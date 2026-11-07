param([switch]$Release)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$pythonRuntime = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$godotConsole = Join-Path $env:USERPROFILE 'Desktop/Godot/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe'
if ($env:GODOT_CONSOLE) { $godotConsole = $env:GODOT_CONSOLE }
if ($env:GAME_PYTHON) { $pythonRuntime = $env:GAME_PYTHON }
& $pythonRuntime scripts/prepare_godot_assets.py
if ($LASTEXITCODE -ne 0) { throw 'Asset export failed' }
& $godotConsole --headless --path . --script game/tests_v7.gd
if ($LASTEXITCODE -ne 0) { throw 'Model acceptance failed' }
& $godotConsole --headless --path . --script game/tests_services_v7.gd
if ($LASTEXITCODE -ne 0) { throw 'Advanced gameplay acceptance failed' }
$exportFolder = if ($Release) { 'build/release-web' } else { 'build/web' }
New-Item -ItemType Directory -Force $exportFolder | Out-Null
$exportMode = if ($Release) { '--export-release' } else { '--export-debug' }
& $godotConsole --headless --path . --editor --quit
if ($LASTEXITCODE -ne 0) { throw 'Godot asset import failed' }
& $godotConsole --headless --path . --script game/tests_ui_v7.gd
if ($LASTEXITCODE -ne 0) { throw 'Native UI integration failed' }
& $godotConsole --headless --path . --script game/tests_visibility.gd
if ($LASTEXITCODE -ne 0) { throw 'Visibility and purse checks failed' }
& $godotConsole --headless --path . $exportMode Web ($exportFolder+'/index.html')
if ($LASTEXITCODE -ne 0) { throw 'Godot export failed' }
& $pythonRuntime scripts/prepare_web_shell.py $exportFolder
if ($LASTEXITCODE -ne 0) { throw 'Web interface skin failed' }
if ($Release) {
    & $pythonRuntime scripts/package_godot_web.py
    if ($LASTEXITCODE -ne 0) { throw 'Release packaging failed' }
}
