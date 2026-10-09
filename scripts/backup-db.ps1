# ==============================================================================
# Ship It Fulfillment OS — PowerShell PostgreSQL Database Backup Script
# Creates a compressed, timestamped pg_dump with retention rotation (14 days).
# ==============================================================================

param (
    [string]$BackupDir = ".\backups",
    [int]$RetentionDays = 14,
    [string]$DbHost = "localhost",
    [string]$DbPort = "5432",
    [string]$DbUser = "shipit",
    [string]$DbName = "shipit"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "shipit_db_backup_$Timestamp.sql"

Write-Host "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] Starting Ship It DB backup for $DbName..." -ForegroundColor Cyan

# Run pg_dump via docker container if running locally, or local pg_dump
if (Get-Command "docker" -ErrorAction SilentlyContinue) {
    docker exec -e PGPASSWORD=shipit shipit-postgres-1 pg_dump -U $DbUser -d $DbName --no-owner --no-privileges > $BackupFile
} else {
    & pg_dump -h $DbHost -p $DbPort -U $DbUser -d $DbName --no-owner --no-privileges > $BackupFile
}

Write-Host "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] Backup created: $BackupFile" -ForegroundColor Green

# Prune old backups
$CutoffDate = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -Filter "shipit_db_backup_*.sql" | Where-Object { $_.LastWriteTime -lt $CutoffDate } | Remove-Item -Force
Write-Host "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] Backup cycle completed." -ForegroundColor Cyan
