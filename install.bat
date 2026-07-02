@echo off
title RaffleVault Installer
color 0A

echo.
echo  ================================================
echo        Welcome to RaffleVault Installer
echo  ================================================
echo.
echo  This installer will set up RaffleVault on your
echo  computer. You only need to answer one question.
echo.
echo  Requirements: Docker Desktop must be installed
echo  and running before continuing.
echo.
pause

:: Check Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Docker Desktop is not running.
    echo  Please start Docker Desktop and run this
    echo  installer again.
    echo.
    pause
    exit /b 1
)

echo.
echo  Docker is running.
echo.

:: Ask for email
set /p OWNER_EMAIL= Enter your email address:

if "%OWNER_EMAIL%"=="" (
    echo.
    echo  ERROR: Email address cannot be empty.
    pause
    exit /b 1
)

echo.
echo  Generating secure passwords...

:: Generate random passwords using PowerShell
for /f "delims=" %%i in ('powershell -command "[System.Web.Security.Membership]::GeneratePassword(32,4)"') do set DB_PASS=%%i
for /f "delims=" %%i in ('powershell -command "[System.Web.Security.Membership]::GeneratePassword(48,6)"') do set JWT_SECRET=%%i

:: Fallback if GeneratePassword fails
if "%DB_PASS%"=="" (
    for /f "delims=" %%i in ('powershell -command "$bytes = New-Object byte[] 24; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [Convert]::ToBase64String($bytes)"') do set DB_PASS=%%i
)
if "%JWT_SECRET%"=="" (
    for /f "delims=" %%i in ('powershell -command "$bytes = New-Object byte[] 36; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [Convert]::ToBase64String($bytes)"') do set JWT_SECRET=%%i
)

:: Write .env file
(
echo POSTGRES_PASSWORD=%DB_PASS%
echo JWT_SECRET=%JWT_SECRET%
echo RAFFLEVAULT_OWNER_EMAIL=%OWNER_EMAIL%
echo # Uncomment and set before going live:
echo # SITE_ORIGIN=https://rafflevault.yourdomain.com
) > .env

echo  Secure passwords generated and saved.
echo.
echo  Starting RaffleVault... this may take a few
echo  minutes the first time while Docker downloads
echo  everything it needs.
echo.

docker compose up --build -d

if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Something went wrong starting RaffleVault.
    echo  Please make sure Docker Desktop is running and
    echo  try again.
    echo.
    pause
    exit /b 1
)

echo.
echo  ================================================
echo        RaffleVault is ready!
echo  ================================================
echo.
echo  Open your web browser and go to:
echo.
echo        http://localhost:3000
echo.
echo  The setup wizard will walk you through the
echo  rest of the configuration.
echo.
echo  IMPORTANT: Bookmark http://localhost:3000/admin
echo  for the admin panel.
echo.
echo  ================================================
echo.
pause
