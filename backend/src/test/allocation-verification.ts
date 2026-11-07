import { createApp } from '../app';
import { prisma } from '../config/prisma';
import { generateToken } from '../utils/token';
import { 
  UserRole, 
  AllocationStatus, 
  AllocationItemStatus, 
  RegistrationStatus, 
  GenderCategory,
  UnitType,
  RoomStatus,
  UnitStatus 
} from '@prisma/client';
import http from 'http';

// Test harness
let server: http.Server;
let port: number;
let baseUrl: string;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

async function startTestServer(): Promise<void> {
  return new Promise((resolve) => {
    const app = createApp();
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      port = addr.port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });
}

async function stopTestServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

async function makeRequest(
  endpoint: string,
  options: {
    method?: string;
    token?: string;
    body?: any;
  } = {}
) {
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
    headers['Cookie'] = `auth_token=${options.token}`;
  }

  let bodyStr: string | undefined = undefined;
  if (options.body) {
    headers['Content-Type'] = 'application/json';
    bodyStr = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: bodyStr,
  });

  let data: any = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return {
    status: res.status,
    headers: res.headers,
    data,
  };
}

async function runAllocationVerification() {
  console.log('====================================================');
  console.log('  PHASE 6: MANUAL ALLOCATION ENGINE VERIFICATION    ');
  console.log('====================================================\n');

  await startTestServer();

  // Admin and Staff Tokens
  const superAdmin = await prisma.adminUser.findFirstOrThrow({
    where: { role: UserRole.SUPER_ADMIN },
  });
  const adminToken = generateToken({
    userId: superAdmin.id,
    email: superAdmin.email,
    role: superAdmin.role,
    name: superAdmin.name,
  });

  const managerUser = await prisma.adminUser.upsert({
    where: { email: 'manager.alc@accommodation.local' },
    update: {},
    create: {
      email: 'manager.alc@accommodation.local',
      passwordHash: 'dummyhash',
      name: 'Allocation Manager Alc',
      role: UserRole.ALLOCATION_MANAGER,
    },
  });
  const managerToken = generateToken({
    userId: managerUser.id,
    email: managerUser.email,
    role: managerUser.role,
    name: managerUser.name,
  });

  const staffUser = await prisma.adminUser.upsert({
    where: { email: 'staff.alc@accommodation.local' },
    update: {},
    create: {
      email: 'staff.alc@accommodation.local',
      passwordHash: 'dummyhash',
      name: 'Reception Staff Alc',
      role: UserRole.RECEPTION_STAFF,
    },
  });
  const staffToken = generateToken({
    userId: staffUser.id,
    email: staffUser.email,
    role: staffUser.role,
    name: staffUser.name,
  });

  const viewerUser = await prisma.adminUser.upsert({
    where: { email: 'viewer.alc@accommodation.local' },
    update: {},
    create: {
      email: 'viewer.alc@accommodation.local',
      passwordHash: 'dummyhash',
      name: 'Viewer Alc',
      role: UserRole.VIEWER,
    },
  });
  const viewerToken = generateToken({
    userId: viewerUser.id,
    email: viewerUser.email,
    role: viewerUser.role,
    name: viewerUser.name,
  });

  // Track created records for cleanup
  const createdAllocationIds: string[] = [];
  const createdRegIds: string[] = [];

  try {
    // ------------------------------------------------------------------------
    // Setup Test Registrations & Rooms
    // ------------------------------------------------------------------------
    const reg1 = await prisma.registration.create({
      data: {
        registrationId: 'REG-TEST-ALC1',
        primaryName: 'Mahesh Sharma',
        mobile: '9810011223',
        totalMembers: 3,
        status: RegistrationStatus.REGISTERED,
      },
    });
    createdRegIds.push(reg1.id);

    const reg2 = await prisma.registration.create({
      data: {
        registrationId: 'REG-TEST-ALC2',
        primaryName: 'Sanjay Gupta',
        mobile: '9810022334',
        totalMembers: 2,
        status: RegistrationStatus.REGISTERED,
      },
    });
    createdRegIds.push(reg2.id);

    const reg3 = await prisma.registration.create({
      data: {
        registrationId: 'REG-TEST-ALC3',
        primaryName: 'Conflict Test User',
        mobile: '9810033445',
        totalMembers: 1,
        status: RegistrationStatus.REGISTERED,
      },
    });
    createdRegIds.push(reg3.id);

    // Fetch units from R-101 and R-102
    const r101Units = await prisma.accommodationUnit.findMany({
      where: { room: { roomNumber: 'R-101' } },
      orderBy: { unitNumber: 'asc' },
    });
    const r102Units = await prisma.accommodationUnit.findMany({
      where: { room: { roomNumber: 'R-102' } },
      orderBy: { unitNumber: 'asc' },
    });

    assert(r101Units.length >= 4, 'Room R-101 has units available for test');
    assert(r102Units.length >= 2, 'Room R-102 has units available for test');

    const u1 = r101Units[0]; // Bed 1 in R-101
    const u2 = r101Units[1]; // Bed 2 in R-101
    const u3 = r102Units[0]; // Bed/Mat in R-102
    const u4 = r101Units[2]; // Bed 3 in R-101

    // ------------------------------------------------------------------------
    // Subsystem 1: Date Window Availability Queries
    // ------------------------------------------------------------------------
    console.log('--- Subsystem 1: Date Window Availability Queries ---');

    const entryDate = '2026-11-20T10:00:00.000Z';
    const exitDate = '2026-11-25T10:00:00.000Z';

    const availRes = await makeRequest(
      `/allocations/availability?entryDate=${entryDate}&exitDate=${exitDate}`,
      { token: staffToken }
    );
    assert(availRes.status === 200, 'Availability check returned HTTP 200');
    assert(availRes.data.success === true, 'Availability check marked success');
    assert(Array.isArray(availRes.data.data.rooms), 'Returns rooms array');
    assert(availRes.data.data.summary.totalUnits > 0, 'Summary reports total units in inventory');

    // Invalid date logic rejection
    const invalidDateRes = await makeRequest(
      `/allocations/availability?entryDate=${exitDate}&exitDate=${entryDate}`, // exit before entry
      { token: staffToken }
    );
    assert(invalidDateRes.status === 400, 'Rejected inverted date window with HTTP 400');

    // ------------------------------------------------------------------------
    // Subsystem 2: Multi-Room & Heterogeneous Unit Allocation
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 2: Multi-Room & Heterogeneous Unit Allocation ---');

    // Allocate 2 beds in R-101 and 1 unit in R-102 for Mahesh Sharma (REG-TEST-ALC1)
    const createRes = await makeRequest('/allocations', {
      method: 'POST',
      token: managerToken,
      body: {
        registrationId: reg1.registrationId,
        entryDate,
        exitDate,
        unitIds: [u1.id, u2.id, u3.id],
        status: AllocationStatus.TENTATIVE,
        notes: '2 beds in R-101, 1 unit in R-102 for 3 members',
      },
    });

    assert(createRes.status === 201, `Created multi-room allocation with HTTP 201 (got ${createRes.status})`);
    const alc1 = createRes.data.data;
    assert(/^ALC-\d{4}$/.test(alc1.allocationNumber), `Assigned sequential Allocation Number: ${alc1.allocationNumber}`);
    createdAllocationIds.push(alc1.id);

    // Verify registration status updated to ALLOCATED
    const updatedReg1 = await prisma.registration.findUniqueOrThrow({ where: { id: reg1.id } });
    assert(updatedReg1.status === RegistrationStatus.ALLOCATED, 'Registration status automatically transitioned to ALLOCATED');

    // Verify allocation items in DB
    const items = await prisma.allocationItem.findMany({ where: { allocationId: alc1.id } });
    assert(items.length === 3, 'Created exactly 3 allocation items');
    assert(items.every((i) => i.status === AllocationItemStatus.TENTATIVE), 'Allocation items saved with TENTATIVE status');

    // ------------------------------------------------------------------------
    // Subsystem 3: Multi-Registration Room Sharing
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 3: Multi-Registration Room Sharing ---');

    // Allocate u4 (Bed 3 in R-101) to Sanjay Gupta (REG-TEST-ALC2) for the exact same date window
    const shareRes = await makeRequest('/allocations', {
      method: 'POST',
      token: managerToken,
      body: {
        registrationId: reg2.registrationId,
        entryDate,
        exitDate,
        unitIds: [u4.id], // Remaining bed in same room R-101
        status: AllocationStatus.CONFIRMED,
        notes: 'Sharing R-101 with family group',
      },
    });

    assert(shareRes.status === 201, 'Second registration successfully allocated remaining bed in same room R-101');
    const alc2 = shareRes.data.data;
    createdAllocationIds.push(alc2.id);

    // ------------------------------------------------------------------------
    // Subsystem 4: Database-Level Double Booking Prevention
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 4: Database-Level Double Booking Prevention ---');

    // Attempt to allocate u1 (already allocated in alc1 for 20-25 Nov) for overlapping dates (22-27 Nov)
    const overlapStart = '2026-11-22T10:00:00.000Z';
    const overlapEnd = '2026-11-27T10:00:00.000Z';

    const conflictRes = await makeRequest('/allocations', {
      method: 'POST',
      token: adminToken,
      body: {
        registrationId: reg3.registrationId,
        entryDate: overlapStart,
        exitDate: overlapEnd,
        unitIds: [u1.id], // Conflict!
        status: AllocationStatus.TENTATIVE,
      },
    });

    assert(conflictRes.status === 409, `Double booking rejected with HTTP 409 Conflict (got ${conflictRes.status})`);
    assert(
      conflictRes.data.message.includes('Conflict') || conflictRes.data.message.includes('already reserved'),
      'Clear conflict notification returned to user'
    );

    // Non-overlapping date window on u1 (e.g. 1-5 Dec) must SUCCEED
    const nonOverlapStart = '2026-12-01T10:00:00.000Z';
    const nonOverlapEnd = '2026-12-05T10:00:00.000Z';

    const nonConflictRes = await makeRequest('/allocations', {
      method: 'POST',
      token: adminToken,
      body: {
        registrationId: reg3.registrationId,
        entryDate: nonOverlapStart,
        exitDate: nonOverlapEnd,
        unitIds: [u1.id], // Same unit, different non-overlapping window
        status: AllocationStatus.TENTATIVE,
      },
    });

    assert(nonConflictRes.status === 201, 'Same unit successfully allocated for non-overlapping future date window');
    createdAllocationIds.push(nonConflictRes.data.data.id);

    // ------------------------------------------------------------------------
    // Subsystem 5: Availability Verification with Active Conflicts
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 5: Availability Verification with Active Conflicts ---');

    const checkOverlapAvail = await makeRequest(
      `/allocations/availability?entryDate=${entryDate}&exitDate=${exitDate}&building=Main Wing`,
      { token: staffToken }
    );
    assert(checkOverlapAvail.status === 200, 'Availability check returned HTTP 200');
    const r101Report = checkOverlapAvail.data.data.rooms.find((r: any) => r.roomNumber === 'R-101');
    assert(r101Report !== undefined, 'Found R-101 in availability report');

    const reportedU1 = r101Report.units.find((u: any) => u.id === u1.id);
    assert(reportedU1.isAvailable === false, 'Unit u1 reported isAvailable: false');
    assert(reportedU1.state === 'ALLOCATED', 'Unit u1 state correctly resolved to ALLOCATED');

    const reportedU4 = r101Report.units.find((u: any) => u.id === u4.id);
    assert(reportedU4.isAvailable === false, 'Unit u4 reported isAvailable: false');
    assert(reportedU4.state === 'CONFIRMED', 'Unit u4 state correctly resolved to CONFIRMED');

    // ------------------------------------------------------------------------
    // Subsystem 6: Status Transitions & Updates
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 6: Status Transitions & Updates ---');

    const updateRes = await makeRequest(`/allocations/${alc1.id}`, {
      method: 'PUT',
      token: managerToken,
      body: {
        status: AllocationStatus.CONFIRMED,
        notes: 'Confirmed by reception deposit',
      },
    });

    assert(updateRes.status === 200, 'Update allocation returned HTTP 200');
    assert(updateRes.data.data.status === 'CONFIRMED', 'Master allocation status transitioned to CONFIRMED');

    const updatedItems = await prisma.allocationItem.findMany({ where: { allocationId: alc1.id } });
    assert(updatedItems.every((i) => i.status === AllocationItemStatus.CONFIRMED), 'Child items transitioned to CONFIRMED');

    // ------------------------------------------------------------------------
    // Subsystem 7: Cancellation & Capacity Release
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 7: Cancellation & Capacity Release ---');

    const cancelRes = await makeRequest(`/allocations/${alc1.id}/cancel`, {
      method: 'POST',
      token: adminToken,
      body: { reason: 'Guest cancelled travel plans' },
    });

    assert(cancelRes.status === 200, 'Cancel allocation returned HTTP 200');
    assert(cancelRes.data.data.status === 'CANCELLED', 'Allocation marked CANCELLED');

    // Verify units immediately released in availability check
    const postCancelAvail = await makeRequest(
      `/allocations/availability?entryDate=${entryDate}&exitDate=${exitDate}&building=Main Wing`,
      { token: staffToken }
    );
    const postCancelR101 = postCancelAvail.data.data.rooms.find((r: any) => r.roomNumber === 'R-101');
    const releasedU1 = postCancelR101.units.find((u: any) => u.id === u1.id);
    assert(releasedU1.isAvailable === true, 'Capacity released: Unit u1 is now available again for the same dates!');

    // ------------------------------------------------------------------------
    // Subsystem 8: Concurrency Stress Test on Allocation Numbering
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 8: Concurrency Stress Test on Allocation Numbering ---');

    const parallelCount = 6;
    console.log(`Executing ${parallelCount} concurrent allocation creations...`);

    // Create 6 dummy units in a scratch room for parallel non-conflicting allocations
    const scratchRoom = await prisma.room.create({
      data: {
        roomNumber: 'R-CONCURR',
        totalBeds: parallelCount,
        totalMats: 0,
        status: RoomStatus.ACTIVE,
      },
    });

    const scratchUnits = await Promise.all(
      Array.from({ length: parallelCount }).map((_, idx) =>
        prisma.accommodationUnit.create({
          data: {
            unitNumber: `BC${idx + 1}`,
            roomId: scratchRoom.id,
            type: UnitType.BED,
            genderCategory: GenderCategory.ANY,
            status: UnitStatus.ACTIVE,
          },
        })
      )
    );

    const parallelRequests = scratchUnits.map((u, idx) =>
      makeRequest('/allocations', {
        method: 'POST',
        token: managerToken,
        body: {
          registrationId: reg2.registrationId,
          entryDate: '2026-12-10T10:00:00.000Z',
          exitDate: '2026-12-15T10:00:00.000Z',
          unitIds: [u.id],
          status: AllocationStatus.TENTATIVE,
          notes: `Parallel stress test ${idx}`,
        },
      })
    );

    const parallelResults = await Promise.all(parallelRequests);
    assert(parallelResults.every((r) => r.status === 201), 'All concurrent allocation creations succeeded (HTTP 201)');

    const parallelNumbers = parallelResults.map((r) => {
      createdAllocationIds.push(r.data.data.id);
      return r.data.data.allocationNumber;
    });

    const uniqueNumbers = new Set(parallelNumbers);
    assert(uniqueNumbers.size === parallelCount, `All ${parallelCount} allocation numbers strictly unique: ${Array.from(uniqueNumbers).join(', ')}`);

    // Clean scratch room
    await prisma.allocationItem.deleteMany({
      where: { unitId: { in: scratchUnits.map((u) => u.id) } },
    });
    await prisma.accommodationUnit.deleteMany({
      where: { roomId: scratchRoom.id },
    });
    await prisma.room.delete({
      where: { id: scratchRoom.id },
    });

    // ------------------------------------------------------------------------
    // Subsystem 9: RBAC Enforcement
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 9: RBAC Enforcement ---');

    // Reception Staff can list allocations
    const staffListRes = await makeRequest('/allocations', { token: staffToken });
    assert(staffListRes.status === 200, 'Reception staff permitted to list allocations (HTTP 200)');

    // Viewer forbidden from creating allocations
    const viewerCreateRes = await makeRequest('/allocations', {
      method: 'POST',
      token: viewerToken,
      body: {
        registrationId: reg2.registrationId,
        entryDate,
        exitDate,
        unitIds: [u1.id],
      },
    });
    assert(viewerCreateRes.status === 403, 'Viewer forbidden from creating allocations (HTTP 403)');

    // Viewer forbidden from cancelling allocations
    const viewerCancelRes = await makeRequest(`/allocations/${alc2.id}/cancel`, {
      method: 'POST',
      token: viewerToken,
      body: { reason: 'Unauthorized' },
    });
    assert(viewerCancelRes.status === 403, 'Viewer forbidden from cancelling allocations (HTTP 403)');

    // ------------------------------------------------------------------------
    // Subsystem 10: Activity Log Verification
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 10: Activity Log Verification ---');

    const activityLogs = await prisma.activityLog.findMany({
      where: {
        entityType: 'Allocation',
        entityId: alc1.id,
      },
    });

    assert(activityLogs.length >= 2, `Recorded audit trail in ActivityLog (expected >= 2, got ${activityLogs.length})`);
    assert(activityLogs.some((l) => l.action === 'ALLOCATE'), 'Recorded ALLOCATE activity');
    assert(activityLogs.some((l) => l.action === 'CANCEL'), 'Recorded CANCEL activity');

    console.log('\n====================================================');
    console.log('   PHASE 6 VERIFICATION RESULTS: ALL TESTS PASSED   ');
    console.log('====================================================\n');
  } finally {
    // Cleanup created test allocations and registrations
    if (createdAllocationIds.length > 0) {
      await prisma.allocationItem.deleteMany({
        where: { allocationId: { in: createdAllocationIds } },
      });
      await prisma.activityLog.deleteMany({
        where: { entityId: { in: createdAllocationIds } },
      });
      await prisma.allocation.deleteMany({
        where: { id: { in: createdAllocationIds } },
      });
    }

    if (createdRegIds.length > 0) {
      await prisma.allocationItem.deleteMany({
        where: { allocation: { registrationId: { in: createdRegIds } } },
      });
      await prisma.allocation.deleteMany({
        where: { registrationId: { in: createdRegIds } },
      });
      await prisma.participant.deleteMany({
        where: { registrationId: { in: createdRegIds } },
      });
      await prisma.registration.deleteMany({
        where: { id: { in: createdRegIds } },
      });
    }

    await prisma.adminUser.deleteMany({
      where: {
        email: { in: ['manager.alc@accommodation.local', 'staff.alc@accommodation.local', 'viewer.alc@accommodation.local'] },
      },
    });

    await stopTestServer();
  }
}

runAllocationVerification().catch((err) => {
  console.error('\nAllocation verification failed:', err);
  process.exit(1);
});
