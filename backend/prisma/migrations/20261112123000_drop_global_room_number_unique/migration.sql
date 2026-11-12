-- Drop legacy global unique index on roomNumber so multiple hotels/buildings can have identical room numbers
DROP INDEX IF EXISTS "rooms_roomNumber_key";

-- Create composite index for property-scoped room number queries
CREATE INDEX IF NOT EXISTS "rooms_hotelId_roomNumber_idx" ON "rooms"("hotelId", "roomNumber");
