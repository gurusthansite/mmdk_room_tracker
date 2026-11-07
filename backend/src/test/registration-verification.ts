import { createApp } from '../app';
import { prisma } from '../config/prisma';
import { generateToken } from '../utils/token';
import { UserRole, RegistrationStatus, Gender } from '@prisma/client';
import http from 'http';
import * as XLSX from 'xlsx';

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
    rawBuffer?: boolean;
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

  if (options.rawBuffer) {
    const arrayBuffer = await res.arrayBuffer();
    return {
      status: res.status,
      headers: res.headers,
      buffer: Buffer.from(arrayBuffer),
    };
  }

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

async function runTests() {
  console.log('====================================================');
  console.log('    PHASE 5: REGISTRATION MANAGEMENT VERIFICATION   ');
  console.log('====================================================\n');

  await startTestServer();

  // Obtain or create admin user tokens for RBAC testing
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
    where: { email: 'manager.reg@accommodation.local' },
    update: {},
    create: {
      email: 'manager.reg@accommodation.local',
      passwordHash: 'dummyhash',
      name: 'Allocation Manager',
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
    where: { email: 'staff.reg@accommodation.local' },
    update: {},
    create: {
      email: 'staff.reg@accommodation.local',
      passwordHash: 'dummyhash',
      name: 'Reception Staff',
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
    where: { email: 'viewer.reg@accommodation.local' },
    update: {},
    create: {
      email: 'viewer.reg@accommodation.local',
      passwordHash: 'dummyhash',
      name: 'Viewer',
      role: UserRole.VIEWER,
    },
  });
  const viewerToken = generateToken({
    userId: viewerUser.id,
    email: viewerUser.email,
    role: viewerUser.role,
    name: viewerUser.name,
  });

  const createdRegIds: string[] = [];

  try {
    // ------------------------------------------------------------------------
    // Subsystem 1: Registration Creation & Sequential ID
    // ------------------------------------------------------------------------
    console.log('--- Subsystem 1: Registration Creation & Sequential ID ---');

    const createRes = await makeRequest('/registrations', {
      method: 'POST',
      token: adminToken,
      body: {
        primaryName: 'Suresh Menon',
        mobile: '9871112233',
        email: 'suresh.menon@example.com',
        city: 'Kochi',
        state: 'Kerala',
        totalMembers: 3,
        notes: 'Arriving by car late evening',
        accompanyingMembers: [
          { fullName: 'Radha Menon', gender: Gender.FEMALE, age: 48, relationToPrimary: 'Spouse' },
        ],
      },
    });

    assert(createRes.status === 201, `Create registration returned HTTP 201 (got ${createRes.status})`);
    assert(createRes.data.success === true, 'Response marked success');
    const regData = createRes.data.data;
    assert(/^REG-\d{4}$/.test(regData.registrationId), `Generated formatted Registration ID: ${regData.registrationId}`);
    assert(regData.primaryName === 'Suresh Menon', 'Stored primary registrant name correctly');
    assert(regData.totalMembers === 3, 'Stored total registered members correctly (3)');
    createdRegIds.push(regData.id);

    // Verify Primary Participant auto-created with relation Self
    const participants = await prisma.participant.findMany({
      where: { registrationId: regData.id },
      orderBy: { isPrimary: 'desc' },
    });
    assert(participants.length === 2, `Created 2 participant records: primary + 1 accompanying (expected 2, got ${participants.length})`);
    assert(participants[0].isPrimary === true && participants[0].fullName === 'Suresh Menon', 'Primary participant created with isPrimary: true');
    assert(participants[1].isPrimary === false && participants[1].fullName === 'Radha Menon', 'Accompanying participant created with relation Spouse');

    // ------------------------------------------------------------------------
    // Subsystem 2: Concurrency-Safe ID Generation
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 2: Concurrency-Safe ID Generation ---');
    console.log('Launching 10 concurrent parallel registration requests...');

    const concurrentRequests = Array.from({ length: 10 }).map((_, idx) => {
      const phone = `98200000${String(idx).padStart(2, '0')}`;
      return makeRequest('/registrations', {
        method: 'POST',
        token: managerToken,
        body: {
          primaryName: `Concurrent Test User ${idx + 1}`,
          mobile: phone,
          totalMembers: 1,
          notes: `Concurrency test index ${idx}`,
        },
      });
    });

    const concurrentResults = await Promise.all(concurrentRequests);
    assert(concurrentResults.every((r) => r.status === 201), 'All 10 concurrent requests succeeded with HTTP 201');

    const generatedIds = concurrentResults.map((r) => {
      createdRegIds.push(r.data.data.id);
      return r.data.data.registrationId;
    });

    const uniqueIds = new Set(generatedIds);
    assert(uniqueIds.size === 10, `All 10 generated Registration IDs are strictly unique (No collisions!): ${Array.from(uniqueIds).join(', ')}`);

    // ------------------------------------------------------------------------
    // Subsystem 3: Multi-Member Support & Partial Arrival Compatibility
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 3: Multi-Member Support & Partial Arrival Compatibility ---');

    const partialGroupRes = await makeRequest('/registrations', {
      method: 'POST',
      token: adminToken,
      body: {
        primaryName: 'Amit Patel',
        mobile: '9845556677',
        city: 'Ahmedabad',
        totalMembers: 5, // 5 registered members
        notes: 'Family retreat group',
        // Zero accompanying details provided in advance (supported)
      },
    });

    assert(partialGroupRes.status === 201, 'Group registration with 5 members created without requiring pre-arrival names');
    const groupReg = partialGroupRes.data.data;
    createdRegIds.push(groupReg.id);

    const groupParticipants = await prisma.participant.findMany({
      where: { registrationId: groupReg.id },
    });
    assert(groupParticipants.length === 1, `Only primary registrant participant exists prior to arrival (got ${groupParticipants.length}, totalMembers: ${groupReg.totalMembers})`);
    assert(groupReg.totalMembers === 5, 'Total members count recorded as 5, ready for partial arrival at reception');

    // ------------------------------------------------------------------------
    // Subsystem 4: Validation & Invalid Input Handling
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 4: Validation & Invalid Input Handling ---');

    // 1. Invalid phone number (less than 10 digits)
    const invalidPhoneRes = await makeRequest('/registrations', {
      method: 'POST',
      token: adminToken,
      body: {
        primaryName: 'Invalid Phone User',
        mobile: '12345',
        totalMembers: 1,
      },
    });
    assert(invalidPhoneRes.status === 400, `Rejected invalid phone number with HTTP 400 (got ${invalidPhoneRes.status})`);

    // 2. Empty primary name
    const emptyNameRes = await makeRequest('/registrations', {
      method: 'POST',
      token: adminToken,
      body: {
        primaryName: ' ',
        mobile: '9876543210',
        totalMembers: 1,
      },
    });
    assert(emptyNameRes.status === 400, `Rejected empty primary name with HTTP 400 (got ${emptyNameRes.status})`);

    // 3. Invalid totalMembers <= 0
    const invalidMembersRes = await makeRequest('/registrations', {
      method: 'POST',
      token: adminToken,
      body: {
        primaryName: 'Test Negative Members',
        mobile: '9876543210',
        totalMembers: 0,
      },
    });
    assert(invalidMembersRes.status === 400, `Rejected totalMembers < 1 with HTTP 400 (got ${invalidMembersRes.status})`);

    // ------------------------------------------------------------------------
    // Subsystem 5: Search, Filter, and Pagination
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 5: Search, Filter, and Pagination ---');

    // Search by Registration ID
    const searchByIdRes = await makeRequest(`/registrations?q=${regData.registrationId}`, {
      token: staffToken,
    });
    assert(searchByIdRes.status === 200, 'Search by Registration ID returned HTTP 200');
    assert(searchByIdRes.data.data.length === 1 && searchByIdRes.data.data[0].registrationId === regData.registrationId, 'Search by Registration ID returned exact record');

    // Search by primary name
    const searchByNameRes = await makeRequest('/registrations?q=Menon', {
      token: staffToken,
    });
    assert(searchByNameRes.status === 200, 'Search by name returned HTTP 200');
    assert(searchByNameRes.data.data.some((r: any) => r.primaryName.includes('Menon')), 'Found registrant matching "Menon"');

    // Filter by status
    const filterStatusRes = await makeRequest('/registrations?status=REGISTERED', {
      token: staffToken,
    });
    assert(filterStatusRes.status === 200, 'Filter by status returned HTTP 200');
    assert(filterStatusRes.data.data.every((r: any) => r.status === 'REGISTERED'), 'All filtered records match status REGISTERED');

    // Pagination
    const pageRes = await makeRequest('/registrations?page=1&limit=3', {
      token: staffToken,
    });
    assert(pageRes.status === 200, 'Pagination query returned HTTP 200');
    assert(pageRes.data.data.length <= 3, `Returned page size <= 3 (got ${pageRes.data.data.length})`);
    assert(pageRes.data.pagination.limit === 3, 'Pagination limit is 3');
    assert(pageRes.data.pagination.totalPages >= 2, `Total pages correctly calculated (got ${pageRes.data.pagination.totalPages})`);

    // ------------------------------------------------------------------------
    // Subsystem 6: Details Endpoint & Aadhaar Privacy Safeguard
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 6: Details Endpoint & Aadhaar Privacy Safeguard ---');

    const detailRes = await makeRequest(`/registrations/${regData.registrationId}`, {
      token: staffToken,
    });
    assert(detailRes.status === 200, 'Single registration detail returned HTTP 200');
    const detailData = detailRes.data.data;
    assert(detailData.registrationId === regData.registrationId, 'Detail matches registration ID');
    assert(Array.isArray(detailData.participants), 'Includes participants array');
    assert(Array.isArray(detailData.allocationSummary), 'Includes allocation summary');
    assert(Array.isArray(detailData.staySummary), 'Includes stay summary');

    // Privacy safeguard: Ensure zero raw Aadhaar fields exist
    const jsonStr = JSON.stringify(detailData);
    assert(!jsonStr.includes('encryptedAadhaar'), 'Security: encryptedAadhaar strictly excluded from registration API');
    assert(!jsonStr.includes('aadhaarIv'), 'Security: aadhaarIv strictly excluded from registration API');

    // ------------------------------------------------------------------------
    // Subsystem 7: Edit & Historical Archival (Soft Delete)
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 7: Edit & Historical Archival (Soft Delete) ---');

    // Update registration details
    const updateRes = await makeRequest(`/registrations/${regData.id}`, {
      method: 'PUT',
      token: managerToken,
      body: {
        city: 'Ernakulam',
        totalMembers: 4,
        notes: 'Updated arrival schedule: flight delayed',
      },
    });
    assert(updateRes.status === 200, 'Update registration returned HTTP 200');
    assert(updateRes.data.data.city === 'Ernakulam', 'City updated to Ernakulam');
    assert(updateRes.data.data.totalMembers === 4, 'Total members updated to 4');

    // Soft delete / Archive
    const archiveRes = await makeRequest(`/registrations/${regData.id}`, {
      method: 'DELETE',
      token: adminToken,
    });
    assert(archiveRes.status === 200, 'Archive registration returned HTTP 200');
    assert(archiveRes.data.data.isArchived === true, 'Registration marked isArchived: true');

    // Verify row NOT deleted from PostgreSQL
    const checkArchivedInDb = await prisma.registration.findUnique({
      where: { id: regData.id },
    });
    assert(checkArchivedInDb !== null && checkArchivedInDb.isArchived === true, 'Soft deletion safeguard verified: Row exists in PostgreSQL with isArchived: true');
    assert(checkArchivedInDb?.deletedAt !== null, 'Soft deletion timestamp recorded');

    // Verify excluded from default active listing
    const activeList = await makeRequest(`/registrations?q=${regData.registrationId}`, {
      token: staffToken,
    });
    assert(activeList.data.data.length === 0, 'Archived registration excluded from default listing');

    // Restore registration
    const restoreRes = await makeRequest(`/registrations/restore/${regData.id}`, {
      method: 'POST',
      token: adminToken,
    });
    assert(restoreRes.status === 200, 'Restore registration returned HTTP 200');
    assert(restoreRes.data.data.isArchived === false, 'Registration restored with isArchived: false');

    // ------------------------------------------------------------------------
    // Subsystem 8: Excel Import Preview & Execution
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 8: Excel Import Preview & Execution ---');

    // Build test rows with valid, duplicate, and invalid entries
    const testImportRows = [
      {
        'Primary Name*': 'Naveen Reddy',
        'Mobile Number*': '9944556677',
        'Email': 'naveen.reddy@example.com',
        'City': 'Hyderabad',
        'State': 'Telangana',
        'Total Members*': 3,
        'Registration Date': '2026-11-12',
        'Special Notes': 'Ground floor room requested',
        'Accompanying Member Names (Comma-separated)': 'Swathi Reddy, Rohan Reddy',
      },
      {
        'Primary Name*': 'Kavita Joshi',
        'Mobile Number*': '9988776655',
        'Email': 'kavita.j@example.com',
        'City': 'Pune',
        'State': 'Maharashtra',
        'Total Members*': 2,
        'Special Notes': 'Near temple',
      },
      {
        // Invalid row (invalid mobile)
        'Primary Name*': 'Bad Phone Person',
        'Mobile Number*': '1234',
        'Total Members*': 1,
      },
      {
        // Duplicate row with Naveen's number within batch
        'Primary Name*': 'Duplicate Batch Person',
        'Mobile Number*': '9944556677',
        'Total Members*': 1,
      },
    ];

    // Preview
    const previewRes = await makeRequest('/registrations/import/preview', {
      method: 'POST',
      token: managerToken,
      body: { rows: testImportRows },
    });

    assert(previewRes.status === 200, 'Excel import preview returned HTTP 200');
    const previewData = previewRes.data.data;
    assert(previewData.totalRows === 4, 'Preview received 4 rows');
    assert(previewData.validRows === 2, `Preview identified exactly 2 valid rows (got ${previewData.validRows})`);
    assert(previewData.invalidRows === 2, `Preview identified exactly 2 invalid/duplicate rows (got ${previewData.invalidRows})`);
    assert(previewData.canImport === true, 'canImport is true');

    // Execute Import with valid rows
    const validRowsForImport = previewData.rows
      .filter((r: any) => r.isValid)
      .map((r: any) => r.data);

    const executeImportRes = await makeRequest('/registrations/import', {
      method: 'POST',
      token: managerToken,
      body: { rows: validRowsForImport },
    });

    assert(executeImportRes.status === 201, 'Execute import returned HTTP 201');
    assert(executeImportRes.data.data.importedCount === 2, 'Imported 2 registrations');
    executeImportRes.data.data.registrations.forEach((r: any) => createdRegIds.push(r.id));

    // Duplicate detection on repeated import preview
    const repeatedPreviewRes = await makeRequest('/registrations/import/preview', {
      method: 'POST',
      token: managerToken,
      body: {
        rows: [
          {
            'Primary Name*': 'Naveen Reddy Repeat',
            'Mobile Number*': '9944556677', // Already in DB now!
            'Total Members*': 1,
          },
        ],
      },
    });
    assert(repeatedPreviewRes.status === 200, 'Repeated preview returned HTTP 200');
    assert(repeatedPreviewRes.data.data.duplicateRows >= 1, 'Repeated import correctly identified existing phone duplicate in database');

    // ------------------------------------------------------------------------
    // Subsystem 9: Excel Export & Template Download
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 9: Excel Export & Template Download ---');

    // Download template
    const templateRes = await makeRequest('/registrations/template', {
      token: staffToken,
      rawBuffer: true,
    });
    assert(templateRes.status === 200, 'Template download returned HTTP 200');
    assert(
      Boolean(templateRes.headers.get('content-type')?.includes('spreadsheetml')),
      'Content-Type is valid Excel spreadsheet'
    );
    const templateWorkbook = XLSX.read(templateRes.buffer, { type: 'buffer' });
    assert(templateWorkbook.SheetNames.includes('Registrations_Template'), 'Template workbook contains Registrations_Template sheet');

    // Export registrations
    const exportRes = await makeRequest('/registrations/export', {
      token: staffToken,
      rawBuffer: true,
    });
    assert(exportRes.status === 200, 'Export registrations returned HTTP 200');
    assert(
      Boolean(exportRes.headers.get('content-type')?.includes('spreadsheetml')),
      'Export Content-Type is valid Excel spreadsheet'
    );
    const exportWorkbook = XLSX.read(exportRes.buffer, { type: 'buffer' });
    const exportSheet = exportWorkbook.Sheets['Registrations'];
    const exportRows: any[] = XLSX.utils.sheet_to_json(exportSheet);
    assert(exportRows.length >= 5, `Export sheet contains at least 5 registration rows (got ${exportRows.length})`);
    assert('Registration ID' in exportRows[0], 'Export contains "Registration ID" column');
    assert('Primary Registrant' in exportRows[0], 'Export contains "Primary Registrant" column');
    assert(!('Aadhaar' in exportRows[0]), 'Export strictly excludes Aadhaar column');

    // ------------------------------------------------------------------------
    // Subsystem 10: Role-Based Authorization (RBAC)
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 10: Role-Based Authorization (RBAC) ---');

    // Reception staff can view registrations
    const staffListRes = await makeRequest('/registrations', { token: staffToken });
    assert(staffListRes.status === 200, 'Reception staff permitted to view registrations (HTTP 200)');

    // Viewer forbidden from creating registrations
    const viewerCreateRes = await makeRequest('/registrations', {
      method: 'POST',
      token: viewerToken,
      body: {
        primaryName: 'Unauthorized Create',
        mobile: '9899999999',
        totalMembers: 1,
      },
    });
    assert(viewerCreateRes.status === 403, 'Viewer forbidden from creating registrations (HTTP 403)');

    // Reception staff forbidden from executing imports
    const staffImportRes = await makeRequest('/registrations/import', {
      method: 'POST',
      token: staffToken,
      body: { rows: [] },
    });
    assert(staffImportRes.status === 403, 'Reception staff forbidden from batch import (HTTP 403)');

    // Viewer can view details (HTTP 200)
    const viewerDetailRes = await makeRequest(`/registrations/${regData.registrationId}`, {
      token: viewerToken,
    });
    assert(viewerDetailRes.status === 200, 'Viewer role permitted to view registration details (HTTP 200)');

    // Viewer forbidden from editing (HTTP 403)
    const viewerUpdateRes = await makeRequest(`/registrations/${regData.id}`, {
      method: 'PUT',
      token: viewerToken,
      body: { city: 'Blocked' },
    });
    assert(viewerUpdateRes.status === 403, 'Viewer forbidden from updating registration (HTTP 403)');

    console.log('\n====================================================');
    console.log('   PHASE 5 VERIFICATION RESULTS: ALL TESTS PASSED   ');
    console.log('====================================================\n');
  } finally {
    // Cleanup created test registrations to keep database clean
    if (createdRegIds.length > 0) {
      await prisma.participant.deleteMany({
        where: { registrationId: { in: createdRegIds } },
      });
      await prisma.activityLog.deleteMany({
        where: { entityId: { in: createdRegIds } },
      });
      await prisma.registration.deleteMany({
        where: { id: { in: createdRegIds } },
      });
    }

    // Cleanup helper admin users
    await prisma.adminUser.deleteMany({
      where: {
        email: { in: ['manager.reg@accommodation.local', 'staff.reg@accommodation.local', 'viewer.reg@accommodation.local'] },
      },
    });

    await stopTestServer();
  }
}

runTests().catch((err) => {
  console.error('\nVerification suite failed:', err);
  process.exit(1);
});
