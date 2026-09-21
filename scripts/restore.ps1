param(
    [Parameter(Mandatory = $true)]
    [string]$BackupDb
)

$dbFile = ".\\data\\mokuro.db"
if ($env:DATABASE_URL -and $env:DATABASE_URL.StartsWith("file:")) {
    $dbFile = $env:DATABASE_URL.Substring(5)
}

Copy-Item $BackupDb $dbFile -Force
Write-Host "Restore completed."
