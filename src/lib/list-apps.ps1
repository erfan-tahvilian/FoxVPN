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
$foxNames=@{}
$foxAppsFolder=(New-Object -ComObject Shell.Application).Namespace('shell:AppsFolder')
foreach($foxItem in $foxAppsFolder.Items()){$foxNames[$foxItem.ExtendedProperty('System.AppUserModel.ID')]=$foxItem.Name}
Get-AppxPackage | ForEach-Object {
 $foxPackage=$_
 try{
  [xml]$foxManifest=Get-Content -LiteralPath (Join-Path $foxPackage.InstallLocation 'AppxManifest.xml') -Raw
  foreach($foxApplication in $foxManifest.Package.Applications.Application){
   $foxName=$foxNames[$foxPackage.PackageFamilyName+'!'+$foxApplication.Id]
   if($foxName){Add-FoxApplication $foxName (Join-Path $foxPackage.InstallLocation $foxApplication.Executable)}
  }
 }catch{}
}
ConvertTo-Json -InputObject @($foxFound.ToArray()) -Compress -Depth 4
