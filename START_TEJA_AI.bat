@echo off
setlocal
title TEJA AI Launcher v2.0
cd /d "%~dp0"
where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  set "PYTHON=py"
) else (
  where python >nul 2>nul
  if %ERRORLEVEL% EQU 0 (
    set "PYTHON=python"
  ) else (
    echo Python not found. Install Python 3.9 or newer from https://www.python.org/downloads/
    echo During installation select "Add Python to PATH".
    pause
    exit /b 1
  )
)
echo =============================================
echo Starting TEJA AI v2.0 local server...
echo If no API keys are set, TEJA will open in Demo Mode.
echo To connect ChatGPT/Gemini/Claude/DeepSeek, read README.md.
echo =============================================
start "TEJA AI Server - KEEP THIS OPEN" cmd /k "%PYTHON% server.py"
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:8000/"
echo Browser opened at http://127.0.0.1:8000/
echo Keep the TEJA AI Server window running to use the assistant.
pause
