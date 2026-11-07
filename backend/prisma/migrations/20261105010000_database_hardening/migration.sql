-- Enable btree_gist extension for PostgreSQL exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- AlterEnum
ALTER TYPE "Gender" ADD VALUE IF NOT EXISTS 'UNKNOWN';

-- AlterEnum
ALTER TYPE "StayStatus" ADD VALUE IF NOT EXISTS 'TRANSFERRED';

-- DropForeignKey
ALTER TABLE "aadhaar_records" DROP CONSTRAINT IF EXISTS "aadhaar_records_participantId_fkey";
ALTER TABLE "accommodation_units" DROP CONSTRAINT IF EXISTS "accommodation_units_roomId_fkey";
ALTER TABLE "allocation_items" DROP CONSTRAINT IF EXISTS "allocation_items_allocationId_fkey";
ALTER TABLE "allocations" DROP CONSTRAINT IF EXISTS "allocations_registrationId_fkey";
ALTER TABLE "message_logs" DROP CONSTRAINT IF EXISTS "message_logs_registrationId_fkey";
ALTER TABLE "participants" DROP CONSTRAINT IF EXISTS "participants_registrationId_fkey";
ALTER TABLE "stay_records" DROP CONSTRAINT IF EXISTS "stay_records_participantId_fkey";
ALTER TABLE "stay_records" DROP CONSTRAINT IF EXISTS "stay_records_registrationId_fkey";
ALTER TABLE "stay_records" DROP CONSTRAINT IF EXISTS "stay_records_unitId_fkey";

-- AlterTable AadhaarRecord
ALTER TABLE "aadhaar_records" ALTER COLUMN "retentionConsent" SET DEFAULT false;

-- AlterTable AllocationItem
ALTER TABLE "allocation_items" ADD COLUMN IF NOT EXISTS "participantId" TEXT;

-- AlterTable Allocations
ALTER TABLE "allocations" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "allocations" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable Participants
ALTER TABLE "participants" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "participants" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "participants" ALTER COLUMN "gender" DROP DEFAULT;
ALTER TABLE "participants" ALTER COLUMN "gender" DROP NOT NULL;

-- AlterTable Registrations
ALTER TABLE "registrations" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "registrations" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- Safe data migration for existing stay_records: populate participantId before adding NOT NULL constraint
UPDATE "stay_records" sr
SET "participantId" = p."id"
FROM "participants" p
WHERE sr."registrationId" = p."registrationId" AND p."isPrimary" = true AND sr."participantId" IS NULL;

-- If any remaining without primary participant, link to any participant of that registration
UPDATE "stay_records" sr
SET "participantId" = p."id"
FROM "participants" p
WHERE sr."registrationId" = p."registrationId" AND sr."participantId" IS NULL;

-- AlterTable StayRecords
ALTER TABLE "stay_records" ADD COLUMN IF NOT EXISTS "allocationItemId" TEXT;
ALTER TABLE "stay_records" ADD COLUMN IF NOT EXISTS "previousStayRecordId" TEXT;
ALTER TABLE "stay_records" ADD COLUMN IF NOT EXISTS "transferReason" TEXT;
ALTER TABLE "stay_records" ALTER COLUMN "participantId" SET NOT NULL;
ALTER TABLE "stay_records" ALTER COLUMN "unitId" SET NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "allocation_items_participantId_idx" ON "allocation_items"("participantId");
CREATE INDEX IF NOT EXISTS "allocations_isArchived_idx" ON "allocations"("isArchived");
CREATE INDEX IF NOT EXISTS "participants_isArchived_idx" ON "participants"("isArchived");
CREATE INDEX IF NOT EXISTS "registrations_isArchived_idx" ON "registrations"("isArchived");
CREATE INDEX IF NOT EXISTS "stay_records_allocationItemId_idx" ON "stay_records"("allocationItemId");
CREATE INDEX IF NOT EXISTS "stay_records_previousStayRecordId_idx" ON "stay_records"("previousStayRecordId");

