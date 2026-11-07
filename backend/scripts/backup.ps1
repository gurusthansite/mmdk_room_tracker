# PowerShell PostgreSQL Backup Automation Script
# Usage: .\backend\scripts\backup.ps1
# Requires pg_dump installed and PG* environment variables configured

param (
    [string]$BackupDir = ".\backups",
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$BackupFile = Join-Path $BackupDir "accommodation_db_$Timestamp.dump"

Write-Host "Starting PostgreSQL backup: $BackupFile" -ForegroundColor Cyan

# Use environment variables for connection parameters without exposing credentials in command-line arguments
$PgHost = if ($env:PGHOST) { $env:PGHOST } else { "127.0.0.1" }
$PgPort = if ($env:PGPORT) { $env:PGPORT } else { "5433" }
$PgUser = if ($env:PGUSER) { $env:PGUSER } else { "postgres" }
$PgDb   = if ($env:PGDATABASE) { $env:PGDATABASE } else { "accommodation_db" }

try {
    & "pg_dump" -h $PgHost -p $PgPort -U $PgUser -F c -b -v -f $BackupFile $PgDb
    
    if (Test-Path $BackupFile) {
        $FileSize = (Get-Item $BackupFile).Length / 1MB
        Write-Host "Backup completed successfully! Size: $([math]::Round($FileSize, 2)) MB" -ForegroundColor Green
        
        # Retention cleanup: Remove backups older than $RetentionDays
        $LimitDate = (Get-Date).AddDays(-$RetentionDays)
        Get-ChildItem -Path $BackupDir -Filter "*.dump" | Where-Object { $_.CreationTime -lt $LimitDate } | ForEach-Object {
            Write-Host "Pruning expired backup: $($_.Name)" -ForegroundColor Yellow
            Remove-Item $_.FullName -Force
        }
    } else {
        throw "Backup file was not generated."
    }
} catch {
    Write-Host "Backup failed: $_" -ForegroundColor Red
    exit 1
}
