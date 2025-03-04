@echo off
setlocal EnableDelayedExpansion

REM Deployment script for Heroku
echo Starting Heroku deployment...

REM Check if Heroku CLI is installed
where heroku >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Heroku CLI is not installed. Please install it first.
    exit /b 1
)
REM Check if git is installed
where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Git is not installed. Please install it first.
    exit /b 1
)

REM Set app name
set APP_NAME=mcmcp

REM Check if already logged in, otherwise prompt
heroku auth:whoami >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo You need to login to Heroku first
    heroku login
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to login to Heroku
        exit /b 1
    )
)

REM Check if app exists, create if not
heroku apps:info --app %APP_NAME% >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Creating Heroku app %APP_NAME%...
    heroku apps:create %APP_NAME%
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to create app %APP_NAME%
        exit /b 1
    )
)

REM Set the stack to container
echo Setting stack to container...
heroku stack:set container --app %APP_NAME%

REM Check if PostgreSQL addon exists, create if not
heroku addons:info postgresql --app %APP_NAME% >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Adding PostgreSQL addon...
    heroku addons:create heroku-postgresql:essential-0 --app %APP_NAME%
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to create PostgreSQL addon
        exit /b 1
    )
)

REM Check if git is initialized
if not exist .git (
    echo Initializing git repository...
    git init
    git add .
    git commit -m "Initial commit for Heroku deployment"
)

REM Check if Heroku remote exists, add if not
git remote -v | findstr heroku >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Adding Heroku git remote...
    git remote add heroku https://git.heroku.com/%APP_NAME%.git
)

REM Push to Heroku
echo Pushing to Heroku...
git push heroku main --force

REM Check for deployment status
if %ERRORLEVEL% EQU 0 (
    echo Deployment successful! Your app is now available at:
    echo https://%APP_NAME%.herokuapp.com
    
    REM Open the app in default browser
    start https://%APP_NAME%.herokuapp.com
) else (
    echo Deployment failed. Check the error messages above.
)

exit /b %ERRORLEVEL%