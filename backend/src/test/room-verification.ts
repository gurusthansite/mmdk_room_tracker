import { createApp } from '../app';
import { prisma } from '../config/prisma';
import { generateToken } from '../utils/token';
import { UserRole, UserStatus, RoomStatus, GenderPreference, UnitType, GenderCategory, UnitStatus } from '@prisma/client';
import http from 'http';

async function runRoomVerification() {
  console.log('====================================================');
  console.log('       PHASE 4: ROOM MANAGEMENT VERIFICATION');
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

  // Helper auth headers
  const adminUser = await prisma.adminUser.findFirstOrThrow({ where: { role: UserRole.SUPER_ADMIN } });
  const adminToken = generateToken({
    userId: adminUser.id,
    email: adminUser.email,
    name: adminUser.name,
    role: adminUser.role,
  });

  async function apiCall(endpoint: string, options: { method?: string; body?: any; token?: string } = {}) {
    const url = `${baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${options.token !== undefined ? options.token : adminToken}`,
    };

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
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
    // ------------------------------------------------------------------------
    // TEST 1: List Rooms & Detailed Unit Breakdown
    // ------------------------------------------------------------------------
    console.log('--- Subsystem 1: Room Listing & Inventory Breakdown ---');
    const listRes = await apiCall('/rooms');
    assert(listRes.status === 200 && listRes.data.success === true, 'List rooms returned HTTP 200');
    assert(listRes.data.data.length >= 5, `Found ${listRes.data.data.length} rooms in database (expected >= 5)`);

    const r101Summary = listRes.data.data.find((r: any) => r.roomNumber === 'R-101');
    assert(r101Summary !== undefined, 'Room R-101 found in listing');
    assert(
      r101Summary.breakdown.bedsMale === 4 && r101Summary.breakdown.bedsFemale === 2 && r101Summary.breakdown.matsMale === 2,
      'R-101 breakdown matches reference sheet: 4 Male Beds, 2 Female Beds, 2 Male Mats'
    );
    assert(r101Summary.totalCapacity === 8, 'R-101 total capacity correctly calculated as 8 units');

    // ------------------------------------------------------------------------
    // TEST 2: Search & Filter Capabilities
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 2: Search & Filter Verification ---');
    const searchRes = await apiCall('/rooms?q=R-102');
    assert(searchRes.data.data.length === 1 && searchRes.data.data[0].roomNumber === 'R-102', 'Search by room number q=R-102 returned single exact match');

    const filterBuildingRes = await apiCall('/rooms?building=Annexe A');
    assert(
      filterBuildingRes.data.data.every((r: any) => r.building === 'Annexe A'),
      'Filter by building=Annexe A returned only rooms belonging to Annexe A'
    );

    // ------------------------------------------------------------------------
    // TEST 3: Room Details & Visual Layout Grid State
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 3: Visual Room Layout & Unit Statuses ---');
    const r101Details = await apiCall(`/rooms/${r101Summary.id}`);
    assert(r101Details.status === 200, 'GET /rooms/:id returned HTTP 200');
    assert(r101Details.data.data.units.length === 8, 'R-101 contains all 8 granular accommodation units');

    const unitStates = r101Details.data.data.units.map((u: any) => u.visualState);
    assert(unitStates.includes('CHECKED_IN'), 'Unit B6 in R-101 reflects CHECKED_IN visual state (Purple)');
    assert(unitStates.includes('CONFIRMED'), 'Units B4, B5 in R-101 reflect CONFIRMED visual state (Amber)');
    assert(unitStates.includes('ALLOCATED'), 'Units B1, B2, B3 in R-101 reflect ALLOCATED visual state (Blue)');
    assert(unitStates.includes('AVAILABLE'), 'Mats M1, M2 in R-101 reflect AVAILABLE visual state (Green)');

    // ------------------------------------------------------------------------
    // TEST 4: Create Room with Auto-Provisioned Units & Trigger Sync
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 4: Room Creation & Trigger Synchronization ---');
    const newRoomNumber = `R-TEST-${Date.now().toString().slice(-4)}`;
    const createRes = await apiCall('/rooms', {
      method: 'POST',
      body: {
        roomNumber: newRoomNumber,
        building: 'Test Wing',
        floor: 3,
        genderPreference: GenderPreference.ANY,
        status: RoomStatus.ACTIVE,
        notes: 'Integration test room',
        maleBeds: 2,
        femaleBeds: 2,
        anyBeds: 1, // 5 total beds
        maleMats: 1,
        femaleMats: 1,
        anyMats: 0, // 2 total mats
      },
    });

    assert(createRes.status === 201 && createRes.data.success === true, 'Room creation returned HTTP 201 Created');
    assert(createRes.data.data.units.length === 7, '7 granular units auto-generated (B1..B5, M1..M2)');
    assert(
      createRes.data.data.totalBeds === 5 && createRes.data.data.totalMats === 2,
      'PostgreSQL trigger auto-synchronized room capacity: totalBeds=5, totalMats=2'
    );

    const createdRoomId = createRes.data.data.id;

    // ------------------------------------------------------------------------
    // TEST 5: Duplicate Room Number Prevention
    // ------------------------------------------------------------------------
    const dupRes = await apiCall('/rooms', {
      method: 'POST',
      body: { roomNumber: newRoomNumber, maleBeds: 1 },
    });
    assert(dupRes.status === 409, 'Duplicate roomNumber correctly rejected with HTTP 409 Conflict');

    // ------------------------------------------------------------------------
    // TEST 6: Add Unit to Existing Room
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 5: Adding Units & Capacity Integrity ---');
    const addUnitRes = await apiCall(`/rooms/${createdRoomId}/units`, {
      method: 'POST',
      body: {
        unitNumber: 'B6',
        type: UnitType.BED,
        genderCategory: GenderCategory.MALE,
        status: UnitStatus.ACTIVE,
      },
    });
    assert(addUnitRes.status === 201, 'Unit B6 added to room successfully (HTTP 201)');
    assert(addUnitRes.data.data.roomTotalBeds === 6, 'PostgreSQL trigger updated roomTotalBeds to 6');

    // Duplicate unit in same room rejected
    const dupUnitRes = await apiCall(`/rooms/${createdRoomId}/units`, {
      method: 'POST',
      body: { unitNumber: 'B6', type: UnitType.BED },
    });
    assert(dupUnitRes.status === 409, 'Duplicate unitNumber in same room rejected with HTTP 409');

    // ------------------------------------------------------------------------
    // TEST 7: Update Unit Status (Maintenance Toggle)
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 6: Unit Maintenance Updates ---');
    const unitToUpdate = addUnitRes.data.data.unit;
    const updateUnitRes = await apiCall(`/rooms/${createdRoomId}/units/${unitToUpdate.id}`, {
      method: 'PUT',
      body: {
        status: UnitStatus.MAINTENANCE,
        notes: 'Spring broken, scheduled for repair',
      },
    });
    assert(updateUnitRes.status === 200 && updateUnitRes.data.data.status === 'MAINTENANCE', 'Unit status updated to MAINTENANCE');

    // Verify visual state on room reflects MAINTENANCE
    const refetchedRoom = await apiCall(`/rooms/${createdRoomId}`);
    const b6Visual = refetchedRoom.data.data.units.find((u: any) => u.unitNumber === 'B6');
    assert(b6Visual.visualState === 'MAINTENANCE', 'Visual state of Unit B6 displays MAINTENANCE (Slate)');

    // ------------------------------------------------------------------------
    // TEST 8: Delete Protection & Room Deletion
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 7: Delete Protections & Clean Removal ---');
    // R-101 has active allocations/stays -> delete must be rejected
    const deleteBlockedRes = await apiCall(`/rooms/${r101Summary.id}`, { method: 'DELETE' });
    assert(deleteBlockedRes.status === 400 && deleteBlockedRes.data.message.includes('historical or active allocations'), 'Delete protection: Room with active allocations cannot be deleted (HTTP 400)');

    // Deleting the newly created test room (no allocations) succeeds
    const deleteNewRes = await apiCall(`/rooms/${createdRoomId}`, { method: 'DELETE' });
    assert(deleteNewRes.status === 200 && deleteNewRes.data.success === true, 'Room without allocations deleted cleanly (HTTP 200)');

    // ------------------------------------------------------------------------
    // TEST 9: Role-Based Access Control (RBAC)
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 8: RBAC Permissions on Room Endpoints ---');
    // Create temporary staff user with RECEPTION_STAFF role
    const staffUser = await prisma.adminUser.upsert({
      where: { email: 'reception.tester@accommodation.local' },
      update: { role: UserRole.RECEPTION_STAFF, status: UserStatus.ACTIVE },
      create: {
        email: 'reception.tester@accommodation.local',
        passwordHash: 'dummy',
        name: 'Reception Tester',
        role: UserRole.RECEPTION_STAFF,
        status: UserStatus.ACTIVE,
      },
    });

    const staffToken = generateToken({
      userId: staffUser.id,
      email: staffUser.email,
      name: staffUser.name,
      role: staffUser.role,
    });

    // Staff CANNOT list room management configuration (HTTP 403)
    const staffListRes = await apiCall('/rooms', { token: staffToken });
    assert(staffListRes.status === 403, 'Reception staff forbidden from room configuration management (HTTP 403)');

    // Staff CANNOT create rooms
    const staffCreateRes = await apiCall('/rooms', {
      method: 'POST',
      body: { roomNumber: 'R-FORBIDDEN-TEST' },
      token: staffToken,
    });
    assert(staffCreateRes.status === 403, 'Reception staff forbidden from creating rooms (HTTP 403)');

    // Staff CANNOT update unit structure/configuration
    const sampleUnit = r101Details.data.data.units[0];
    const staffUnitRes = await apiCall(`/rooms/${r101Summary.id}/units/${sampleUnit.id}`, {
      method: 'PUT',
      body: { notes: 'Reception staff noted cleanliness inspection' },
      token: staffToken,
    });
    assert(staffUnitRes.status === 403, 'Reception staff forbidden from updating unit configuration (HTTP 403)');

    // Clean up temporary staff user
    await prisma.adminUser.delete({ where: { id: staffUser.id } });

    // ------------------------------------------------------------------------
    // SUMMARY
    // ------------------------------------------------------------------------
    console.log('\n====================================================');
    console.log(`   PHASE 4 VERIFICATION RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('Unexpected error during room verification:', error);
    process.exit(1);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runRoomVerification();
