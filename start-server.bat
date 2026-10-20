@echo off
title UCL Longitudinal Programme Sequencer — LAN Server
cd /d "%~dp0"
node --no-warnings --experimental-sqlite server.cjs
pause
