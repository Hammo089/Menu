$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Blanco.Core.ps1')
function Assert($Value, $Message) { if (-not $Value) { throw $Message } }
Assert ((Get-TvEndpoint '192.168.1.20') -eq '192.168.1.20:5555') 'Default port'
Assert ((Get-TvEndpoint '10.0.0.2:37123') -eq '10.0.0.2:37123') 'Custom port'
foreach ($bad in @('8.8.8.8','127.0.0.1','192.168.1.20;whoami','192.168.1.20:99999','192.168.999.1')) {
    $failed=$false; try { $null=Get-TvEndpoint $bad } catch { $failed=$true }; Assert $failed "Reject $bad"
}
foreach ($mode in @('success','owner-blocked','install-failed','launch-failed','unauthorized','old-android','final-launch-failed')) {
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
            '^shell am start' { $state.Launches++; if($mode -eq 'launch-failed' -or ($mode -eq 'final-launch-failed' -and $state.Launches -eq 2)){$code=1;$output='Error: Activity missing'}else{$output='Status: ok'};break }
            'set-home-activity' { $output='Success';break }
            'set-device-owner' { if($mode -eq 'owner-blocked'){$code=1;$output='Error: accounts exist'}else{$output='Success: Device owner set'};break }
        }
        [pscustomobject]@{Code=$code;Output=$output}
    }.GetNewClosure()
    $temp=Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
    try {
        $failed=$false; try { $result=Invoke-BlancoSetup -Bridge $fake -ApkPath 'C:\Test Folder\blanco.apk' -Managed $true -BackupDirectory $temp } catch { $failed=$true; Write-Host "$mode : $($_.Exception.Message)" }
        if($mode -in @('install-failed','launch-failed','unauthorized','old-android','final-launch-failed')) { Assert $failed "Must stop: $mode" } else {
            Assert (-not $failed) "Must install: $mode"
            Assert ($result.Managed -eq ($mode -eq 'success')) "Correct managed result: $mode"
            Assert (Test-Path (Join-Path $temp 'previous-home.txt')) 'Backup saved'
        }
        if($mode -in @('install-failed','launch-failed','unauthorized','old-android')) { Assert (-not ($calls -match 'set-home-activity|set-device-owner')) 'Never change Home/owner after failure' }
        if($mode -eq 'final-launch-failed') { Assert ($calls[-1] -eq 'shell cmd package set-home-activity com.android.tv/.Home') 'Restore previous Home' }
        Assert (-not ($calls -match 'uninstall|disable|factory|remove-active-admin|remove-user|wipe|tcpip')) 'No destructive or permanent debugging commands'
    } finally { Remove-Item -Recurse -Force $temp -ErrorAction SilentlyContinue }
}
Write-Host 'Installer endpoint validation and 7 device flows passed.'
