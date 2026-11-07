import { createApp } from '../app';
import { prisma } from '../config/prisma';
import { generateToken } from '../utils/token';
import { decryptSensitiveData } from '../utils/encryption';
import {
  UserRole,
  AllocationStatus,
  StayStatus,
  ParticipantStatus,
  RegistrationStatus,
  Gender,
  AadhaarComplianceStatus,
} from '@prisma/client';
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

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: bodyStr,
  });

  const text = await response.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  return {
    status: response.status,
    headers: response.headers,
    body: json,
  };
}

async function runReceptionVerificationSuite() {
  console.log('================================================================================');
  console.log('STARTING PHASE 8: RECEPTION DESK & OCCUPANCY VERIFICATION SUITE');
  console.log('================================================================================\n');

  await startTestServer();

  try {
    // --------------------------------------------------------------------------
    // Setup test staff and test units
    // --------------------------------------------------------------------------
    console.log('[SETUP] Setting up reception test users, rooms, and allocations');

    const adminUser = await prisma.adminUser.upsert({
      where: { email: 'admin-rcp@accommodation.local' },
      update: { role: UserRole.SUPER_ADMIN, status: 'ACTIVE' },
      create: {
        email: 'admin-rcp@accommodation.local',
        passwordHash: 'dummy-hash',
        name: 'Admin Reception Supervisor',
        role: UserRole.SUPER_ADMIN,
        status: 'ACTIVE',
      },
    });

    const staffUser = await prisma.adminUser.upsert({
      where: { email: 'staff-rcp@accommodation.local' },
      update: { role: UserRole.RECEPTION_STAFF, status: 'ACTIVE' },
      create: {
        email: 'staff-rcp@accommodation.local',
        passwordHash: 'dummy-hash',
        name: 'Reception Officer Amit',
        role: UserRole.RECEPTION_STAFF,
        status: 'ACTIVE',
      },
    });

    const viewerUser = await prisma.adminUser.upsert({
      where: { email: 'viewer-rcp@accommodation.local' },
      update: { role: UserRole.VIEWER, status: 'ACTIVE' },
      create: {
        email: 'viewer-rcp@accommodation.local',
        passwordHash: 'dummy-hash',
        name: 'Viewer Auditing Staff',
        role: UserRole.VIEWER,
        status: 'ACTIVE',
      },
    });

    const staffToken = generateToken({
      userId: staffUser.id,
      email: staffUser.email,
      role: staffUser.role,
      name: staffUser.name,
    });

    const viewerToken = generateToken({
      userId: viewerUser.id,
      email: viewerUser.email,
      role: viewerUser.role,
      name: viewerUser.name,
    });

    // Create 2 test rooms with units
    const testRoom1 = await prisma.room.create({
      data: {
        roomNumber: 'RCP-101-' + Date.now().toString().slice(-4),
        building: 'Reception Wing',
        floor: 1,
        totalBeds: 3,
        totalMats: 0,
        units: {
          create: [
            { unitNumber: 'B1', type: 'BED', genderCategory: 'ANY' },
            { unitNumber: 'B2', type: 'BED', genderCategory: 'ANY' },
            { unitNumber: 'B3', type: 'BED', genderCategory: 'ANY' },
          ],
        },
      },
      include: { units: true },
    });

    const testRoom2 = await prisma.room.create({
      data: {
        roomNumber: 'RCP-102-' + Date.now().toString().slice(-4),
        building: 'Reception Wing',
        floor: 1,
        totalBeds: 2,
        totalMats: 1,
        units: {
          create: [
            { unitNumber: 'B1', type: 'BED', genderCategory: 'ANY' },
            { unitNumber: 'B2', type: 'BED', genderCategory: 'ANY' },
            { unitNumber: 'M1', type: 'MAT', genderCategory: 'ANY' },
          ],
        },
      },
      include: { units: true },
    });

    // Create a 5-member registration
    const regUnique = Date.now().toString().slice(-4);
    const testReg = await prisma.registration.create({
      data: {
        registrationId: 'REG-RCP-' + regUnique,
        primaryName: 'Maheshwar Sharma',
        mobile: '9822334455',
        totalMembers: 5,
        city: 'Varanasi',
        state: 'Uttar Pradesh',
        status: RegistrationStatus.REGISTERED,
      },
    });

    // Create a 4-unit tentative allocation (heterogeneous: 3 beds in Room 1 + 1 mat in Room 2)
    const testAlloc = await prisma.allocation.create({
      data: {
        allocationNumber: 'ALC-RCP-' + regUnique,
        registrationId: testReg.id,
        status: AllocationStatus.TENTATIVE,
        entryDate: new Date(),
        exitDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        createdById: adminUser.id,
        items: {
          create: [
            {
              unitId: testRoom1.units[0].id,
              entryDate: new Date(),
              exitDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
              status: 'TENTATIVE',
            },
            {
              unitId: testRoom1.units[1].id,
              entryDate: new Date(),
              exitDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
              status: 'TENTATIVE',
            },
            {
              unitId: testRoom1.units[2].id,
              entryDate: new Date(),
              exitDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
              status: 'TENTATIVE',
            },
            {
              unitId: testRoom2.units[2].id, // M1
              entryDate: new Date(),
              exitDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
              status: 'TENTATIVE',
            },
          ],
        },
      },
      include: { items: true },
    });

    // --------------------------------------------------------------------------
    // TEST 1: Reception Overview & Metrics
    // --------------------------------------------------------------------------
    console.log('\n[TEST 1] Testing Reception Overview & Counters (GET /api/reception/overview)');
    const overviewRes = await makeRequest('/reception/overview', {
      method: 'GET',
      token: staffToken,
    });

    assert(overviewRes.status === 200, 'GET /reception/overview returned HTTP 200');
    assert(overviewRes.body.success === true, 'Success: true');
    assert(typeof overviewRes.body.data.metrics.tentativeAwaitingCount === 'number', 'Contains tentativeAwaitingCount');
    assert(typeof overviewRes.body.data.metrics.checkedInCount === 'number', 'Contains checkedInCount');
    assert(Array.isArray(overviewRes.body.data.records), 'Records is an array');

    // --------------------------------------------------------------------------
    // TEST 2: Registration & Allocation Lookup
    // --------------------------------------------------------------------------
    console.log('\n[TEST 2] Testing Reception Search & Lookup (GET /api/reception/lookup)');
    const searchRes = await makeRequest(`/reception/lookup?q=${testReg.registrationId}`, {
      method: 'GET',
      token: staffToken,
    });

    assert(searchRes.status === 200, 'GET /reception/lookup returned HTTP 200');
    assert(searchRes.body.data.length >= 1, 'Lookup found registration by registrationId');
    assert(searchRes.body.data[0].registrationId === testReg.registrationId, 'Matched correct registrationId');

    // Also lookup by allocation number
    const searchByAllocRes = await makeRequest(`/reception/lookup?q=${testAlloc.allocationNumber}`, {
      method: 'GET',
      token: staffToken,
    });
    assert(searchByAllocRes.status === 200, 'Lookup by allocation number returned HTTP 200');
    assert(searchByAllocRes.body.data.length >= 1, 'Found registration by allocationNumber');

    // --------------------------------------------------------------------------
    // TEST 3: Reception Dossier Profile
    // --------------------------------------------------------------------------
    console.log('\n[TEST 3] Testing Reception Dossier Profile (GET /api/reception/dossier/:id)');
    const dossierRes = await makeRequest(`/reception/dossier/${testReg.id}`, {
      method: 'GET',
      token: staffToken,
    });

    assert(dossierRes.status === 200, 'GET /reception/dossier/:id returned HTTP 200');
    assert(dossierRes.body.data.registration.registrationId === testReg.registrationId, 'Dossier registration matches');
    assert(dossierRes.body.data.capacitySummary.totalRegisteredMembers === 5, 'totalRegisteredMembers is 5');
    assert(dossierRes.body.data.capacitySummary.allocatedUnitsCount === 4, 'allocatedUnitsCount is 4');

    // --------------------------------------------------------------------------
    // TEST 4: Partial Family Arrival & Actual Participant Recording
    // --------------------------------------------------------------------------
    console.log('\n[TEST 4] Testing Partial Family Arrival Recording (5 Registered -> 3 Arrived)');
    // Only 3 members arrive: Primary (Maheshwar), Wife (Sunita), Son (Rahul)
    const arriveRes = await makeRequest('/reception/participants', {
      method: 'POST',
      token: staffToken,
      body: {
        registrationId: testReg.id,
        participants: [
          {
            fullName: 'Maheshwar Sharma',
            gender: Gender.MALE,
            age: 52,
            relationToPrimary: 'Self',
            isPrimary: true,
          },
          {
            fullName: 'Sunita Sharma',
            gender: Gender.FEMALE,
            age: 48,
            relationToPrimary: 'Spouse',
            isPrimary: false,
          },
          {
            fullName: 'Rahul Sharma',
            gender: Gender.MALE,
            age: 22,
            relationToPrimary: 'Son',
            isPrimary: false,
          },
        ],
      },
    });

    assert(arriveRes.status === 200, 'POST /reception/participants returned HTTP 200');
    assert(arriveRes.body.data.length === 3, 'Recorded exactly 3 actual arriving participants');
    const participants = arriveRes.body.data;
    const p1 = participants.find((p: any) => p.fullName === 'Maheshwar Sharma');
    const p2 = participants.find((p: any) => p.fullName === 'Sunita Sharma');
    const p3 = participants.find((p: any) => p.fullName === 'Rahul Sharma');

    assert(Boolean(p1 && p2 && p3), 'All 3 arriving participants created in database');
    assert(p1.isPrimary === true, 'Primary registrant flagged isPrimary: true');

    // --------------------------------------------------------------------------
    // TEST 5: Encrypted Aadhaar Collection & Consent
    // --------------------------------------------------------------------------
    console.log('\n[TEST 5] Testing Aadhaar Collection: AES-256-GCM Encryption, Consent & Masked UI');
    const aadhaarInput = '555544443333';
    const aadhaarRes = await makeRequest('/reception/aadhaar', {
      method: 'POST',
      token: staffToken,
      body: {
        participantId: p1.id,
        aadhaarNumber: aadhaarInput,
        retentionConsent: true,
        complianceStatus: AadhaarComplianceStatus.VERIFIED,
      },
    });

    assert(aadhaarRes.status === 200, 'POST /reception/aadhaar returned HTTP 200');
    assert(aadhaarRes.body.data.maskedAadhaar === 'XXXX-XXXX-3333', 'Returns strictly masked format (XXXX-XXXX-3333)');
    assert(aadhaarRes.body.data.retentionConsent === true, 'Explicit opt-in consent recorded');

    // Direct database validation: verify ciphertext is encrypted and plaintext is NOT stored
    const dbAadhaar = await prisma.aadhaarRecord.findUniqueOrThrow({
      where: { participantId: p1.id },
    });
    assert(dbAadhaar.encryptedAadhaar !== aadhaarInput, 'Plaintext 12-digit Aadhaar is NEVER stored in database');
    assert(dbAadhaar.lastFourDigits === '3333', 'Last 4 digits stored unencrypted for verification');

    // Decryption test
    const decrypted = decryptSensitiveData(dbAadhaar.encryptedAadhaar, dbAadhaar.aadhaarIv, dbAadhaar.aadhaarAuthTag);
    assert(decrypted === aadhaarInput, 'AES-256-GCM decryption successfully recovers authentic Aadhaar');

    // --------------------------------------------------------------------------
    // TEST 6: Reception Review & Partial Confirmation
    // --------------------------------------------------------------------------
    console.log('\n[TEST 6] Testing Reception Review & Partial Allocation Confirmation');
    // Map 3 participants to 3 of the 4 allocated units (Room 1: B1, B2, B3)
    const confirmRes = await makeRequest('/reception/confirm', {
      method: 'POST',
      token: staffToken,
      body: {
        allocationId: testAlloc.id,
        participantAssignments: [
          {
            participantId: p1.id,
            unitId: testRoom1.units[0].id,
            allocationItemId: testAlloc.items[0].id,
          },
          {
            participantId: p2.id,
            unitId: testRoom1.units[1].id,
            allocationItemId: testAlloc.items[1].id,
          },
          {
            participantId: p3.id,
            unitId: testRoom1.units[2].id,
            allocationItemId: testAlloc.items[2].id,
          },
        ],
      },
    });

    assert(confirmRes.status === 200, 'POST /reception/confirm returned HTTP 200');
    assert(confirmRes.body.data.status === AllocationStatus.CONFIRMED, 'Allocation transitioned to CONFIRMED');

    const confirmedReg = await prisma.registration.findUnique({ where: { id: testReg.id } });
    assert(confirmedReg?.status === RegistrationStatus.CONFIRMED, 'Registration transitioned to CONFIRMED');

    // Verify unassigned 4th unit (Room 2 M1) remains unassigned
    const unassignedItem = await prisma.allocationItem.findUnique({ where: { id: testAlloc.items[3].id } });
    assert(unassignedItem?.participantId === null, 'Unused 4th unit remains unassigned and distinguishable');

    // --------------------------------------------------------------------------
    // TEST 7: Actual Check-In
    // --------------------------------------------------------------------------
    console.log('\n[TEST 7] Testing Actual Check-In (Physical Bed/Mat Occupancy Activation)');
    const checkInRes = await makeRequest('/reception/check-in', {
      method: 'POST',
      token: staffToken,
      body: {
        registrationId: testReg.id,
        allocationId: testAlloc.id,
        checkIns: [
          {
            participantId: p1.id,
            unitId: testRoom1.units[0].id,
            allocationItemId: testAlloc.items[0].id,
            notes: 'Checked in by reception desk',
          },
          {
            participantId: p2.id,
            unitId: testRoom1.units[1].id,
            allocationItemId: testAlloc.items[1].id,
          },
          {
            participantId: p3.id,
            unitId: testRoom1.units[2].id,
            allocationItemId: testAlloc.items[2].id,
          },
        ],
      },
    });

    assert(checkInRes.status === 200, 'POST /reception/check-in returned HTTP 200');
    assert(checkInRes.body.data.length === 3, 'Created 3 active StayRecords');
    const stays = checkInRes.body.data;
    const stay1 = stays.find((s: any) => s.participantId === p1.id);
    assert(stay1.status === StayStatus.CHECKED_IN, 'Stay status is CHECKED_IN');
    assert(stay1.recordedById === staffUser.id, 'Recorded by current staff user');

    // Verify participant checkInStatus
    const checkedInP1 = await prisma.participant.findUnique({ where: { id: p1.id } });
    assert(checkedInP1?.checkInStatus === ParticipantStatus.CHECKED_IN, 'Participant marked CHECKED_IN');

    // --------------------------------------------------------------------------
    // TEST 8: Check-in Authorization & Double Occupancy Prevention
    // --------------------------------------------------------------------------
    console.log('\n[TEST 8] Testing Check-in Authorization & Double Occupancy Protection');
    // Create an unconfirmed 4th participant
    const extraParticipant = await prisma.participant.create({
      data: {
        registrationId: testReg.id,
        fullName: 'Suraj Verma',
        isPrimary: false,
        checkInStatus: ParticipantStatus.REGISTERED, // Not confirmed yet
      },
    });

    // Attempt 1: Check in unconfirmed participant without prior reception confirmation
    const unconfirmedCheckIn = await makeRequest('/reception/check-in', {
      method: 'POST',
      token: staffToken,
      body: {
        registrationId: testReg.id,
        checkIns: [
          {
            participantId: extraParticipant.id,
            unitId: testRoom2.units[0].id,
          },
        ],
      },
    });
    assert(
      unconfirmedCheckIn.status === 500 && unconfirmedCheckIn.body.message.includes('cannot be checked in without prior reception confirmation'),
      'Check-in blocked for unconfirmed participant (Enforces reception confirmation requirement)'
    );

    // Now confirm extra participant
    await prisma.participant.update({
      where: { id: extraParticipant.id },
      data: { checkInStatus: ParticipantStatus.CONFIRMED },
    });

    // Attempt 2: Check extra participant into already occupied Room 1 B1
    const conflictRes = await makeRequest('/reception/check-in', {
      method: 'POST',
      token: staffToken,
      body: {
        registrationId: testReg.id,
        checkIns: [
          {
            participantId: extraParticipant.id,
            unitId: testRoom1.units[0].id, // Already occupied by p1
          },
        ],
      },
    });

    assert(conflictRes.status === 409, 'Double occupancy blocked with HTTP 409 Conflict (PostgreSQL 23P01)');
    assert(conflictRes.body.conflictType === 'OCCUPANCY_CONFLICT', 'Proper conflictType returned');

    // Attempt 3: Check already checked-in participant p1 into another unit at the same time
    const overlapParticipantRes = await makeRequest('/reception/check-in', {
      method: 'POST',
      token: staffToken,
      body: {
        registrationId: testReg.id,
        checkIns: [
          {
            participantId: p1.id, // Already checked into Room 1 B1
            unitId: testRoom2.units[0].id, // Different unit
          },
        ],
      },
    });

    assert(
      overlapParticipantRes.status === 409,
      'Participant overlapping stay blocked with HTTP 409 Conflict (PostgreSQL 23P01)'
    );

    // --------------------------------------------------------------------------
    // TEST 9: Room / Bed / Mat Transfer with Audit History
    // --------------------------------------------------------------------------
    console.log('\n[TEST 9] Testing Room Transfer with Prior History Preservation');
    // Transfer Rahul (p3) from Room 1 B3 to Room 2 M1 (available Mat)
    const stay3 = stays.find((s: any) => s.participantId === p3.id);

    const transferRes = await makeRequest('/reception/transfer', {
      method: 'POST',
      token: staffToken,
      body: {
        stayRecordId: stay3.id,
        newUnitId: testRoom2.units[2].id, // Room 2 M1
        reason: 'Guest requested floor mat due to personal comfort preference',
      },
    });

    assert(transferRes.status === 200, 'POST /reception/transfer returned HTTP 200');
    assert(transferRes.body.data.previousStay.status === StayStatus.TRANSFERRED, 'Prior stay marked TRANSFERRED');
    assert(
      transferRes.body.data.previousStay.transferReason.includes('personal comfort'),
      'Transfer reason recorded on prior stay'
    );
    assert(transferRes.body.data.newStay.status === StayStatus.CHECKED_IN, 'New stay is active CHECKED_IN');
    assert(
      transferRes.body.data.newStay.previousStayRecordId === stay3.id,
      'New stay is linked to previous stay via previousStayRecordId'
    );

    // --------------------------------------------------------------------------
    // TEST 10: Stay Extension Conflict & Actual Checkout
    // --------------------------------------------------------------------------
    console.log('\n[TEST 10] Testing Stay Extension Conflict Checking & Checkout (Capacity Release)');
    const stay2 = stays.find((s: any) => s.participantId === p2.id);

    // Setup future conflicting reservation on stay2's unit (Room 1 B2) in 4 days
    const futureEntryDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    const futureExitDate = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);

    const conflictAlloc = await prisma.allocation.create({
      data: {
        allocationNumber: 'ALC-FUTURE-' + Date.now().toString().slice(-4),
        registrationId: testReg.id,
        status: AllocationStatus.CONFIRMED,
        entryDate: futureEntryDate,
        exitDate: futureExitDate,
        createdById: adminUser.id,
        items: {
          create: [
            {
              unitId: testRoom1.units[1].id, // same unit as stay2
              entryDate: futureEntryDate,
              exitDate: futureExitDate,
              status: 'CONFIRMED',
            },
          ],
        },
      },
    });

    // Attempt extension past the future booking date (e.g. into day 5)
    const conflictingExtensionDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const conflictExtendRes = await makeRequest('/reception/extend-stay', {
      method: 'POST',
      token: staffToken,
      body: {
        stayRecordId: stay2.id,
        newExitDate: conflictingExtensionDate,
        notes: 'Attempting conflicting extension',
      },
    });

    assert(conflictExtendRes.status === 409, 'Extension into conflicting future reservation rejected with HTTP 409 Conflict');
    assert(conflictExtendRes.body.conflictType === 'EXTENSION_CONFLICT', 'conflictType is EXTENSION_CONFLICT');

    // Valid extension before the future booking date (in 2 days)
    const validExtensionDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const validExtendRes = await makeRequest('/reception/extend-stay', {
      method: 'POST',
      token: staffToken,
      body: {
        stayRecordId: stay2.id,
        newExitDate: validExtensionDate,
        notes: 'Extension to non-conflicting date',
      },
    });

    assert(validExtendRes.status === 200, 'Non-conflicting extension succeeded (HTTP 200)');
    assert(validExtendRes.body.data.status === StayStatus.EXTENDED, 'Stay status updated to EXTENDED');
    assert(validExtendRes.body.data.notes.includes('Extension: Original Exit'), 'Historical planned date preserved in notes');

    // Actual Checkout of stay1 (Maheshwar)
    const checkoutRes = await makeRequest('/reception/check-out', {
      method: 'POST',
      token: staffToken,
      body: {
        stayRecordId: stay1.id,
        notes: 'Key card returned, luggage cleared',
      },
    });

    assert(checkoutRes.status === 200, 'POST /reception/check-out returned HTTP 200');
    assert(checkoutRes.body.data.status === StayStatus.CHECKED_OUT, 'Stay status is CHECKED_OUT');
    assert(checkoutRes.body.data.actualCheckOut !== null, 'actualCheckOut timestamp recorded');

    const checkedOutP1 = await prisma.participant.findUnique({ where: { id: p1.id } });
    assert(checkedOutP1?.checkInStatus === ParticipantStatus.CHECKED_OUT, 'Participant marked CHECKED_OUT');

    // Now verify unit Room 1 B1 is released: another participant CAN now check in without 23P01 error
    const reuseUnitRes = await makeRequest('/reception/check-in', {
      method: 'POST',
      token: staffToken,
      body: {
        registrationId: testReg.id,
        checkIns: [
          {
            participantId: extraParticipant.id,
            unitId: testRoom1.units[0].id, // Previously occupied by p1, now checked out
          },
        ],
      },
    });
    assert(reuseUnitRes.status === 200, 'Released unit successfully checked into by new occupant');

    // --------------------------------------------------------------------------
    // TEST 11: Role-Based Authorization
    // --------------------------------------------------------------------------
    console.log('\n[TEST 11] Testing Role-Based Authorization on Reception Operations');
    const viewerCheckInRes = await makeRequest('/reception/check-in', {
      method: 'POST',
      token: viewerToken,
      body: {
        registrationId: testReg.id,
        checkIns: [{ participantId: p1.id, unitId: testRoom1.units[0].id }],
      },
    });
    assert(viewerCheckInRes.status === 403, 'VIEWER role forbidden from check-in (HTTP 403)');

    const viewerCheckoutRes = await makeRequest('/reception/check-out', {
      method: 'POST',
      token: viewerToken,
      body: { stayRecordId: stay1.id },
    });
    assert(viewerCheckoutRes.status === 403, 'VIEWER role forbidden from checkout (HTTP 403)');

    console.log('\n================================================================================');
    console.log('ALL PHASE 8: RECEPTION DESK & OCCUPANCY TESTS PASSED (11/11)!');
    console.log('================================================================================\n');
  } finally {
    await stopTestServer();
  }
}

runReceptionVerificationSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Reception verification test failed:', err);
    process.exit(1);
  });
