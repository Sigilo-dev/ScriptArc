@echo off
setlocal
cd /d "%~dp0.."

where pnpm >nul 2>nul
if errorlevel 1 (
  echo ScriptArc development requires pnpm. Install Node.js and enable pnpm with Corepack.
  exit /b 1
)

if not exist "node_modules" (
  echo Installing project dependencies...
  call pnpm install
  if errorlevel 1 exit /b 1
)

echo Starting ScriptArc in Tauri development mode...
call pnpm tauri dev
exit /b %errorlevel%
