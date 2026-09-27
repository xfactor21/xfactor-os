$ErrorActionPreference = 'Stop'

function Write-LogTail([string]$Path) {
  if (Test-Path $Path) {
    Write-Host "----- log tail: $Path -----"
    Get-Content $Path -Tail 120
  }
}

function Get-XFactorUninstallEntry {
  $roots = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  Get-ItemProperty $roots -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -eq 'xFactor.OS' } |
    Select-Object -First 1
}

function Resolve-AppExecutable($Entry) {
  $candidates = @()

  if ($Entry.DisplayIcon) {
    $displayIcon = ($Entry.DisplayIcon -replace '^"|"

$msi = Get-ChildItem 'src-tauri/target/release/bundle/msi/*.msi' -File | Select-Object -First 1
if (-not $msi) { throw 'No xFactor.OS MSI bundle found.' }
$nsis = Get-ChildItem 'src-tauri/target/release/bundle/nsis/*.exe' -File |
  Where-Object { $_.Name -match 'setup' } |
  Select-Object -First 1
if (-not $nsis) { throw 'No xFactor.OS NSIS setup executable found.' }

$installLog = Join-Path $env:RUNNER_TEMP 'xfactor-os-msi-install.log'
$uninstallLog = Join-Path $env:RUNNER_TEMP 'xfactor-os-msi-uninstall.log'

Write-Host "Installing $($msi.Name)"
$install = Start-Process msiexec.exe -ArgumentList @(
  '/i',
  ('"{0}"' -f $msi.FullName),
  '/quiet',
  '/norestart',
  '/l*v',
  ('"{0}"' -f $installLog)
) -Wait -PassThru

if ($install.ExitCode -notin @(0, 3010)) {
  Write-LogTail $installLog
  throw "MSI install failed with exit code $($install.ExitCode)."
}

$entry = Wait-ForUninstallEntry
if (-not $entry) {
  Write-LogTail $installLog
  throw 'xFactor.OS Windows uninstall registration was not created.'
}

$exe = Resolve-AppExecutable $entry
Invoke-AppLaunchSmoke $exe 'MSI'

Write-Host "Uninstalling $($msi.Name)"
$uninstall = Start-Process msiexec.exe -ArgumentList @(
  '/x',
  ('"{0}"' -f $msi.FullName),
  '/quiet',
  '/norestart',
  '/l*v',
  ('"{0}"' -f $uninstallLog)
) -Wait -PassThru

if ($uninstall.ExitCode -notin @(0, 3010)) {
  Write-LogTail $uninstallLog
  throw "MSI uninstall failed with exit code $($uninstall.ExitCode)."
}

Start-Sleep -Seconds 2
try {
  Wait-ForUninstallRemoval
} catch {
  Write-LogTail $uninstallLog
  throw
}

if (Test-Path $exe.FullName) {
  throw "Installed executable still exists after MSI uninstall: $($exe.FullName)"
}

Write-Host 'PASS: xFactor.OS MSI install -> launch -> uninstall lifecycle.'

Write-Host "Installing NSIS bundle $($nsis.Name)"
$nsisInstall = Start-Process $nsis.FullName -ArgumentList '/S' -Wait -PassThru
if ($nsisInstall.ExitCode -notin @(0, 3010)) {
  throw "NSIS silent install failed with exit code $($nsisInstall.ExitCode)."
}

$nsisEntry = Wait-ForUninstallEntry
if (-not $nsisEntry) {
  throw 'xFactor.OS NSIS install did not create Windows uninstall registration.'
}

$nsisExe = Resolve-AppExecutable $nsisEntry
Invoke-AppLaunchSmoke $nsisExe 'NSIS'

$uninstallCommand = if ($nsisEntry.QuietUninstallString) {
  [string]$nsisEntry.QuietUninstallString
} else {
  [string]$nsisEntry.UninstallString
}
$parsed = Split-UninstallCommand $uninstallCommand
$nsisArgs = [string]$parsed.Args
if ($nsisArgs -notmatch '(^|\s)/S(\s|$)') {
  $nsisArgs = ($nsisArgs + ' /S').Trim()
}

Write-Host "Uninstalling NSIS installation via $($parsed.File)"
$nsisUninstall = Start-Process $parsed.File -ArgumentList $nsisArgs -Wait -PassThru
if ($nsisUninstall.ExitCode -notin @(0, 3010)) {
  throw "NSIS silent uninstall failed with exit code $($nsisUninstall.ExitCode)."
}

Wait-ForUninstallRemoval
if (Test-Path $nsisExe.FullName) {
  throw "Installed executable still exists after NSIS uninstall: $($nsisExe.FullName)"
}

Write-Host 'PASS: xFactor.OS NSIS EXE install -> launch -> uninstall lifecycle.'
Write-Host 'PASS: xFactor.OS Windows installer lifecycle verified for MSI and NSIS.'
,'') -replace ',\d+

$msi = Get-ChildItem 'src-tauri/target/release/bundle/msi/*.msi' -File | Select-Object -First 1
if (-not $msi) { throw 'No xFactor.OS MSI bundle found.' }

$installLog = Join-Path $env:RUNNER_TEMP 'xfactor-os-msi-install.log'
$uninstallLog = Join-Path $env:RUNNER_TEMP 'xfactor-os-msi-uninstall.log'

Write-Host "Installing $($msi.Name)"
$install = Start-Process msiexec.exe -ArgumentList @(
  '/i',
  ('"{0}"' -f $msi.FullName),
  '/quiet',
  '/norestart',
  '/l*v',
  ('"{0}"' -f $installLog)
) -Wait -PassThru

if ($install.ExitCode -notin @(0, 3010)) {
  Write-LogTail $installLog
  throw "MSI install failed with exit code $($install.ExitCode)."
}

$entry = Get-XFactorUninstallEntry
if (-not $entry) {
  Write-LogTail $installLog
  throw 'xFactor.OS Windows uninstall registration was not created.'
}

$exe = Resolve-AppExecutable $entry
Write-Host "Installed executable: $($exe.FullName)"

$app = Start-Process $exe.FullName -PassThru
Start-Sleep -Seconds 10
if ($app.HasExited) {
  throw "Installed xFactor.OS exited during launch smoke with code $($app.ExitCode)."
}
Write-Host "Installed xFactor.OS remained running during launch smoke."
Stop-Process -Id $app.Id -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "Uninstalling $($msi.Name)"
$uninstall = Start-Process msiexec.exe -ArgumentList @(
  '/x',
  ('"{0}"' -f $msi.FullName),
  '/quiet',
  '/norestart',
  '/l*v',
  ('"{0}"' -f $uninstallLog)
) -Wait -PassThru

if ($uninstall.ExitCode -notin @(0, 3010)) {
  Write-LogTail $uninstallLog
  throw "MSI uninstall failed with exit code $($uninstall.ExitCode)."
}

Start-Sleep -Seconds 3
if (Get-XFactorUninstallEntry) {
  Write-LogTail $uninstallLog
  throw 'xFactor.OS uninstall registration still exists after MSI uninstall.'
}

if (Test-Path $exe.FullName) {
  throw "Installed executable still exists after MSI uninstall: $($exe.FullName)"
}

Write-Host 'PASS: xFactor.OS MSI install -> launch -> uninstall lifecycle.'
,''
    if (Test-Path $displayIcon) { $candidates += Get-Item $displayIcon }
  }

  if ($Entry.InstallLocation -and (Test-Path $Entry.InstallLocation)) {
    $candidates += Get-ChildItem $Entry.InstallLocation -File -Filter '*.exe' -Recurse -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -notmatch 'uninstall|setup' }
  }

  $preferred = $candidates |
    Sort-Object @{Expression={ if ($_.Name -match 'xfactor') { 0 } else { 1 } }}, FullName |
    Select-Object -First 1

  if (-not $preferred) {
    throw 'Installed xFactor.OS executable could not be resolved from Windows uninstall registration.'
  }
  return $preferred
}

