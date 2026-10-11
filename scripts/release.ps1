param([ValidateSet('Inspect','Publish','Runs')][string]$Mode = 'Inspect')
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
} elseif ($Mode -eq 'Runs') {
  $foxRuns = Invoke-FoxApi '/actions/runs?per_page=5'
  $foxRuns.workflow_runs | Select-Object id, head_sha, status, conclusion, html_url
} else {
  $foxCommit = (git rev-parse HEAD).Trim()
  $foxAssets = @(Get-ChildItem -LiteralPath dist -File | Where-Object { $_.Extension -in '.exe', '.zip', '.gz' -or $_.Name -eq 'SHA256SUMS.txt' })
  if ($foxAssets.Count -lt 4) { throw 'Build the installer, portable ZIP, source archive and checksums before publishing.' }
  if ((git status --porcelain).Length -gt 0) { throw 'Commit all source changes before publishing.' }
  $foxNotes = Get-Content -LiteralPath 'RELEASE_NOTES.md' -Raw
  $foxRelease = $null
  try { $foxRelease = Invoke-FoxApi '/releases/tags/v1.0.0' } catch { if ([int]$_.Exception.Response.StatusCode -ne 404) { throw } }
  if ($null -eq $foxRelease) {
    $foxRelease = Invoke-FoxApi '/releases' 'POST' @{tag_name='v1.0.0'; target_commitish=$foxCommit; name='Fox VPN v1.0.0 — Windows'; body=$foxNotes; draft=$true; prerelease=$false}
  } elseif (!$foxRelease.draft) { throw 'v1.0.0 is already published; refusing to replace its assets.' }
  foreach ($foxAsset in $foxAssets) {
    $foxExisting = $foxRelease.assets | Where-Object name -eq $foxAsset.Name
    if ($foxExisting) { Invoke-FoxApi ('/releases/assets/' + $foxExisting.id) 'DELETE' | Out-Null }
    $foxUploadUrl = $foxRelease.upload_url -replace '\{.*$', ''
    $foxUploadUrl += '?name=' + [uri]::EscapeDataString($foxAsset.Name)
    Invoke-RestMethod -Uri $foxUploadUrl -Headers $foxHeaders -Method POST -ContentType 'application/octet-stream' -InFile $foxAsset.FullName | Select-Object name,size
  }
  $foxPublished = Invoke-FoxApi ('/releases/' + $foxRelease.id) 'PATCH' @{draft=$false}
  [pscustomobject]@{Release=$foxPublished.html_url; Tag=$foxPublished.tag_name; Published=$foxPublished.published_at}
}
# Tokens remain in memory; never print headers or credential values.
