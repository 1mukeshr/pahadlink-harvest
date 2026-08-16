# Start portable MongoDB for local PahadLink development.
# Data: D:\pahadlink-project\mongodb-data
# URI:  mongodb://127.0.0.1:27017/Pahadi_link_DB

$ErrorActionPreference = 'Stop'

$Mongod = 'D:\pahadlink-project\mongodb7\mongodb-win32-x86_64-windows-7.0.21\bin\mongod.exe'
$DataDir = 'D:\pahadlink-project\mongodb-data'
$LogDir = 'D:\pahadlink-project\mongodb-logs'
$LogFile = Join-Path $LogDir 'mongod.log'
$Port = 27017

if (-not (Test-Path $Mongod)) {
  Write-Error "mongod not found at $Mongod. Re-extract MongoDB 7.0 under D:\pahadlink-project\mongodb7"
}

function Test-MongoPort {
  try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $iar = $tcp.BeginConnect('127.0.0.1', $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(500) -and $tcp.Connected
    $tcp.Close()
    return $ok
  } catch {
    return $false
  }
}

if (Test-MongoPort) {
  Write-Host "MongoDB already running on 127.0.0.1:$Port"
  Write-Host "URI: mongodb://127.0.0.1:$Port/Pahadi_link_DB"
  exit 0
}

New-Item -ItemType Directory -Force -Path $DataDir, $LogDir | Out-Null

Start-Process -FilePath $Mongod -ArgumentList @(
  '--dbpath', $DataDir,
  '--logpath', $LogFile,
  '--bind_ip', '127.0.0.1',
  '--port', "$Port"
) -WindowStyle Hidden

for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Milliseconds 500
  if (Test-MongoPort) {
    Write-Host "MongoDB started on 127.0.0.1:$Port"
    Write-Host "URI: mongodb://127.0.0.1:$Port/Pahadi_link_DB"
    Write-Host "Log: $LogFile"
    exit 0
  }
}

Write-Error "MongoDB failed to start. Check log: $LogFile"
