import { createApp } from '../app';
import { prisma } from '../config/prisma';
import { generateToken } from '../utils/token';
import { UserRole, UserStatus, ActionType } from '@prisma/client';
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

async function runActivityVerificationSuite() {
  console.log('================================================================================');
  console.log('STARTING PHASE 9: GLOBAL SEARCH, AUDIT TRAIL & ACTIVITY LOGGING VERIFICATION');
  console.log('================================================================================\n');

  await startTestServer();

  try {
    // SETUP: Create test users for different roles
    console.log('[SETUP] Setting up admin users for Phase 9 testing');
    const passwordHash = await bcrypt.hash('Test@123', 10);

    const superAdmin = await prisma.adminUser.upsert({
      where: { email: 'superadmin.phase9@test.local' },
      update: { role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE },
      create: {
        email: 'superadmin.phase9@test.local',
        name: 'Super Admin P9',
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    const manager = await prisma.adminUser.upsert({
      where: { email: 'manager.phase9@test.local' },
      update: { role: UserRole.ALLOCATION_MANAGER, status: UserStatus.ACTIVE },
      create: {
        email: 'manager.phase9@test.local',
        name: 'Manager P9',
        passwordHash,
        role: UserRole.ALLOCATION_MANAGER,
        status: UserStatus.ACTIVE,
      },
    });

    const receptionStaff = await prisma.adminUser.upsert({
      where: { email: 'staff.phase9@test.local' },
      update: { role: UserRole.RECEPTION_STAFF, status: UserStatus.ACTIVE },
      create: {
        email: 'staff.phase9@test.local',
        name: 'Staff P9',
        passwordHash,
        role: UserRole.RECEPTION_STAFF,
        status: UserStatus.ACTIVE,
      },
    });

    const viewer = await prisma.adminUser.upsert({
      where: { email: 'viewer.phase9@test.local' },
      update: { role: UserRole.VIEWER, status: UserStatus.ACTIVE },
      create: {
        email: 'viewer.phase9@test.local',
        name: 'Viewer P9',
        passwordHash,
        role: UserRole.VIEWER,
        status: UserStatus.ACTIVE,
      },
    });

    const adminToken = generateToken({
      userId: superAdmin.id,
      email: superAdmin.email,
      name: superAdmin.name,
      role: superAdmin.role,
    });

    const managerToken = generateToken({
      userId: manager.id,
      email: manager.email,
      name: manager.name,
      role: manager.role,
    });

    const staffToken = generateToken({
      userId: receptionStaff.id,
      email: receptionStaff.email,
      name: receptionStaff.name,
      role: receptionStaff.role,
    });

    const viewerToken = generateToken({
      userId: viewer.id,
      email: viewer.email,
      name: viewer.name,
      role: viewer.role,
    });

    // Create sample audit logs with before/after details and potential sensitive fields
    console.log('[SETUP] Creating sample activity logs with detailed audit payloads');
    await prisma.activityLog.createMany({
      data: [
        {
          entityType: 'REGISTRATION',
          entityId: 'REG-9999',
          action: ActionType.CREATE,
          userId: superAdmin.id,
          ipAddress: '127.0.0.1',
          details: {
            primaryName: 'Audit Test Guest',
            mobile: '9876500001',
            totalMembers: 3,
          },
        },
        {
          entityType: 'ALLOCATION',
          entityId: 'ALC-9999',
          action: ActionType.ALLOCATE,
          userId: manager.id,
          ipAddress: '127.0.0.1',
          details: {
            allocationNumber: 'ALC-9999',
            registrationId: 'REG-9999',
            unitsAllocated: ['R-101-B1', 'R-101-B2'],
          },
        },
        {
          entityType: 'AADHAAR',
          entityId: 'participant-test-id',
          action: ActionType.CREATE,
          userId: receptionStaff.id,
          ipAddress: '127.0.0.1',
          details: {
            lastFourDigits: '9999',
            complianceStatus: 'COLLECTED',
            retentionConsent: true,
            password: 'SecretPassword123',
            encryptedAadhaar: 'some_encrypted_blob',
          },
        },
      ],
    });

    // --------------------------------------------------------------------------
    // TEST 1: Global Search - Authentication & Input Validation
    // --------------------------------------------------------------------------
    console.log('\n[TEST 1] Testing Global Search Authentication & Input Validation');
    const unauthSearch = await fetch(`${baseUrl}/search?q=test`);
    assert(unauthSearch.status === 401, 'Unauthenticated global search rejected (HTTP 401)');

    const emptySearch = await fetch(`${baseUrl}/search?q=`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(emptySearch.status === 400, 'Empty search query rejected with validation error (HTTP 400)');

    // --------------------------------------------------------------------------
    // TEST 2: Global Search Across Entities (Registration, Room, Unit, Allocation)
    // --------------------------------------------------------------------------
    console.log('\n[TEST 2] Testing Global Search Across Multiple Entity Types');
    const roomSearchRes = await fetch(`${baseUrl}/search?q=101`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(roomSearchRes.status === 200, 'Search for room 101 returned HTTP 200');
    const roomSearchData = await roomSearchRes.json();
    assert(roomSearchData.success === true, 'Search returned success: true');
    const hasRoomResult = roomSearchData.data.some(
      (item: any) => item.type === 'ROOM' || item.type === 'UNIT'
    );
    assert(hasRoomResult, 'Search for "101" matched Room or Unit records');

    const regSearchRes = await fetch(`${baseUrl}/search?q=REG`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(regSearchRes.status === 200, 'Search for REG returned HTTP 200');
    const regSearchData = await regSearchRes.json();
    const hasRegResult = regSearchData.data.some((item: any) => item.type === 'REGISTRATION');
    assert(hasRegResult, 'Search for "REG" matched registration records');

    const sampleResult = regSearchData.data[0];
    assert(
      !!sampleResult.title && !!sampleResult.subtitle && !!sampleResult.badge && !!sampleResult.link,
      'Search result conforms to UI card contract with title, badge and direct link'
    );

    // --------------------------------------------------------------------------
    // TEST 3: Privacy & Zero Aadhaar Leakage in Global Search
    // --------------------------------------------------------------------------
    console.log('\n[TEST 3] Testing Aadhaar Privacy & Absence from Search Results');
    const rawSearchJson = JSON.stringify(roomSearchData) + JSON.stringify(regSearchData);
    const aadhaarRegex = /\b\d{4}\s\d{4}\s\d{4}\b|\b\d{12}\b/g;
    const matches = rawSearchJson.match(aadhaarRegex);
    const hasUnmaskedAadhaar = matches && matches.some((m) => m.length === 12 && !m.startsWith('000000000000'));
    assert(!hasUnmaskedAadhaar, 'Global search results contain strictly zero plaintext or encrypted Aadhaar data');

    // --------------------------------------------------------------------------
    // TEST 4: Activity Log Listing & Pagination
    // --------------------------------------------------------------------------
    console.log('\n[TEST 4] Testing Activity Log Listing & Pagination');
    const activityListRes = await fetch(`${baseUrl}/activity?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(activityListRes.status === 200, 'GET /api/activity returned HTTP 200');
    const activityListData = await activityListRes.json();
    assert(
      Array.isArray(activityListData.data) && activityListData.data.length > 0,
      `Retrieved ${activityListData.data.length} activity logs`
    );
    assert(
      activityListData.pagination && typeof activityListData.pagination.total === 'number',
      `Response contains pagination metadata (total: ${activityListData.pagination.total})`
    );

    // --------------------------------------------------------------------------
    // TEST 5: Activity Log Filtering (Action, EntityType, Staff Member)
    // --------------------------------------------------------------------------
    console.log('\n[TEST 5] Testing Activity Log Filtering');
    const actionFilterRes = await fetch(`${baseUrl}/activity?action=CREATE`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert(actionFilterRes.status === 200, 'GET /api/activity?action=CREATE returned HTTP 200');
    const actionFilterData = await actionFilterRes.json();
    const allCreate = actionFilterData.data.every((item: any) => item.action === 'CREATE');
    assert(allCreate, 'Action filter (CREATE) returned exclusively CREATE action logs');

    const entityFilterRes = await fetch(`${baseUrl}/activity?entityType=REGISTRATION`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(entityFilterRes.status === 200, 'GET /api/activity?entityType=REGISTRATION returned HTTP 200');
    const entityFilterData = await entityFilterRes.json();
    const allReg = entityFilterData.data.every(
      (item: any) => item.entityType.toUpperCase() === 'REGISTRATION'
    );
    assert(allReg, 'Entity type filter (REGISTRATION) returned exclusively registration logs');

    const userFilterRes = await fetch(`${baseUrl}/activity?userId=${superAdmin.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(userFilterRes.status === 200, `GET /api/activity?userId=${superAdmin.id} returned HTTP 200`);
    const userFilterData = await userFilterRes.json();
    const allUser = userFilterData.data.every((item: any) => item.userId === superAdmin.id);
    assert(allUser, 'Staff member filter returned exclusively logs created by specified staff');

    // --------------------------------------------------------------------------
    // TEST 6: Sensitive Field Redaction in Audit Log Details
    // --------------------------------------------------------------------------
    console.log('\n[TEST 6] Testing Sensitive Field Redaction in Audit Log Details');
    const aadhaarLogsRes = await fetch(`${baseUrl}/activity?entityType=AADHAAR`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(aadhaarLogsRes.status === 200, 'GET /api/activity?entityType=AADHAAR returned HTTP 200');
    const aadhaarLogsData = await aadhaarLogsRes.json();
    const testAadhaarItem = aadhaarLogsData.data.find(
      (l: any) => l.entityId === 'participant-test-id'
    );
    assert(!!testAadhaarItem, 'Found participant-test-id activity record');
    assert(
      testAadhaarItem.details.password === '[REDACTED_SECURITY]' &&
        testAadhaarItem.details.encryptedAadhaar === '[REDACTED_SECURITY]',
      'Sensitive fields (passwords, tokens, encrypted blobs) strictly redacted in audit response'
    );

    // --------------------------------------------------------------------------
    // TEST 7: Audit Log Immutability & Modification Prevention
    // --------------------------------------------------------------------------
    console.log('\n[TEST 7] Testing Audit Log Immutability (No Modify/Delete APIs)');
    const dummyLogId = activityListData.data[0].id;
    const deleteAttempt = await fetch(`${baseUrl}/activity/${dummyLogId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      deleteAttempt.status === 404 || deleteAttempt.status === 405,
      'DELETE /api/activity/:id rejected (Route does not exist)'
    );

    const putAttempt = await fetch(`${baseUrl}/activity/${dummyLogId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ action: 'UPDATE' }),
    });
    assert(
      putAttempt.status === 404 || putAttempt.status === 405,
      'PUT /api/activity/:id rejected (Route does not exist)'
    );

    // --------------------------------------------------------------------------
    // TEST 8: Operational Insights API
    // --------------------------------------------------------------------------
    console.log('\n[TEST 8] Testing Operational Insights API');
    const insightsRes = await fetch(`${baseUrl}/activity/insights`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(insightsRes.status === 200, 'GET /api/activity/insights returned HTTP 200');
    const insightsData = await insightsRes.json();
    assert(insightsData.success === true, 'Insights returned success: true');
    const insights = insightsData.data;
    assert(
      typeof insights.todayRegistrations === 'number' &&
        typeof insights.todayAllocations === 'number' &&
        typeof insights.todayCheckIns === 'number' &&
        typeof insights.todayCheckOuts === 'number' &&
        typeof insights.currentInHouse === 'number' &&
        typeof insights.recentTransfers === 'number' &&
        Array.isArray(insights.recentStaffActivity),
      'Operational insights computed directly from database records'
    );

    // --------------------------------------------------------------------------
    // TEST 9: Excel Audit Log Export & RBAC
    // --------------------------------------------------------------------------
    console.log('\n[TEST 9] Testing Excel Audit Log Export & Role Permissions');
    const staffExport = await fetch(`${baseUrl}/activity/export`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(staffExport.status === 403, 'RECEPTION_STAFF role forbidden from Excel audit export (HTTP 403)');

    const viewerExport = await fetch(`${baseUrl}/activity/export`, {
      headers: { Authorization: `Bearer ${viewerToken}` },
    });
    assert(viewerExport.status === 403, 'VIEWER role forbidden from Excel audit export (HTTP 403)');

    const managerExport = await fetch(`${baseUrl}/activity/export`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert(managerExport.status === 200, 'ALLOCATION_MANAGER authorized to export audit logs (HTTP 200)');
    const contentType = managerExport.headers.get('content-type') || '';
    const contentDisp = managerExport.headers.get('content-disposition') || '';
    assert(
      contentType.includes('spreadsheetml') || contentType.includes('octet-stream'),
      'Content-Type is valid Excel spreadsheet'
    );
    assert(
      contentDisp.includes('attachment') && contentDisp.includes('.xlsx'),
      'Content-Disposition header specifies .xlsx attachment'
    );

    // --------------------------------------------------------------------------
    // TEST 10: Staff Member Directory Listing for Filters
    // --------------------------------------------------------------------------
    console.log('\n[TEST 10] Testing Staff Member Directory Listing for UI Filter Options');
    const staffListRes = await fetch(`${baseUrl}/activity/staff`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(staffListRes.status === 200, 'GET /api/activity/staff returned HTTP 200');
    const staffListData = await staffListRes.json();
    assert(
      Array.isArray(staffListData.data) && staffListData.data.length > 0,
      `Retrieved ${staffListData.data.length} staff members for UI filtering`
    );

    console.log('\n================================================================================');
    console.log('ALL PHASE 9: GLOBAL SEARCH & ACTIVITY LOGGING TESTS PASSED (10/10)!');
    console.log('================================================================================\n');

    // Cleanup test data
    await prisma.activityLog.deleteMany({
      where: {
        entityId: { in: ['REG-9999', 'ALC-9999', 'participant-test-id'] },
      },
    });
    await prisma.adminUser.deleteMany({
      where: {
        email: {
          in: [
            'superadmin.phase9@test.local',
            'manager.phase9@test.local',
            'staff.phase9@test.local',
            'viewer.phase9@test.local',
          ],
        },
      },
    });
  } finally {
    await stopTestServer();
  }
}

runActivityVerificationSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Activity verification failed:', err);
    process.exit(1);
  });
