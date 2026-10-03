# Regenerates every screenshot, the hero clip and the brand files this site uses, from the Shturmap app repository.
# Usage: .\tools\make-media.ps1 [-App ..\Shturmap] [-Stills] [-Video] [-Brand]    (no switch: all three)
#   -Stills  assets\img\raid.webp, raid-card.webp, plan-rail.webp, quest-card.webp
#   -Video   assets\video\hero.webm, hero.mp4 and assets\img\hero-poster.webp
#   -Brand   assets\img\logo-dark.svg, icon.svg, social-preview.png, favicon.svg, favicon.ico, apple-touch-icon.png
# Needs the .NET 10 SDK (found by the app repo's eng\dotnet.ps1) and, for the clip, ffmpeg
# (winget install --id Gyan.FFmpeg -e). The app opens for each render, on the second monitor if there is one; the clip
# is recorded from Shturmap's own window only (the app repo's tools\record-window). See README.md, "Media".
param(
  [string] $App,
  [switch] $Stills,
  [switch] $Video,
  [switch] $Brand,
  [string] $Ffmpeg
)
$ErrorActionPreference = 'Stop'
$site = Split-Path $PSScriptRoot -Parent
if (-not $App) { $App = Join-Path $site '..\Shturmap' }
$App = (Resolve-Path $App).Path
if (-not ($Stills -or $Video -or $Brand)) { $Stills = $true; $Video = $true; $Brand = $true }
$dotnet = Join-Path $App 'eng\dotnet.ps1'
$fakeRaid = Join-Path $App 'tools\fake-raid.ps1'
$img = Join-Path $site 'assets\img'
$videoDir = Join-Path $site 'assets\video'
$work = Join-Path ([IO.Path]::GetTempPath()) ('shturmap-media-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force $work, $videoDir | Out-Null

# The site's image tool (composite, crop); '--' is quoted so PowerShell passes it on.
function ImgTool {
  & $dotnet run (Join-Path $site 'tools\img.cs') '--' @args | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "tools\img.cs $($args[0]) failed." }
}

if ($Stills -or $Video) {
  # The release's folder build (eng\publish.ps1), never a Debug build: Debug builds are developer builds now, titled
  # "Shturmap DEV" with a cyan icon and the developer tools, and the clip records the whole window.
  Write-Output 'Building the app (release folder build)...'
  & (Join-Path $App 'eng\publish.ps1') | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'The app did not build.' }
  $exe = Join-Path $App 'artifacts\Shturmap\Shturmap.exe'
}

if ($Stills) {
  # Three fake raids on Streets at 1600x900, rendered at twice the pixel density, in English.
  $raid = Join-Path $work 'raid'; $plan = Join-Path $work 'plan'; $quest = Join-Path $work 'quest'
  Write-Output 'Rendering the raid view...'
  & $fakeRaid -Exe $exe -Out $raid -Window 1600x900 -Scale 2 | Out-Null
  Write-Output 'Rendering Plan...'
  & $fakeRaid -Exe $exe -Out $plan -Window 1600x900 -Scale 2 -PlanOnly | Out-Null
  Write-Output 'Rendering a quest card...'
  & $fakeRaid -Exe $exe -Out $quest -Window 1600x900 -Scale 2 -ShowQuest Ballet | Out-Null
  # The snapshot draws the map apart from the window: lay it in, without the loading cue and notice it keeps up. The
  # cue's band (with the kit's picture row since 2026-10-03) spans rows 644-1157 at 2x. The floor picker (x 2956-3135
  # from row 1070) stays: beside it only the band's bottom line goes, above it the whole band.
  ImgTool composite "$raid\window.png" "$raid\map.png" "$work\raid.png" 768 80 ex '1080,104,1780,120' ex '768,640,2188,522' ex '2956,640,212,428' ex '3136,1150,32,12'
  ImgTool composite "$plan\window.png" "$plan\map.png" "$work\plan.png" 768 80
  # Quality 100 is lossless WebP: interface text stays sharp. The whole raid view is mostly map, so lossy.
  ImgTool crop "$work\raid.png" "$img\raid.webp" 0 0 3168 1722 3168 88
  ImgTool crop "$work\raid.png" "$img\raid-card.webp" 0 250 768 1010 768 100
  ImgTool crop "$work\plan.png" "$img\plan-rail.webp" 0 240 768 1400 768 100
  ImgTool crop "$quest\card.png" "$img\quest-card.webp" 0 0 720 634 720 100
}

