const { PrismaClient } = require('d:/CodeBase/Room Tracking MMDK/backend/node_modules/@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:postgres@127.0.0.1:5432/accommodation_db?schema=public"
    }
  }
});

async function inspectAndBackup() {
  console.log('Connecting to database...');
  
  const counts = {
    hotels: await prisma.hotel.count(),
    rooms: await prisma.room.count(),
    units: await prisma.accommodationUnit.count(),
    allocations: await prisma.allocation.count(),
    allocationItems: await prisma.allocationItem.count(),
    stayRecords: await prisma.stayRecord.count(),
    registrations: await prisma.registration.count(),
    participants: await prisma.participant.count(),
    adminUsers: await prisma.adminUser.count(),
    activityLogs: await prisma.activityLog.count(),
  };

  console.log('CURRENT RECORD COUNTS:', JSON.stringify(counts, null, 2));

  // Perform full data dump
  console.log('Creating full data backup...');
  const fullBackup = {
    timestamp: new Date().toISOString(),
    environment: 'development (127.0.0.1:5432/accommodation_db)',
    counts,
    data: {
      adminUsers: await prisma.adminUser.findMany(),
      hotels: await prisma.hotel.findMany(),
      rooms: await prisma.room.findMany(),
      units: await prisma.accommodationUnit.findMany(),
      registrations: await prisma.registration.findMany(),
      participants: await prisma.participant.findMany(),
      allocations: await prisma.allocation.findMany(),
      allocationItems: await prisma.allocationItem.findMany(),
      stayRecords: await prisma.stayRecord.findMany(),
      activityLogs: await prisma.activityLog.findMany(),
    }
  };

  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const filename = `db_backup_pre_reset_${Date.now()}.json`;
  const backupPath = path.join(backupDir, filename);
  fs.writeFileSync(backupPath, JSON.stringify(fullBackup, null, 2), 'utf8');
  console.log('BACKUP CREATED SUCCESSFULLY AT:', backupPath);
  console.log('File size:', fs.statSync(backupPath).size, 'bytes');

  await prisma.$disconnect();
}

inspectAndBackup().catch(err => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
