import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function bootstrapAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@mmdk.local').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe@2026!';
  const name = process.env.ADMIN_NAME || 'Super Administrator';
  const phone = process.env.ADMIN_PHONE || null;

  console.log(`[Bootstrap] Checking for existing administrator with email: ${email}`);

  // Create-only logic: never overwrite or modify an existing administrator
  const existing = await prisma.adminUser.findUnique({
    where: { email },
  });

  if (existing) {
    console.log(`[Bootstrap] Administrator already exists (ID: ${existing.id}, Role: ${existing.role}, Status: ${existing.status}). Skipping creation.`);
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

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

  console.log(`[Bootstrap] Super Admin successfully created:`);
  console.log(`  ID: ${admin.id}`);
  console.log(`  Email: ${admin.email}`);
  console.log(`  Role: ${admin.role}`);
  console.log(`  Must Change Password: ${admin.mustChangePassword}`);
  console.log(`[Bootstrap] Note: Initial temporary password must be changed immediately upon first login.`);
}

bootstrapAdmin()
  .catch((err) => {
    console.error('[Bootstrap Error]:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
