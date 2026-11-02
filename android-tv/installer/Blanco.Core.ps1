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
function Get-BlancoInspection {
    param([scriptblock]$Bridge)
    $state = & $Bridge -Arguments @('get-state')
    if ($state.Code -ne 0 -or $state.Output.Trim() -ne 'device') { throw 'TV not authorized. Accept the ADB dialog on the TV, then retry.' }
    $sdk = & $Bridge -Arguments @('shell','getprop','ro.build.version.sdk')
    $version = 0
    if (-not [int]::TryParse($sdk.Output.Trim(), [ref]$version) -or $version -lt 26) { throw 'Android 8 or later is required.' }
    $model = & $Bridge -Arguments @('shell','getprop','ro.product.model')
    $launcher = & $Bridge -Arguments @('shell','cmd','package','resolve-activity','--brief','-a','android.intent.action.MAIN','-c','android.intent.category.HOME')
    return [pscustomobject]@{ Model=$model.Output.Trim(); Sdk=$version; PreviousHome=$launcher.Output.Trim() }
}
function Invoke-BlancoSetup {
    param([scriptblock]$Bridge, [string]$ApkPath, [string]$BackupDirectory)
    $inspection = Get-BlancoInspection -Bridge $Bridge
    New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
    $inspection | ConvertTo-Json | Out-File -LiteralPath (Join-Path $BackupDirectory 'inspection.json') -Encoding utf8
    $inspection.PreviousHome | Out-File -LiteralPath (Join-Path $BackupDirectory 'previous-home.txt') -Encoding utf8
    $packages = & $Bridge -Arguments @('shell','pm','list','packages')
    $packages.Output | Out-File -LiteralPath (Join-Path $BackupDirectory 'packages.txt') -Encoding utf8
    Write-Host 'Installing optional Blanco TV display app...'
    $install = & $Bridge -Arguments @('install','-r',$ApkPath)
    if ($install.Code -ne 0 -or $install.Output -notmatch '(?m)^Success\s*$') { throw "Installation failed. Existing app/data kept. $($install.Output)" }
    $launch = & $Bridge -Arguments @('shell','am','start','-W','-n','fr.blanco.tv/.MainActivity')
    if ($launch.Code -ne 0 -or $launch.Output -match '(?i)error:|error type|exception|does not exist') { throw "App launch failed. No Home or device-management settings changed. $($launch.Output)" }
    return [pscustomobject]@{ HomeSet=$false; Managed=$false; PreviousHome=$inspection.PreviousHome; Backup=$BackupDirectory }
}
