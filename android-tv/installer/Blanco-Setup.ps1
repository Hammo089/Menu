$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Blanco.Core.ps1')
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = 'Blanco TV - Installation'
Write-Host "`n  BLANCO TV / Installation Android TV`n" -ForegroundColor Green
Write-Host 'Same Wi-Fi/LAN as TV. Enable Developer options and USB/network debugging.'
Write-Host 'Some TVs require a cable first or Wireless debugging pairing; no data will be erased.'
Write-Host 'No factory reset, root, stock launcher removal, or router changes.'
try {
    $endpoint = Get-TvEndpoint (Read-Host 'TV IP (e.g. 192.168.1.25 or 192.168.1.25:37123)')
    $adb = Join-Path $PSScriptRoot 'platform-tools/adb.exe'
    $apk = Join-Path $PSScriptRoot 'blanco-tv-pilot.apk'
    $manifest = Get-Content -Raw (Join-Path $PSScriptRoot 'checksums.json') | ConvertFrom-Json
    foreach ($file in $manifest.PSObject.Properties) { Assert-PackageHash (Join-Path $PSScriptRoot $file.Name) $file.Value }
    function Call-Adb([string[]]$AdbArgs) {
        # No shell interpolation: every value is passed as an independent native argument.
        $start = New-Object System.Diagnostics.ProcessStartInfo
        $start.FileName = $adb
        $start.Arguments = (($AdbArgs | ForEach-Object { '"' + $_.Replace('"','\"') + '"' }) -join ' ')
        $start.UseShellExecute = $false
        $start.CreateNoWindow = $true
        $start.RedirectStandardOutput = $true
        $start.RedirectStandardError = $true
        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $start
        $null = $process.Start()
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(120000)) { $process.Kill(); throw 'ADB timed out. Check the TV and retry.' }
        $output = $stdout.Result + $stderr.Result
        $exit = $process.ExitCode
        $process.Dispose()
        return [pscustomobject]@{ Code=$exit; Output=$output }
    }
    $wireless = Read-Host 'Wireless debugging with pairing code? [y/N]'
    if ($wireless -eq 'y') {
        $pairEndpoint = Get-TvEndpoint (Read-Host 'Pairing IP:port shown by TV (different from connection port)')
        if ($pairEndpoint.Split(':')[0] -ne $endpoint.Split(':')[0]) { throw 'Pairing and connection must refer to the same TV.' }
        $pairCode = Read-Host 'Six-digit Android wireless pairing code'
        if ($pairCode -notmatch '^[0-9]{6}$') { throw 'Pairing code must contain six digits.' }
        $pair = Call-Adb -AdbArgs @('pair',$pairEndpoint,$pairCode)
        $pairCode = $null
        if ($pair.Code -ne 0 -or $pair.Output -notmatch 'Successfully paired') { throw "Pairing failed: $($pair.Output)" }
    }
    Write-Host 'Connecting... Accept the authorization dialog on the TV.'
    $connected = Call-Adb -AdbArgs @('connect',$endpoint)
    Write-Host $connected.Output
    Read-Host 'After accepting on the TV, press Enter' | Out-Null
    $bridge = { param([string[]]$Arguments) Call-Adb -AdbArgs (@('-s',$endpoint) + $Arguments) }
    $inspection = Get-BlancoInspection -Bridge $bridge
    Write-Host "Read-only check: $($inspection.Model), Android SDK $($inspection.Sdk)"
    Write-Host "Current Home: $($inspection.PreviousHome)"
    Write-Host 'The inspection has not changed any TV settings.' -ForegroundColor Green
    if ((Read-Host 'Install/open optional Blanco display app? Home and device management stay unchanged. [y/N]') -ne 'y') {
        Write-Host 'Inspection finished. Nothing installed or changed.'
        return
    }
    $backup = Join-Path $env:LOCALAPPDATA ('BlancoTV/Backups/' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    $result = Invoke-BlancoSetup -Bridge $bridge -ApkPath $apk -BackupDirectory $backup
    Write-Host "`nInstalled. Scan the QR on the TV, sign in to Blanco and choose your EXIT PIN." -ForegroundColor Green
    Write-Host 'The on-screen 10-character code is a pairing code, NOT your exit PIN.'
    Write-Host 'Optional display mode. Fire TV Home remains available. No full device lock enabled.' -ForegroundColor Green
    Write-Host 'Blanco requests launch on full TV boot. Test a real restart; Fire TV may block auto-launch.'
    Write-Host 'Back + PIN opens Return to TV and the auto-start on/off option. Home remains unchanged.'
    Write-Host "Backup: $backup"
    if ($result.PreviousHome) { Write-Host "Previous Home: $($result.PreviousHome) (saved for restoration)" }
    Start-Process 'https://blanco-menu-one.vercel.app/admin/screens'
    Read-Host 'Finish pairing on the TV/dashboard, then press Enter to disconnect this computer' | Out-Null
    $null = Call-Adb -AdbArgs @('disconnect',$endpoint)
    Write-Host 'Disconnected. Disable network debugging on the TV after testing.'
} catch {
    Write-Host "`nInstallation stopped: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Do not factory-reset or remove accounts. Check TV authorization, IP/port and model.'
    if (Test-Path variable:adb) { if (Test-Path variable:endpoint) { try { $null = Call-Adb -AdbArgs @('disconnect',$endpoint) } catch {} } }
} finally {
    if (Test-Path variable:adb) { if (Test-Path variable:endpoint) { try { $null = Call-Adb -AdbArgs @('disconnect',$endpoint) } catch {} } }
    Read-Host 'Press Enter to close' | Out-Null
}