if ($Video) {
  if ($Ffmpeg) { $ffmpegExe = $Ffmpeg }
  elseif (Get-Command ffmpeg -ErrorAction SilentlyContinue) { $ffmpegExe = (Get-Command ffmpeg).Source }
  else {
    $ffmpegExe = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages') -Recurse -Filter ffmpeg.exe -ErrorAction SilentlyContinue |
      Select-Object -First 1 -ExpandProperty FullName
  }
  if (-not $ffmpegExe) { throw 'ffmpeg not found: winget install --id Gyan.FFmpeg -e, or pass -Ffmpeg.' }
  $demo = Join-Path $work 'demo'
  Write-Output 'Recording the hero clip (about a minute)...'
  & $fakeRaid -Exe $exe -Out $demo -Demo -Ffmpeg $ffmpegExe | Out-Null
  $invariant = [Globalization.CultureInfo]::InvariantCulture
  $cut = (Get-Content (Join-Path $demo 'cut.txt')) -split ' '
  $length = [double]::Parse($cut[1], $invariant) - [double]::Parse($cut[0], $invariant)
  $cutOut = Join-Path $demo 'cut.mkv'; $first = Join-Path $demo 'first.png'; $loop = Join-Path $demo 'loop.mkv'
  # Options with a colon (-c:v) are quoted: PowerShell would read them as its own parameters.
  function Ffmpeg { & $ffmpegExe -hide_banner -loglevel error -y @args; if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed: $args" } }
  # The loop, cut out of the recording losslessly first. The position changes once in it (the key press), so its end
  # and start differ in the marker and the raid card: the last 0.6 s fade into the first frame, and it loops without
  # a jump. Then it is encoded twice for the web, without sound.
  Ffmpeg -i (Join-Path $demo 'capture.mkv') -vf "trim=start=$($cut[0]):end=$($cut[1]),setpts=PTS-STARTPTS" '-c:v' libx264rgb -preset ultrafast -qp 0 $cutOut
  Ffmpeg -i $cutOut '-frames:v' 1 $first
  $fadeAt = ($length - 0.6).ToString('0.000', $invariant)
  Ffmpeg -i $cutOut -loop 1 -framerate 30 -t 0.6 -i $first -filter_complex "[0:v]format=gbrp,fps=30,settb=1/30[a];[1:v]format=gbrp,fps=30,settb=1/30[b];[a][b]xfade=transition=fade:duration=0.6:offset=$fadeAt" '-c:v' libx264rgb -preset ultrafast -qp 0 $loop
  Ffmpeg -i $loop -vf format=yuv420p '-c:v' libvpx-vp9 -crf 38 '-b:v' 0 -row-mt 1 -deadline good -cpu-used 2 -g 60 -an (Join-Path $videoDir 'hero.webm')
  Ffmpeg -i $loop -vf format=yuv420p '-c:v' libx264 '-profile:v' high -preset slow -crf 26 -tune stillimage -g 60 -movflags +faststart -an (Join-Path $videoDir 'hero.mp4')
  Ffmpeg -i $first '-c:v' libwebp -quality 85 (Join-Path $img 'hero-poster.webp')
}

if ($Brand) {
  Write-Output 'Copying the brand files...'
  $brandDir = Join-Path $App 'brand'
  Copy-Item (Join-Path $brandDir 'logo-dark.svg'), (Join-Path $brandDir 'icon.svg'), (Join-Path $brandDir 'social-preview.png') $img
  Copy-Item (Join-Path $brandDir 'icon-small.svg') (Join-Path $img 'favicon.svg')
  Copy-Item (Join-Path $App 'src\Shturmap.App\Assets\Shturmap.ico') (Join-Path $img 'favicon.ico')
  ImgTool crop (Join-Path $brandDir 'icon-512.png') (Join-Path $img 'apple-touch-icon.png') 0 0 512 512 180
}

Remove-Item -Recurse -Force -LiteralPath $work -ErrorAction SilentlyContinue

Write-Output ''
Write-Output 'Files:'
Get-ChildItem $img, $videoDir -File | Sort-Object FullName | ForEach-Object {
  Write-Output ('  {0,-36} {1,8:N0} KB' -f $_.FullName.Substring($site.Length + 1), ($_.Length / 1KB))
}
Write-Output ''
Write-Output 'Check by hand (README.md, "Media"):'
Write-Output '  - the numbered callouts on raid.webp in index.html (percent positions; find them with img.cs sample)'
Write-Output '  - alt texts and captions that quote the images: "69 m ahead-left", "five quests to complete and one to progress",'
Write-Output '    the quest card "300 m ahead and 9 m up", the raid card "94 m to the right"'
Write-Output '  - the crop rectangles above, if the rail moved'
Write-Output '  - the width and height attributes in index.html, if an image or the clip changed size'
Write-Output '  - the clip: play it through once; it should loop without a jump'
