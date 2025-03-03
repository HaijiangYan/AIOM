@echo off
SETLOCAL EnableExtensions EnableDelayedExpansion

echo ==========================================================
echo AIOM -- a platform of Markov Chain Monte Carlo with People
echo ==========================================================

REM Check if Node.js is installed
echo Checking if Node.js is installed...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Node.js is not installed or not in PATH. Please install Node.js.
    echo Visit https://nodejs.org/en/download/ to download and install Node.js.
    pause
    exit /b 1
)

echo Node.js is installed: 
node --version

REM Check if required npm packages are installed
echo Checking required npm packages...
cd /d "%~dp0"

REM Check if package.json exists
if not exist package.json (
    echo Error: package.json not found. Please make sure you're running this script from the project root directory.
    pause
    exit /b 1
)

REM Install dependencies if node_modules doesn't exist or if force install is needed
if not exist node_modules (
    echo Installing npm dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to install dependencies.
        pause
        exit /b 1
    )
) else (
    echo Dependencies already installed. Checking for updates...
    call npm ci
)

REM Check if Docker is installed
echo Checking if Docker is installed...
where docker >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Docker is not installed or not in PATH. Please install Docker Desktop.
    echo Visit https://www.docker.com/products/docker-desktop/ to download and install Docker Desktop.
    pause
    exit /b 1
)
REM Check if Docker is running
echo Checking if Docker is running...
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo Docker is not running. Starting Docker Desktop...
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  
  echo Waiting for Docker to start...
  :WAIT_LOOP
  timeout /t 5 >nul
  docker info >nul 2>&1
  if %ERRORLEVEL% NEQ 0 goto WAIT_LOOP
  
  echo Docker started successfully.
) else (
  echo Docker is already running.
)
echo ====================================================
echo All checks completed. Starting the Electron app...
echo ====================================================

call npx electron gui/GUI-main.js