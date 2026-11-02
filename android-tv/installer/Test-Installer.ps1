$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Blanco.Core.ps1')
function Assert($Value, $Message) { if (-not $Value) { throw $Message } }
Assert ((Get-TvEndpoint '192.168.1.20') -eq '192.168.1.20:5555') 'Default port'
Assert ((Get-TvEndpoint '10.0.0.2:37123') -eq '10.0.0.2:37123') 'Custom port'
foreach ($bad in @('8.8.8.8','127.0.0.1','192.168.1.20;whoami','192.168.1.20:99999','192.168.999.1')) {
    $failed=$false; try { $null=Get-TvEndpoint $bad } catch { $failed=$true }; Assert $failed "Reject $bad"
}
foreach ($mode in @('success','install-failed','launch-failed','unauthorized','old-android')) {
    $calls = [System.Collections.Generic.List[string]]::new()
    $state=@{Launches=0}
    $fake = {
        param([string[]]$Arguments)
        $cmd = $Arguments -join ' '
        $calls.Add($cmd)
        $code=0; $output=''
        switch -Regex ($cmd) {
            '^get-state$' { $output=if($mode -eq 'unauthorized'){'unauthorized'}else{'device'}; break }
            'ro.build.version.sdk' { $output=if($mode -eq 'old-android'){'25'}else{'34'}; break }
            'resolve-activity' { $output='com.android.tv/.Home'; break }
            '^install ' { if($mode -eq 'install-failed'){$code=1;$output='Failure [UPDATE_INCOMPATIBLE]'}else{$output='Success'};break }
            '^shell am start' { if($mode -eq 'launch-failed'){$code=1;$output='Error: Activity missing'}else{$output='Status: ok'};break }
        }
        [pscustomobject]@{Code=$code;Output=$output}
    }.GetNewClosure()
    $temp=Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
    try {
        $failed=$false; try { $result=Invoke-BlancoSetup -Bridge $fake -ApkPath 'C:\Test Folder\blanco.apk' -BackupDirectory $temp } catch { $failed=$true; Write-Host "$mode : $($_.Exception.Message)" }
        if($mode -in @('install-failed','launch-failed','unauthorized','old-android')) { Assert $failed "Must stop: $mode" } else {
            Assert (-not $failed) "Must install: $mode"
            Assert (-not $result.Managed -and -not $result.HomeSet) "Correct managed result: $mode"
            Assert (Test-Path (Join-Path $temp 'previous-home.txt')) 'Backup saved'
        }
        if($mode -in @('install-failed','launch-failed','unauthorized','old-android')) { Assert (-not ($calls -match 'set-home-activity|set-device-owner')) 'Never change Home/owner after failure' }
        Assert (-not ($calls -match 'set-home-activity|set-device-owner|set-active-admin')) 'Home and management never change'
        foreach ($call in $calls) { Assert ($call -match '^(get-state|shell getprop ro\.(build\.version\.sdk|product\.model)|shell cmd package resolve-activity |shell pm list packages|install -r |shell am start -W -n fr\.blanco\.tv/\.MainActivity)') "Unexpected command: $call" }
        Assert (-not ($calls -match 'uninstall|disable|factory|remove-active-admin|remove-user|wipe|tcpip')) 'No destructive or permanent debugging commands'
    } finally { Remove-Item -Recurse -Force $temp -ErrorAction SilentlyContinue }
}
$reads = [System.Collections.Generic.List[string]]::new()
$readBridge = {param([string[]]$Arguments) $cmd=$Arguments -join ' ';$reads.Add($cmd);$o=if($cmd -eq 'get-state'){'device'}elseif($cmd -match 'version.sdk'){'28'}else{'Fire TV'};[pscustomobject]@{Code=0;Output=$o}}.GetNewClosure()
$null=Get-BlancoInspection -Bridge $readBridge
Assert (-not ($reads -match 'install|am start|set-|dpm|disable|uninstall')) 'Inspection must be read-only'
Write-Host 'Installer endpoint validation, read-only inspection and 5 optional-display flows passed.'
