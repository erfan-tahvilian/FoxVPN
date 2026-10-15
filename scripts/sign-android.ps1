param(
    [Parameter(Mandatory=$true)][string]$RunId,
    [ValidateSet('arm64-v8a','armeabi-v7a','x86_64','x86','universal')]
    [string[]]$Architectures=@('arm64-v8a','armeabi-v7a','x86_64','x86','universal')
)
$ErrorActionPreference = 'Stop'
if ($RunId -notmatch '^\d+$') { throw 'Invalid build run ID.' }
. "$PSScriptRoot/release.ps1" -Mode Inspect | Out-Null
$foxRoot = Split-Path -Parent $PSScriptRoot
$foxRun = Invoke-FoxApi ('/actions/runs/' + $RunId)
if ($foxRun.conclusion -ne 'success' -or $foxRun.head_sha -ne (git rev-parse HEAD).Trim()) { throw 'Android build must pass for the current source commit.' }
$foxGh = Join-Path $foxRoot '.tools/gh/bin/gh.exe'
$foxBuild = Join-Path $foxRoot ('.tools/android-build-' + $RunId)
$foxSigningTools = Join-Path $foxRoot '.tools/android-signing-tools'
$foxOutput = Join-Path $foxRoot 'dist/android'
$foxKeystore = Join-Path $foxRoot '.tools/android-release.jks'
$foxPasswordFile = Join-Path $foxRoot '.tools/android-key-password.dpapi'
if (!(Test-Path -LiteralPath $foxKeystore) -or !(Test-Path -LiteralPath $foxPasswordFile)) { throw 'Local Android signing identity is unavailable; refusing to create a replacement.' }
New-Item -ItemType Directory -Path $foxBuild,$foxSigningTools,$foxOutput -Force | Out-Null
$foxPreviousToken = $env:GH_TOKEN
$foxDownload = Join-Path $foxRoot ('.tools/android-download-' + $RunId + '-' + [guid]::NewGuid().ToString('N'))
$foxArtifactName = if ($Architectures.Count -eq 1 -and $Architectures[0] -eq 'arm64-v8a') { 'Android-unsigned-arm64' } else { 'Android-unsigned-build' }
try {
    $env:GH_TOKEN = $foxCredentialValues['password']
    & $foxGh run download $RunId --repo erfan-tahvilian/FoxVPN --name $foxArtifactName --dir (Join-Path $foxDownload 'build')
    if ($LASTEXITCODE -ne 0) { throw 'Could not download the verified Android build.' }
    & $foxGh run download $RunId --repo erfan-tahvilian/FoxVPN --name Android-signing-tools --dir (Join-Path $foxDownload 'tools')
    if ($LASTEXITCODE -ne 0) { throw 'Could not download signing tools.' }
    Copy-Item -Path (Join-Path $foxDownload 'build/*') -Destination $foxBuild -Recurse -Force
    Copy-Item -Path (Join-Path $foxDownload 'tools/*') -Destination $foxSigningTools -Recurse -Force
} finally { $env:GH_TOKEN = $foxPreviousToken }
Add-Type -AssemblyName System.Security.Cryptography.ProtectedData
$foxPassword = [System.Text.Encoding]::UTF8.GetString([System.Security.Cryptography.ProtectedData]::Unprotect([System.IO.File]::ReadAllBytes($foxPasswordFile),$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser))
$env:FOX_ANDROID_SIGNING_PASS = $foxPassword
$foxJava = 'D:\Program Files\Java\jdk-22\bin\java.exe'
$foxSigner = Join-Path $foxSigningTools 'apksigner.jar'
$foxCertificate = (Get-Content (Join-Path $foxRoot 'android/signing-certificate.sha256') -Raw).Trim()
try {
    foreach ($foxAbi in $Architectures) {
        $foxInputs = @(Get-ChildItem -LiteralPath $foxBuild -Recurse -File -Filter ('app-' + $foxAbi + '-release-unsigned.apk'))
        if ($foxInputs.Count -ne 1) { throw ('Expected one verified Android package for ' + $foxAbi) }
        $foxApk = Join-Path $foxOutput ('FoxVPN-1.0.0-Android-' + $foxAbi + '.apk')
        & $foxJava -jar $foxSigner sign --ks $foxKeystore --ks-key-alias foxvpn --ks-pass env:FOX_ANDROID_SIGNING_PASS --key-pass env:FOX_ANDROID_SIGNING_PASS --min-sdk-version 26 --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --v4-signing-enabled false --out $foxApk $foxInputs[0].FullName
        if ($LASTEXITCODE -ne 0) { throw ('Signing failed for ' + $foxAbi) }
        $foxVerification = & $foxJava -jar $foxSigner verify --verbose --print-certs $foxApk
        if ($LASTEXITCODE -ne 0 -or ($foxVerification -join "\n") -notmatch [regex]::Escape($foxCertificate)) { throw ('Signature or signing identity mismatch for ' + $foxAbi) }
        [pscustomobject]@{Package=(Split-Path -Leaf $foxApk);SHA256=(Get-FileHash $foxApk -Algorithm SHA256).Hash.ToLowerInvariant();Certificate=$foxCertificate}
    }
} finally { Remove-Item Env:FOX_ANDROID_SIGNING_PASS -ErrorAction SilentlyContinue }
