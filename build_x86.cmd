@echo off
setlocal
nuget restore
msbuild SpaceInvadersSaverWin7.csproj /p:Configuration=Release /p:Platform="x86" /m
set OUTDIR=bin\Release\net48
copy /Y %OUTDIR%\SpaceInvadersSaverWin7.exe %OUTDIR%\SpaceInvadersSaverWin7.scr >nul
powershell -Command "Compress-Archive -Path 'bin/Release/net48/*','Content/*' -DestinationPath 'SpaceInvadersSaverWin7-x86.zip' -Force"
echo [OK] Listo: %CD%\SpaceInvadersSaverWin7-x86.zip
endlocal
