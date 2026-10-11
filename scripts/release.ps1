param([ValidateSet('Inspect','Publish','Runs','Jobs','Logs')][string]$Mode = 'Inspect')
$ErrorActionPreference = 'Stop'
$foxCredentials = "protocol=https`nhost=github.com`n`n" | git credential fill
if ($LASTEXITCODE -ne 0) { throw 'GitHub credentials are unavailable. Sign in through Git Credential Manager.' }
$foxCredentialValues = @{}
foreach ($foxLine in $foxCredentials) {
  $foxPair = $foxLine -split '=', 2
  if ($foxPair.Length -eq 2) { $foxCredentialValues[$foxPair[0]] = $foxPair[1] }
}
if (!$foxCredentialValues['password']) { throw 'GitHub authentication is unavailable.' }
$foxHeaders = @{Authorization = 'Bearer ' + $foxCredentialValues['password']; Accept = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28'}
$foxApi = 'https://api.github.com/repos/erfan-tahvilian/FoxVPN'
function Invoke-FoxApi([string]$Path, [string]$Method = 'GET', $Body = $null) {
  $foxParameters = @{Uri = $foxApi + $Path; Headers = $foxHeaders; Method = $Method}
  if ($null -ne $Body) { $foxParameters.ContentType = 'application/json'; $foxParameters.Body = $Body | ConvertTo-Json -Depth 10 }
  Invoke-RestMethod @foxParameters
}
if ($Mode -eq 'Inspect') {
  $foxRepo = Invoke-FoxApi ''
  [pscustomobject]@{Repository = $foxRepo.full_name; CanPush = $foxRepo.permissions.push; DefaultBranch = $foxRepo.default_branch}
} elseif ($Mode -in 'Runs','Jobs','Logs') {
  $foxRuns = Invoke-FoxApi '/actions/runs?per_page=5'
  $foxRuns.workflow_runs | Select-Object id, head_sha, status, conclusion, html_url
  if ($Mode -in 'Jobs','Logs') {
    $foxJobs = Invoke-FoxApi ('/actions/runs/' + $foxRuns.workflow_runs[0].id + '/jobs')
    foreach ($foxJob in $foxJobs.jobs) { $foxJob.steps | Select-Object name,status,conclusion }
    if ($Mode -eq 'Logs') {
      $foxFailedJob = $foxJobs.jobs | Where-Object conclusion -eq 'failure' | Select-Object -First 1
      if ($foxFailedJob) {
        $foxJobLog = Invoke-WebRequest -Uri ($foxApi + '/actions/jobs/' + $foxFailedJob.id + '/logs') -Headers $foxHeaders
        ($foxJobLog.Content -split "`n") | Select-Object -Last 65
      }
    }
  }
} else {
  $foxVersion = (Get-Content package.json -Raw | ConvertFrom-Json).version
  $foxTag = 'v' + $foxVersion
  $foxCommit = (git rev-parse HEAD).Trim()
  $foxAssets = @(Get-ChildItem -LiteralPath dist -File | Where-Object { ($_.Name -in ('FoxVPN-' + $foxVersion + '-Windows-x64.exe'), ('FoxVPN-' + $foxVersion + '-Windows-x64.zip') -or $_.Extension -eq '.gz') -or $_.Name -eq 'SHA256SUMS.txt' })
  if ($foxAssets.Count -lt 4) { throw 'Build the installer, portable ZIP, source archive and checksums before publishing.' }
  if ((git status --porcelain).Length -gt 0) { throw 'Commit all source changes before publishing.' }
  $foxNotes = Get-Content -LiteralPath 'RELEASE_NOTES.md' -Raw
  $foxRelease = $null
  try { $foxRelease = Invoke-FoxApi ('/releases/tags/' + $foxTag) } catch { if ([int]$_.Exception.Response.StatusCode -ne 404) { throw } }
  if ($null -eq $foxRelease) {
    $foxRelease = (Invoke-FoxApi '/releases?per_page=30') | Where-Object tag_name -eq $foxTag | Select-Object -First 1
  }
  if ($null -eq $foxRelease) {
    $foxRelease = Invoke-FoxApi '/releases' 'POST' @{tag_name=$foxTag; target_commitish=$foxCommit; name=('Fox VPN ' + $foxTag + ' — Windows'); body=$foxNotes; draft=$true; prerelease=$false}
  } elseif (!$foxRelease.draft) {
    if ($foxTag -ne 'v1.0.0') { throw ($foxTag + ' is already published; refusing to replace its assets.') }
    # The owner explicitly requested ongoing updates under the fixed v1.0.0 release.
    $foxRelease = Invoke-FoxApi ('/releases/' + $foxRelease.id) 'PATCH' @{draft=$true; body=$foxNotes; name=('Fox VPN ' + $foxTag + ' — Windows')}
  }
  foreach ($foxAsset in $foxAssets) {
    $foxExisting = $foxRelease.assets | Where-Object name -eq $foxAsset.Name
    if ($foxExisting) { Invoke-FoxApi ('/releases/assets/' + $foxExisting.id) 'DELETE' | Out-Null }
    $foxUploadUrl = $foxRelease.upload_url -replace '\{.*$', ''
    $foxUploadUrl += '?name=' + [uri]::EscapeDataString($foxAsset.Name)
    Invoke-RestMethod -Uri $foxUploadUrl -Headers $foxHeaders -Method POST -ContentType 'application/octet-stream' -InFile $foxAsset.FullName -TimeoutSec 900 | Select-Object name,size
  }
  $foxPublished = Invoke-FoxApi ('/releases/' + $foxRelease.id) 'PATCH' @{draft=$false}
  [pscustomobject]@{Release=$foxPublished.html_url; Tag=$foxPublished.tag_name; Published=$foxPublished.published_at}
}
# Tokens remain in memory; never print headers or credential values.
