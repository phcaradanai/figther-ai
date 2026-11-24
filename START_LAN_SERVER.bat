@echo off
title LOST SAGA 3D PIXEL ARENA - LAN SERVER (feat/knight-effekseer-vfx)
cd /d "%~dp0"
echo Starting Lost Saga 3D LAN Server (Iron Knight Effekseer VFX Branch)...
start http://localhost:3000/?renderer=3d
node server.js
pause
