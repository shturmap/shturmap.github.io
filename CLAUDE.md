# shturmap.github.io

The website of Shturmap, a second-monitor map for Escape from Tarkov (the app is in `..\Shturmap`). Plain static
HTML, CSS and JS, served by GitHub Pages at https://shturmap.github.io. README.md has the details; this file is the
working rules.

## Rules

- **No third-party requests.** Fonts, images and video are served from this repository; no CDNs, analytics or
  embeds. External URLs may only be links and the canonical/og URLs (`tools/check-site.cs` lists them all).
- **Every claim literally true** of the app as it is. It reads screenshot file names and, of a screenshot taken in a raid, the top right corner of its picture for the
  game's extract list (on the PC, with Windows' text recognition; nothing of the picture kept or sent; a setting turns
  it off), the
  application and push-notification logs, Control.ini and Game.ini, where the game is installed, and public
  tarkov.dev data; it sends no input, and quest status comes only from the game's logs (an objective can be ticked
  by hand). Three things need their exact words, as in the app's README: its own code opens no handle to the game,
  but its installer (Velopack) asks Windows about every running program; it deletes nothing outside its folders
  except with "Delete position screenshots" ticked; and on The Lab, Labyrinth and Icebreaker the tile requests can
  show roughly where the player looks. Don't write "only" where it isn't (it also downloads tarkov.dev data).
  Check numbers in alt texts and captions against the images.
- **Sober wording**: no superlatives, no exclamation marks, never "cheat"; say what it reads and what it never does.
- **Credits**: "Map © Shebuka and contributors, CC BY-NC-SA 4.0" under every image or clip that shows a map; the
  footer keeps the Battlestate, tarkov.dev and TarkovEyes credits.
- **Testing notice**: the preview banner and `noindex` came out on 2026-10-09 (owner). The notice at the top says
  Shturmap is in private testing; it goes when testing ends, with the app README's note (README.md, "Testing notice").
- **Committing and pushing** as `shturmap`: the author, the signing key and the GitHub login (through `gh`) all come
  from the repository's git config; write the message to a file and use `git commit -F <file>`. Every commit is
  signed with `shturmap`'s SSH key; never commit or push with another identity or GitHub login (owner, 2026-10-07).

## Regenerate the media

When the app's UI changes, redo every screenshot, the hero clip and the brand files with one command:

```powershell
.\tools\make-media.ps1            # all; or -Stills, -Video, -Brand
```

- **Needs**: the app repository as the sibling folder `..\Shturmap` (or pass `-App`); the .NET 10 SDK, found by
  `..\Shturmap\eng\dotnet.ps1`; ffmpeg (`winget install --id Gyan.FFmpeg -e`). The scripts find ffmpeg on PATH or
  in `%LOCALAPPDATA%\Microsoft\WinGet\Packages`, or take `-Ffmpeg <path>`. The app opens on screen for about two
  minutes; leave it alone.
- **Outputs** (README.md, "Media", has the table): `assets/img/raid.webp`, `raid-card.webp` (a raid on Streets at
  position B), `plan-rail.webp` (Plan in the menus), `quest-card.webp` (Ballet Lover's card), `assets/video/hero.webm`
  and `hero.mp4` with `assets/img/hero-poster.webp` (the demo clip), and the brand files copied from `..\Shturmap\brand`.
- **The clip's timeline** lives in the app: `src/Shturmap.App/Demo.cs` (what happens, and when) and
  `tools\fake-raid.ps1 -Demo` (the two positions, the one screenshot after the key press, the cut points);
  `make-media.ps1` does the crossfade and the encoding. The clip's rules (DESIGN.md §8 in the app): the position
  changes once, visibly after the drawn key press, and the loop never jumps back.
- **Changing the demo quest**: `-DemoQuest` in `fake-raid.ps1` (default "Road Closed"); then also the video's
  `aria-label` in `index.html` and the clip's row in README.md, which name it.

**Capture rule**: the clip is recorded from Shturmap's own window only (`..\Shturmap\tools\record-window`, Windows
Graphics Capture on that window, no cursor). Never record or screenshot a monitor, the desktop or another window,
and never capture anything for routine checks: use the app's `--snapshot` and the files themselves.

## After re-recording, check by hand

- **Callouts** on `raid.webp` in `index.html`: `left`/`top` are percents of the image. Find pixels with
  `..\Shturmap\eng\dotnet.ps1 run tools/img.cs '--' sample <png> x y` and divide by 3168 x 1722.
- **Text that quotes the images**: the alt texts and captions with numbers ("30 m ahead-left", "138 m
  behind", "five quests to complete and one to progress", "294 m to the left and 8 m up") and the clip's `aria-label`.
- **Crop rectangles** in `make-media.ps1`, if the app's rail moved.
- **`width` and `height`** in `index.html`, if an image or the clip changed size.
- **The app's README** embeds `https://shturmap.github.io/assets/img/raid.webp` and repeats the hero's wording: keep
  that path, and keep the README's description of the screenshot true.
- **The clip**: the key press before the marker moves, one move only, no jump at the loop.

## Verify

```powershell
..\Shturmap\eng\dotnet.ps1 run tools/check-site.cs '--' .    # HTML, references, JS syntax, external URLs; exit 1 on problems
```

Look at frames with ffmpeg rather than playing the video, e.g.
`ffmpeg -ss 2.4 -i assets/video/hero.mp4 -frames:v 1 frame.png` (quote `'-frames:v'` in PowerShell), and compare the
first and last frame for the loop seam. Nothing is verified in a browser from here: say so when reporting.