function Invoke-AppLaunchSmoke([System.IO.FileInfo]$Exe, [string]$InstallerLabel) {
  Write-Host "Launching installed app from $InstallerLabel: $($Exe.FullName)"
  $app = Start-Process $Exe.FullName -PassThru
  Start-Sleep -Seconds 10
  if ($app.HasExited) {
    throw "Installed xFactor.OS exited during $InstallerLabel launch smoke with code $($app.ExitCode)."
  }
  Write-Host "Installed xFactor.OS remained running during $InstallerLabel launch smoke."
  Stop-Process -Id $app.Id -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}

function Wait-ForUninstallEntry([int]$TimeoutSeconds = 30) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $entry = Get-XFactorUninstallEntry
    if ($entry) { return $entry }
    Start-Sleep -Seconds 1
  } while ((Get-Date) -lt $deadline)
  return $null
}

function Wait-ForUninstallRemoval([int]$TimeoutSeconds = 30) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    if (-not (Get-XFactorUninstallEntry)) { return }
    Start-Sleep -Seconds 1
  } while ((Get-Date) -lt $deadline)
  throw 'xFactor.OS uninstall registration still exists after uninstall timeout.'
}

function Split-UninstallCommand([string]$Command) {
  if (-not $Command) { throw 'NSIS uninstall command is missing.' }
  if ($Command -match '^\s*"([^"]+)"\s*(.*)

$msi = Get-ChildItem 'src-tauri/target/release/bundle/msi/*.msi' -File | Select-Object -First 1
if (-not $msi) { throw 'No xFactor.OS MSI bundle found.' }

$installLog = Join-Path $env:RUNNER_TEMP 'xfactor-os-msi-install.log'
$uninstallLog = Join-Path $env:RUNNER_TEMP 'xfactor-os-msi-uninstall.log'

Write-Host "Installing $($msi.Name)"
$install = Start-Process msiexec.exe -ArgumentList @(
  '/i',
  ('"{0}"' -f $msi.FullName),
  '/quiet',
  '/norestart',
  '/l*v',
  ('"{0}"' -f $installLog)
) -Wait -PassThru

if ($install.ExitCode -notin @(0, 3010)) {
  Write-LogTail $installLog
  throw "MSI install failed with exit code $($install.ExitCode)."
}

$entry = Get-XFactorUninstallEntry
if (-not $entry) {
  Write-LogTail $installLog
  throw 'xFactor.OS Windows uninstall registration was not created.'
}

$exe = Resolve-AppExecutable $entry
Write-Host "Installed executable: $($exe.FullName)"

$app = Start-Process $exe.FullName -PassThru
Start-Sleep -Seconds 10
if ($app.HasExited) {
  throw "Installed xFactor.OS exited during launch smoke with code $($app.ExitCode)."
}
Write-Host "Installed xFactor.OS remained running during launch smoke."
Stop-Process -Id $app.Id -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "Uninstalling $($msi.Name)"
$uninstall = Start-Process msiexec.exe -ArgumentList @(
  '/x',
  ('"{0}"' -f $msi.FullName),
  '/quiet',
  '/norestart',
  '/l*v',
  ('"{0}"' -f $uninstallLog)
) -Wait -PassThru

if ($uninstall.ExitCode -notin @(0, 3010)) {
  Write-LogTail $uninstallLog
  throw "MSI uninstall failed with exit code $($uninstall.ExitCode)."
}

Start-Sleep -Seconds 3
if (Get-XFactorUninstallEntry) {
  Write-LogTail $uninstallLog
  throw 'xFactor.OS uninstall registration still exists after MSI uninstall.'
}

if (Test-Path $exe.FullName) {
  throw "Installed executable still exists after MSI uninstall: $($exe.FullName)"
}

Write-Host 'PASS: xFactor.OS MSI install -> launch -> uninstall lifecycle.'
) {
    return @{ File = $Matches[1]; Args = $Matches[2] }
  }
  if ($Command -match '^\s*(\S+)\s*(.*)

$msi = Get-ChildItem 'src-tauri/target/release/bundle/msi/*.msi' -File | Select-Object -First 1
if (-not $msi) { throw 'No xFactor.OS MSI bundle found.' }

$installLog = Join-Path $env:RUNNER_TEMP 'xfactor-os-msi-install.log'
$uninstallLog = Join-Path $env:RUNNER_TEMP 'xfactor-os-msi-uninstall.log'

Write-Host "Installing $($msi.Name)"
$install = Start-Process msiexec.exe -ArgumentList @(
  '/i',
  ('"{0}"' -f $msi.FullName),
  '/quiet',
  '/norestart',
  '/l*v',
  ('"{0}"' -f $installLog)
) -Wait -PassThru

if ($install.ExitCode -notin @(0, 3010)) {
  Write-LogTail $installLog
  throw "MSI install failed with exit code $($install.ExitCode)."
}

$entry = Get-XFactorUninstallEntry
if (-not $entry) {
  Write-LogTail $installLog
  throw 'xFactor.OS Windows uninstall registration was not created.'
}

$exe = Resolve-AppExecutable $entry
Write-Host "Installed executable: $($exe.FullName)"

$app = Start-Process $exe.FullName -PassThru
Start-Sleep -Seconds 10
if ($app.HasExited) {
  throw "Installed xFactor.OS exited during launch smoke with code $($app.ExitCode)."
}
Write-Host "Installed xFactor.OS remained running during launch smoke."
Stop-Process -Id $app.Id -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "Uninstalling $($msi.Name)"
$uninstall = Start-Process msiexec.exe -ArgumentList @(
  '/x',
  ('"{0}"' -f $msi.FullName),
  '/quiet',
  '/norestart',
  '/l*v',
  ('"{0}"' -f $uninstallLog)
) -Wait -PassThru

if ($uninstall.ExitCode -notin @(0, 3010)) {
  Write-LogTail $uninstallLog
  throw "MSI uninstall failed with exit code $($uninstall.ExitCode)."
}

Start-Sleep -Seconds 3
if (Get-XFactorUninstallEntry) {
  Write-LogTail $uninstallLog
  throw 'xFactor.OS uninstall registration still exists after MSI uninstall.'
}

if (Test-Path $exe.FullName) {
  throw "Installed executable still exists after MSI uninstall: $($exe.FullName)"
}

Write-Host 'PASS: xFactor.OS MSI install -> launch -> uninstall lifecycle.'
) {
    return @{ File = $Matches[1]; Args = $Matches[2] }
  }
  throw "Unable to parse NSIS uninstall command: $Command"
}

