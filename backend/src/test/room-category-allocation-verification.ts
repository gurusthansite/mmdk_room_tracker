import { createApp } from '../app';
import { prisma } from '../config/prisma';
import { generateToken } from '../utils/token';
import { UserRole, GenderPreference, UnitType, GenderCategory, UnitStatus, Gender } from '@prisma/client';
import http from 'http';

async function runCategoryAllocationVerification() {
  console.log('====================================================');
  console.log('   ROOM CATEGORY & ALLOCATION RULES VERIFICATION');
  console.log('====================================================\n');

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] Test ${totalTests}: ${message}`);
      passedTests++;
    } else {
      console.error(`[FAIL] Test ${totalTests}: ${message}`);
      process.exitCode = 1;
    }
  }

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  let adminUser = await prisma.adminUser.findFirst({ where: { role: UserRole.SUPER_ADMIN } });
  if (!adminUser) {
    adminUser = await prisma.adminUser.create({
      data: {
        email: 'test_admin@example.com',
        passwordHash: 'dummy',
        name: 'Test Admin',
        role: UserRole.SUPER_ADMIN,
      },
    });
  }

  const adminToken = generateToken({
    userId: adminUser.id,
    email: adminUser.email,
    name: adminUser.name,
    role: adminUser.role,
  });

  async function apiCall(endpoint: string, options: { method?: string; body?: any } = {}) {
    const url = `${baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const status = response.status;
    let data: any = {};
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    return { status, data };
  }

  try {
    const ts = Date.now();
    // 1. Create a Male room, a Female room, a Family room, and a Guest room
    const maleRoomRes = await apiCall('/rooms', {
      method: 'POST',
      body: {
        roomNumber: `RM-M-${ts}`,
        genderPreference: GenderPreference.MALE,
        maleBeds: 4,
        maleMats: 2,
      },
    });
    assert(maleRoomRes.status === 201 && maleRoomRes.data.success, 'Successfully created Male Room');

    const femaleRoomRes = await apiCall('/rooms', {
      method: 'POST',
      body: {
        roomNumber: `RM-F-${ts}`,
        genderPreference: GenderPreference.FEMALE,
        femaleBeds: 4,
        femaleMats: 2,
      },
    });
    assert(femaleRoomRes.status === 201 && femaleRoomRes.data.success, 'Successfully created Female Room');

    const guestRoomRes = await apiCall('/rooms', {
      method: 'POST',
      body: {
        roomNumber: `RM-G-${ts}`,
        genderPreference: GenderPreference.GUEST,
        anyBeds: 2,
      },
    });
    assert(guestRoomRes.status === 201 && guestRoomRes.data.success, 'Successfully created Guest Room with GUEST category');

    const familyRoomRes = await apiCall('/rooms', {
      method: 'POST',
      body: {
        roomNumber: `RM-FAM-${ts}`,
        genderPreference: GenderPreference.FAMILY,
        anyBeds: 4,
        anyMats: 2,
      },
    });
    assert(familyRoomRes.status === 201 && familyRoomRes.data.success, 'Successfully created Family Room with FAMILY category');

    // Retrieve units for each room
    const mUnits = await prisma.accommodationUnit.findMany({ where: { roomId: maleRoomRes.data.data.id } });
    const fUnits = await prisma.accommodationUnit.findMany({ where: { roomId: femaleRoomRes.data.data.id } });
    const gUnits = await prisma.accommodationUnit.findMany({ where: { roomId: guestRoomRes.data.data.id } });
    const famUnits = await prisma.accommodationUnit.findMany({ where: { roomId: familyRoomRes.data.data.id } });

    // 2. Scenario 1: All Male Group (Lohit + 3 tagged male members)
    const allMaleReg = await apiCall('/registrations', {
      method: 'POST',
      body: {
        primaryName: 'Lohit AllMale',
        mobile: '9876543001',
        totalMembers: 4,
        accompanyingMembers: [
          { fullName: 'Male Member 1', gender: Gender.MALE },
          { fullName: 'Male Member 2', gender: Gender.MALE },
          { fullName: 'Male Member 3', gender: Gender.MALE },
        ],
      },
    });
    assert(allMaleReg.status === 201, 'Created all-male registration (4 male members)');
    const allMaleRegId = allMaleReg.data.data.registrationId;

    // Test: Try allocating all-male group to Female room -> must be REJECTED!
    const maleInFemaleRes = await apiCall('/allocations', {
      method: 'POST',
      body: {
        registrationId: allMaleRegId,
        entryDate: '2026-12-01T10:00:00.000Z',
        exitDate: '2026-12-05T10:00:00.000Z',
        unitIds: [fUnits[0].id, fUnits[1].id],
      },
    });
    assert(maleInFemaleRes.status === 400 && maleInFemaleRes.data.message.includes('cannot be allocated to Female Room'), 'Blocked male group from being assigned to Female Room');

    // Test: Allocate all-male group to Male room -> must SUCCEED!
    const maleInMaleRes = await apiCall('/allocations', {
      method: 'POST',
      body: {
        registrationId: allMaleRegId,
        entryDate: '2026-12-01T10:00:00.000Z',
        exitDate: '2026-12-05T10:00:00.000Z',
        unitIds: [mUnits[0].id, mUnits[1].id, mUnits[2].id, mUnits[3].id],
      },
    });
    assert(maleInMaleRes.status === 201 && maleInMaleRes.data.success, 'Successfully allocated all-male group to Male Room');

    // 3. Scenario 2: Mixed Group (2 Male, 2 Female)
    const mixedReg = await apiCall('/registrations', {
      method: 'POST',
      body: {
        primaryName: 'Lohit Mixed',
        mobile: '9876543002',
        totalMembers: 4,
        accompanyingMembers: [
          { fullName: 'Male Member 2', gender: Gender.MALE },
          { fullName: 'Female Member 1', gender: Gender.FEMALE },
          { fullName: 'Female Member 2', gender: Gender.FEMALE },
        ],
      },
    });
    assert(mixedReg.status === 201, 'Created mixed registration (2 Male, 2 Female)');
    const mixedRegId = mixedReg.data.data.registrationId;

    // Test: Try allocating mixed group entirely into a Female Room -> must be REJECTED!
    const mixedAllFemaleRes = await apiCall('/allocations', {
      method: 'POST',
      body: {
        registrationId: mixedRegId,
        entryDate: '2026-12-10T10:00:00.000Z',
        exitDate: '2026-12-15T10:00:00.000Z',
        unitIds: [fUnits[0].id, fUnits[1].id, fUnits[2].id, fUnits[3].id],
      },
    });
    assert(mixedAllFemaleRes.status === 400 && mixedAllFemaleRes.data.message.includes('Male members cannot be placed in a Female Room'), 'Blocked mixed group from being placed entirely in Female Room');

    // Test: Allocate 2 units in Male room + 2 units in Female room according to category -> must SUCCEED!
    const mixedSplitRes = await apiCall('/allocations', {
      method: 'POST',
      body: {
        registrationId: mixedRegId,
        entryDate: '2026-12-10T10:00:00.000Z',
        exitDate: '2026-12-15T10:00:00.000Z',
        unitIds: [mUnits[0].id, mUnits[1].id, fUnits[0].id, fUnits[1].id],
      },
    });
    assert(mixedSplitRes.status === 201 && mixedSplitRes.data.success, 'Successfully allocated mixed group: 2 beds in Male Room + 2 beds in Female Room');

    // 4. Scenario 3: Family Group -> Allocated to Family Room
    const familyReg = await apiCall('/registrations', {
      method: 'POST',
      body: {
        primaryName: 'Sharma Family',
        mobile: '9876543003',
        totalMembers: 3,
        notes: '[Guest: Family (3 Members)]',
        accompanyingMembers: [
          { fullName: 'Pooja Sharma', gender: Gender.FEMALE },
          { fullName: 'Aarav Sharma', gender: Gender.MALE },
        ],
      },
    });
    assert(familyReg.status === 201, 'Created family registration');
    const familyRegId = familyReg.data.data.registrationId;

    const familyAllocRes = await apiCall('/allocations', {
      method: 'POST',
      body: {
        registrationId: familyRegId,
        entryDate: '2026-12-20T10:00:00.000Z',
        exitDate: '2026-12-25T10:00:00.000Z',
        unitIds: [famUnits[0].id, famUnits[1].id, famUnits[2].id],
        notes: '[Guest: Family]',
      },
    });
    assert(familyAllocRes.status === 201 && familyAllocRes.data.success, 'Successfully allocated family members together in Family Room');

    // 5. Scenario 4: Guest Group -> Allocated to Guest Room
    const guestReg = await apiCall('/registrations', {
      method: 'POST',
      body: {
        primaryName: 'VIP Speaker',
        mobile: '9876543004',
        totalMembers: 1,
        notes: '[Guest: Special / VIP]',
      },
    });
    assert(guestReg.status === 201, 'Created guest registration');
    const guestRegId = guestReg.data.data.registrationId;

    const guestAllocRes = await apiCall('/allocations', {
      method: 'POST',
      body: {
        registrationId: guestRegId,
        entryDate: '2026-12-20T10:00:00.000Z',
        exitDate: '2026-12-22T10:00:00.000Z',
        unitIds: [gUnits[0].id],
        notes: '[Guest: VIP]',
      },
    });
    assert(guestAllocRes.status === 201 && guestAllocRes.data.success, 'Successfully allocated guest to Guest Room');

    console.log(`\n====================================================`);
    console.log(`VERIFICATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log(`====================================================`);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runCategoryAllocationVerification().catch((err) => {
  console.error('Fatal error in verification:', err);
  process.exit(1);
});