-- AddForeignKey (Hardened: Restrict deletion to preserve historical operational records)
ALTER TABLE "accommodation_units" ADD CONSTRAINT "accommodation_units_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "participants" ADD CONSTRAINT "participants_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "allocations" ADD CONSTRAINT "allocations_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "allocation_items" ADD CONSTRAINT "allocation_items_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "allocation_items" ADD CONSTRAINT "allocation_items_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "aadhaar_records" ADD CONSTRAINT "aadhaar_records_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stay_records" ADD CONSTRAINT "stay_records_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stay_records" ADD CONSTRAINT "stay_records_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stay_records" ADD CONSTRAINT "stay_records_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "accommodation_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stay_records" ADD CONSTRAINT "stay_records_allocationItemId_fkey" FOREIGN KEY ("allocationItemId") REFERENCES "allocation_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stay_records" ADD CONSTRAINT "stay_records_previousStayRecordId_fkey" FOREIGN KEY ("previousStayRecordId") REFERENCES "stay_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- POSTGRESQL LEVEL EXCLUSION CONSTRAINTS (HARDENING REQUIREMENT 1 & 5)
-- ----------------------------------------------------------------------------

-- Prevent overlapping active allocations for the same physical unit [entryDate, exitDate)
ALTER TABLE "allocation_items" 
DROP CONSTRAINT IF EXISTS "no_overlapping_active_allocations";

ALTER TABLE "allocation_items" 
ADD CONSTRAINT "no_overlapping_active_allocations" 
EXCLUDE USING gist (
  "unitId" WITH =,
  tsrange("entryDate", "exitDate", '[)') WITH &&
)
WHERE ("status" IN ('TENTATIVE', 'CONFIRMED'));

-- Prevent one physical unit from having multiple active occupants during overlapping stay periods
ALTER TABLE "stay_records"
DROP CONSTRAINT IF EXISTS "no_overlapping_active_stays";

ALTER TABLE "stay_records"
ADD CONSTRAINT "no_overlapping_active_stays"
EXCLUDE USING gist (
  "unitId" WITH =,
  tsrange("actualCheckIn", COALESCE("actualCheckOut", 'infinity'::timestamp), '[)') WITH &&
)
WHERE ("status" IN ('CHECKED_IN', 'EXTENDED'));

-- ----------------------------------------------------------------------------
-- AUTOMATIC INVENTORY CAPACITY SYNCHRONIZATION TRIGGER (HARDENING REQUIREMENT 3)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sync_room_capacity()
RETURNS TRIGGER AS $$
DECLARE
  target_room_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_room_id := OLD."roomId";
  ELSE
    target_room_id := NEW."roomId";
  END IF;

  UPDATE "rooms"
  SET 
    "totalBeds" = (
      SELECT COUNT(*) FROM "accommodation_units" 
      WHERE "roomId" = target_room_id AND "type" = 'BED' AND "status" != 'INACTIVE'
    ),
    "totalMats" = (
      SELECT COUNT(*) FROM "accommodation_units" 
      WHERE "roomId" = target_room_id AND "type" = 'MAT' AND "status" != 'INACTIVE'
    ),
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = target_room_id;

  IF TG_OP = 'UPDATE' AND OLD."roomId" IS DISTINCT FROM NEW."roomId" THEN
    UPDATE "rooms"
    SET 
      "totalBeds" = (
        SELECT COUNT(*) FROM "accommodation_units" 
        WHERE "roomId" = OLD."roomId" AND "type" = 'BED' AND "status" != 'INACTIVE'
      ),
      "totalMats" = (
        SELECT COUNT(*) FROM "accommodation_units" 
        WHERE "roomId" = OLD."roomId" AND "type" = 'MAT' AND "status" != 'INACTIVE'
      ),
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = OLD."roomId";
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_room_capacity ON "accommodation_units";
CREATE TRIGGER trigger_sync_room_capacity
AFTER INSERT OR UPDATE OR DELETE ON "accommodation_units"
FOR EACH ROW EXECUTE FUNCTION sync_room_capacity();
