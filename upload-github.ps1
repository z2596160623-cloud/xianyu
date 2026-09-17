$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

function Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

try {
  Step 'Checking GitHub CLI'
  if (-not (Get-Command gh.exe -ErrorAction SilentlyContinue)) {
    if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
      throw 'GitHub CLI is missing and winget is unavailable. Install GitHub CLI from https://cli.github.com/ and try again.'
    }
    & winget.exe install --id GitHub.cli -e --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI installation failed.' }
    $env:Path = "C:\Program Files\GitHub CLI;$env:Path"
  }
  if (-not (Get-Command gh.exe -ErrorAction SilentlyContinue)) {
    throw 'GitHub CLI was installed, but this window cannot find it. Close this window and run upload-github.bat again.'
  }

  Step 'Authorizing GitHub'
  $ErrorActionPreference = 'Continue'
  & gh.exe auth status 2>$null
  $loggedIn = $LASTEXITCODE -eq 0
  $ErrorActionPreference = 'Stop'
  if (-not $loggedIn) {
    Write-Host 'Follow the browser instructions and authorize GitHub. Never paste your password or token into chat.'
    & gh.exe auth login --hostname github.com --git-protocol https --web
    if ($LASTEXITCODE -ne 0) { throw 'GitHub authorization failed.' }
  }
  & gh.exe auth setup-git
  if ($LASTEXITCODE -ne 0) { throw 'Git credential setup failed.' }

  Step 'Uploading the project'
  if (-not (Test-Path '.git')) {
    & git init -b main
    if ($LASTEXITCODE -ne 0) { throw 'git init failed.' }
  }
  & git config user.name 'Z2596160623'
  & git config user.email 'z2596160623@users.noreply.github.com'
  & git add --all
  & git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & git commit -m 'Build Shisan Windows monitor MVP'
    if ($LASTEXITCODE -ne 0) { throw 'git commit failed.' }
  }
  $remoteUrl = 'https://github.com/z2596160623-cloud/xianyu.git'
  $remotes = @(& git remote)
  if ($remotes -contains 'origin') {
    & git remote set-url origin $remoteUrl
  } else {
    & git remote add origin $remoteUrl
  }
  & git branch -M main
  & git push --set-upstream origin main
  if ($LASTEXITCODE -ne 0) { throw 'GitHub push failed.' }

  Write-Host "`nUpload completed. Windows packaging has started on GitHub." -ForegroundColor Green
  Write-Host 'Build page: https://github.com/z2596160623-cloud/xianyu/actions' -ForegroundColor Yellow
}
catch {
  Write-Host "`nUpload failed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'Send only the last error lines. Do not send passwords, tokens, or one-time codes.' -ForegroundColor Yellow
}
finally {
  Write-Host "`nPress Enter to close this window."
  [void](Read-Host)
}
