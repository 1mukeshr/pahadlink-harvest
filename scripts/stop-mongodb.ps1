# Stop the portable MongoDB process started for PahadLink.

$ErrorActionPreference = 'Stop'
$procs = Get-Process mongod -ErrorAction SilentlyContinue

if (-not $procs) {
  Write-Host 'MongoDB is not running.'
  exit 0
}

$procs | Stop-Process -Force
Write-Host "Stopped mongod (PID: $($procs.Id -join ', '))"
