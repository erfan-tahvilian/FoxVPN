# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Erfan Tahvilian
$ErrorActionPreference='SilentlyContinue'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$foxFound=[Collections.Generic.List[object]]::new()
function Add-FoxApplication([string]$Name,[string]$Target){
 if($Target -and [IO.Path]::GetExtension($Target) -ieq '.exe' -and (Test-Path -LiteralPath $Target -PathType Leaf)){
  $foxExecutable=[IO.Path]::GetFileName($Target)
  if($foxExecutable -notmatch '(?i)unins|uninstall|setup|update|crashpad|installer'){
   $foxFound.Add([pscustomobject]@{id=$foxExecutable;name=$Name;path=$Target;processes=@($foxExecutable)})
  }
 }
}
$foxShell=New-Object -ComObject WScript.Shell
foreach($foxRoot in @([Environment]::GetFolderPath('StartMenu'),[Environment]::GetFolderPath('CommonStartMenu'),[Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('CommonDesktopDirectory'))){
 if(!$foxRoot){continue}
 Get-ChildItem -LiteralPath $foxRoot -Filter '*.lnk' -Recurse -File | ForEach-Object {
  $foxLink=$foxShell.CreateShortcut($_.FullName)
  Add-FoxApplication $_.BaseName $foxLink.TargetPath
 }
}
foreach($foxKey in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths','HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths')){
 Get-ChildItem -LiteralPath $foxKey | ForEach-Object {
  $foxTarget=$_.GetValue('')
  if($foxTarget){$foxTarget=$foxTarget.Trim('"');$foxName=(Get-Item -LiteralPath $foxTarget).VersionInfo.FileDescription;if(!$foxName){$foxName=[IO.Path]::GetFileNameWithoutExtension($foxTarget)};Add-FoxApplication $foxName $foxTarget}
 }
}
# Appx inventory can stall while Windows initializes package services. Keep the
# Win32 catalog available and bound optional Store-app discovery independently.
$foxAppxJob=Start-Job -ScriptBlock {
 $ErrorActionPreference='SilentlyContinue'
 Get-AppxPackage | ForEach-Object {
  $package=$_
  try {
   [xml]$manifest=Get-Content -LiteralPath (Join-Path $package.InstallLocation 'AppxManifest.xml') -Raw
   foreach($application in $manifest.Package.Applications.Application){
    $name=[string]$application.VisualElements.DisplayName
    if(!$name -or $name -like 'ms-resource:*'){$name=$package.Name}
    if($application.Executable){[pscustomobject]@{Name=$name;Target=(Join-Path $package.InstallLocation $application.Executable)}}
   }
  }catch{}
 }
}
try {
 $null=Wait-Job -Job $foxAppxJob -Timeout 15
 Receive-Job -Job $foxAppxJob | ForEach-Object {Add-FoxApplication $_.Name $_.Target}
}finally{
 Stop-Job -Job $foxAppxJob
 Remove-Job -Job $foxAppxJob -Force
}
ConvertTo-Json -InputObject @($foxFound.ToArray()) -Compress -Depth 4
