Set-StrictMode -Version Latest
function Get-TvEndpoint([string]$Value) {
    $match = [regex]::Match($Value.Trim(), '^(?<host>(?:[0-9]{1,3}\.){3}[0-9]{1,3})(?::(?<port>[0-9]{1,5}))?$')
    if (-not $match.Success) { throw 'Enter an IPv4 address, optionally followed by :port.' }
    $ip = [System.Net.IPAddress]::Parse($match.Groups['host'].Value)
    $b = $ip.GetAddressBytes()
    if (-not (($b[0] -eq 10) -or ($b[0] -eq 192 -and $b[1] -eq 168) -or ($b[0] -eq 172 -and $b[1] -ge 16 -and $b[1] -le 31))) { throw 'Use the private LAN address shown on your TV.' }
    $port = 5555
    if ($match.Groups['port'].Success) { $port = [int]$match.Groups['port'].Value }
    if ($port -lt 1 -or $port -gt 65535) { throw 'Invalid port.' }
    return "$($ip.ToString()):$port"
}
function Assert-PackageHash([string]$Path, [string]$Expected) {
    if ((Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash -ne $Expected) { throw 'Package checksum mismatch. Download the original Blanco ZIP again.' }
}
function Invoke-BlancoSetup {
    param([scriptblock]$Bridge, [string]$ApkPath, [bool]$Managed, [string]$BackupDirectory)
    $component = 'fr.blanco.tv/.MainActivity'
    $admin = 'fr.blanco.tv/.AdminReceiver'
    $state = & $Bridge -Arguments @('get-state')
    if ($state.Code -ne 0 -or $state.Output.Trim() -ne 'device') { throw 'TV not authorized. Accept the ADB dialog on the TV, then retry.' }
    $sdk = & $Bridge -Arguments @('shell','getprop','ro.build.version.sdk')
    $version = 0
    if (-not [int]::TryParse($sdk.Output.Trim(), [ref]$version) -or $version -lt 26) { throw 'Android 8 or later is required.' }
    New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
    $old = & $Bridge -Arguments @('shell','cmd','package','resolve-activity','--brief','-a','android.intent.action.MAIN','-c','android.intent.category.HOME')
    $oldHome = ''
    foreach ($line in ($old.Output -split "`n")) {
        if ($line.Trim() -match '^[A-Za-z0-9_.]+/[A-Za-z0-9_.$]+$') { $oldHome = $line.Trim() }
    }
    foreach ($record in @(@('model',@('shell','getprop','ro.product.model')), @('packages',@('shell','pm','list','packages')), @('owners',@('shell','dpm','list-owners')))) {
        $r = & $Bridge -Arguments $record[1]
        $r.Output | Out-File -LiteralPath (Join-Path $BackupDirectory ($record[0]+'.txt')) -Encoding utf8
    }
    $oldHome | Out-File -LiteralPath (Join-Path $BackupDirectory 'previous-home.txt') -Encoding utf8
    Write-Host 'Installing Blanco TV...'
    $install = & $Bridge -Arguments @('install','-r',$ApkPath)
    if ($install.Code -ne 0 -or $install.Output -notmatch '(?m)^Success\s*$') { throw "Installation failed. Existing app/data kept. $($install.Output)" }
    $launch = & $Bridge -Arguments @('shell','am','start','-W','-n',$component)
    if ($launch.Code -ne 0 -or $launch.Output -match '(?i)error:|exception|does not exist') { throw "App launch failed; Home was not changed. $($launch.Output)" }
    $homeResult = & $Bridge -Arguments @('shell','cmd','package','set-home-activity',$component)
    $homeSet = $homeResult.Code -eq 0 -and $homeResult.Output -match '(?i)success'
    $ownerSet = $false
    $ownerMessage = 'Not requested.'
    if ($Managed) {
        $owner = & $Bridge -Arguments @('shell','dpm','set-device-owner',$admin)
        $ownerMessage = $owner.Output
        $ownerSet = $owner.Code -eq 0 -and $owner.Output -match '(?i)success'
        if (-not $ownerSet) {
            $existing = & $Bridge -Arguments @('shell','dumpsys','device_policy')
            $ownerSet = $existing.Output -match '(?is)Device Owner.{0,400}ComponentInfo\{fr\.blanco\.tv/[^}]*AdminReceiver\}'
        }
    }
    $ownerMessage | Out-File -LiteralPath (Join-Path $BackupDirectory 'managed-mode.txt') -Encoding utf8
    $finalLaunch = & $Bridge -Arguments @('shell','am','start','-W','-n',$component)
    if ($finalLaunch.Code -ne 0 -or $finalLaunch.Output -match '(?i)error:|exception') {
        if ($homeSet -and $oldHome -and $oldHome -ne $component) { $null = & $Bridge -Arguments @('shell','cmd','package','set-home-activity',$oldHome) }
        throw 'Final launch failed. Previous Home restored when available. See backup; do not disable any launcher.'
    }
    return [pscustomobject]@{ HomeSet=$homeSet; Managed=$ownerSet; PreviousHome=$oldHome; Backup=$BackupDirectory }
}
