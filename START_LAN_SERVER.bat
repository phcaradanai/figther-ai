@echo off
title LOST SAGA 3D ARENA - LAN SERVER
cd /d "%~dp0"
echo Starting Lost Saga 3D LAN Server...
start http://localhost:3000/
node server.js
pause
