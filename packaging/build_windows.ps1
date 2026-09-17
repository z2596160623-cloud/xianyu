# 构建 Windows 安装程序(onedir + 打进 Chromium + Inno Setup)。
# 前置: pip install -e . pyinstaller ; (cd frontend; npm ci; npm run build) ; 装 Inno Setup 6
# 用法: powershell -ExecutionPolicy Bypass -File packaging\build_windows.ps1 0.1.0
param([string]$Version = "0.1.0")
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host ">> Playwright Chromium"
python -m playwright install chromium
if ($LASTEXITCODE -ne 0) { throw "Chromium download failed" }

Write-Host ">> PyInstaller 打包"
python -m PyInstaller packaging/goofish.spec --noconfirm --distpath dist --workpath build
if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed" }

Write-Host ">> 拷 Chromium 进 onedir"
python packaging/copy_browsers.py "dist/GooFish-AIMonitor/ms-playwright"
if ($LASTEXITCODE -ne 0) { throw "Browser copy failed" }

Write-Host ">> 冒烟: 拉起包内 Chromium"
$selfcheck = Start-Process -FilePath "dist/GooFish-AIMonitor/GooFish-AIMonitor.exe" -ArgumentList '--selfcheck' -Wait -PassThru
if ($selfcheck.ExitCode -ne 0) { throw "Packaged Chromium selfcheck failed" }

Write-Host ">> Inno Setup 打安装包"
& "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe" "/DMyAppVersion=$Version" packaging\goofish.iss
if ($LASTEXITCODE -ne 0) { throw "Installer compilation failed" }

Write-Host "✓ 完成: packaging\Output\Shisan-Xianyu-Monitor-Setup-$Version.exe"
