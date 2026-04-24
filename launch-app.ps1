param(
  [int]$Port = 3000,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

function Test-LocalPort {
  param(
    [int]$TestPort
  )

  $client = [System.Net.Sockets.TcpClient]::new()

  try {
    $async = $client.BeginConnect("127.0.0.1", $TestPort, $null, $null)
    $connected = $async.AsyncWaitHandle.WaitOne(300)

    if (-not $connected) {
      return $false
    }

    $client.EndConnect($async) | Out-Null
    return $true
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverScript = Join-Path $root "run-server.ps1"

if (-not (Test-Path -LiteralPath $serverScript)) {
  throw "run-server.ps1 was not found."
}

$serverAlreadyRunning = Test-LocalPort -TestPort $Port

if (-not $serverAlreadyRunning) {
  $argumentList = "-NoExit -ExecutionPolicy Bypass -File `"$serverScript`" -Port $Port"

  Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList $argumentList `
    -WorkingDirectory $root `
    -WindowStyle Minimized | Out-Null

  $serverReady = $false

  for ($index = 0; $index -lt 50; $index++) {
    Start-Sleep -Milliseconds 200

    if (Test-LocalPort -TestPort $Port) {
      $serverReady = $true
      break
    }
  }

  if (-not $serverReady) {
    throw "Server failed to start. Please check the server window."
  }
}

if (-not $NoBrowser) {
  Start-Process "http://localhost:$Port/"
}

Write-Host "Bottleapp Store is ready at http://localhost:$Port/"
