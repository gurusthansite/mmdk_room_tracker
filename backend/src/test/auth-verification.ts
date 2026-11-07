import { createApp } from '../app';
import { prisma } from '../config/prisma';
import { resetLoginAttempts } from '../middlewares/rateLimiter';
import { generateToken } from '../utils/token';
import { UserRole, UserStatus } from '@prisma/client';
import http from 'http';

async function runAuthVerification() {
  console.log('====================================================');
  console.log('      PHASE 3: ADMIN AUTHENTICATION VERIFICATION');
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

  // Spin up app on a random free ephemeral port
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

  try {
    resetLoginAttempts('127.0.0.1');

    // ------------------------------------------------------------------------
    // TEST 1: Valid Admin Login
    // ------------------------------------------------------------------------
    console.log('--- Subsystem 1: Core Credential Verification ---');
    const validLoginRes = await apiCall('/auth/login', {
      method: 'POST',
      body: { email: 'admin@accommodation.local', password: 'Admin@123' },
    });

    assert(validLoginRes.status === 200 && validLoginRes.data.success === true, 'Valid admin login returned HTTP 200');
    assert(validLoginRes.data.data.user.email === 'admin@accommodation.local', 'Returned authenticated user profile');
    assert(validLoginRes.data.data.user.role === 'SUPER_ADMIN', 'Returned user role is SUPER_ADMIN');
    assert(validLoginRes.data.data.user.passwordHash === undefined, 'Security: passwordHash is strictly excluded from response');
    assert(validLoginRes.data.data.user.lastLoginAt !== null, 'lastLoginAt was updated in PostgreSQL');
    assert(
      validLoginRes.setCookie !== null && validLoginRes.setCookie.includes('auth_token=') && validLoginRes.setCookie.includes('HttpOnly'),
      'Secure HttpOnly auth_token cookie set in response header'
    );

    const authToken = validLoginRes.data.data.token;
    const cookieHeader = validLoginRes.setCookie?.split(';')[0]; // "auth_token=..."

    // Verify ActivityLog entry
    const loginLog = await prisma.activityLog.findFirst({
      where: { entityType: 'ADMIN_USER', action: 'UPDATE' },
      orderBy: { createdAt: 'desc' },
    });
    assert(loginLog !== null && (loginLog.details as any)?.action === 'LOGIN_SUCCESS', 'Successful login recorded in immutable ActivityLog');

    // ------------------------------------------------------------------------
    // TEST 2: Invalid Password
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 2: Invalid Credentials & Rejections ---');
    const badPasswordRes = await apiCall('/auth/login', {
      method: 'POST',
      body: { email: 'admin@accommodation.local', password: 'WrongPassword999' },
    });
    assert(badPasswordRes.status === 401 && badPasswordRes.data.success === false, 'Invalid password rejected with HTTP 401');

    // ------------------------------------------------------------------------
    // TEST 3: Unknown Email
    // ------------------------------------------------------------------------
    const badEmailRes = await apiCall('/auth/login', {
      method: 'POST',
      body: { email: 'nonexistent@accommodation.local', password: 'Admin@123' },
    });
    assert(badEmailRes.status === 401 && badEmailRes.data.success === false, 'Unknown email rejected with HTTP 401');

    // ------------------------------------------------------------------------
    // TEST 4: Input Validation with Zod
    // ------------------------------------------------------------------------
    const malformedRes = await apiCall('/auth/login', {
      method: 'POST',
      body: { email: 'not-an-email', password: '' },
    });
    assert(malformedRes.status === 400 && malformedRes.data.message === 'Validation failed', 'Zod schema validation rejected malformed request with HTTP 400');

    // ------------------------------------------------------------------------
    // TEST 5: Rate Limiting & Brute Force Protection
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 3: Rate Limiting Protection ---');
    // Trigger 5 consecutive failed attempts
    for (let i = 0; i < 4; i++) {
      await apiCall('/auth/login', {
        method: 'POST',
        body: { email: 'admin@accommodation.local', password: 'bad' },
      });
    }
    // The 5th attempt triggers rate limit block
    const blockedRes = await apiCall('/auth/login', {
      method: 'POST',
      body: { email: 'admin@accommodation.local', password: 'bad' },
    });
    assert(blockedRes.status === 429 && blockedRes.data.message.includes('Too many failed login attempts'), 'Brute-force protection: IP blocked with HTTP 429 after 5 failed attempts');

    // Reset rate limiter for remaining test operations
    resetLoginAttempts('127.0.0.1');

    // ------------------------------------------------------------------------
    // TEST 6: Protected Route /api/auth/me
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 4: Protected Routes & Session Authentication ---');
    // 6a: Access with HttpOnly cookie
    const meCookieRes = await apiCall('/auth/me', { cookie: cookieHeader });
    assert(meCookieRes.status === 200 && meCookieRes.data.data.user.email === 'admin@accommodation.local', 'Protected /api/auth/me accessible via HttpOnly session cookie');

    // 6b: Access with Bearer token header
    const meBearerRes = await apiCall('/auth/me', { headers: { Authorization: `Bearer ${authToken}` } });
    assert(meBearerRes.status === 200 && meBearerRes.data.data.user.email === 'admin@accommodation.local', 'Protected /api/auth/me accessible via Bearer token');

    // 6c: Access without any auth
    const meNoAuthRes = await apiCall('/auth/me');
    assert(meNoAuthRes.status === 401 && meNoAuthRes.data.success === false, 'Protected /api/auth/me rejected unauthenticated request with HTTP 401');

    // 6d: Access with tampered token
    const meTamperedRes = await apiCall('/auth/me', { headers: { Authorization: 'Bearer invalid.tampered.token' } });
    assert(meTamperedRes.status === 401, 'Tampered token rejected with HTTP 401');

    // ------------------------------------------------------------------------
    // TEST 7: Role-Based Access Control (RBAC)
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 5: Role-Based Authorization Middleware ---');
    // 7a: Super Admin accessing admin-only endpoint
    const adminOnlyRes = await apiCall('/auth/admin-only', { cookie: cookieHeader });
    assert(adminOnlyRes.status === 200 && adminOnlyRes.data.success === true, 'SUPER_ADMIN granted access to /api/auth/admin-only');

    // 7b: Create a temporary staff user with RECEPTION_STAFF role to test RBAC rejection
    const staffUser = await prisma.adminUser.upsert({
      where: { email: 'staff.test@accommodation.local' },
      update: { role: UserRole.RECEPTION_STAFF, status: UserStatus.ACTIVE },
      create: {
        email: 'staff.test@accommodation.local',
        passwordHash: 'dummyhash',
        name: 'Reception Staff Test',
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

    const staffForbiddenRes = await apiCall('/auth/admin-only', {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(staffForbiddenRes.status === 403 && staffForbiddenRes.data.message.includes('Forbidden'), 'RBAC enforcement: RECEPTION_STAFF forbidden from SUPER_ADMIN resource (HTTP 403)');

    // 7c: Manager-only route accessible by Super Admin
    const managerRes = await apiCall('/auth/manager-only', { cookie: cookieHeader });
    assert(managerRes.status === 200, 'SUPER_ADMIN granted access to manager-only multi-role resource');

    // Clean up temporary staff user
    await prisma.adminUser.delete({ where: { id: staffUser.id } });

    // ------------------------------------------------------------------------
    // TEST 8: Logout & Session Invalidation
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 6: Logout & Cookie Invalidation ---');
    const logoutRes = await apiCall('/auth/logout', { method: 'POST', cookie: cookieHeader });
    assert(logoutRes.status === 200 && logoutRes.data.success === true, 'Logout API returned HTTP 200');
    assert(logoutRes.setCookie !== null && logoutRes.setCookie.includes('auth_token=;'), 'Logout clears auth_token cookie with empty value');

    // ------------------------------------------------------------------------
    // TEST 9: Health API Unaffected
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 7: Health API Regressions Check ---');
    const healthRes = await apiCall('/health');
    assert(healthRes.status === 200 && healthRes.data.data.database.status === 'CONNECTED', 'Existing health endpoint /api/health functional (HTTP 200)');

    // ------------------------------------------------------------------------
    // SUMMARY
    // ------------------------------------------------------------------------
    console.log('\n====================================================');
    console.log(`   PHASE 3 VERIFICATION RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('Unexpected error in auth verification:', error);
    process.exit(1);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runAuthVerification();
