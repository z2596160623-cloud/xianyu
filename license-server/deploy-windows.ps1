$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

function Show-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Get-WranglerJson([string[]]$Arguments) {
  $stderrPath = [IO.Path]::GetTempFileName()
  $previousPreference = $ErrorActionPreference
  try {
    # Windows PowerShell 5.1 wraps native stderr in ErrorRecord objects.
    # Warnings must not abort the pipeline; the native exit code is authoritative.
    $ErrorActionPreference = 'Continue'
    $output = & npx.cmd --yes wrangler@4.132.0 @Arguments 2>$stderrPath | Out-String
    $nativeExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousPreference
    if ($nativeExitCode -ne 0) {
      $details = Get-Content -LiteralPath $stderrPath -Raw
      throw "Cloudflare command failed (exit $nativeExitCode): $details"
    }
    $parsed = $output | ConvertFrom-Json
    # Explicit enumeration also handles [] under Windows PowerShell 5.1.
    # Do not emit the array container itself as a database record.
    foreach ($entry in $parsed) {
      if ($null -ne $entry) { Write-Output $entry }
    }
  }
  finally {
    $ErrorActionPreference = $previousPreference
    Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
  }
}

function Find-LicenseDatabase([string]$DatabaseName) {
  $records = @(Get-WranglerJson -Arguments @('d1', 'list', '--json'))
  foreach ($record in $records) {
    if ($null -eq $record) { continue }
    $nameProperty = $record.PSObject.Properties['name']
    $idProperty = $record.PSObject.Properties['uuid']
    if ($null -eq $nameProperty -or $null -eq $idProperty) {
      throw 'Unexpected D1 list format. Stop without creating resources. Please send the output of: npx.cmd --yes wrangler@4.132.0 d1 list --json'
    }
    if ($nameProperty.Value -eq $DatabaseName) { return $record }
  }
}

