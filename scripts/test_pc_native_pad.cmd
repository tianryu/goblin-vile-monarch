@echo off
setlocal
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" >nul
if errorlevel 1 exit /b 1
pushd "%~dp0.."
if not exist "artifacts\pc-controller-20261107" mkdir "artifacts\pc-controller-20261107"
cl /nologo /EHsc /std:c++17 "scripts\test_xinput_mapping.cpp" /Fo"artifacts\pc-controller-20261107\xinput-test.obj" /Fe"artifacts\pc-controller-20261107\xinput-test.exe"
if errorlevel 1 exit /b 1
"artifacts\pc-controller-20261107\xinput-test.exe" >"artifacts\pc-controller-20261107\xinput-fixtures.jsonl"
popd
