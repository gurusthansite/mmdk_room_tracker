-- Migration: 20261105020000_concurrency_safe_registration_id
-- Description: Concurrency-safe PostgreSQL sequence and generator function for Registration IDs

-- 1. Create dedicated concurrency-safe sequence for Registration ID generation
CREATE SEQUENCE IF NOT EXISTS registration_id_seq START WITH 1;

-- 2. Synchronize sequence value with the maximum existing numeric suffix in registrations table
DO $$
DECLARE
    max_id INT;
BEGIN
    SELECT COALESCE(MAX(SUBSTRING("registrationId" FROM 5)::INTEGER), 0)
    INTO max_id
    FROM "registrations"
    WHERE "registrationId" ~ '^REG-[0-9]+$';

    IF max_id > 0 THEN
        PERFORM setval('registration_id_seq', max_id);
    END IF;
END $$;

-- 3. Create stored generator function for atomic and formatted registration ID generation
CREATE OR REPLACE FUNCTION generate_next_registration_id()
RETURNS TEXT AS $$
DECLARE
    next_val BIGINT;
BEGIN
    next_val := nextval('registration_id_seq');
    RETURN 'REG-' || LPAD(next_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;
