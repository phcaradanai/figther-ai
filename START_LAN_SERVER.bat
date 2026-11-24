@echo off
title LOST SAGA 2.5D PIXEL ARENA - LAN SERVER
cd /d "%~dp0"
echo Starting Lost Saga 2.5D LAN Server...
start http://localhost:3000
node server.js
pause
