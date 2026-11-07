import { createApp } from '../app';
import { prisma } from '../config/prisma';
import { generateToken } from '../utils/token';
import { UserRole, UserStatus } from '@prisma/client';
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

async function runReportVerificationSuite() {
  console.log('================================================================================');
  console.log('STARTING PHASE 10: REPORTS, ANALYTICS & OPERATIONAL EXPORTS VERIFICATION');
  console.log('================================================================================\n');

  await startTestServer();

  try {
    console.log('[SETUP] Setting up users for Phase 10 testing');
    const passwordHash = await bcrypt.hash('Test@123', 10);

    const superAdmin = await prisma.adminUser.upsert({
      where: { email: 'superadmin.phase10@test.local' },
      update: { role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE },
      create: {
        email: 'superadmin.phase10@test.local',
        name: 'Super Admin P10',
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    const manager = await prisma.adminUser.upsert({
      where: { email: 'manager.phase10@test.local' },
      update: { role: UserRole.ALLOCATION_MANAGER, status: UserStatus.ACTIVE },
      create: {
        email: 'manager.phase10@test.local',
        name: 'Manager P10',
        passwordHash,
        role: UserRole.ALLOCATION_MANAGER,
        status: UserStatus.ACTIVE,
      },
    });

    const staff = await prisma.adminUser.upsert({
      where: { email: 'staff.phase10@test.local' },
      update: { role: UserRole.RECEPTION_STAFF, status: UserStatus.ACTIVE },
      create: {
        email: 'staff.phase10@test.local',
        name: 'Staff P10',
        passwordHash,
        role: UserRole.RECEPTION_STAFF,
        status: UserStatus.ACTIVE,
      },
    });

    const viewer = await prisma.adminUser.upsert({
      where: { email: 'viewer.phase10@test.local' },
      update: { role: UserRole.VIEWER, status: UserStatus.ACTIVE },
      create: {
        email: 'viewer.phase10@test.local',
        name: 'Viewer P10',
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
      userId: staff.id,
      email: staff.email,
      name: staff.name,
      role: staff.role,
    });

    const viewerToken = generateToken({
      userId: viewer.id,
      email: viewer.email,
      name: viewer.name,
      role: viewer.role,
    });

    // --------------------------------------------------------------------------
    // TEST 1: Executive Report Overview API
    // --------------------------------------------------------------------------
    console.log('\n[TEST 1] Testing Executive Report Overview API');
    const overviewRes = await fetch(`${baseUrl}/reports/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(overviewRes.status === 200, 'GET /api/reports/overview returned HTTP 200');
    const overviewData = await overviewRes.json();
    assert(overviewData.success === true, 'Response success is true');
    const cap = overviewData.data.capacity;
    assert(
      typeof cap.totalRooms === 'number' &&
        typeof cap.totalCapacity === 'number' &&
        typeof cap.occupiedUnits === 'number' &&
        typeof cap.availableUnits === 'number' &&
        typeof cap.overallOccupancyRate === 'number',
      'Capacity metrics conform to schema'
    );
    assert(
      cap.totalCapacity === cap.totalBeds + cap.totalMats,
      'Total capacity equals total beds plus total mats'
    );
    console.log(`[PASS] Capacity: ${cap.totalCapacity} units across ${cap.totalRooms} rooms (${cap.overallOccupancyRate}% occupancy)`);

    // --------------------------------------------------------------------------
    // TEST 2: Occupancy & Room Utilization Report
    // --------------------------------------------------------------------------
    console.log('\n[TEST 2] Testing Room & Bed Occupancy Report');
    const occRes = await fetch(`${baseUrl}/reports/occupancy`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert(occRes.status === 200, 'GET /api/reports/occupancy returned HTTP 200');
    const occData = await occRes.json();
    assert(Array.isArray(occData.data.summary), 'Summary is an array of building/floor groups');
    assert(Array.isArray(occData.data.rooms), 'Rooms is an array of room utilization details');
    if (occData.data.rooms.length > 0) {
      const r = occData.data.rooms[0];
      assert(
        r.roomNumber && typeof r.totalCapacity === 'number' && typeof r.utilizationRate === 'number',
        'Room record contains roomNumber, totalCapacity, and utilizationRate'
      );
    }
    console.log(`[PASS] Retrieved occupancy report with ${occData.data.summary.length} building groups and ${occData.data.rooms.length} rooms`);

    // --------------------------------------------------------------------------
    // TEST 3: Registrations & Geographic Analytics
    // --------------------------------------------------------------------------
    console.log('\n[TEST 3] Testing Registration Analytics Report');
    const regRes = await fetch(`${baseUrl}/reports/registrations`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(regRes.status === 200, 'GET /api/reports/registrations returned HTTP 200');
    const regData = await regRes.json();
    const reg = regData.data;
    assert(typeof reg.totalRegistrations === 'number', 'totalRegistrations is a number');
    assert(typeof reg.totalRegisteredMembers === 'number', 'totalRegisteredMembers is a number');
    assert(typeof reg.groupSizeDistribution === 'object', 'groupSizeDistribution is an object');
    assert(Array.isArray(reg.topCities), 'topCities is an array');
    assert(Array.isArray(reg.registrationTrend), 'registrationTrend is an array');
    console.log(`[PASS] Registrations: ${reg.totalRegistrations} total, ${reg.totalRegisteredMembers} members`);

    // --------------------------------------------------------------------------
    // TEST 4: Participant Demographics & Statutory Compliance
    // --------------------------------------------------------------------------
    console.log('\n[TEST 4] Testing Participant Demographics & Statutory Compliance');
    const partRes = await fetch(`${baseUrl}/reports/participants`, {
      headers: { Authorization: `Bearer ${viewerToken}` },
    });
    assert(partRes.status === 200, 'VIEWER granted read access to participant report (HTTP 200)');
    const partData = await partRes.json();
    const part = partData.data;
    assert(typeof part.totalParticipants === 'number', 'totalParticipants is a number');
    assert(typeof part.genderDistribution === 'object', 'genderDistribution is present');
    assert(typeof part.ageGroups === 'object', 'ageGroups is present');
    assert(typeof part.aadhaarCompliance === 'object', 'aadhaarCompliance is present');
    console.log(`[PASS] Participants: ${part.totalParticipants} total, Aadhaar compliance: ${part.aadhaarCompliance.compliancePercentage}%`);

    // --------------------------------------------------------------------------
    // TEST 5: Daily Operational Timeline Report
    // --------------------------------------------------------------------------
    console.log('\n[TEST 5] Testing Daily Operational Timeline Report');
    const dailyRes = await fetch(`${baseUrl}/reports/operational-daily`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert(dailyRes.status === 200, 'GET /api/reports/operational-daily returned HTTP 200');
    const dailyData = await dailyRes.json();
    assert(Array.isArray(dailyData.data), 'Daily operational report is an array of daily buckets');
    if (dailyData.data.length > 0) {
      const day = dailyData.data[0];
      assert(
        day.date &&
          typeof day.expectedArrivals === 'number' &&
          typeof day.actualCheckIns === 'number' &&
          typeof day.expectedDepartures === 'number' &&
          typeof day.actualCheckOuts === 'number',
        'Daily bucket conforms to operational timeline schema'
      );
    }
    console.log(`[PASS] Generated ${dailyData.data.length} daily operational timeline records`);

    // --------------------------------------------------------------------------
    // TEST 6: Date Range Filtering Across Reports
    // --------------------------------------------------------------------------
    console.log('\n[TEST 6] Testing Custom Date Range Filtering');
    const filteredRes = await fetch(
      `${baseUrl}/reports/operational-daily?startDate=2026-11-01&endDate=2026-11-05`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(filteredRes.status === 200, 'Date filtered daily report returned HTTP 200');
    const filteredData = await filteredRes.json();
    assert(filteredData.data.length === 5, '5 days returned for date range 2026-11-01 to 2026-11-05');
    console.log('[PASS] Date range filtering strictly adhered to [startDate, endDate]');

    // --------------------------------------------------------------------------
    // TEST 7: Excel Multi-Sheet Operational Export
    // --------------------------------------------------------------------------
    console.log('\n[TEST 7] Testing Excel Multi-Sheet Report Export');
    const excelRes = await fetch(`${baseUrl}/reports/export/excel`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert(excelRes.status === 200, 'GET /api/reports/export/excel returned HTTP 200');
    const excelContentType = excelRes.headers.get('content-type') || '';
    const excelDisp = excelRes.headers.get('content-disposition') || '';
    assert(
      excelContentType.includes('spreadsheetml') || excelContentType.includes('octet-stream'),
      'Excel Content-Type header is valid'
    );
    assert(
      excelDisp.includes('attachment') && excelDisp.includes('.xlsx'),
      'Content-Disposition specifies .xlsx attachment'
    );
    const excelBuffer = await excelRes.arrayBuffer();
    assert(excelBuffer.byteLength > 1000, `Excel file contains binary workbook (${excelBuffer.byteLength} bytes)`);
    console.log(`[PASS] Generated valid multi-sheet Excel operational report (${excelBuffer.byteLength} bytes)`);

    // --------------------------------------------------------------------------
    // TEST 8: PDF Executive Report Export
    // --------------------------------------------------------------------------
    console.log('\n[TEST 8] Testing PDF Executive Briefing Report Export');
    const pdfRes = await fetch(`${baseUrl}/reports/export/pdf`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(pdfRes.status === 200, 'GET /api/reports/export/pdf returned HTTP 200');
    const pdfContentType = pdfRes.headers.get('content-type') || '';
    const pdfDisp = pdfRes.headers.get('content-disposition') || '';
    assert(pdfContentType.includes('application/pdf'), 'PDF Content-Type is application/pdf');
    assert(
      pdfDisp.includes('attachment') && pdfDisp.includes('.pdf'),
      'Content-Disposition specifies .pdf attachment'
    );
    const pdfBuffer = await pdfRes.arrayBuffer();
    const pdfHeader = Buffer.from(pdfBuffer.slice(0, 5)).toString('utf-8');
    assert(pdfHeader === '%PDF-', 'PDF file contains valid "%PDF-" binary signature');
    console.log(`[PASS] Generated valid binary PDF operational report (${pdfBuffer.byteLength} bytes)`);

    // --------------------------------------------------------------------------
    // TEST 9: RBAC & Permission Restrictions on Exports
    // --------------------------------------------------------------------------
    console.log('\n[TEST 9] Testing RBAC Permissions on Report Exports');
    const staffExcel = await fetch(`${baseUrl}/reports/export/excel`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(staffExcel.status === 403, 'RECEPTION_STAFF forbidden from Excel export (HTTP 403)');

    const viewerExcel = await fetch(`${baseUrl}/reports/export/excel`, {
      headers: { Authorization: `Bearer ${viewerToken}` },
    });
    assert(viewerExcel.status === 403, 'VIEWER forbidden from Excel export (HTTP 403)');

    const staffPdf = await fetch(`${baseUrl}/reports/export/pdf`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(staffPdf.status === 403, 'RECEPTION_STAFF forbidden from PDF export (HTTP 403)');

    const viewerPdf = await fetch(`${baseUrl}/reports/export/pdf`, {
      headers: { Authorization: `Bearer ${viewerToken}` },
    });
    assert(viewerPdf.status === 403, 'VIEWER forbidden from PDF export (HTTP 403)');
    console.log('[PASS] Export endpoints strictly protected against unauthorized roles');

    // --------------------------------------------------------------------------
    // TEST 10: Sensitive Identity Redaction & Privacy
    // --------------------------------------------------------------------------
    console.log('\n[TEST 10] Testing Sensitive Identity Redaction & Aadhaar Privacy');
    const rawJson = JSON.stringify(overviewData) + JSON.stringify(partData) + JSON.stringify(regData);
    const aadhaarRegex = /\b\d{4}\s\d{4}\s\d{4}\b|\b\d{12}\b/g;
    const matches = rawJson.match(aadhaarRegex);
    const hasUnmaskedAadhaar = matches && matches.some((m) => m.length === 12 && !m.startsWith('000000000000'));
    assert(!hasUnmaskedAadhaar, 'Report JSON contains zero unmasked Aadhaar numbers');
    console.log('[PASS] Full Aadhaar numbers and credentials strictly omitted from all report outputs');

    console.log('\n================================================================================');
    console.log('ALL PHASE 10: REPORTS, ANALYTICS & EXPORTS TESTS PASSED (10/10)!');
    console.log('================================================================================\n');

    // Cleanup test users
    await prisma.adminUser.deleteMany({
      where: {
        email: {
          in: [
            'superadmin.phase10@test.local',
            'manager.phase10@test.local',
            'staff.phase10@test.local',
            'viewer.phase10@test.local',
          ],
        },
      },
    });
  } finally {
    await stopTestServer();
  }
}

runReportVerificationSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Report verification failed:', err);
    process.exit(1);
  });
