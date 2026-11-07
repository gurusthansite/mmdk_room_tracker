-- Migration: 20261105030000_concurrency_safe_allocation_number
-- Description: Concurrency-safe PostgreSQL sequence and generator function for Allocation Numbers (ALC-XXXX)

-- 1. Create dedicated sequence for Allocation Number generation
CREATE SEQUENCE IF NOT EXISTS allocation_number_seq START WITH 1;

-- 2. Synchronize sequence value with the maximum existing numeric suffix in allocations table
DO $$
DECLARE
    max_id INT;
BEGIN
    SELECT COALESCE(MAX(SUBSTRING("allocationNumber" FROM 5)::INTEGER), 0)
    INTO max_id
    FROM "allocations"
    WHERE "allocationNumber" ~ '^ALC-[0-9]+$';

    IF max_id > 0 THEN
        PERFORM setval('allocation_number_seq', max_id);
    END IF;
END $$;

-- 3. Create stored generator function for atomic and formatted allocation number generation
CREATE OR REPLACE FUNCTION generate_next_allocation_number()
RETURNS TEXT AS $$
DECLARE
    next_val BIGINT;
BEGIN
    next_val := nextval('allocation_number_seq');
    RETURN 'ALC-' || LPAD(next_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;
