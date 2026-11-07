import { createApp } from '../app';
import { prisma } from '../config/prisma';
import { generateToken } from '../utils/token';
import {
  formatPhoneNumberForWhatsApp,
  formatReadableDateTime,
  generateAllocationMessage,
  buildWhatsAppClickToChatUrl,
} from '../utils/whatsappTemplate';
import {
  UserRole,
  AllocationStatus,
  MessageStatus,
  MessageType,
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

async function runWhatsAppVerificationSuite() {
  console.log('================================================================================');
  console.log('STARTING PHASE 7: WHATSAPP CLICK-TO-CHAT INTEGRATION VERIFICATION SUITE');
  console.log('================================================================================\n');

  await startTestServer();

  try {
    // --------------------------------------------------------------------------
    // TEST 1: Phone number formatting & validation
    // --------------------------------------------------------------------------
    console.log('[TEST 1] Testing Phone Number Formatting for WhatsApp wa.me');
    assert(formatPhoneNumberForWhatsApp('9876543210') === '919876543210', '10-digit number prepends 91');
    assert(formatPhoneNumberForWhatsApp('09876543210') === '919876543210', 'Leading 0 stripped and 91 prepended');
    assert(formatPhoneNumberForWhatsApp('+91 98765 43210') === '919876543210', 'Formatted +91 with spaces stripped');
    assert(formatPhoneNumberForWhatsApp('919876543210') === '919876543210', 'Existing 12-digit with 91 preserved');
    assert(formatPhoneNumberForWhatsApp('9876-543-210') === '919876543210', 'Dashes stripped and 91 prepended');

    let invalidPhoneCaught = false;
    try {
      formatPhoneNumberForWhatsApp('12345');
    } catch {
      invalidPhoneCaught = true;
    }
    assert(invalidPhoneCaught, 'Invalid short phone number rejected with error');

    // --------------------------------------------------------------------------
    // TEST 2: URL Encoding and click-to-chat construction
    // --------------------------------------------------------------------------
    console.log('\n[TEST 2] Testing URL Encoding and Click-to-Chat Deep Link Structure');
    const sampleMessage = 'Hello World!\nLine 2 with *bold* & special characters: ⚠️ •';
    const clickUrl = buildWhatsAppClickToChatUrl('9876543210', sampleMessage);

    assert(clickUrl.startsWith('https://wa.me/919876543210?text='), 'Deep link starts with wa.me and normalized number');
    assert(!clickUrl.includes(' '), 'No raw spaces in encoded query string');
    assert(!clickUrl.includes('\n'), 'No raw linebreaks in encoded query string');
    assert(clickUrl.includes('%0A'), 'Line breaks encoded as %0A');
    assert(clickUrl.includes('%20'), 'Spaces encoded as %20');

    // --------------------------------------------------------------------------
    // TEST 3: Template Generation with Mandatory Tentative Disclaimer & No Aadhaar
    // --------------------------------------------------------------------------
    console.log('\n[TEST 3] Testing Message Template Content & Security Compliance');
    const generatedMsg = generateAllocationMessage({
      organizationName: 'Shree Samsthan Accommodation Desk',
      registrationId: 'REG-0001',
      primaryName: 'Ramesh Sharma',
      totalMembers: 4,
      allocationNumber: 'ALC-0001',
      rooms: [
        {
          roomNumber: '101',
          building: 'Main Wing',
          floor: 1,
          units: [
            { unitNumber: 'B1', type: 'BED' },
            { unitNumber: 'B2', type: 'BED' },
          ],
        },
        {
          roomNumber: '102',
          building: 'Main Wing',
          floor: 1,
          units: [{ unitNumber: 'M1', type: 'MAT' }],
        },
      ],
      entryDate: new Date('2026-11-20T10:00:00Z'),
      exitDate: new Date('2026-11-23T12:00:00Z'),
      helpdeskContact: '+91 98765 00000',
    });

    assert(
      generatedMsg.includes('TENTATIVE ACCOMMODATION ALLOCATION – NOT CONFIRMED'),
      'Mandatory tentative allocation disclaimer is prominently included'
    );
    assert(generatedMsg.includes('REG-0001'), 'Contains Registration ID');
    assert(generatedMsg.includes('ALC-0001'), 'Contains Allocation Number');
    assert(generatedMsg.includes('Ramesh Sharma'), 'Contains Primary Registrant Name');
    assert(generatedMsg.includes('Room 101'), 'Contains Room 101');
    assert(generatedMsg.includes('Bed B1, Bed B2'), 'Contains Bed details');
    assert(generatedMsg.includes('Mat M1'), 'Contains Mat details');
    assert(generatedMsg.includes('Reception Desk'), 'Contains Reception instructions');

    // Security compliance: no 12-digit Aadhaar number pattern
    const hasAadhaarPattern = /\b\d{4}\s?\d{4}\s?\d{4}\b/.test(generatedMsg);
    assert(!hasAadhaarPattern, 'Message strictly contains zero Aadhaar numbers or patterns');

    // --------------------------------------------------------------------------
    // Setup test users & test data in PostgreSQL
    // --------------------------------------------------------------------------
    console.log('\n[SETUP] Setting up test users and allocation in PostgreSQL');
    const adminUser = await prisma.adminUser.upsert({
      where: { email: 'admin-wa@accommodation.local' },
      update: { role: UserRole.SUPER_ADMIN, status: 'ACTIVE' },
      create: {
        email: 'admin-wa@accommodation.local',
        passwordHash: 'dummy-hash',
        name: 'Admin WhatsApp Staff',
        role: UserRole.SUPER_ADMIN,
        status: 'ACTIVE',
      },
    });

    const staffUser = await prisma.adminUser.upsert({
      where: { email: 'reception-wa@accommodation.local' },
      update: { role: UserRole.RECEPTION_STAFF, status: 'ACTIVE' },
      create: {
        email: 'reception-wa@accommodation.local',
        passwordHash: 'dummy-hash',
        name: 'Reception WA Staff',
        role: UserRole.RECEPTION_STAFF,
        status: 'ACTIVE',
      },
    });

    const viewerUser = await prisma.adminUser.upsert({
      where: { email: 'viewer-wa@accommodation.local' },
      update: { role: UserRole.VIEWER, status: 'ACTIVE' },
      create: {
        email: 'viewer-wa@accommodation.local',
        passwordHash: 'dummy-hash',
        name: 'Viewer User',
        role: UserRole.VIEWER,
        status: 'ACTIVE',
      },
    });

    const adminToken = generateToken({
      userId: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      name: adminUser.name,
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

    // Create a room with 2 units
    const testRoom = await prisma.room.create({
      data: {
        roomNumber: 'WA-' + Date.now().toString().slice(-4),
        building: 'Block WA',
        floor: 1,
        totalBeds: 2,
        totalMats: 0,
        units: {
          create: [
            { unitNumber: 'B1', type: 'BED', genderCategory: 'ANY' },
            { unitNumber: 'B2', type: 'BED', genderCategory: 'ANY' },
          ],
        },
      },
      include: { units: true },
    });

    // Create a registration
    const testReg = await prisma.registration.create({
      data: {
        registrationId: 'REG-WA-' + Date.now().toString().slice(-4),
        primaryName: 'Suresh Patel',
        mobile: '9876543210',
        totalMembers: 2,
        city: 'Ahmedabad',
        state: 'Gujarat',
      },
    });

    // Create an allocation
    const testAllocation = await prisma.allocation.create({
      data: {
        allocationNumber: 'ALC-WA-' + Date.now().toString().slice(-4),
        registrationId: testReg.id,
        status: AllocationStatus.TENTATIVE,
        entryDate: new Date('2026-11-25T10:00:00Z'),
        exitDate: new Date('2026-11-28T10:00:00Z'),
        createdById: adminUser.id,
        items: {
          create: [
            {
              unitId: testRoom.units[0].id,
              entryDate: new Date('2026-11-25T10:00:00Z'),
              exitDate: new Date('2026-11-28T10:00:00Z'),
              status: 'TENTATIVE',
            },
            {
              unitId: testRoom.units[1].id,
              entryDate: new Date('2026-11-25T10:00:00Z'),
              exitDate: new Date('2026-11-28T10:00:00Z'),
              status: 'TENTATIVE',
            },
          ],
        },
      },
    });

    // --------------------------------------------------------------------------
    // TEST 4: Prepare WhatsApp Message (POST /api/whatsapp/prepare)
    // --------------------------------------------------------------------------
    console.log('\n[TEST 4] Testing Message Preparation & PREPARED MessageLog Generation');
    const prepRes = await makeRequest('/whatsapp/prepare', {
      method: 'POST',
      token: staffToken,
      body: {
        allocationId: testAllocation.id,
        helpdeskContact: '+91 99999 88888',
      },
    });

    assert(prepRes.status === 200, 'POST /api/whatsapp/prepare returned HTTP 200');
    assert(prepRes.body.success === true, 'Response marked success: true');
    assert(Boolean(prepRes.body.data.messageLogId), 'MessageLog ID generated');
    assert(prepRes.body.data.status === MessageStatus.PREPARED, 'Status is PREPARED');
    assert(prepRes.body.data.recipientMobile === '919876543210', 'Normalized mobile is 919876543210');
    assert(prepRes.body.data.whatsappUrl.startsWith('https://wa.me/919876543210?text='), 'Valid Click-to-Chat URL');
    assert(
      prepRes.body.data.templateContent.includes('TENTATIVE ACCOMMODATION ALLOCATION – NOT CONFIRMED'),
      'Disclaimer present in prepared content'
    );

    const messageLogId = prepRes.body.data.messageLogId;

    // Verify database record
    const dbLog = await prisma.messageLog.findUnique({ where: { id: messageLogId } });
    assert(Boolean(dbLog), 'MessageLog exists in database');
    assert(dbLog?.status === MessageStatus.PREPARED, 'Database status is PREPARED');
    assert(dbLog?.sentAt === null, 'sentAt is strictly NULL initially');
    assert(dbLog?.sentByUserId === null, 'sentByUserId is strictly NULL initially');

    // --------------------------------------------------------------------------
    // TEST 5: Duplicate Action Protection & Idempotency
    // --------------------------------------------------------------------------
    console.log('\n[TEST 5] Testing Duplicate Action Protection & Idempotent Preparation');
    const prepRes2 = await makeRequest('/whatsapp/prepare', {
      method: 'POST',
      token: staffToken,
      body: {
        allocationId: testAllocation.id,
      },
    });

    assert(prepRes2.status === 200, 'Second prepare returned HTTP 200');
    assert(
      prepRes2.body.data.messageLogId === messageLogId,
      'Reuses existing PREPARED MessageLog rather than creating duplicate'
    );

    // --------------------------------------------------------------------------
    // TEST 6: Transition from PREPARED to OPENED
    // --------------------------------------------------------------------------
    console.log('\n[TEST 6] Testing Link Opened Transition (PREPARED -> OPENED)');
    const openRes = await makeRequest(`/whatsapp/messages/${messageLogId}/open`, {
      method: 'PATCH',
      token: staffToken,
    });

    assert(openRes.status === 200, 'PATCH /messages/:id/open returned HTTP 200');
    assert(openRes.body.data.status === MessageStatus.OPENED, 'Status transitioned to OPENED');

    // CRITICAL: Opening WhatsApp MUST NOT mark as sent!
    const openedDbLog = await prisma.messageLog.findUnique({ where: { id: messageLogId } });
    assert(openedDbLog?.status === MessageStatus.OPENED, 'DB status updated to OPENED');
    assert(openedDbLog?.sentAt === null, 'CRITICAL: sentAt is still NULL after opening WhatsApp');
    assert(openedDbLog?.sentByUserId === null, 'CRITICAL: sentByUserId is still NULL after opening WhatsApp');

    // --------------------------------------------------------------------------
    // TEST 7: Transition from OPENED to STAFF_CONFIRMED_SENT
    // --------------------------------------------------------------------------
    console.log('\n[TEST 7] Testing Staff Manual Confirmation (OPENED -> STAFF_CONFIRMED_SENT)');
    const confirmRes = await makeRequest(`/whatsapp/messages/${messageLogId}/confirm-sent`, {
      method: 'PATCH',
      token: staffToken,
      body: {
        notes: 'Sent via WhatsApp Web on reception tablet',
      },
    });

    assert(confirmRes.status === 200, 'PATCH /messages/:id/confirm-sent returned HTTP 200');
    assert(confirmRes.body.data.status === MessageStatus.STAFF_CONFIRMED_SENT, 'Status is STAFF_CONFIRMED_SENT');

    const confirmedDbLog = await prisma.messageLog.findUnique({
      where: { id: messageLogId },
      include: { sentByUser: true },
    });
    assert(confirmedDbLog?.status === MessageStatus.STAFF_CONFIRMED_SENT, 'DB status is STAFF_CONFIRMED_SENT');
    assert(confirmedDbLog?.sentAt !== null, 'sentAt is populated upon staff confirmation');
    assert(confirmedDbLog?.sentByUserId === staffUser.id, 'sentByUserId matches confirming staff member');
    assert(confirmedDbLog?.notes?.includes('reception tablet') || false, 'Staff notes recorded');

    // --------------------------------------------------------------------------
    // TEST 8: Failed Sending Workflow
    // --------------------------------------------------------------------------
    console.log('\n[TEST 8] Testing Failed Sending Workflow (-> FAILED)');
    // Prepare a new message for another allocation or subsequent send
    const testAllocation2 = await prisma.allocation.create({
      data: {
        allocationNumber: 'ALC-WA-FAIL-' + Date.now().toString().slice(-4),
        registrationId: testReg.id,
        status: AllocationStatus.TENTATIVE,
        entryDate: new Date('2026-11-25T10:00:00Z'),
        exitDate: new Date('2026-11-28T10:00:00Z'),
        createdById: adminUser.id,
      },
    });

    const prepFailRes = await makeRequest('/whatsapp/prepare', {
      method: 'POST',
      token: staffToken,
      body: {
        allocationId: testAllocation2.id,
      },
    });

    assert(prepFailRes.status === 200, 'Prepared second message');
    const failMessageLogId = prepFailRes.body.data.messageLogId;

    const failRes = await makeRequest(`/whatsapp/messages/${failMessageLogId}/failed`, {
      method: 'PATCH',
      token: staffToken,
      body: {
        reason: 'Recipient mobile number not registered on WhatsApp',
      },
    });

    assert(failRes.status === 200, 'PATCH /messages/:id/failed returned HTTP 200');
    assert(failRes.body.data.status === MessageStatus.FAILED, 'Status transitioned to FAILED');

    const failedDbLog = await prisma.messageLog.findUnique({ where: { id: failMessageLogId } });
    assert(failedDbLog?.status === MessageStatus.FAILED, 'DB status is FAILED');
    assert(
      failedDbLog?.notes?.includes('not registered on WhatsApp') || false,
      'Failure reason preserved in notes'
    );

    // --------------------------------------------------------------------------
    // TEST 9: Role-Based Authorization
    // --------------------------------------------------------------------------
    console.log('\n[TEST 9] Testing Role-Based Authorization (VIEWER vs STAFF/ADMIN)');
    const viewerPrepRes = await makeRequest('/whatsapp/prepare', {
      method: 'POST',
      token: viewerToken,
      body: {
        allocationId: testAllocation.id,
      },
    });
    assert(viewerPrepRes.status === 403, 'VIEWER role forbidden from preparing WhatsApp messages (HTTP 403)');

    const viewerConfirmRes = await makeRequest(`/whatsapp/messages/${messageLogId}/confirm-sent`, {
      method: 'PATCH',
      token: viewerToken,
    });
    assert(viewerConfirmRes.status === 403, 'VIEWER role forbidden from confirming message sent (HTTP 403)');

    // --------------------------------------------------------------------------
    // TEST 10: Message History Listing
    // --------------------------------------------------------------------------
    console.log('\n[TEST 10] Testing Message History Listing & Filtering');
    const listRes = await makeRequest(`/whatsapp/messages?registrationId=${testReg.id}`, {
      method: 'GET',
      token: staffToken,
    });

    assert(listRes.status === 200, 'GET /whatsapp/messages returned HTTP 200');
    assert(listRes.body.success === true, 'Response is success: true');
    assert(Array.isArray(listRes.body.data.logs), 'Logs is an array');
    assert(listRes.body.data.logs.length >= 2, 'Found at least 2 logs for registration');
    assert(
      listRes.body.data.logs.some((l: any) => l.status === MessageStatus.STAFF_CONFIRMED_SENT),
      'Contains STAFF_CONFIRMED_SENT entry'
    );
    assert(
      listRes.body.data.logs.some((l: any) => l.status === MessageStatus.FAILED),
      'Contains FAILED entry'
    );

    console.log('\n================================================================================');
    console.log('ALL PHASE 7: WHATSAPP CLICK-TO-CHAT INTEGRATION TESTS PASSED (10/10)!');
    console.log('================================================================================\n');
  } finally {
    await stopTestServer();
  }
}

runWhatsAppVerificationSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('WhatsApp verification test failed:', err);
    process.exit(1);
  });