$msi = Get-ChildItem 'src-tauri/target/release/bundle/msi/*.msi' -File | Select-Object -First 1
if (-not $msi) { throw 'No xFactor.OS MSI bundle found.' }

$installLog = Join-Path $env:RUNNER_TEMP 'xfactor-os-msi-install.log'
$uninstallLog = Join-Path $env:RUNNER_TEMP 'xfactor-os-msi-uninstall.log'

Write-Host "Installing $($msi.Name)"
$install = Start-Process msiexec.exe -ArgumentList @(
  '/i',
  ('"{0}"' -f $msi.FullName),
  '/quiet',
  '/norestart',
  '/l*v',
  ('"{0}"' -f $installLog)
) -Wait -PassThru

if ($install.ExitCode -notin @(0, 3010)) {
  Write-LogTail $installLog
  throw "MSI install failed with exit code $($install.ExitCode)."
}

$entry = Get-XFactorUninstallEntry
if (-not $entry) {
  Write-LogTail $installLog
  throw 'xFactor.OS Windows uninstall registration was not created.'
}

$exe = Resolve-AppExecutable $entry
Write-Host "Installed executable: $($exe.FullName)"

$app = Start-Process $exe.FullName -PassThru
Start-Sleep -Seconds 10
if ($app.HasExited) {
  throw "Installed xFactor.OS exited during launch smoke with code $($app.ExitCode)."
}
Write-Host "Installed xFactor.OS remained running during launch smoke."
Stop-Process -Id $app.Id -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "Uninstalling $($msi.Name)"
$uninstall = Start-Process msiexec.exe -ArgumentList @(
  '/x',
  ('"{0}"' -f $msi.FullName),
  '/quiet',
  '/norestart',
  '/l*v',
  ('"{0}"' -f $uninstallLog)
) -Wait -PassThru

if ($uninstall.ExitCode -notin @(0, 3010)) {
  Write-LogTail $uninstallLog
  throw "MSI uninstall failed with exit code $($uninstall.ExitCode)."
}

Start-Sleep -Seconds 3
if (Get-XFactorUninstallEntry) {
  Write-LogTail $uninstallLog
  throw 'xFactor.OS uninstall registration still exists after MSI uninstall.'
}

if (Test-Path $exe.FullName) {
  throw "Installed executable still exists after MSI uninstall: $($exe.FullName)"
}

Write-Host 'PASS: xFactor.OS MSI install -> launch -> uninstall lifecycle.'
