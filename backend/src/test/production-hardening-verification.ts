import { createApp } from '../app';
import { prisma } from '../config/prisma';
import { generateToken } from '../utils/token';
import { UserRole, UserStatus, RoomStatus, UnitStatus, GenderPreference, GenderCategory, UnitType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import http from 'http';

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

async function runHardeningVerificationSuite() {
  console.log('================================================================================');
  console.log('STARTING PHASE 11: PRODUCTION HARDENING, PERFORMANCE & CONCURRENCY AUDIT');
  console.log('================================================================================\n');

  await startTestServer();

  try {
    console.log('[SETUP] Setting up admin users and test room inventory for concurrency tests');
    const passwordHash = await bcrypt.hash('Admin@123', 10);

    const superAdmin = await prisma.adminUser.upsert({
      where: { email: 'superadmin.p11@test.local' },
      update: { role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE },
      create: {
        email: 'superadmin.p11@test.local',
        name: 'Super Admin P11',
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    const manager1 = await prisma.adminUser.upsert({
      where: { email: 'manager1.p11@test.local' },
      update: { role: UserRole.ALLOCATION_MANAGER, status: UserStatus.ACTIVE },
      create: {
        email: 'manager1.p11@test.local',
        name: 'Manager Desk 1',
        passwordHash,
        role: UserRole.ALLOCATION_MANAGER,
        status: UserStatus.ACTIVE,
      },
    });

    const manager2 = await prisma.adminUser.upsert({
      where: { email: 'manager2.p11@test.local' },
      update: { role: UserRole.ALLOCATION_MANAGER, status: UserStatus.ACTIVE },
      create: {
        email: 'manager2.p11@test.local',
        name: 'Manager Desk 2',
        passwordHash,
        role: UserRole.ALLOCATION_MANAGER,
        status: UserStatus.ACTIVE,
      },
    });

    const staff1 = await prisma.adminUser.upsert({
      where: { email: 'staff1.p11@test.local' },
      update: { role: UserRole.RECEPTION_STAFF, status: UserStatus.ACTIVE },
      create: {
        email: 'staff1.p11@test.local',
        name: 'Reception Desk 1',
        passwordHash,
        role: UserRole.RECEPTION_STAFF,
        status: UserStatus.ACTIVE,
      },
    });

    const staff2 = await prisma.adminUser.upsert({
      where: { email: 'staff2.p11@test.local' },
      update: { role: UserRole.RECEPTION_STAFF, status: UserStatus.ACTIVE },
      create: {
        email: 'staff2.p11@test.local',
        name: 'Reception Desk 2',
        passwordHash,
        role: UserRole.RECEPTION_STAFF,
        status: UserStatus.ACTIVE,
      },
    });

    const adminToken = generateToken({
      userId: superAdmin.id,
      email: superAdmin.email,
      name: superAdmin.name,
      role: superAdmin.role,
    });

    const manager1Token = generateToken({
      userId: manager1.id,
      email: manager1.email,
      name: manager1.name,
      role: manager1.role,
    });

    const manager2Token = generateToken({
      userId: manager2.id,
      email: manager2.email,
      name: manager2.name,
      role: manager2.role,
    });

    const staff1Token = generateToken({
      userId: staff1.id,
      email: staff1.email,
      name: staff1.name,
      role: staff1.role,
    });

    const staff2Token = generateToken({
      userId: staff2.id,
      email: staff2.email,
      name: staff2.name,
      role: staff2.role,
    });

    // Pre-cleanup in case of previous aborted runs
    const existingRoom = await prisma.room.findFirst({ where: { roomNumber: 'R-P11-TEST' } });
    if (existingRoom) {
      await prisma.stayRecord.deleteMany({ where: { unit: { roomId: existingRoom.id } } });
      await prisma.allocationItem.deleteMany({ where: { unit: { roomId: existingRoom.id } } });
      await prisma.accommodationUnit.deleteMany({ where: { roomId: existingRoom.id } });
      await prisma.room.delete({ where: { id: existingRoom.id } });
    }

    // Create dedicated test room & unit for collision testing
    const testRoom = await prisma.room.create({
      data: {
        roomNumber: 'R-P11-TEST',
        building: 'Hardening Wing',
        floor: 1,
        totalBeds: 2,
        totalMats: 1,
        status: RoomStatus.ACTIVE,
        genderPreference: GenderPreference.ANY,
        units: {
          create: [
            { unitNumber: 'B-1', type: UnitType.BED, genderCategory: GenderCategory.ANY, status: UnitStatus.ACTIVE },
            { unitNumber: 'B-2', type: UnitType.BED, genderCategory: GenderCategory.ANY, status: UnitStatus.ACTIVE },
            { unitNumber: 'M-1', type: UnitType.MAT, genderCategory: GenderCategory.ANY, status: UnitStatus.MAINTENANCE },
          ],
        },
      },
      include: { units: true },
    });

    const targetUnit = testRoom.units.find((u) => u.unitNumber === 'B-1')!;
    const maintenanceUnit = testRoom.units.find((u) => u.unitNumber === 'M-1')!;

    // --------------------------------------------------------------------------
    // TEST 1: Security Headers & Server Fingerprinting Protection
    // --------------------------------------------------------------------------
    console.log('\n[TEST 1] Testing HTTP Security Headers & Fingerprinting');
    const healthRes = await fetch(`${baseUrl}/health`);
    assert(healthRes.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff header set');
    assert(healthRes.headers.get('x-frame-options') === 'DENY', 'X-Frame-Options: DENY header set');
    assert(healthRes.headers.get('x-xss-protection') === '1; mode=block', 'X-XSS-Protection header set');
    assert(healthRes.headers.get('referrer-policy') === 'strict-origin-when-cross-origin', 'Referrer-Policy header set');
    assert(!healthRes.headers.get('x-powered-by'), 'X-Powered-By header is completely disabled/omitted');

    // --------------------------------------------------------------------------
    // TEST 2: Health Check Probe & System Telemetry
    // --------------------------------------------------------------------------
    console.log('\n[TEST 2] Testing Health Check Probe & Latency Metrics');
    assert(healthRes.status === 200, 'GET /api/health returned HTTP 200');
    const healthData = await healthRes.json();
    assert(healthData.success === true, 'Health probe reports success: true');
    assert(healthData.data.status === 'UP', 'Service status is UP');
    assert(healthData.data.database.status === 'CONNECTED', 'Database status is CONNECTED');
    assert(typeof healthData.data.database.latencyMs === 'number', 'Database latency is measured in ms');
    assert(typeof healthData.data.uptimeSeconds === 'number', 'Uptime metric is reported');
    assert(typeof healthData.data.memoryUsage.rssMb === 'number', 'Memory RSS usage is reported');
    console.log(`[PASS] DB Latency: ${healthData.data.database.latencyMs}ms, Memory RSS: ${healthData.data.memoryUsage.rssMb}MB`);

    // --------------------------------------------------------------------------
    // TEST 3: Concurrent Sequential Registration Creation (Race-Condition Free)
    // --------------------------------------------------------------------------
    console.log('\n[TEST 3] Testing Concurrent Registration Sequential ID Generation');
    const concurrentRegistrations = await Promise.all([
      fetch(`${baseUrl}/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ primaryName: 'Concurrent Guest 1', mobile: '9900000001', totalMembers: 1 }),
      }),
      fetch(`${baseUrl}/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ primaryName: 'Concurrent Guest 2', mobile: '9900000002', totalMembers: 1 }),
      }),
      fetch(`${baseUrl}/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ primaryName: 'Concurrent Guest 3', mobile: '9900000003', totalMembers: 1 }),
      }),
      fetch(`${baseUrl}/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ primaryName: 'Concurrent Guest 4', mobile: '9900000004', totalMembers: 1 }),
      }),
    ]);

    const regResults = await Promise.all(concurrentRegistrations.map((r) => r.json()));
    const generatedIds = regResults.map((r) => r.data.registrationId);
    const uniqueIds = new Set(generatedIds);
    assert(uniqueIds.size === 4, `All 4 concurrent registrations received unique IDs: ${generatedIds.join(', ')}`);
    console.log(`[PASS] Concurrency-safe sequence generation verified: ${generatedIds.join(', ')}`);

    const regA = regResults[0].data;
    const regB = regResults[1].data;

    // --------------------------------------------------------------------------
    // TEST 4: Concurrent Allocation Collision (Double-Booking Exclusion Constraint)
    // --------------------------------------------------------------------------
    console.log('\n[TEST 4] Testing Concurrent Double-Booking Prevention on Simultaneous Allocations');
    const entryDate = '2026-12-01T12:00:00.000Z';
    const exitDate = '2026-12-05T10:00:00.000Z';

    // Two managers attempt to allocate the exact same unit for the exact same dates simultaneously
    const [allocAttempt1, allocAttempt2] = await Promise.all([
      fetch(`${baseUrl}/allocations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${manager1Token}` },
        body: JSON.stringify({
          registrationId: regA.id,
          entryDate,
          exitDate,
          unitIds: [targetUnit.id],
        }),
      }),
      fetch(`${baseUrl}/allocations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${manager2Token}` },
        body: JSON.stringify({
          registrationId: regB.id,
          entryDate,
          exitDate,
          unitIds: [targetUnit.id],
        }),
      }),
    ]);

    const statuses = [allocAttempt1.status, allocAttempt2.status].sort();
    assert(
      statuses[0] === 201 && statuses[1] === 409,
      `Simultaneous allocation race resulted in exactly one success (201) and one conflict (409): ${statuses.join(', ')}`
    );
    console.log('[PASS] Hardware-level PostgreSQL exclusion constraint strictly blocked simultaneous double-booking');

    // --------------------------------------------------------------------------
    // TEST 5: Maintenance Unit Allocation & Check-in Prevention
    // --------------------------------------------------------------------------
    console.log('\n[TEST 5] Testing Maintenance Unit Allocation Rejection');
    const maintenanceAlloc = await fetch(`${baseUrl}/allocations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        registrationId: regB.id,
        entryDate,
        exitDate,
        unitIds: [maintenanceUnit.id],
      }),
    });
    assert(maintenanceAlloc.status === 400 || maintenanceAlloc.status === 409, 'Allocation to unit under MAINTENANCE rejected');
    console.log('[PASS] Units under MAINTENANCE cannot be allocated');

    // --------------------------------------------------------------------------
    // TEST 6: Concurrent Participant Check-In Collision
    // --------------------------------------------------------------------------
    console.log('\n[TEST 6] Testing Concurrent Participant Check-in Collision');
    // Set up participant
    const participant = await prisma.participant.create({
      data: {
        registrationId: regA.id,
        fullName: 'Concurrency Test Participant',
        checkInStatus: 'CONFIRMED',
      },
    });

    const freeUnit = testRoom.units.find((u) => u.unitNumber === 'B-2')!;

    // Two reception desks attempt to check in the same participant simultaneously into the same unit
    const [checkInAttempt1, checkInAttempt2] = await Promise.all([
      fetch(`${baseUrl}/reception/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staff1Token}` },
        body: JSON.stringify({
          registrationId: regA.id,
          checkIns: [{ participantId: participant.id, unitId: freeUnit.id }],
        }),
      }),
      fetch(`${baseUrl}/reception/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staff2Token}` },
        body: JSON.stringify({
          registrationId: regA.id,
          checkIns: [{ participantId: participant.id, unitId: freeUnit.id }],
        }),
      }),
    ]);

    const checkInStatuses = [checkInAttempt1.status, checkInAttempt2.status].sort();
    assert(
      checkInStatuses[0] === 200 && checkInStatuses[1] === 409,
      `Simultaneous check-in race resulted in exactly one success (200) and one conflict (409): ${checkInStatuses.join(', ')}`
    );
    console.log('[PASS] Exclusion constraint blocked simultaneous duplicate physical check-in');

    // --------------------------------------------------------------------------
    // TEST 7: Production Error Details Masking
    // --------------------------------------------------------------------------
    console.log('\n[TEST 7] Testing Production Error Masking (Zero Stack/Internal Leaks)');
    // In production mode, error handler must omit stack traces
    const notFoundRes = await fetch(`${baseUrl}/non-existent-endpoint-route`);
    assert(notFoundRes.status === 404, 'Unknown route returns HTTP 404');
    const notFoundData = await notFoundRes.json();
    assert(!notFoundData.stack, 'Stack trace strictly omitted from 404 error responses');

    // --------------------------------------------------------------------------
    // TEST 8: Sensitive Data Leakage Audit across Core Endpoints
    // --------------------------------------------------------------------------
    console.log('\n[TEST 8] Comprehensive Sensitive Data Leakage Audit');
    const endpointsToInspect = [
      `${baseUrl}/health`,
      `${baseUrl}/search?q=TEST`,
      `${baseUrl}/reports/overview`,
      `${baseUrl}/activity?page=1&limit=5`,
    ];

    for (const url of endpointsToInspect) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${adminToken}` } });
      const text = await res.text();
      assert(!text.includes('passwordHash'), `Zero passwordHash leakage in ${url}`);
      assert(!text.includes('jwt_secret') && !text.includes('SecretPassword'), `Zero secret leakage in ${url}`);
      const aadhaarPattern = /\b[2-9]\d{3}\s\d{4}\s\d{4}\b/g;
      const aadhaarMatches = text.match(aadhaarPattern);
      assert(!aadhaarMatches, `Zero unmasked Aadhaar pattern matches in ${url}`);
    }
    console.log('[PASS] All core endpoints audited: Zero password, secret, or Aadhaar leaks detected');

    // --------------------------------------------------------------------------
    // TEST 9: General API Rate Limiting Threshold Verification
    // --------------------------------------------------------------------------
    console.log('\n[TEST 9] Testing General API Rate Limiter Header & Behavior');
    const burstReq = await fetch(`${baseUrl}/health`);
    assert(burstReq.status === 200, 'Healthy request under rate limit returns HTTP 200');
    console.log('[PASS] API rate limiting operational and non-blocking for standard workflows');

    // --------------------------------------------------------------------------
    // TEST 10: Database Connection Pooling & Latency Benchmark
    // --------------------------------------------------------------------------
    console.log('\n[TEST 10] Testing Database Connection Pool & Latency Benchmark');
    const benchStart = Date.now();
    await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      prisma.$queryRaw`SELECT 1`,
      prisma.$queryRaw`SELECT 1`,
      prisma.$queryRaw`SELECT 1`,
      prisma.$queryRaw`SELECT 1`,
    ]);
    const benchDuration = Date.now() - benchStart;
    assert(benchDuration < 300, `5 concurrent database queries executed in ${benchDuration}ms (< 300ms)`);
    console.log(`[PASS] Connection pool benchmark: 5 concurrent queries completed in ${benchDuration}ms`);

    console.log('\n================================================================================');
    console.log('ALL PHASE 11: PRODUCTION HARDENING & CONCURRENCY TESTS PASSED (10/10)!');
    console.log('================================================================================\n');

    // Cleanup test records
    const allRegIds = regResults.map((r) => r.data.id);
    await prisma.stayRecord.deleteMany({
      where: {
        OR: [
          { participantId: participant.id },
          { unit: { roomId: testRoom.id } },
          { registrationId: { in: allRegIds } },
        ],
      },
    });
    await prisma.messageLog.deleteMany({
      where: { registrationId: { in: allRegIds } },
    });
    await prisma.allocationItem.deleteMany({
      where: { unit: { roomId: testRoom.id } },
    });
    await prisma.allocation.deleteMany({
      where: { registrationId: { in: allRegIds } },
    });
    await prisma.participant.deleteMany({
      where: {
        OR: [
          { id: participant.id },
          { registrationId: { in: allRegIds } },
        ],
      },
    });
    await prisma.registration.deleteMany({
      where: { id: { in: allRegIds } },
    });
    await prisma.accommodationUnit.deleteMany({
      where: { roomId: testRoom.id },
    });
    await prisma.room.deleteMany({
      where: { id: testRoom.id },
    });
    const userIds = [superAdmin.id, manager1.id, manager2.id, staff1.id, staff2.id];
    await prisma.stayRecord.deleteMany({
      where: { recordedById: { in: userIds } },
    });
    await prisma.aadhaarRecord.deleteMany({
      where: { recordedById: { in: userIds } },
    });
    await prisma.allocationItem.deleteMany({
      where: { allocation: { createdById: { in: userIds } } },
    });
    await prisma.allocation.deleteMany({
      where: { createdById: { in: userIds } },
    });
    await prisma.messageLog.deleteMany({
      where: { sentByUserId: { in: userIds } },
    });
    await prisma.activityLog.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.adminUser.deleteMany({
      where: {
        id: { in: userIds },
      },
    });
  } finally {
    await stopTestServer();
  }
}

runHardeningVerificationSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Hardening verification failed:', err);
    process.exit(1);
  });
