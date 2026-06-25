@echo off
REM FretFall launcher for Windows — double-click to play.
cd /d "%~dp0"
set PORT=8753
start "" http://localhost:%PORT%/index.html
where py >nul 2>nul && (py -m http.server %PORT% --bind 127.0.0.1) || (python -m http.server %PORT% --bind 127.0.0.1)
