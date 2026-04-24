$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = if ($env:PORT) { $env:PORT } else { "3000" }
$env:PORT = $port

Write-Host "Starting Bottleapp Store on http://localhost:$port"
node (Join-Path $root "server.js")
