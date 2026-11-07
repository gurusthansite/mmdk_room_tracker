const { PrismaClient } = require('d:/CodeBase/Room Tracking MMDK/backend/node_modules/@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:postgres@127.0.0.1:5432/accommodation_db?schema=public"
    }
  }
});

async function main() {
  if (process.env.NODE_ENV === 'production' || (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('127.0.0.1') && !process.env.DATABASE_URL.includes('localhost'))) {
    throw new Error('SAFETY BLOCKED: Reset script cannot be run against production or non-local database!');
  }
  console.log('=== STARTING SAFE ROOM INVENTORY DATA RESET ===');
  console.log('Environment: LOCAL DEVELOPMENT (127.0.0.1:5432/accommodation_db)');
  
  // Verify backup exists before proceeding
  const backupPath = 'd:/CodeBase/Room Tracking MMDK/backend/backups/db_backup_pre_reset_1794045834461.json';
  if (!fs.existsSync(backupPath)) {
    throw new Error('CRITICAL: Pre-reset backup not found at: ' + backupPath);
  }
  console.log('Pre-reset backup confirmed at:', backupPath);

  // Pre-reset counts
  const preCounts = {
    hotels: await prisma.hotel.count(),
    rooms: await prisma.room.count(),
    units: await prisma.accommodationUnit.count(),
    allocations: await prisma.allocation.count(),
    allocationItems: await prisma.allocationItem.count(),
    stayRecords: await prisma.stayRecord.count(),
    registrations: await prisma.registration.count(),
    participants: await prisma.participant.count(),
    adminUsers: await prisma.adminUser.count(),
  };
  console.log('Pre-reset database counts:', preCounts);

  // Execute deletion in a strict transaction respecting foreign key order
  console.log('\nExecuting transactional deletion of old inventory...');
  const result = await prisma.$transaction(async (tx) => {
    // 1. Delete dependent stay records
    const deletedStayRecords = await tx.stayRecord.deleteMany({});
    
    // 2. Delete dependent allocation items
    const deletedAllocationItems = await tx.allocationItem.deleteMany({});
    
    // 3. Delete allocations
    const deletedAllocations = await tx.allocation.deleteMany({});
    
    // 4. Delete individual beds and mats (AccommodationUnits)
    const deletedUnits = await tx.accommodationUnit.deleteMany({});
    
    // 5. Delete physical rooms
    const deletedRooms = await tx.room.deleteMany({});

    return {
      deletedStayRecords: deletedStayRecords.count,
      deletedAllocationItems: deletedAllocationItems.count,
      deletedAllocations: deletedAllocations.count,
      deletedUnits: deletedUnits.count,
      deletedRooms: deletedRooms.count,
    };
  });

  console.log('Deletion results:', result);

  // Post-reset verification
  const postCounts = {
    hotels: await prisma.hotel.count(),
    rooms: await prisma.room.count(),
    units: await prisma.accommodationUnit.count(),
    allocations: await prisma.allocation.count(),
    allocationItems: await prisma.allocationItem.count(),
    stayRecords: await prisma.stayRecord.count(),
    registrations: await prisma.registration.count(),
    participants: await prisma.participant.count(),
    adminUsers: await prisma.adminUser.count(),
  };
  console.log('\nPost-reset database counts:', postCounts);

  // Assertions
  if (postCounts.rooms !== 0 || postCounts.units !== 0) {
    throw new Error('VERIFICATION FAILED: Room or Unit inventory still exists!');
  }
  if (postCounts.hotels !== preCounts.hotels) {
    throw new Error('VERIFICATION FAILED: Hotel records were affected!');
  }
  if (postCounts.adminUsers !== preCounts.adminUsers) {
    throw new Error('VERIFICATION FAILED: Admin/staff user accounts were affected!');
  }

  // Verify accounts can be read
  const users = await prisma.adminUser.findMany({
    select: { id: true, email: true, name: true, role: true, status: true }
  });
  console.log('\nPreserved active user accounts:', users);

  const hotels = await prisma.hotel.findMany({
    select: { id: true, name: true }
  });
  console.log('Preserved hotel facilities:', hotels);

  console.log('\n=== INVENTORY RESET COMPLETED AND VERIFIED 100% SUCCESSFULLY ===');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Safe reset error:', err);
  process.exit(1);
});
