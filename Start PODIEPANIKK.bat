@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title PODIEPANIKK^^! - server
cd /d "%~dp0"

echo.
echo   ==============================================
echo      PODIEPANIKK^^!  -  starter gameshowet ...
echo   ==============================================
echo.

rem --- 1. Finn Node.js (ogsa nar Windows ikke har oppdatert PATH etter installasjon) ---
where node >nul 2>nul
if errorlevel 1 (
  for %%d in ("%ProgramFiles%\nodejs" "%ProgramFiles(x86)%\nodejs" "%LOCALAPPDATA%\Programs\nodejs" "%NVM_SYMLINK%") do (
    if exist "%%~d\node.exe" set "PATH=%%~d;!PATH!"
  )
)
where node >nul 2>nul
if errorlevel 1 (
  echo   Fant ikke Node.js. Last ned LTS-versjonen fra nodejs.org og installer den.
  start "" https://nodejs.org
  goto feil
)

rem --- 2. Sjekk at port 3001 er ledig ---
netstat -ano | findstr /r /c:":3001 .*LISTENING" >nul
if not errorlevel 1 (
  echo   Spillet ser ut til a kjore allerede ^(port 3001 er opptatt^).
  echo   Apner nettleseren i stedet ...
  start "" http://localhost:3001
  goto slutt
)

rem --- 3. Installer byggeklosser forste gang ---
if not exist "node_modules\" (
  echo   Forste gang: installerer byggeklosser ^(tar et par minutter^) ...
  call npm.cmd install --no-audit --no-fund
  if errorlevel 1 goto feil
)

rem --- 4. Bygg siste versjon (tar ca. 10 sekunder) ---
echo   Bygger siste versjon av spillet ...
call npm.cmd run build >build.log 2>&1
if errorlevel 1 (
  echo   Bygget feilet. Se build.log for detaljer.
  goto feil
)
del build.log >nul 2>nul

rem --- 5. Vis adressene mobilene kan bruke ---
echo.
echo   Spillet blir tilgjengelig pa:
echo     Denne PC-en:   http://localhost:3001
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  set "ip=%%a"
  set "ip=!ip: =!"
  echo     Mobiler/TV:    http://!ip!:3001   ^(samme Wi-Fi^)
)
echo.
echo   Tips: Apne storskjermen via IP-adressen, sa virker QR-koden for mobilene.
echo   Lukk dette vinduet eller trykk Ctrl+C for a stoppe spillet.
echo.

rem --- 6. Apne nettleseren nar serveren er klar, og start serveren ---
if not "%PP_NOBROWSER%"=="1" start "" /min cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3001"
call npm.cmd start
echo.
echo   Serveren er stoppet.
goto slutt

:feil
echo.
echo   Noe gikk galt. Ta gjerne et skjermbilde av dette vinduet.

:slutt
echo.
pause
