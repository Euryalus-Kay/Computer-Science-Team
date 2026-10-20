import { originOf } from "@/lib/launch";

/**
 * irm <site>/desktop/install.ps1 | iex
 * Installs per user (no admin), registers the labcs:// link and a Start menu entry.
 * Invoke-WebRequest doesn't mark the download, so SmartScreen doesn't interrupt.
 */
export function GET(req: Request) {
  const { origin } = originOf(req);
  const script = `$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$url = '${origin}/api/desktop/download/windows-zip'
$dest = Join-Path $env:LOCALAPPDATA 'Programs\\Lab CS'
$zip = Join-Path $env:TEMP 'labcs-app.zip'
Write-Host 'Downloading Lab CS...'
Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
Get-Process -Name 'Lab CS' -ErrorAction SilentlyContinue | Stop-Process -Force
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
Expand-Archive -Path $zip -DestinationPath $dest -Force
Remove-Item $zip -Force
$exe = Get-ChildItem -Path $dest -Filter 'Lab CS.exe' -Recurse | Select-Object -First 1 -ExpandProperty FullName
if (-not $exe) { throw 'Lab CS.exe not found in the download.' }
Get-ChildItem -Path $dest -Recurse -File | Unblock-File
$key = 'HKCU:\\Software\\Classes\\labcs'
New-Item -Path "$key\\shell\\open\\command" -Force | Out-Null
Set-ItemProperty -Path $key -Name '(Default)' -Value 'URL:Lab CS'
Set-ItemProperty -Path $key -Name 'URL Protocol' -Value ''
Set-ItemProperty -Path "$key\\shell\\open\\command" -Name '(Default)' -Value ('"' + $exe + '" "%1"')
$lnk = Join-Path ([Environment]::GetFolderPath('Programs')) 'Lab CS.lnk'
$sh = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
$sh.TargetPath = $exe
$sh.Save()
Write-Host "Installed to $dest"
Start-Process -FilePath $exe -ArgumentList '--setup', '${origin}'
Write-Host 'Done. Go back to the website and press Open in app.'
`;
  return new Response(script, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
