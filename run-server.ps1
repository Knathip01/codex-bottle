param(
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$env:PORT = $Port

Write-Host ""
Write-Host "Bottleapp Store running on http://localhost:$Port"
Write-Host "Close this window to stop the app."
Write-Host ""

node (Join-Path $root "server.js")
