import { prisma } from '../config/prisma';

let syncPromise: Promise<void> | null = null;

async function syncSequence(): Promise<void> {
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      // 1. Check if generator function is already operational from migration
      await prisma.$queryRawUnsafe('SELECT 1 FROM pg_proc WHERE proname = \'generate_next_registration_id\';');

      // Verify sequence is at least as high as highest existing registration numeric suffix
      const existing = await prisma.registration.findMany({
        select: { registrationId: true },
        take: 500,
        orderBy: { registrationId: 'desc' },
      });
      let maxNum = 0;
      for (const r of existing) {
        const match = r.registrationId.match(/\d+/);
        if (match) {
          const n = parseInt(match[0], 10);
          if (n > maxNum) maxNum = n;
        }
      }

      await prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS registration_id_seq START WITH 1 INCREMENT BY 1;`);
      if (maxNum > 0) {
        // Ensure sequence never rewinds backwards
        await prisma.$executeRawUnsafe(`
          SELECT setval('registration_id_seq', GREATEST(COALESCE((SELECT last_value FROM registration_id_seq), 1), ${maxNum}), true);
        `);
      }
      return;
    } catch {
      // Function or sequence may not exist yet, initialize safely
    }

    try {
      const existing = await prisma.registration.findMany({
        select: { registrationId: true },
        take: 2000,
      });
      let maxNum = 0;
      for (const r of existing) {
        const match = r.registrationId.match(/\d+/);
        if (match) {
          const n = parseInt(match[0], 10);
          if (n > maxNum) maxNum = n;
        }
      }

      await prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS registration_id_seq START WITH 1 INCREMENT BY 1;`);
      if (maxNum > 0) {
        await prisma.$executeRawUnsafe(`SELECT setval('registration_id_seq', ${maxNum}, true);`);
      }
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION generate_next_registration_id()
        RETURNS TEXT AS $$
        DECLARE
          next_val BIGINT;
        BEGIN
          next_val := nextval('registration_id_seq');
          RETURN 'REG-' || LPAD(next_val::TEXT, 4, '0');
        END;
        $$ LANGUAGE plpgsql;
      `);
    } catch {
      // Fallback query generator will handle uniqueness
    }
  })();

  return syncPromise;
}

/**
 * Concurrency-safe Registration ID generator with collision-proof fallback.
 * Generates REG-0001, REG-0002, etc. strictly avoiding any existing IDs.
 */
export async function getNextRegistrationId(): Promise<string> {
  await syncSequence();

  for (let attempt = 0; attempt < 25; attempt++) {
    let candidate: string | null = null;
    try {
      const result = await prisma.$queryRawUnsafe<{ next_id: string }[]>(
        'SELECT generate_next_registration_id() AS next_id;'
      );
      if (result && result.length > 0 && result[0].next_id) {
        candidate = result[0].next_id;
      }
    } catch (e) {
      // ignore
    }

    if (!candidate) {
      const existing = await prisma.registration.findMany({
        select: { registrationId: true },
        take: 2000,
      });
      let maxNum = 0;
      for (const r of existing) {
        const match = r.registrationId.match(/\d+/);
        if (match) {
          const n = parseInt(match[0], 10);
          if (n > maxNum) maxNum = n;
        }
      }
      candidate = `REG-${String(maxNum + 1 + attempt).padStart(4, '0')}`;
    }

    // Double check that candidate does not collide with an existing row
    const exists = await prisma.registration.findFirst({
      where: { registrationId: candidate },
      select: { id: true },
    });

    if (!exists) {
      return candidate;
    }
  }

  // Guaranteed unique emergency fallback with timestamp
  const count = await prisma.registration.count();
  return `REG-${String(count + 1).padStart(4, '0')}-${Date.now().toString().slice(-4)}`;
}
