# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Erfan Tahvilian
param([ValidateSet('Inspect','Publish','Runs','Jobs','Logs')][string]$Mode = 'Inspect')
$ErrorActionPreference = 'Stop'
if($Mode -eq 'Publish'){throw 'Stage all desktop and signed Android builds with GitHub Actions, then run finalize-release.yml. Local partial releases are not supported.'}
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
}
# Tokens remain in memory; never print headers or credential values.