try {
  Show-Step 'Checking Node.js'
  if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
    if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
      throw 'Node.js is missing and winget is unavailable. Install Node.js LTS from https://nodejs.org/ and run this file again.'
    }
    Write-Host 'Node.js is not installed. Windows will install the official LTS version.'
    & winget.exe install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw 'Node.js installation failed.' }
    $env:Path = "C:\Program Files\nodejs;$env:Path"
  }
  if (-not (Get-Command npx.cmd -ErrorAction SilentlyContinue)) {
    throw 'Node.js was installed, but this terminal cannot find npx. Close this window and run deploy-license.bat again.'
  }

  Show-Step 'Authorizing your Cloudflare account'
  $ErrorActionPreference = 'Continue'
  $loginStatus = & npx.cmd --yes wrangler@4.132.0 whoami 2>&1 | Out-String
  $loginExitCode = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($loginExitCode -ne 0 -or $loginStatus -notmatch 'You are logged in') {
    Write-Host 'Your browser will open. Sign in to Cloudflare and approve the authorization.'
    & npx.cmd --yes wrangler@4.132.0 login
    if ($LASTEXITCODE -ne 0) { throw 'Cloudflare authorization failed.' }
  }
  & npx.cmd --yes wrangler@4.132.0 whoami
  if ($LASTEXITCODE -ne 0) { throw 'Cloudflare login was not confirmed.' }

  $databaseName = 'shisan-license-db'
  Show-Step 'Creating or reusing the license database'
  $database = Find-LicenseDatabase -DatabaseName $databaseName
  if (-not $database) {
    & npx.cmd --yes wrangler@4.132.0 d1 create $databaseName
    if ($LASTEXITCODE -ne 0) { throw 'D1 database creation failed.' }
    $database = Find-LicenseDatabase -DatabaseName $databaseName
  }
  if (-not $database -or -not $database.uuid) { throw 'Could not read the D1 database ID.' }

  $deployConfig = [ordered]@{
    '$schema' = 'node_modules/wrangler/config-schema.json'
    name = 'shisan-license'
    main = 'src/index.js'
    compatibility_date = '2026-09-01'
    d1_databases = @(
      [ordered]@{
        binding = 'DB'
        database_name = $databaseName
        database_id = $database.uuid
      }
    )
  }
  $configPath = Join-Path $ProjectDir 'wrangler.deploy.json'
  $deployConfig | ConvertTo-Json -Depth 5 | Set-Content -Path $configPath -Encoding utf8

  Show-Step 'Creating database tables'
  & npx.cmd --yes wrangler@4.132.0 d1 execute $databaseName --remote --file schema.sql --yes --config $configPath
  if ($LASTEXITCODE -ne 0) { throw 'Database initialization failed.' }

  Show-Step 'Creating the private administrator key'
  $randomBytes = New-Object byte[] 32
  $randomGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
  $randomGenerator.GetBytes($randomBytes)
  $randomGenerator.Dispose()
  $adminToken = ([BitConverter]::ToString($randomBytes) -replace '-', '').ToLowerInvariant()
  $secretPath = Join-Path $ProjectDir '.deploy-secrets.json'
  @{ ADMIN_TOKEN = $adminToken } | ConvertTo-Json | Set-Content -Path $secretPath -Encoding utf8
  # Preserve a local recovery copy before deployment, even if a later test fails.
  $privateDir = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Shisan-License-Admin'
  [void](New-Item -ItemType Directory -Path $privateDir -Force)
  $backupPath = Join-Path $privateDir (('admin-{0}-{1}.json' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), [Guid]::NewGuid().ToString('N')))
  Copy-Item -LiteralPath $secretPath -Destination $backupPath

  Show-Step 'Deploying the license service'
  $ErrorActionPreference = 'Continue'
  $deployOutput = & npx.cmd --yes wrangler@4.132.0 deploy --config $configPath --secrets-file $secretPath 2>&1 | Out-String
  $deployExitCode = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($deployExitCode -ne 0) { throw "Worker deployment failed.`n$deployOutput" }
  Write-Host $deployOutput
  $urlMatch = [regex]::Match($deployOutput, 'https://[a-zA-Z0-9.-]+\.workers\.dev')
  if (-not $urlMatch.Success) { throw 'Deployment succeeded, but the workers.dev URL could not be detected.' }
  $serviceUrl = $urlMatch.Value.TrimEnd('/')

  Show-Step 'Testing the service and generating the first 30-day key'
  $health = Invoke-RestMethod -Method Get -Uri "$serviceUrl/health"
  if (-not $health.ok) { throw 'Health check failed.' }
  $headers = @{ Authorization = "Bearer $adminToken" }
  $body = @{ duration_days = 30; plan = 'monthly' } | ConvertTo-Json
  $license = Invoke-RestMethod -Method Post -Uri "$serviceUrl/v1/admin/licenses" -Headers $headers -ContentType 'application/json' -Body $body

  $desktop = [Environment]::GetFolderPath('Desktop')
  $resultPath = Join-Path $desktop '十三月卡服务部署结果.txt'
  @"
十三闲鱼监控助手 - 月卡服务

服务网址（可以发给开发者）：$serviceUrl
第一张30天月卡：$($license.license_key)

管理员密钥（绝对不要发给买家）：$adminToken
部署时间：$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
"@ | Set-Content -Path $resultPath -Encoding utf8

  Write-Host "`nDeployment completed successfully." -ForegroundColor Green
  Write-Host "Result saved to: $resultPath" -ForegroundColor Green
  Write-Host "Service URL: $serviceUrl" -ForegroundColor Yellow
}
catch {
  Write-Host "`nDeployment failed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'Take a screenshot of this window and send it to the developer.' -ForegroundColor Yellow
}
finally {
  $secretPathToClean = Join-Path $ProjectDir '.deploy-secrets.json'
  if (Test-Path $secretPathToClean) { Remove-Item -LiteralPath $secretPathToClean -Force }
  Write-Host "`nPress Enter to close this window."
  [void](Read-Host)
}
