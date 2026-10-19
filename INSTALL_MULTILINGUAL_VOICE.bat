@echo off
setlocal
title TEJA AI - Install Multilingual Voice
cd /d "%~dp0"
where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  set "PYTHON=py"
) else (
  where python >nul 2>nul
  if %ERRORLEVEL% EQU 0 (
    set "PYTHON=python"
  ) else (
    echo Python not found. Install Python 3.9+ first.
    pause
    exit /b 1
  )
)
echo =============================================
echo TEJA AI Multilingual Voice Installation
 echo This optional voice engine uses internet speech services.
echo The installed package will not change your existing Ollama model.
echo =============================================
%PYTHON% -m pip install --user --upgrade edge-tts
if errorlevel 1 (
  echo.
  echo Installation failed. Check internet and pip availability.
  echo You can try: py -m ensurepip --upgrade
  pause
  exit /b 1
)
echo.
%PYTHON% -c "import edge_tts; print('Multilingual voice package installed successfully.')"
if errorlevel 1 (
  echo Package installation verification failed.
  pause
  exit /b 1
)
echo.
echo Restart TEJA AI server. Select Engine: Multilingual online.
pause
