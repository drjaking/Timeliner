@echo off
title UCL Longitudinal Programme Sequencer — LAN Server
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% equ 0 (
    set "NODE_EXE=node"
) else if exist "%ProgramFiles%\nodejs\node.exe" (
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
    set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
) else if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
    set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
) else if exist "%~dp0.node\node.exe" (
    set "PATH=%~dp0.node;%PATH%"
    set "NODE_EXE=%~dp0.node\node.exe"
) else (
    echo [ERROR] Node.js was not found on PATH or standard install locations.
    pause
    exit /b 1
)

"%NODE_EXE%" --no-warnings --experimental-sqlite server.cjs
pause
