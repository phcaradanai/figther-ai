@echo off
setlocal enabledelayedexpansion

echo ============================================================================
echo  LOST SAGA 3D - IRON KNIGHT EFFEKSEER 1.80.8 BUILD & WEBGL SYNC TOOL
echo ============================================================================
echo.

set "REPO_ROOT=%~dp0.."
set "EFFEKSEER_DIR=C:\Users\phcar\Downloads\Effekseer1.80.8Win"
set "WEBGL_DIR=C:\Users\phcar\Downloads\EffekseerForWebGL1.80.8"

if not "%~1"=="" set "EFFEKSEER_DIR=%~1"
if not "%~2"=="" set "WEBGL_DIR=%~2"

set "VFX_DIR=%REPO_ROOT%\public\assets\vfx\knight"
set "VENDOR_DIR=%REPO_ROOT%\public\vendor\effekseer"

if not exist "%VENDOR_DIR%" mkdir "%VENDOR_DIR%"

REM ----------------------------------------------------------------------------
REM 1. Locate Effekseer.exe
REM ----------------------------------------------------------------------------
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
    echo         Usage: build_knight_vfx.bat "C:\path\to\Effekseer1.80.8Win" "C:\path\to\EffekseerForWebGL1.80.8"
    pause
    exit /b 1
)
echo [1/3] Found Effekseer Editor: "%EFFEKSEER_EXE%"

REM ----------------------------------------------------------------------------
REM 2. Copy EffekseerForWebGL runtime (effekseer.min.js + effekseer.wasm)
REM ----------------------------------------------------------------------------
echo [2/3] Syncing EffekseerForWebGL runtime to public\vendor\effekseer\ ...
set "COPIED_JS=0"
set "COPIED_WASM=0"

for /r "%WEBGL_DIR%" %%F in (effekseer.min.js) do (
    if "!COPIED_JS!"=="0" (
        copy /y "%%F" "%VENDOR_DIR%\effekseer.min.js" >nul
        echo       Copied: %%F
        set "COPIED_JS=1"
    )
)
if "%COPIED_JS%"=="0" (
    for /r "%WEBGL_DIR%" %%F in (effekseer.js) do (
        if "!COPIED_JS!"=="0" (
            copy /y "%%F" "%VENDOR_DIR%\effekseer.min.js" >nul
            echo       Copied: %%F -^> effekseer.min.js
            set "COPIED_JS=1"
        )
    )
)

for /r "%WEBGL_DIR%" %%F in (effekseer.wasm) do (
    if "!COPIED_WASM!"=="0" (
        copy /y "%%F" "%VENDOR_DIR%\effekseer.wasm" >nul
        echo       Copied: %%F
        set "COPIED_WASM=1"
    )
)

if "%COPIED_JS%"=="0" echo [WARN] effekseer.min.js not found in "%WEBGL_DIR%"
if "%COPIED_WASM%"=="0" echo [WARN] effekseer.wasm not found in "%WEBGL_DIR%"

REM ----------------------------------------------------------------------------
REM 3. Compile all 7 Knight .efkproj source files into .efkefc runtime files
REM    (Pass FULL absolute paths because Effekseer.exe resets its CWD on start!)
REM ----------------------------------------------------------------------------
echo [3/3] Compiling Knight .efkproj -^> .efkefc ...
set "COMPILED=0"
for %%F in ("%VFX_DIR%\*.efkproj") do (
    set "IN_FILE=%%~fF"
    set "OUT_EFKEFC=%%~dpnF.efkefc"
    set "OUT_EFK=%%~dpnF.efk"
    echo       Compiling %%~nxF ...
    "%EFFEKSEER_EXE%" -cui -in "!IN_FILE!" -o "!OUT_EFKEFC!"
    if not exist "!OUT_EFKEFC!" (
        echo       [Fallback] Exporting .efk via -e ...
        "%EFFEKSEER_EXE%" -cui -in "!IN_FILE!" -e "!OUT_EFK!"
    )
    if exist "!OUT_EFKEFC!" (
        echo       [OK] Created %%~nF.efkefc
        set /a COMPILED+=1
    ) else if exist "!OUT_EFK!" (
        echo       [OK] Created %%~nF.efk
        set /a COMPILED+=1
    ) else (
        echo       [FAIL] Could not compile %%~nxF ^(exit=!ERRORLEVEL!^)
    )
)

echo.
echo ============================================================================
echo  DONE! Compiled !COMPILED! .efkefc effects in:
echo    %VFX_DIR%
echo.
echo  Next step:
echo    1. Start server: START_LAN_SERVER.bat (or: node server.js)
echo    2. Open preview: http://localhost:3000/knight_vfx_preview.html
echo    3. Or open any .efkproj / .efkefc directly in Effekseer 1.80.8 to tweak!
echo ============================================================================
pause
