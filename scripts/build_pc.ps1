param([ValidateSet('preview','windows')][string]$Target='preview',[string]$Creator='C:/Develop/Cocos/Creator/3.8.8/CocosCreator.exe',[switch]$Compile)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$configName=if($Target -eq 'windows'){'pc-windows.json'}else{'pc-preview.json'}
$logRoot=Join-Path $projectRoot 'qa/pc'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$env:ELECTRON_RUN_AS_NODE=$null
# 在 Creator 安装目录启动，确保本机 Electron 与原生依赖按正确目录加载。
$buildArgs=@('--no-sandbox','--disable-gpu','--project',('"'+(Join-Path $projectRoot 'cocos')+'"'),'--build',('"configPath='+(Join-Path $projectRoot ('configs/'+$configName))+'"'))
$process=Start-Process -FilePath $Creator -WorkingDirectory (Split-Path $Creator -Parent) -ArgumentList $buildArgs -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput (Join-Path $logRoot ($Target+'.stdout.log')) -RedirectStandardError (Join-Path $logRoot ($Target+'.stderr.log'))
# Creator 命令行约定 36 表示构建成功，0 兼容普通进程退出；同时检查最终完成标志。
$buildLog=Get-Content -LiteralPath (Join-Path $logRoot ($Target+'.stdout.log')) -Raw
if($process.ExitCode -notin @(0,36) -or $buildLog -notmatch 'build Task .+ Finished in') {throw "Creator build failed: $($process.ExitCode). See qa/pc logs."}
if($Target -eq 'windows' -and $Compile){
    $cmake=Join-Path (Split-Path $Creator -Parent) 'resources/tools/cmake/bin/cmake.exe'
    # Creator 的 VS 后置复制在中文目录创建部分 DLL 时会失败。先用 Unicode 路径 API 预置同版依赖。
    $runtime=Join-Path $projectRoot 'cocos/build/pc-windows-20261107/proj/Release'
    $sdkLibs=Join-Path (Split-Path $Creator -Parent) 'resources/resources/3d/engine/native/external/win64/libs'
    New-Item -ItemType Directory -Path $runtime -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $runtime 'Fonts') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectRoot 'cocos/assets/resources/fonts/GoblinHand.ttf') -Destination (Join-Path $runtime 'Fonts/GoblinHand.ttf') -Force
    foreach($folder in @($sdkLibs,(Join-Path $sdkLibs 'v8/Release'),(Join-Path $sdkLibs 'msvcr'))){
        Get-ChildItem -LiteralPath $folder -File -Filter '*.dll' | ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination $runtime -Force}
    }
    & $cmake --build (Join-Path $projectRoot 'cocos/build/pc-windows-20261107/proj') --config Release --parallel 6
    if($LASTEXITCODE -ne 0){throw 'Windows C++ compilation failed.'}
}
