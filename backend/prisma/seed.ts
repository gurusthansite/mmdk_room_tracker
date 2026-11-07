import { PrismaClient, UserRole, UserStatus, RoomStatus, GenderPreference, UnitType, GenderCategory, UnitStatus, RegistrationStatus, AllocationStatus, AllocationItemStatus, StayStatus, Gender, ParticipantStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('[Seed] SAFETY BLOCKED: Seeding is disabled in production.');
    process.exit(0);
  }
  console.log('--- Commencing Database Seeding ---');

  // 1. Seed System Admin User
  const passwordHash = await bcrypt.hash('Admin@123', 10);
  const adminUser = await prisma.adminUser.upsert({
    where: { email: 'admin@accommodation.local' },
    update: {
      passwordHash,
      name: 'System Administrator',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: 'admin@accommodation.local',
      passwordHash,
      name: 'System Administrator',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      phone: '9876543210',
    },
  });
  console.log(`[Seed] Admin User: ${adminUser.email} (Role: ${adminUser.role})`);

  // 2. Seed Sample Rooms (5 Rooms matching reference dashboard)
  const roomDefinitions = [
    {
      roomNumber: 'R-101',
      building: 'Main Wing',
      floor: 1,
      totalBeds: 6,
      totalMats: 2,
      genderPreference: GenderPreference.ANY,
      status: RoomStatus.ACTIVE,
      notes: 'Ground floor room near reception',
      units: [
        { unitNumber: 'B1', type: UnitType.BED, genderCategory: GenderCategory.MALE },
        { unitNumber: 'B2', type: UnitType.BED, genderCategory: GenderCategory.MALE },
        { unitNumber: 'B3', type: UnitType.BED, genderCategory: GenderCategory.MALE },
        { unitNumber: 'B4', type: UnitType.BED, genderCategory: GenderCategory.MALE },
        { unitNumber: 'B5', type: UnitType.BED, genderCategory: GenderCategory.FEMALE },
        { unitNumber: 'B6', type: UnitType.BED, genderCategory: GenderCategory.FEMALE },
        { unitNumber: 'M1', type: UnitType.MAT, genderCategory: GenderCategory.MALE },
        { unitNumber: 'M2', type: UnitType.MAT, genderCategory: GenderCategory.MALE },
      ],
    },
    {
      roomNumber: 'R-102',
      building: 'Main Wing',
      floor: 1,
      totalBeds: 6,
      totalMats: 4,
      genderPreference: GenderPreference.ANY,
      status: RoomStatus.ACTIVE,
      notes: 'Spacious corner room with attached bath',
      units: [
        { unitNumber: 'B1', type: UnitType.BED, genderCategory: GenderCategory.MALE },
        { unitNumber: 'B2', type: UnitType.BED, genderCategory: GenderCategory.MALE },
        { unitNumber: 'B3', type: UnitType.BED, genderCategory: GenderCategory.MALE },
        { unitNumber: 'B4', type: UnitType.BED, genderCategory: GenderCategory.FEMALE },
        { unitNumber: 'B5', type: UnitType.BED, genderCategory: GenderCategory.FEMALE },
        { unitNumber: 'B6', type: UnitType.BED, genderCategory: GenderCategory.FEMALE },
        { unitNumber: 'M1', type: UnitType.MAT, genderCategory: GenderCategory.FEMALE },
        { unitNumber: 'M2', type: UnitType.MAT, genderCategory: GenderCategory.FEMALE },
        { unitNumber: 'M3', type: UnitType.MAT, genderCategory: GenderCategory.FEMALE },
        { unitNumber: 'M4', type: UnitType.MAT, genderCategory: GenderCategory.FEMALE },
      ],
    },
    {
      roomNumber: 'R-103',
      building: 'Annexe A',
      floor: 1,
      totalBeds: 6,
      totalMats: 4,
      genderPreference: GenderPreference.FEMALE,
      status: RoomStatus.ACTIVE,
      notes: 'Dedicated female accommodation wing',
      units: [
        { unitNumber: 'B1', type: UnitType.BED, genderCategory: GenderCategory.FEMALE },
        { unitNumber: 'B2', type: UnitType.BED, genderCategory: GenderCategory.FEMALE },
        { unitNumber: 'B3', type: UnitType.BED, genderCategory: GenderCategory.FEMALE },
        { unitNumber: 'B4', type: UnitType.BED, genderCategory: GenderCategory.FEMALE },
        { unitNumber: 'B5', type: UnitType.BED, genderCategory: GenderCategory.FEMALE },
        { unitNumber: 'B6', type: UnitType.BED, genderCategory: GenderCategory.FEMALE },
        { unitNumber: 'M1', type: UnitType.MAT, genderCategory: GenderCategory.FEMALE },
        { unitNumber: 'M2', type: UnitType.MAT, genderCategory: GenderCategory.FEMALE },
        { unitNumber: 'M3', type: UnitType.MAT, genderCategory: GenderCategory.FEMALE },
        { unitNumber: 'M4', type: UnitType.MAT, genderCategory: GenderCategory.FEMALE },
      ],
    },
    {
      roomNumber: 'R-104',
      building: 'Annexe A',
      floor: 1,
      totalBeds: 5,
      totalMats: 3,
      genderPreference: GenderPreference.MALE,
      status: RoomStatus.ACTIVE,
      notes: 'Dedicated male accommodation wing',
      units: [
        { unitNumber: 'B1', type: UnitType.BED, genderCategory: GenderCategory.MALE },
        { unitNumber: 'B2', type: UnitType.BED, genderCategory: GenderCategory.MALE },
        { unitNumber: 'B3', type: UnitType.BED, genderCategory: GenderCategory.MALE },
        { unitNumber: 'B4', type: UnitType.BED, genderCategory: GenderCategory.MALE },
        { unitNumber: 'B5', type: UnitType.BED, genderCategory: GenderCategory.MALE },
        { unitNumber: 'M1', type: UnitType.MAT, genderCategory: GenderCategory.MALE },
        { unitNumber: 'M2', type: UnitType.MAT, genderCategory: GenderCategory.MALE },
        { unitNumber: 'M3', type: UnitType.MAT, genderCategory: GenderCategory.MALE },
      ],
    },
    {
      roomNumber: 'R-105',
      building: 'Annexe B',
      floor: 2,
      totalBeds: 8,
      totalMats: 4,
      genderPreference: GenderPreference.FAMILY,
      status: RoomStatus.ACTIVE,
      notes: 'Large family suite with flexible layout',
      units: [
        { unitNumber: 'B1', type: UnitType.BED, genderCategory: GenderCategory.MALE },
        { unitNumber: 'B2', type: UnitType.BED, genderCategory: GenderCategory.MALE },
        { unitNumber: 'B3', type: UnitType.BED, genderCategory: GenderCategory.MALE },
        { unitNumber: 'B4', type: UnitType.BED, genderCategory: GenderCategory.MALE },
        { unitNumber: 'B5', type: UnitType.BED, genderCategory: GenderCategory.FEMALE },
        { unitNumber: 'B6', type: UnitType.BED, genderCategory: GenderCategory.FEMALE },
        { unitNumber: 'B7', type: UnitType.BED, genderCategory: GenderCategory.FEMALE },
        { unitNumber: 'B8', type: UnitType.BED, genderCategory: GenderCategory.FEMALE },
        { unitNumber: 'M1', type: UnitType.MAT, genderCategory: GenderCategory.MALE },
        { unitNumber: 'M2', type: UnitType.MAT, genderCategory: GenderCategory.MALE },
        { unitNumber: 'M3', type: UnitType.MAT, genderCategory: GenderCategory.FEMALE },
        { unitNumber: 'M4', type: UnitType.MAT, genderCategory: GenderCategory.FEMALE },
      ],
    },
  ];

  const createdUnitsMap: Record<string, Record<string, string>> = {}; // roomNumber -> { unitNumber: unitId }

  for (const rDef of roomDefinitions) {
    const room = await prisma.room.upsert({
      where: { roomNumber: rDef.roomNumber },
      update: {
        building: rDef.building,
        floor: rDef.floor,
        totalBeds: rDef.totalBeds,
        totalMats: rDef.totalMats,
        genderPreference: rDef.genderPreference,
        status: rDef.status,
        notes: rDef.notes,
      },
      create: {
        roomNumber: rDef.roomNumber,
        building: rDef.building,
        floor: rDef.floor,
        totalBeds: rDef.totalBeds,
        totalMats: rDef.totalMats,
        genderPreference: rDef.genderPreference,
        status: rDef.status,
        notes: rDef.notes,
      },
    });

    createdUnitsMap[room.roomNumber] = {};

    for (const uDef of rDef.units) {
      const unit = await prisma.accommodationUnit.upsert({
        where: {
          roomId_unitNumber: {
            roomId: room.id,
            unitNumber: uDef.unitNumber,
          },
        },
        update: {
          type: uDef.type,
          genderCategory: uDef.genderCategory,
          status: UnitStatus.ACTIVE,
        },
        create: {
          roomId: room.id,
          unitNumber: uDef.unitNumber,
          type: uDef.type,
          genderCategory: uDef.genderCategory,
          status: UnitStatus.ACTIVE,
        },
      });
      createdUnitsMap[room.roomNumber][uDef.unitNumber] = unit.id;
    }

    console.log(`[Seed] Room ${room.roomNumber}: ${rDef.units.length} accommodation units seeded`);
  }

  // 3. Seed Sample Registrations
  const registrationsData = [
    {
      registrationId: 'REG-0001',
      primaryName: 'Ramesh Kumar',
      mobile: '9876543210',
      email: 'ramesh.kumar@example.com',
      city: 'Delhi',
      state: 'Delhi',
      totalMembers: 5,
      status: RegistrationStatus.ALLOCATED,
      notes: 'Group arriving via early train',
      participants: [
        { fullName: 'Ramesh Kumar', gender: Gender.MALE, age: 42, isPrimary: true, relationToPrimary: 'Self' },
        { fullName: 'Suresh Kumar', gender: Gender.MALE, age: 38, isPrimary: false, relationToPrimary: 'Brother' },
        { fullName: 'Dinesh Kumar', gender: Gender.MALE, age: 35, isPrimary: false, relationToPrimary: 'Cousin' },
        { fullName: 'Sunita Devi', gender: Gender.FEMALE, age: 40, isPrimary: false, relationToPrimary: 'Spouse' },
        { fullName: 'Pooja Kumar', gender: Gender.FEMALE, age: 16, isPrimary: false, relationToPrimary: 'Daughter' },
      ],
    },
    {
      registrationId: 'REG-0002',
      primaryName: 'Sita Devi',
      mobile: '9123456780',
      email: 'sita.devi@example.com',
      city: 'Jaipur',
      state: 'Rajasthan',
      totalMembers: 3,
      status: RegistrationStatus.REGISTERED,
      notes: 'Requires ground floor accommodation',
      participants: [
        { fullName: 'Sita Devi', gender: Gender.FEMALE, age: 58, isPrimary: true, relationToPrimary: 'Self' },
        { fullName: 'Meena Sharma', gender: Gender.FEMALE, age: 32, isPrimary: false, relationToPrimary: 'Daughter' },
        { fullName: 'Kavita Sharma', gender: Gender.FEMALE, age: 28, isPrimary: false, relationToPrimary: 'Daughter' },
      ],
    },
    {
      registrationId: 'REG-0003',
      primaryName: 'Mohan Lal',
      mobile: '9988776655',
      email: 'mohan.lal@example.com',
      city: 'Varanasi',
      state: 'Uttar Pradesh',
      totalMembers: 2,
      status: RegistrationStatus.CONFIRMED,
      notes: 'Confirmed at reception desk',
      participants: [
        { fullName: 'Mohan Lal', gender: Gender.MALE, age: 50, isPrimary: true, relationToPrimary: 'Self' },
        { fullName: 'Radha Devi', gender: Gender.FEMALE, age: 46, isPrimary: false, relationToPrimary: 'Spouse' },
      ],
    },
    {
      registrationId: 'REG-0004',
      primaryName: 'Priya Sharma',
      mobile: '9876501234',
      email: 'priya.sharma@example.com',
      city: 'Mumbai',
      state: 'Maharashtra',
      totalMembers: 4,
      status: RegistrationStatus.ALLOCATED,
      notes: 'Family booking',
      participants: [
        { fullName: 'Priya Sharma', gender: Gender.FEMALE, age: 34, isPrimary: true, relationToPrimary: 'Self' },
        { fullName: 'Amit Sharma', gender: Gender.MALE, age: 36, isPrimary: false, relationToPrimary: 'Spouse' },
        { fullName: 'Aarav Sharma', gender: Gender.MALE, age: 10, isPrimary: false, relationToPrimary: 'Son' },
        { fullName: 'Ananya Sharma', gender: Gender.FEMALE, age: 7, isPrimary: false, relationToPrimary: 'Daughter' },
      ],
    },
    {
      registrationId: 'REG-0005',
      primaryName: 'Anand Verma',
      mobile: '9765432109',
      email: 'anand.verma@example.com',
      city: 'Bangalore',
      state: 'Karnataka',
      totalMembers: 1,
      status: RegistrationStatus.CHECKED_IN,
      notes: 'Solo volunteer participant',
      participants: [
        { fullName: 'Anand Verma', gender: Gender.MALE, age: 29, isPrimary: true, relationToPrimary: 'Self' },
      ],
    },
  ];

  const createdRegsMap: Record<string, string> = {};

  for (const regDef of registrationsData) {
    const reg = await prisma.registration.upsert({
      where: { registrationId: regDef.registrationId },
      update: {
        primaryName: regDef.primaryName,
        mobile: regDef.mobile,
        email: regDef.email,
        city: regDef.city,
        state: regDef.state,
        totalMembers: regDef.totalMembers,
        status: regDef.status,
        notes: regDef.notes,
      },
      create: {
        registrationId: regDef.registrationId,
        primaryName: regDef.primaryName,
        mobile: regDef.mobile,
        email: regDef.email,
        city: regDef.city,
        state: regDef.state,
        totalMembers: regDef.totalMembers,
        status: regDef.status,
        notes: regDef.notes,
      },
    });

    createdRegsMap[reg.registrationId] = reg.id;

    // Seed participants
    for (const pDef of regDef.participants) {
      const existingParticipant = await prisma.participant.findFirst({
        where: {
          registrationId: reg.id,
          fullName: pDef.fullName,
        },
      });

      if (!existingParticipant) {
        await prisma.participant.create({
          data: {
            registrationId: reg.id,
            fullName: pDef.fullName,
            gender: pDef.gender,
            age: pDef.age,
            isPrimary: pDef.isPrimary,
            relationToPrimary: pDef.relationToPrimary,
            checkInStatus: reg.status === RegistrationStatus.CHECKED_IN ? ParticipantStatus.CHECKED_IN : ParticipantStatus.REGISTERED,
          },
        });
      }
    }

    console.log(`[Seed] Registration ${reg.registrationId}: ${reg.primaryName} (${reg.totalMembers} members)`);
  }

  // 4. Seed Allocations & Allocation Items
  // Example from requirements:
  // REG-0001 (5 members):
  //   - Room R-101: 3 beds (B1, B2, B3)
  //   - Room R-102: 2 beds (B1, B2)
  //   - Entry: 2026-11-01, Exit: 2026-11-05
  const entryDate = new Date('2026-11-01T00:00:00.000Z');
  const exitDate = new Date('2026-11-05T00:00:00.000Z');

  // Allocation ALC-0001 for REG-0001
  const reg1Id = createdRegsMap['REG-0001'];
  if (reg1Id) {
    const alc1 = await prisma.allocation.upsert({
      where: { allocationNumber: 'ALC-0001' },
      update: {
        status: AllocationStatus.TENTATIVE,
        entryDate,
        exitDate,
      },
      create: {
        allocationNumber: 'ALC-0001',
        registrationId: reg1Id,
        status: AllocationStatus.TENTATIVE,
        entryDate,
        exitDate,
        notes: 'Multi-room group allocation (R-101: 3 beds, R-102: 2 beds)',
        createdById: adminUser.id,
      },
    });

    // Delete existing items to ensure clean idempotency
    await prisma.allocationItem.deleteMany({ where: { allocationId: alc1.id } });

    const unitsForAlc1 = [
      createdUnitsMap['R-101']?.['B1'],
      createdUnitsMap['R-101']?.['B2'],
      createdUnitsMap['R-101']?.['B3'],
      createdUnitsMap['R-102']?.['B1'],
      createdUnitsMap['R-102']?.['B2'],
    ].filter(Boolean);

    for (const unitId of unitsForAlc1) {
      await prisma.allocationItem.create({
        data: {
          allocationId: alc1.id,
          unitId,
          entryDate,
          exitDate,
          status: AllocationItemStatus.TENTATIVE,
        },
      });
    }
    console.log(`[Seed] Allocation ALC-0001: 5 units assigned across R-101 and R-102`);
  }

  // Allocation ALC-0003 for REG-0003 (Confirmed, 2 beds in R-101: B4, B5)
  const reg3Id = createdRegsMap['REG-0003'];
  if (reg3Id) {
    const alc3 = await prisma.allocation.upsert({
      where: { allocationNumber: 'ALC-0003' },
      update: {
        status: AllocationStatus.CONFIRMED,
        entryDate,
        exitDate,
      },
      create: {
        allocationNumber: 'ALC-0003',
        registrationId: reg3Id,
        status: AllocationStatus.CONFIRMED,
        entryDate,
        exitDate,
        notes: 'Reception confirmed booking (R-101: 2 beds)',
        createdById: adminUser.id,
      },
    });

    await prisma.allocationItem.deleteMany({ where: { allocationId: alc3.id } });

    const unitsForAlc3 = [
      createdUnitsMap['R-101']?.['B4'],
      createdUnitsMap['R-101']?.['B5'],
    ].filter(Boolean);

    for (const unitId of unitsForAlc3) {
      await prisma.allocationItem.create({
        data: {
          allocationId: alc3.id,
          unitId,
          entryDate,
          exitDate,
          status: AllocationItemStatus.CONFIRMED,
        },
      });
    }
    console.log(`[Seed] Allocation ALC-0003: 2 units assigned in R-101`);
  }

  // Allocation ALC-0005 for REG-0005 (Checked-In, 1 bed in R-101: B6)
  const reg5Id = createdRegsMap['REG-0005'];
  if (reg5Id) {
    const alc5 = await prisma.allocation.upsert({
      where: { allocationNumber: 'ALC-0005' },
      update: {
        status: AllocationStatus.CONFIRMED,
        entryDate,
        exitDate,
      },
      create: {
        allocationNumber: 'ALC-0005',
        registrationId: reg5Id,
        status: AllocationStatus.CONFIRMED,
        entryDate,
        exitDate,
        notes: 'Solo volunteer in R-101 B6',
        createdById: adminUser.id,
      },
    });

    await prisma.allocationItem.deleteMany({ where: { allocationId: alc5.id } });

    const unitB6 = createdUnitsMap['R-101']?.['B6'];
    if (unitB6) {
      await prisma.allocationItem.create({
        data: {
          allocationId: alc5.id,
          unitId: unitB6,
          entryDate,
          exitDate,
          status: AllocationItemStatus.CONFIRMED,
        },
      });

      // Also create a sample StayRecord mapped to participant
      const p5 = await prisma.participant.findFirst({
        where: { registrationId: reg5Id, isPrimary: true },
      });
      const existingStay = await prisma.stayRecord.findFirst({
        where: { registrationId: reg5Id },
      });
      if (!existingStay && p5) {
        await prisma.stayRecord.create({
          data: {
            registrationId: reg5Id,
            participantId: p5.id,
            unitId: unitB6,
            status: StayStatus.CHECKED_IN,
            actualCheckIn: new Date(),
            recordedById: adminUser.id,
            notes: 'Checked in at desk',
          },
        });
      }
    }
    console.log(`[Seed] Allocation ALC-0005 & StayRecord created for Anand Verma`);
  }

  console.log('--- Database Seeding Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
