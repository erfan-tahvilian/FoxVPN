# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Erfan Tahvilian
param(
    [Parameter(Mandatory=$true)][string]$RunId,
    [ValidateSet('arm64-v8a','armeabi-v7a','x86_64','x86','universal')]
    [string[]]$Architectures=@('arm64-v8a','armeabi-v7a','x86_64','x86','universal'),
    [switch]$InstallCompatibility
)
$ErrorActionPreference = 'Stop'
if ($RunId -notmatch '^\d+$') { throw 'Invalid build run ID.' }
if ($InstallCompatibility -and ($Architectures.Count -ne 1 -or $Architectures[0] -ne 'arm64-v8a')) { throw 'Installation experiments are ARM64-only; specify -Architectures arm64-v8a.' }
$foxRoot = Split-Path -Parent $PSScriptRoot
$foxGh = Join-Path $foxRoot '.tools/gh/bin/gh.exe'
$foxCredentials = "protocol=https`nhost=github.com`n`n" | git credential fill
if ($LASTEXITCODE -ne 0) { throw 'GitHub credentials are unavailable.' }
$foxCredentialValues = @{}
foreach ($foxLine in $foxCredentials) {
    $foxPair = $foxLine -split '=', 2
    if ($foxPair.Length -eq 2) { $foxCredentialValues[$foxPair[0]] = $foxPair[1] }
}
if (!$foxCredentialValues['password']) { throw 'GitHub authentication is unavailable.' }
$foxPreviousToken = $env:GH_TOKEN
try {
    $env:GH_TOKEN = $foxCredentialValues['password']
    $foxRunJson = & $foxGh api ('repos/erfan-tahvilian/FoxVPN/actions/runs/' + $RunId)
    if ($LASTEXITCODE -ne 0) { throw 'Could not verify Android build metadata.' }
    $foxRun = $foxRunJson | ConvertFrom-Json
} finally { $env:GH_TOKEN = $foxPreviousToken }
if ($foxRun.conclusion -ne 'success' -or $foxRun.path -ne '.github/workflows/android.yml') { throw 'A successful Android CI build is required.' }
if($foxRun.head_sha -ne (git rev-parse HEAD).Trim()){
    # Release tooling may change after a build; every APK input must still match.
    & git diff --exit-code $foxRun.head_sha HEAD -- android src/ui assets licenses LICENSE COPYRIGHT scripts/prepare-android.cjs scripts/android-notices.cjs .github/workflows/android.yml | Out-Null
    if($LASTEXITCODE -ne 0){throw 'Android application source differs from the verified CI build.'}
}
$foxBuild = Join-Path $foxRoot ('.tools/android-build-' + $RunId)
$foxSigningTools = Join-Path $foxRoot '.tools/android-signing-tools'
$foxOutput = Join-Path $foxRoot $(if($InstallCompatibility){'dist/android-install-compat'}else{'dist/android'})
$foxKeystore = Join-Path $foxRoot '.tools/android-release.jks'
$foxPasswordFile = Join-Path $foxRoot '.tools/android-key-password.dpapi'
if (!(Test-Path -LiteralPath $foxKeystore) -or !(Test-Path -LiteralPath $foxPasswordFile)) { throw 'Local Android signing identity is unavailable; refusing to create a replacement.' }
New-Item -ItemType Directory -Path $foxBuild,$foxSigningTools,$foxOutput -Force | Out-Null
$foxPreviousToken = $env:GH_TOKEN
$foxDownload = Join-Path $foxRoot ('.tools/android-download-' + $RunId + '-' + [guid]::NewGuid().ToString('N'))
$foxArtifactName = if ($Architectures.Count -eq 1 -and $Architectures[0] -eq 'arm64-v8a') { 'Android-unsigned-arm64' } else { 'Android-unsigned-build' }
$foxSignerHash='00ef9948f843fe395d2440ae3ef41405b8040a6d5d46493bd1902ac0ee6deae7'
$foxCachedSigner=Join-Path $foxSigningTools 'apksigner.jar'
try {
    $env:GH_TOKEN = $foxCredentialValues['password']
    $foxMissing=@($Architectures | Where-Object { @(Get-ChildItem -LiteralPath $foxBuild -Recurse -File -Filter ('app-' + $_ + '-release-unsigned.apk')).Count -ne 1 })
    if($foxMissing.Count -gt 0){
        & $foxGh run download $RunId --repo erfan-tahvilian/FoxVPN --name $foxArtifactName --dir (Join-Path $foxDownload 'build')
        if ($LASTEXITCODE -ne 0) { throw 'Could not download the verified Android build.' }
        Copy-Item -Path (Join-Path $foxDownload 'build/*') -Destination $foxBuild -Recurse -Force
    }
    if(!(Test-Path -LiteralPath $foxCachedSigner) -or (Get-FileHash -LiteralPath $foxCachedSigner -Algorithm SHA256).Hash.ToLowerInvariant() -ne $foxSignerHash){
        & $foxGh run download $RunId --repo erfan-tahvilian/FoxVPN --name Android-signing-tools --dir (Join-Path $foxDownload 'tools')
        if ($LASTEXITCODE -ne 0) { throw 'Could not download signing tools.' }
        Copy-Item -Path (Join-Path $foxDownload 'tools/*') -Destination $foxSigningTools -Recurse -Force
    }
    if((Get-FileHash -LiteralPath $foxCachedSigner -Algorithm SHA256).Hash.ToLowerInvariant() -ne $foxSignerHash){throw 'Android signing tool checksum mismatch.'}
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
        $foxInput = $foxInputs[0].FullName
        $foxSuffix = ''
        if($InstallCompatibility){
            $foxExperiment=Join-Path $foxRoot ('.tools/android-install-compat-'+$RunId)
            New-Item -ItemType Directory -Path $foxExperiment -Force | Out-Null
            $foxRaw=Join-Path $foxExperiment 'repacked-unsigned.apk'
            & python (Join-Path $foxRoot '.github/scripts/make_install_compat.py') $foxInput $foxRaw | Set-Content (Join-Path $foxExperiment 'payload-report.json') -Encoding utf8
            if($LASTEXITCODE -ne 0){throw 'Installation experiment payload verification failed.'}
            $foxSdk=if($env:ANDROID_HOME){$env:ANDROID_HOME}else{Join-Path $foxRoot '.tools/phone-sdk'}
            $foxAligners=@(Get-ChildItem -LiteralPath (Join-Path $foxSdk 'build-tools') -Directory | Sort-Object Name -Descending | ForEach-Object {Join-Path $_.FullName 'zipalign.exe'} | Where-Object {Test-Path -LiteralPath $_})
            if(!$foxAligners.Count){throw 'A local Windows Android SDK zipalign tool is required; no extra tool download is performed.'}
            $foxInput=Join-Path $foxExperiment 'aligned-unsigned.apk'
            & $foxAligners[0] -P 16 -f 4 $foxRaw $foxInput
            if($LASTEXITCODE -ne 0){throw 'Installation experiment alignment failed.'}
            $foxSuffix='-install-compat'
        }
        $foxApk = Join-Path $foxOutput ('FoxVPN-1.0.0-Android-' + $foxAbi + $foxSuffix + '.apk')
        & $foxJava -jar $foxSigner sign --ks $foxKeystore --ks-key-alias foxvpn --ks-pass env:FOX_ANDROID_SIGNING_PASS --key-pass env:FOX_ANDROID_SIGNING_PASS --min-sdk-version 26 --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --v4-signing-enabled false --out $foxApk $foxInput
        if ($LASTEXITCODE -ne 0) { throw ('Signing failed for ' + $foxAbi) }
        $foxVerification = & $foxJava -jar $foxSigner verify --verbose --print-certs $foxApk
        if ($LASTEXITCODE -ne 0 -or ($foxVerification -join "\n") -notmatch [regex]::Escape($foxCertificate)) { throw ('Signature or signing identity mismatch for ' + $foxAbi) }
        [pscustomobject]@{Package=(Split-Path -Leaf $foxApk);SHA256=(Get-FileHash $foxApk -Algorithm SHA256).Hash.ToLowerInvariant();Certificate=$foxCertificate}
    }
} finally { Remove-Item Env:FOX_ANDROID_SIGNING_PASS -ErrorAction SilentlyContinue }
