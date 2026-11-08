import { createApp } from '../app';
import { prisma } from '../config/prisma';
import { generateToken } from '../utils/token';
import { parseRoomTokens } from '../utils/roomParser';
import { UserRole, GenderPreference, UnitType, RoomStatus } from '@prisma/client';
import http from 'http';

async function runBulkRoomVerification() {
  console.log('====================================================');
  console.log('       BULK ROOM & HOTEL PROVISIONING VERIFICATION');
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

  // 1. Test room token parser
  const parsed1 = parseRoomTokens('21, 23, 24, 43');
  assert(
    parsed1.length === 4 &&
      parsed1[0] === '21' &&
      parsed1[1] === '23' &&
      parsed1[2] === '24' &&
      parsed1[3] === '43',
    'Parser parses comma-separated rooms: 21, 23, 24, 43'
  );

  const parsedRange = parseRoomTokens('101-104');
  assert(
    parsedRange.length === 4 &&
      parsedRange[0] === '101' &&
      parsedRange[3] === '104',
    'Parser expands number range: 101-104 -> 101, 102, 103, 104'
  );

  const parsedMixed = parseRoomTokens('12, 15-17, 30');
  assert(
    parsedMixed.length === 5 &&
      parsedMixed[0] === '12' &&
      parsedMixed[1] === '15' &&
      parsedMixed[3] === '17' &&
      parsedMixed[4] === '30',
    'Parser handles mixed lists and ranges'
  );

  // Setup server for integration tests
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  const adminUser = await prisma.adminUser.findFirstOrThrow({ where: { role: UserRole.SUPER_ADMIN } });
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
      data = text;
    }
    return { status, data };
  }

  // 2. Create a test Hotel with ONLY the name (all other fields empty or omitted)
  const hotelResNameOnly = await apiCall('/hotels', {
    method: 'POST',
    body: {
      name: `Name Only Hotel ${Date.now()}`,
      address: '',
      contactPhone: '',
      contactEmail: '',
      notes: '',
    },
  });
  assert(
    hotelResNameOnly.status === 201 && hotelResNameOnly.data.data?.id,
    'Hotel created successfully with ONLY name and all other fields empty string'
  );
  const nameOnlyHotelId = hotelResNameOnly.data.data?.id;

  const hotelRes = await apiCall('/hotels', {
    method: 'POST',
    body: {
      name: `Test Hotel ${Date.now()}`,
      address: 'Near Temple West Gate',
      contactPhone: '9876543210',
    },
  });
  assert(hotelRes.status === 201 && hotelRes.data.data?.id, 'Hotel created successfully for room association');
  const testHotelId = hotelRes.data.data?.id;

  // 3. Test Bulk Room Creation: single group with multiple rooms (e.g. 21, 23, 24, 43)
  const batch1Prefix = `B1_${Date.now()}_`;
  const roomList1 = [`${batch1Prefix}21`, `${batch1Prefix}23`, `${batch1Prefix}24`, `${batch1Prefix}43`];

  const bulkRes1 = await apiCall('/rooms/bulk', {
    method: 'POST',
    body: {
      hotelId: testHotelId,
      groups: [
        {
          roomNumbers: roomList1.join(', '),
          building: 'Block A',
          floor: 2,
          genderPreference: GenderPreference.MALE,
          status: RoomStatus.ACTIVE,
          totalBeds: 4,
          totalMats: 2,
          notes: 'Standard 4-bed male AC room',
        },
      ],
    },
  });

  assert(
    bulkRes1.status === 201 && bulkRes1.data.data?.createdCount === 4,
    `Bulk creation created 4 rooms at once (status: ${bulkRes1.status}, created: ${bulkRes1.data.data?.createdCount})`
  );
  assert(
    bulkRes1.data.data?.totalUnits === 24,
    `Total inventory units created is 24 (4 rooms * 6 units)`
  );

  // Verify units inside DB for room 21
  const room21 = await prisma.room.findUnique({
    where: { roomNumber: `${batch1Prefix}21` },
    include: { units: true },
  });
  assert(room21 !== null, 'Room 21 verified in database');
  assert(room21?.totalBeds === 4 && room21?.totalMats === 2, 'Room 21 totals match 4 beds, 2 mats');
  assert(
    room21?.units.filter((u) => u.type === UnitType.BED).length === 4,
    'Room 21 has exactly 4 BED units (B1..B4)'
  );
  assert(
    room21?.units.filter((u) => u.type === UnitType.MAT).length === 2,
    'Room 21 has exactly 2 MAT units (M1..M2)'
  );

  // 4. Test Multi-Group Bulk Creation:
  // Group 1: rooms with 4 beds & 2 mats
  // Group 2: single room with 2 beds & 0 mats
  const batch2Prefix = `B2_${Date.now()}_`;
  const multiGroupRes = await apiCall('/rooms/bulk', {
    method: 'POST',
    body: {
      hotelId: testHotelId,
      groups: [
        {
          roomNumbers: `${batch2Prefix}51, ${batch2Prefix}52`,
          building: 'East Wing',
          floor: 1,
          genderPreference: GenderPreference.FEMALE,
          totalBeds: 3,
          totalMats: 1,
        },
        {
          roomNumbers: `${batch2Prefix}60`, // Single room with different beds/mats
          building: 'VIP Suite',
          floor: 1,
          genderPreference: GenderPreference.GUEST,
          totalBeds: 2,
          totalMats: 0,
        },
      ],
    },
  });

  assert(
    multiGroupRes.status === 201 && multiGroupRes.data.data?.createdCount === 3,
    'Multi-group bulk provisioning created 3 rooms across different bed/mat configurations'
  );
  assert(
    multiGroupRes.data.data?.totalUnits === 10,
    'Total inventory units across multiple groups is 10 (2*4 + 1*2)'
  );

  // 5. Duplicate collision detection
  const dupRes = await apiCall('/rooms/bulk', {
    method: 'POST',
    body: {
      hotelId: testHotelId,
      groups: [
        {
          roomNumbers: `${batch1Prefix}21`, // Already exists!
          totalBeds: 2,
          totalMats: 0,
        },
      ],
    },
  });
  assert(
    dupRes.status === 409 && dupRes.data.message.includes('already exist'),
    'Duplicate room number cleanly rejected with 409 conflict and clear message'
  );

  // Cleanup test rooms
  await prisma.accommodationUnit.deleteMany({
    where: {
      room: {
        hotelId: testHotelId,
      },
    },
  });
  await prisma.room.deleteMany({
    where: { hotelId: testHotelId },
  });
  await prisma.hotel.delete({
    where: { id: testHotelId },
  });
  if (nameOnlyHotelId) {
    await prisma.hotel.delete({
      where: { id: nameOnlyHotelId },
    });
  }

  server.close();

  console.log('\n====================================================');
  console.log(`VERIFICATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('====================================================\n');
}

runBulkRoomVerification()
  .catch((e) => {
    console.error('Test execution failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
