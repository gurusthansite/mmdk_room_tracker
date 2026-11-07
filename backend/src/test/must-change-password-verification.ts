import { createApp } from '../app';
import { prisma } from '../config/prisma';
import { generateToken } from '../utils/token';
import { UserRole, UserStatus } from '@prisma/client';
import http from 'http';
import bcrypt from 'bcryptjs';

async function runMustChangePasswordVerification() {
  console.log('====================================================');
  console.log('   MUST CHANGE PASSWORD ENFORCEMENT VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`[PASS] Test ${total}: ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${total}: ${msg}`);
      process.exitCode = 1;
    }
  }

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  async function apiCall(endpoint: string, options: { method?: string; body?: any; headers?: any; cookie?: string } = {}) {
    const url = `${baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    };
    if (options.cookie) {
      headers['Cookie'] = options.cookie;
    }

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
    const setCookie = response.headers.get('set-cookie');
    return { status, data, setCookie };
  }

  const testEmail = 'pwdchange.test@accommodation.local';

  try {
    // 1. Create a staff user with mustChangePassword = true
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('TempPassword123!', salt);

    const user = await prisma.adminUser.upsert({
      where: { email: testEmail },
      update: {
        passwordHash: hash,
        mustChangePassword: true,
        status: UserStatus.ACTIVE,
        role: UserRole.ALLOCATION_MANAGER,
        tokenVersion: 0,
      },
      create: {
        email: testEmail,
        name: 'Password Change Tester',
        passwordHash: hash,
        mustChangePassword: true,
        status: UserStatus.ACTIVE,
        role: UserRole.ALLOCATION_MANAGER,
        tokenVersion: 0,
      },
    });

    assert(user.mustChangePassword === true, 'Test staff user created with mustChangePassword = true');

    // 2. Login as the staff user
    const loginRes = await apiCall('/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: 'TempPassword123!' },
    });
    assert(loginRes.status === 200, 'Login succeeded with temporary credentials');
    assert(loginRes.data.data.user.mustChangePassword === true, 'Profile indicates mustChangePassword is true');

    const cookieHeader = loginRes.setCookie?.split(';')[0];
    const token = loginRes.data.data.token;

    // 3. Attempt to access protected business endpoint (/api/rooms) -> Should be blocked with HTTP 403
    const blockedRes = await apiCall('/rooms', {
      cookie: cookieHeader,
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(blockedRes.status === 403, 'Protected business resource (/api/rooms) blocked with HTTP 403');
    assert(blockedRes.data.mustChangePassword === true, 'Response flags mustChangePassword: true');

    // 4. Verify /api/auth/me is permitted so frontend can identify user state
    const meRes = await apiCall('/auth/me', {
      cookie: cookieHeader,
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(meRes.status === 200, 'Identity endpoint (/api/auth/me) is permitted during forced password change');

    // 5. Change password using /api/auth/change-password
    const changeRes = await apiCall('/auth/change-password', {
      method: 'POST',
      cookie: cookieHeader,
      headers: { Authorization: `Bearer ${token}` },
      body: {
        currentPassword: 'TempPassword123!',
        newPassword: 'NewSecurePassword456!',
      },
    });
    assert(changeRes.status === 200 && changeRes.data.success === true, 'Password successfully updated via /api/auth/change-password');

    const newCookieHeader = changeRes.setCookie?.split(';')[0];

    // 6. Verify user profile now has mustChangePassword = false
    const updatedUser = await prisma.adminUser.findUnique({ where: { email: testEmail } });
    assert(updatedUser?.mustChangePassword === false, 'Database record updated: mustChangePassword is now false');
    assert(updatedUser?.tokenVersion === 1, 'tokenVersion was incremented to invalidate prior tokens');

    // 7. Verify old token is now invalidated by tokenVersion check
    const oldTokenRes = await apiCall('/rooms', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(oldTokenRes.status === 401, 'Old token rejected with HTTP 401 due to tokenVersion mismatch');

    // 8. Re-login with new password
    const newLoginRes = await apiCall('/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: 'NewSecurePassword456!' },
    });
    assert(newLoginRes.status === 200, 'Login succeeded with newly established password');
    assert(newLoginRes.data.data.user.mustChangePassword === false, 'mustChangePassword is now false in login response');

    const activeCookieHeader = newLoginRes.setCookie?.split(';')[0];

    // 9. Verify access to business resource is now permitted
    const activeRes = await apiCall('/rooms', {
      cookie: activeCookieHeader,
    });
    assert(activeRes.status === 200, 'Business resource (/api/rooms) is now accessible after password change');

    console.log(`\nResults: ${passed} / ${total} tests passed.\n`);
  } finally {
    await prisma.adminUser.deleteMany({ where: { email: testEmail } });
    server.close();
    await prisma.$disconnect();
  }
}

runMustChangePasswordVerification();
