# Disaster Recovery & Database Backup Policy

This runbook establishes standard operating procedures for database backup automation, data retention, integrity verification, and disaster recovery for the Accommodation Management System.

---

## 1. Backup Architecture & Automation

### Backup Types
1. **Full Physical & Logical Snapshots (`pg_dump -F c`)**:
   - Captured daily at 02:00 UTC during off-peak hours.
   - Script: [`backend/scripts/backup.sh`](file:///d:/CodeBase/Room%20Tracking%20MMDK/backend/scripts/backup.sh) / [`backend/scripts/backup.ps1`](file:///d:/CodeBase/Room%20Tracking%20MMDK/backend/scripts/backup.ps1).
   - Format: PostgreSQL Custom Archive (`-F c`) with blob support and compression.
2. **Continuous Write-Ahead Logging (WAL)**:
   - For managed PostgreSQL instances (e.g. Railway, AWS RDS), automated continuous WAL archiving is enabled for Point-in-Time Recovery (PITR) up to the second.

### Security Guarantees
- Backups are encrypted at rest using AES-256.
- Database credentials are never passed as command-line arguments (handled via standard `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` environment variables).
- Backup files (`*.dump`, `*.sql`) are strictly ignored in `.gitignore` to prevent repository leaks.

---

## 2. Retention Policy

| Tier | Frequency | Retention Window | Storage Target |
|---|---|---|---|
| **Daily Snapshots** | Daily at 02:00 UTC | 30 Days | Primary Backup Volume |
| **Weekly Archives** | Every Sunday | 90 Days | Off-Site Cloud Storage |
| **Monthly Milestone** | 1st of each month | 365 Days | Cold Archive (Glacier / Immutable bucket) |

---

## 3. Restoration & Recovery Runbook

### Step 1: Pre-Restore Verification
1. Ensure the target PostgreSQL instance is provisioned and listening on the designated port.
2. Verify available disk space (at least 3× the compressed backup file size).
3. Notify administrative staff of maintenance window.

### Step 2: Database Restoration (`pg_restore`)
```bash
# Set connection parameters
export PGHOST="your-db-host"
export PGPORT="5432"
export PGUSER="postgres"
export PGPASSWORD="your-secure-password"

# Recreate database cleanly
dropdb -h $PGHOST -p $PGPORT -U $PGUSER --if-exists accommodation_db
createdb -h $PGHOST -p $PGPORT -U $PGUSER accommodation_db

# Restore from backup archive
pg_restore -h $PGHOST -p $PGPORT -U $PGUSER \
  -d accommodation_db \
  --clean --if-exists \
  --no-owner --no-privileges \
  -v ./backups/accommodation_db_YYYYMMDD_HHMMSS.dump
```

### Step 3: Migration & Trigger Sync Verification
```bash
cd backend
# Verify Prisma schema synchronization
npx prisma migrate status

# Run system verification test suite
npx tsx src/test/database-verification.ts
```

---

## 4. Backup Integrity & Dry-Run Testing

- **Quarterly Automated Integrity Test**: Restore the latest backup into an ephemeral test database container.
- Run the full verification test suite against the restored instance:
  - Database schema integrity: 28/28 checks passed.
  - Exclusion constraint validation (`btree_gist`).
  - AES-256-GCM Aadhaar decryption with `AADHAAR_ENCRYPTION_KEY`.
- Confirm zero corrupted tables or orphan records.
