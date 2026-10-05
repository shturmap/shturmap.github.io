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
| `assets/site.js` | Optional behaviour: the logo moving into the header, the route marker, the drifting contour lines (WebGL), the screenshot loupe and the hero clip's play-while-visible; the page works without it |
| `assets/fonts/` | Barlow Semi Condensed, Barlow and IBM Plex Mono, self-hosted, with their licences |
| `assets/img/` | Screenshots, the hero clip's poster, logo, favicons and the social preview image |
| `assets/video/` | The hero clip |
| `tools/make-media.ps1` | Regenerates all of the media above from the app repository |
| `tools/img.cs` | Composites and crops the app's renders into the screenshots (used by `make-media.ps1`) |
| `tools/check-site.cs` | Checks the page before a commit (see CLAUDE.md, "Verify") |
| `CLAUDE.md` | Working rules and the media routine, for Claude Code and anyone else |

## Media

Every screenshot and the clip are the app's own output in a scripted fake raid on Streets of Tarkov; nothing is
captured from a screen except Shturmap's own window for the clip. When the app changes, regenerate everything with
one command (the app repository is expected next to this one; pass `-App` otherwise):

```powershell
.\tools\make-media.ps1            # all of it; or -Stills, -Video, -Brand for a part
```

It builds the app (its release folder build, `eng\publish.ps1`; Debug builds are developer builds, titled
"Shturmap DEV"), renders, records, encodes and copies, then lists the files and the checks below. It needs the
.NET 10 SDK and, for the clip, ffmpeg (`winget install --id Gyan.FFmpeg -e`). The app opens for each render (on the
second monitor if there is one); leave it alone until the script says it's done, about two minutes.

| File | What it shows | Made by |
| --- | --- | --- |
| `assets/img/raid.webp` | In a raid, 27 minutes in, with the extract list read: the raid card and the whole map (section 02, with the callouts and the loupe) | `fake-raid.ps1 -Window 1600x900 -Scale 2`, map laid in, loading cue and notice removed |
| `assets/img/raid-card.webp` | The raid card from that view at actual size | crop of the same render |
| `assets/img/plan-rail.webp` | Plan in the menus: the map list, Streets first, and what to bring | `fake-raid.ps1 -PlanOnly -Window 1600x1040` (taller, so BRING's rows are in view), crop |
| `assets/img/quest-card.webp` | Ballet Lover's quest card | `fake-raid.ps1 -ShowQuest Ballet` |
| `assets/video/hero.webm`, `hero.mp4` | The hero clip, a demo raid without the game (19 s loop): the window dims and pauses on a large drawn screenshot key; it is pressed, the file name the position comes from appears under it, and as the dim clears the marker moves once, 29 m along Primorsky Ave, and the raid card re-sorts; then a drawn pointer opens Road Closed's card and picks the quest for the raid (cyan, first in the raid card), the map zooms to its places and the card stays up about five seconds; then the pick is undone and the view goes back. The last 0.6 s fade into the first frame, so it loops without a jump | `fake-raid.ps1 -Demo` (the app's `--demo`, recorded by `tools\record-window`) |
| `assets/img/hero-poster.webp` | The clip's first frame, shown before it plays | ffmpeg |
| `assets/img/logo-dark.svg`, `icon.svg`, `social-preview.png`, `favicon.svg`, `favicon.ico`, `apple-touch-icon.png` | The brand | copied from the app repository's `brand/` (and its app icon); the touch icon is `icon-512.png` at 180 px |

The stills are rendered at twice the pixel density and shown at half their pixel size (the `width` and `height` in
`index.html`), so they stay sharp on high-DPI screens. Interface crops are lossless WebP; the whole raid view and
the clip are lossy because they are mostly map. The script's comments, and the one at the top of `tools/img.cs`,
explain each step and the crop rectangles.

After re-recording, check by hand:

- **The numbered callouts** on `raid.webp` in `index.html`: their `left`/`top` are percent positions on the image.
  Find a spot's pixels with `dotnet run tools/img.cs '--' sample <png> x y`, then divide by 3168 x 1722.
- **Text that quotes the images**, which must match the new ones: the raid card's alt text ("next objective 30 m
  ahead-left, the nearest extract on your list 138 m behind"), Plan's ("Streets of Tarkov first, five quests to complete and one
  to progress") and the quest card's ("the objective 294 m to the left and 8 m up"), the hero clip's `aria-label` (the quest
  it points at) and the figure captions.
- **The crop rectangles** in `make-media.ps1`, if the rail's layout moved.
- **The `width` and `height` attributes** in `index.html`, if an image or the clip changed size.
- **The clip:** play it through once. The key press must come before the marker moves, the marker must move only once, and the loop must not jump.

## Launch

The site goes up before the app is released, as a preview. At launch, remove everything marked
`PREVIEW: remove at launch`:

- **The preview banner:** the block at the top of `<body>` in `index.html` and its rules in `assets/site.css`.
- **`<meta name="robots" content="noindex">`** in the `<head>` of `index.html`, so search engines may list the site.

The "Get it on GitHub" links work once the app repository is public.

## Licence

The site's code and text are under the [MIT licence](LICENSE).

The MIT licence does not cover:

- **Screenshots and the clip.** They contain map artwork © Shebuka and contributors
  ([CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)) and Battlestate Games' art.
- **Fonts.** They are under the SIL Open Font License 1.1: `assets/fonts/OFL-Barlow.txt` and
  `assets/fonts/OFL-IBMPlexMono.txt`.
- **The Shturmap name and logo.** They identify the project.

Escape from Tarkov is a trademark of Battlestate Games. Shturmap is unofficial and unaffiliated.
