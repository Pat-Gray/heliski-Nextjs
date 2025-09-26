@echo off
echo Stopping any running Node.js processes...
taskkill /f /im node.exe 2>nul
timeout /t 2 /nobreak >nul

echo Clearing Next.js cache...
if exist .next rmdir /s /q .next
if exist node_modules\.cache rmdir /s /q node_modules\.cache

echo Clearing npm cache...
npm cache clean --force

echo Starting development server...
npm run dev