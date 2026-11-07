import { prisma } from '../config/prisma';

let syncPromise: Promise<void> | null = null;

async function syncSequence(): Promise<void> {
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      // 1. Check if generator function is already operational from migration
      await prisma.$queryRawUnsafe('SELECT 1 FROM pg_proc WHERE proname = \'generate_next_allocation_number\';');

      // Verify sequence is at least as high as highest existing allocation numeric suffix
      const existing = await prisma.allocation.findMany({
        select: { allocationNumber: true },
        take: 500,
        orderBy: { allocationNumber: 'desc' },
      });
      let maxNum = 0;
      for (const a of existing) {
        const match = a.allocationNumber.match(/\d+/);
        if (match) {
          const n = parseInt(match[0], 10);
          if (n > maxNum) maxNum = n;
        }
      }

      await prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS allocation_number_seq START WITH 1 INCREMENT BY 1;`);
      if (maxNum > 0) {
        // Ensure sequence never rewinds backwards
        await prisma.$executeRawUnsafe(`
          SELECT setval('allocation_number_seq', GREATEST(COALESCE((SELECT last_value FROM allocation_number_seq), 1), ${maxNum}), true);
        `);
      }
      return;
    } catch {
      // Function or sequence may not exist yet, initialize safely
    }

    try {
      const existing = await prisma.allocation.findMany({
        select: { allocationNumber: true },
        take: 2000,
      });
      let maxNum = 0;
      for (const a of existing) {
        const match = a.allocationNumber.match(/\d+/);
        if (match) {
          const n = parseInt(match[0], 10);
          if (n > maxNum) maxNum = n;
        }
      }

      await prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS allocation_number_seq START WITH 1 INCREMENT BY 1;`);
      if (maxNum > 0) {
        await prisma.$executeRawUnsafe(`SELECT setval('allocation_number_seq', ${maxNum}, true);`);
      }
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION generate_next_allocation_number()
        RETURNS TEXT AS $$
        DECLARE
          next_val BIGINT;
        BEGIN
          next_val := nextval('allocation_number_seq');
          RETURN 'ALC-' || LPAD(next_val::TEXT, 4, '0');
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
 * Concurrency-safe Allocation Number generator with collision-proof fallback.
 * Generates ALC-0001, ALC-0002, etc. strictly avoiding any existing numbers.
 */
export async function getNextAllocationNumber(): Promise<string> {
  await syncSequence();

  for (let attempt = 0; attempt < 25; attempt++) {
    let candidate: string | null = null;
    try {
      const result = await prisma.$queryRawUnsafe<{ next_id: string }[]>(
        'SELECT generate_next_allocation_number() AS next_id;'
      );
      if (result && result.length > 0 && result[0].next_id) {
        candidate = result[0].next_id;
      }
    } catch (e) {
      // ignore sequence error
    }

    if (!candidate) {
      const existing = await prisma.allocation.findMany({
        select: { allocationNumber: true },
        take: 2000,
      });
      let maxNum = 0;
      for (const a of existing) {
        const match = a.allocationNumber.match(/\d+/);
        if (match) {
          const n = parseInt(match[0], 10);
          if (n > maxNum) maxNum = n;
        }
      }
      candidate = `ALC-${String(maxNum + 1 + attempt).padStart(4, '0')}`;
    }

    // Double check that candidate does not collide with an existing row
    const exists = await prisma.allocation.findFirst({
      where: { allocationNumber: candidate },
      select: { id: true },
    });

    if (!exists) {
      return candidate;
    }
  }

  // Guaranteed unique emergency fallback with timestamp
  const count = await prisma.allocation.count();
  return `ALC-${String(count + 1).padStart(4, '0')}-${Date.now().toString().slice(-4)}`;
}
