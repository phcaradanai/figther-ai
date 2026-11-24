@echo off
setlocal enabledelayedexpansion

echo ============================================================================
echo  LOST SAGA 3D - EFFEKSEER 1.80.8 ALL HEROES VFX BUILD & WEBGL SYNC TOOL
echo ============================================================================
echo.

set "REPO_ROOT=%~dp0.."
set "EFFEKSEER_DIR=C:\Users\phcar\Downloads\Effekseer1.80.8Win"
set "WEBGL_DIR=C:\Users\phcar\Downloads\EffekseerForWebGL1.80.8"

if not "%~1"=="" set "EFFEKSEER_DIR=%~1"
if not "%~2"=="" set "WEBGL_DIR=%~2"

set "VFX_ROOT=%REPO_ROOT%\public\assets\vfx"
set "VENDOR_DIR=%REPO_ROOT%\public\vendor\effekseer"

if not exist "%VENDOR_DIR%" mkdir "%VENDOR_DIR%"

REM 1. Locate Effekseer.exe
set "EFFEKSEER_EXE="
if exist "%EFFEKSEER_DIR%\Tool\Effekseer.exe" set "EFFEKSEER_EXE=%EFFEKSEER_DIR%\Tool\Effekseer.exe"
if not defined EFFEKSEER_EXE if exist "%EFFEKSEER_DIR%\Effekseer.exe" set "EFFEKSEER_EXE=%EFFEKSEER_DIR%\Effekseer.exe"
if not defined EFFEKSEER_EXE (
    for /r "%EFFEKSEER_DIR%" %%E in (Effekseer.exe) do (
        if not defined EFFEKSEER_EXE set "EFFEKSEER_EXE=%%E"
    )
)

if not defined EFFEKSEER_EXE (
    echo [ERROR] Effekseer.exe not found inside: "%EFFEKSEER_DIR%"
    pause
    exit /b 1
)
echo [1/3] Found Effekseer Editor: "%EFFEKSEER_EXE%"

REM 2. Sync EffekseerForWebGL runtime
echo [2/3] Syncing EffekseerForWebGL runtime to public\vendor\effekseer\ ...
set "COPIED_JS=0"
set "COPIED_WASM=0"
for /r "%WEBGL_DIR%" %%F in (effekseer.min.js) do (
    if "!COPIED_JS!"=="0" (
        copy /y "%%F" "%VENDOR_DIR%\effekseer.min.js" >nul
        set "COPIED_JS=1"
    )
)
for /r "%WEBGL_DIR%" %%F in (effekseer.wasm) do (
    if "!COPIED_WASM!"=="0" (
        copy /y "%%F" "%VENDOR_DIR%\effekseer.wasm" >nul
        set "COPIED_WASM=1"
    )
)

REM 3. Compile all hero .efkproj files under public\assets\vfx\*\ using full absolute paths
echo [3/3] Compiling all hero .efkproj -^> .efkefc ...
set "COMPILED=0"
for /d %%H in ("%VFX_ROOT%\*") do (
    echo   --- Hero: %%~nxH ---
    for %%F in ("%%H\*.efkproj") do (
        set "IN_FILE=%%~fF"
        set "OUT_EFKEFC=%%~dpnF.efkefc"
        set "OUT_EFK=%%~dpnF.efk"
        echo       Compiling %%~nxF ...
        "%EFFEKSEER_EXE%" -cui -in "!IN_FILE!" -o "!OUT_EFKEFC!"
        if not exist "!OUT_EFKEFC!" (
            "%EFFEKSEER_EXE%" -cui -in "!IN_FILE!" -e "!OUT_EFK!"
        )
        if exist "!OUT_EFKEFC!" (
            echo       [OK] %%~nF.efkefc
            set /a COMPILED+=1
        ) else if exist "!OUT_EFK!" (
            echo       [OK] %%~nF.efk
            set /a COMPILED+=1
        ) else (
            echo       [FAIL] %%~nxF ^(exit=!ERRORLEVEL!^)
        )
    )
)

echo.
echo ============================================================================
echo  DONE! Compiled !COMPILED! hero Effekseer runtime effects.
echo ============================================================================
pause
