# shturmap.github.io

The website of [Shturmap](https://github.com/shturmap/shturmap), a second-monitor map for Escape from Tarkov. It is
served by GitHub Pages at <https://shturmap.github.io>.

It's plain static HTML, CSS and JS, with no build step and no third-party requests: fonts and images are served
from this repository.

## Preview

Open `index.html` in a browser, or serve the folder:

```powershell
python -m http.server 8000   # then open http://localhost:8000
```

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The page |
| `assets/site.css` | Styles; the colours and shapes follow the app (Shturmap `docs/DESIGN.md`) |
| `assets/site.js` | Optional behaviour: the logo moving into the header, the route marker, the drifting contour lines (WebGL) and the screenshot loupe; the page works without it |
| `assets/fonts/` | Barlow Semi Condensed, Barlow and IBM Plex Mono, self-hosted, with their licences |
| `assets/img/` | Screenshots, logo, favicons and the social preview image |
| `tools/img.cs` | Composites and crops the app's renders into the screenshots |

## Media

The screenshots are the app's own renders, made in the Shturmap app repository with a scripted raid:

```powershell
.\tools\fake-raid.ps1 -Exe <Shturmap.exe> -Out <folder> -Window 1600x900 -Scale 2 [-PlanOnly] [-ShowQuest Ballet]
```

`-Scale 2` renders at twice the pixel density, so the screenshots stay sharp on high-DPI screens; the page shows
them at half their pixel size (the `width` and `height` in `index.html`).

The snapshot renders the map apart from the window, so `tools/img.cs` here lays it in and crops the result (it
needs the .NET 10 SDK):

```powershell
dotnet run tools/img.cs '--' composite window.png map.png raid.png 768 80 ex '1080,104,1780,120' ex '768,684,2180,436' ex '2948,684,220,14'
dotnet run tools/img.cs '--' crop raid.png assets/img/raid.webp 0 0 3168 1722 3168 88
dotnet run tools/img.cs '--' crop raid.png assets/img/raid-card.webp 0 250 768 1010 768 100
dotnet run tools/img.cs '--' crop plan.png assets/img/plan-rail.webp 0 240 768 1400 768 100
dotnet run tools/img.cs '--' crop card.png assets/img/quest-card.webp 0 0 720 634 720 100
```

In PowerShell, quote `--` and the comma lists, or they don't reach the tool. Quality 100 writes lossless WebP, which
keeps the interface text sharp; the full raid view is lossy (88) because it is mostly map.

The comment at the top of `tools/img.cs` explains each command. The `ex` rectangles remove the loading cue and
notice that a snapshot keeps on screen. If you move a screenshot's contents, also move its numbered callouts in
`index.html`.

## Launch

The site goes up before the app is released, as a preview. At launch, remove everything marked
`PREVIEW: remove at launch`:

- **The preview banner:** the block at the top of `<body>` in `index.html` and its rules in `assets/site.css`.
- **`<meta name="robots" content="noindex">`** in the `<head>` of `index.html`, so search engines may list the site.

The "Get it on GitHub" links work once the app repository is public.

## Licence

The site's code and text are under the [MIT licence](LICENSE).

The MIT licence does not cover:

- **Screenshots.** They contain map artwork © Shebuka and contributors
  ([CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)) and Battlestate Games' art.
- **Fonts.** They are under the SIL Open Font License 1.1: `assets/fonts/OFL-Barlow.txt` and
  `assets/fonts/OFL-IBMPlexMono.txt`.
- **The Shturmap name and logo.** They identify the project.

Escape from Tarkov is a trademark of Battlestate Games. Shturmap is unofficial and unaffiliated.
