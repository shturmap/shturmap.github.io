#:package SkiaSharp@4.153.1
// Prepares the site's screenshots from the app's own renders (see README.md, "Media").
// Run from the repository root: dotnet run tools/img.cs -- <command> ...
//
//   sample <png> x y [x y ...]
//       Prints the colour of each pixel, to find coordinates for callouts or exclusions.
//
//   composite <window.png> <map.png> <out.png> mapX mapY [ex x,y,w,h ...]
//       The app's snapshot renders the map separately (the window shows it black). Lays map.png under the
//       window's empty map area at mapX, mapY (384, 40 for a 1600x900 window; 768, 80 at -Scale 2). Every "ex" rectangle is taken
//       from the map regardless, to remove what the snapshot holds on screen over it (the RAID LOADING cue,
//       the loading notice).
//
//   crop <in> <out> x y w h [width] [quality]
//       Crops, scales to width (default: w, no scaling) and encodes by the output's extension:
//       .webp or .jpg at quality (default 82; 100 is lossless WebP), anything else as PNG.
using SkiaSharp;

switch (args.Length > 0 ? args[0] : "")
{
    case "sample":
    {
        using var bmp = SKBitmap.Decode(args[1]);
        Console.WriteLine($"{bmp.Width}x{bmp.Height}");
        for (int i = 2; i + 1 < args.Length; i += 2)
        {
            var c = bmp.GetPixel(int.Parse(args[i]), int.Parse(args[i + 1]));
            Console.WriteLine($"{args[i]},{args[i + 1]}: #{c.Red:X2}{c.Green:X2}{c.Blue:X2}");
        }
        break;
    }
    case "composite":
    {
        using var win = SKBitmap.Decode(args[1]);
        using var map = SKBitmap.Decode(args[2]);
        int mx = int.Parse(args[4]), my = int.Parse(args[5]);
        var excludes = new List<SKRectI>();
        for (int i = 6; i + 1 < args.Length; i += 2)
            if (args[i] == "ex")
            {
                var p = args[i + 1].Split(',').Select(int.Parse).ToArray();
                excludes.Add(SKRectI.Create(p[0], p[1], p[2], p[3]));
            }
        // The empty map colour is whatever the window shows inside the map panel, away from the overlays.
        var empty = win.GetPixel(mx + map.Width - 400, my + 300);
        using var outBmp = win.Copy();
        for (int y = 0; y < map.Height && my + y < win.Height; y++)
            for (int x = 0; x < map.Width && mx + x < win.Width; x++)
            {
                int wx = mx + x, wy = my + y;
                var w = win.GetPixel(wx, wy);
                bool isEmpty = Math.Abs(w.Red - empty.Red) <= 2 && Math.Abs(w.Green - empty.Green) <= 2 && Math.Abs(w.Blue - empty.Blue) <= 2;
                if (isEmpty || excludes.Any(r => r.Contains(wx, wy)))
                    outBmp.SetPixel(wx, wy, map.GetPixel(x, y));
            }
        Save(outBmp, args[3], 95);
        Console.WriteLine($"{args[3]}: {outBmp.Width}x{outBmp.Height}");
        break;
    }
    case "crop":
    {
        using var src = SKBitmap.Decode(args[1]);
        int x = int.Parse(args[3]), y = int.Parse(args[4]), w = int.Parse(args[5]), h = int.Parse(args[6]);
        int width = args.Length > 7 ? int.Parse(args[7]) : w;
        int quality = args.Length > 8 ? int.Parse(args[8]) : 82;
        int height = (int)Math.Round(h * (double)width / w);
        using var dst = new SKBitmap(width, height);
        using (var c = new SKCanvas(dst))
        {
            using var img = SKImage.FromBitmap(src);
            c.DrawImage(img, SKRect.Create(x, y, w, h), SKRect.Create(0, 0, width, height), new SKSamplingOptions(SKCubicResampler.Mitchell));
        }
        Save(dst, args[2], quality);
        Console.WriteLine($"{args[2]}: {width}x{height}, {new FileInfo(args[2]).Length / 1024} KB");
        break;
    }
    default:
        Console.WriteLine("Commands: sample, composite, crop. See the comment at the top of tools/img.cs.");
        break;
}

static void Save(SKBitmap bmp, string path, int quality)
{
    var format = Path.GetExtension(path).ToLowerInvariant() switch
    {
        ".webp" => SKEncodedImageFormat.Webp,
        ".jpg" or ".jpeg" => SKEncodedImageFormat.Jpeg,
        _ => SKEncodedImageFormat.Png,
    };
    using var img = SKImage.FromBitmap(bmp);
    using var data = img.Encode(format, quality);
    File.WriteAllBytes(path, data.ToArray());
}
