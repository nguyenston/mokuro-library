param(
    [string]$BackupDir = ".\\backups"
)

$date = Get-Date -Format "yyyyMMdd_HHmmss"
$dbFile = ".\\data\\mokuro.db"

if ($env:DATABASE_URL -and $env:DATABASE_URL.StartsWith("file:")) {
    $dbFile = $env:DATABASE_URL.Substring(5)
}

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

if (Get-Command sqlite3 -ErrorAction SilentlyContinue) {
    sqlite3 $dbFile ".backup '$BackupDir\\library_$date.db'"
} else {
    Copy-Item $dbFile "$BackupDir\\library_$date.db"
}

if (Test-Path ".\\uploads") {
    Compress-Archive -Path ".\\uploads" -DestinationPath "$BackupDir\\uploads_$date.zip" -Force
}

Get-ChildItem $BackupDir -Filter "*.db" | Where-Object {
    $_.LastWriteTime -lt (Get-Date).AddDays(-30)
} | Remove-Item -Force -ErrorAction SilentlyContinue

Get-ChildItem $BackupDir -Filter "*.zip" | Where-Object {
    $_.LastWriteTime -lt (Get-Date).AddDays(-30)
} | Remove-Item -Force -ErrorAction SilentlyContinue

Write-Host "Backup completed: $date"
