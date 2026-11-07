-- Phase 8 Database Hardening: Prevent one participant from having multiple overlapping active stays
-- Uses btree_gist extension (already installed in 20261105010000_database_hardening)

ALTER TABLE "stay_records"
DROP CONSTRAINT IF EXISTS "no_overlapping_participant_stays";

ALTER TABLE "stay_records"
ADD CONSTRAINT "no_overlapping_participant_stays"
EXCLUDE USING gist (
  "participantId" WITH =,
  tsrange("actualCheckIn", COALESCE("actualCheckOut", 'infinity'::timestamp), '[)') WITH &&
)
WHERE ("status" IN ('CHECKED_IN', 'EXTENDED'));
