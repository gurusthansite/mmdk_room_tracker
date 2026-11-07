import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import readline from 'readline';

const prisma = new PrismaClient();

function promptSecure(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function bootstrapAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'gurusthan.mmdk@arunachalam').trim().toLowerCase();
  const name = (process.env.ADMIN_NAME || 'Super Administrator').trim();
  const phone = process.env.ADMIN_PHONE?.trim() || null;

  console.log('====================================================');
  console.log('   MMDK SUPER_ADMIN PRODUCTION BOOTSTRAP PROVISIONING');
  console.log('====================================================');
  console.log(`Target Email: ${email}`);
  console.log(`Target Role:  SUPER_ADMIN`);

  // 1. Safety Check: Never overwrite an existing administrator
  const existing = await prisma.adminUser.findUnique({
    where: { email },
  });

  if (existing) {
    console.log(`\n[ABORTED] An administrator with email "${email}" already exists (ID: ${existing.id}, Status: ${existing.status}).`);
    console.log('Existing credentials and privileges were preserved. No changes made.');
    return;
  }

  // 2. Obtain password: read from interactive terminal prompt or environment variable
  let password = process.env.ADMIN_PASSWORD;

  if (!password) {
    password = await promptSecure('\nEnter new secure password for Super Admin: ');
  }

  if (!password || password.length < 8) {
    console.error('\n[ERROR] Password must be at least 8 characters long.');
    process.exit(1);
  }

  // 3. Hash password using bcrypt
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // 4. Create account with create-only semantics and mustChangePassword = true
  const admin = await prisma.adminUser.create({
    data: {
      email,
      name,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      phone,
      mustChangePassword: true, // Strictly requires password change on first login
      tokenVersion: 0,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      mustChangePassword: true,
      createdAt: true,
    },
  });

  console.log('\n====================================================');
  console.log('   SUPER_ADMIN SUCCESSFULLY PROVISIONED');
  console.log('====================================================');
  console.log(`User ID:              ${admin.id}`);
  console.log(`Login Email:          ${admin.email}`);
  console.log(`Role:                 ${admin.role}`);
  console.log(`Account Status:       ${admin.status}`);
  console.log(`Must Change Password: ${admin.mustChangePassword}`);
  console.log('----------------------------------------------------');
  console.log('SECURITY NOTICE:');
  console.log('1. Plaintext passwords were not logged.');
  console.log('2. mustChangePassword is TRUE. Upon first login, access to all');
  console.log('   business endpoints will be blocked until a permanent password is set.');
  console.log('====================================================\n');
}

bootstrapAdmin()
  .catch((err) => {
    console.error('\n[Bootstrap Fatal Error]:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
