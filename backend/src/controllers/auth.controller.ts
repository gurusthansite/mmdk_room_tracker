import { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { generateToken, verifyToken } from '../utils/token';
import { config } from '../config';
import { getClientIp, recordFailedLogin, resetLoginAttempts } from '../middlewares/rateLimiter';
import { ActionType, UserRole, UserStatus } from '@prisma/client';

export const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function login(req: Request, res: Response) {
  const ip = getClientIp(req);

  // Validate input schema
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const { email, password } = parsed.data;

  // Query user from PostgreSQL
  const user = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    recordFailedLogin(ip);
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password.',
    });
  }

  // Check account status
  if (user.status !== 'ACTIVE') {
    return res.status(403).json({
      success: false,
      message: `Account is ${user.status.toLowerCase()}. Please contact administrator.`,
    });
  }

  // Verify bcrypt password hash
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    recordFailedLogin(ip);
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password.',
    });
  }

  // Reset rate limiter on successful authentication
  resetLoginAttempts(ip);

  // Update lastLoginAt timestamp
  const updatedUser = await prisma.adminUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      phone: true,
      status: true,
      mustChangePassword: true,
      tokenVersion: true,
      lastLoginAt: true,
    },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      entityType: 'ADMIN_USER',
      entityId: user.id,
      action: ActionType.UPDATE,
      details: { action: 'LOGIN_SUCCESS', email: user.email },
      userId: user.id,
      ipAddress: ip,
    },
  });

  // Generate JWT token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  // Set secure HttpOnly cookie
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return res.json({
    success: true,
    message: 'Login successful.',
    data: {
      user: updatedUser,
      token, // Provided for automated testing / non-browser HTTP clients
    },
  });
}

export async function logout(req: Request, res: Response) {
  // Audit log logout if authenticated
  const token = req.cookies?.auth_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (token) {
    try {
      const decoded = verifyToken(token);
      if (decoded?.userId) {
        await prisma.activityLog.create({
          data: {
            entityType: 'ADMIN_USER',
            entityId: decoded.userId,
            action: ActionType.UPDATE,
            details: { action: 'LOGOUT_SUCCESS', email: decoded.email },
            userId: decoded.userId,
            ipAddress: req.ip || req.socket.remoteAddress || null,
          },
        });
      }
    } catch {
      // Ignore expired/invalid token on logout
    }
  }

  // Clear HttpOnly auth cookie
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
  });

  return res.json({
    success: true,
    message: 'Logged out successfully.',
  });
}

export async function getMe(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated.',
    });
  }

  return res.json({
    success: true,
    data: {
      user: req.user,
    },
  });
}

// ----------------------------------------------------------------------------
// STAFF ACCOUNT MANAGEMENT (SUPER_ADMIN ONLY)
// ----------------------------------------------------------------------------

export const createStaffSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.nativeEnum(UserRole).default(UserRole.RECEPTION_STAFF),
  phone: z.string().trim().optional().nullable(),
  mustChangePassword: z.boolean().default(true),
});

export const updateStaffSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(6).optional(),
  role: z.nativeEnum(UserRole).optional(),
  phone: z.string().trim().optional().nullable(),
  status: z.nativeEnum(UserStatus).optional(),
  mustChangePassword: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters').optional(),
});

export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export async function listStaff(req: Request, res: Response) {
  const q = ((req.query.q as string) || '').trim();
  const role = req.query.role as UserRole | undefined;
  const status = req.query.status as UserStatus | undefined;

  const whereClause: any = {};
  if (role) whereClause.role = role;
  if (status) whereClause.status = status;

  if (q) {
    whereClause.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
    ];
  }

  const staff = await prisma.adminUser.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      status: true,
      mustChangePassword: true,
      tokenVersion: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({
    success: true,
    data: staff,
  });
}

export async function createStaff(req: Request, res: Response) {
  const parsed = createStaffSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }

  const { name, email, password, role, phone, mustChangePassword } = parsed.data;

  const existing = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existing) {
    return res.status(409).json({
      success: false,
      message: `User with email ${email} already exists.`,
    });
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const newStaff = await prisma.adminUser.create({
    data: {
      name,
      email: email.toLowerCase(),
      passwordHash,
      role,
      phone: phone || null,
      status: UserStatus.ACTIVE,
      mustChangePassword: mustChangePassword ?? true,
      tokenVersion: 0,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      status: true,
      mustChangePassword: true,
      createdAt: true,
    },
  });

  const currentUserId = (req as any).user?.id;
  await prisma.activityLog.create({
    data: {
      entityType: 'ADMIN_USER',
      entityId: newStaff.id,
      action: ActionType.CREATE,
      details: {
        action: 'STAFF_CREATED',
        name: newStaff.name,
        email: newStaff.email,
        role: newStaff.role,
        mustChangePassword: newStaff.mustChangePassword,
      },
      userId: currentUserId || newStaff.id,
      ipAddress: req.ip || null,
    },
  });

  return res.status(201).json({
    success: true,
    message: `Staff account created successfully for ${newStaff.name} with role ${newStaff.role}. Temporary password requires change on first login.`,
    data: newStaff,
  });
}

export async function updateStaff(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = updateStaffSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }

  const existing = await prisma.adminUser.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Staff user not found.' });
  }

  // Safeguard: Prevent deactivation or role demotion of the last active SUPER_ADMIN
  if (existing.role === UserRole.SUPER_ADMIN) {
    const isDemoting = parsed.data.role && parsed.data.role !== UserRole.SUPER_ADMIN;
    const isDeactivating = parsed.data.status && parsed.data.status !== UserStatus.ACTIVE;

    if (isDemoting || isDeactivating) {
      const activeSuperAdminCount = await prisma.adminUser.count({
        where: {
          role: UserRole.SUPER_ADMIN,
          status: UserStatus.ACTIVE,
        },
      });

      if (activeSuperAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate or change the role of the last active System Administrator.',
        });
      }
    }
  }

  const dataToUpdate: any = {};
  if (parsed.data.name) dataToUpdate.name = parsed.data.name;
  if (parsed.data.email) dataToUpdate.email = parsed.data.email.toLowerCase();
  if (parsed.data.role) dataToUpdate.role = parsed.data.role;
  if (parsed.data.phone !== undefined) dataToUpdate.phone = parsed.data.phone;
  if (parsed.data.mustChangePassword !== undefined) dataToUpdate.mustChangePassword = parsed.data.mustChangePassword;

  // If status is changed to non-active, invalidate active sessions
  if (parsed.data.status) {
    dataToUpdate.status = parsed.data.status;
    if (parsed.data.status !== UserStatus.ACTIVE) {
      dataToUpdate.tokenVersion = { increment: 1 };
    }
  }

  if (parsed.data.password) {
    const salt = await bcrypt.genSalt(10);
    dataToUpdate.passwordHash = await bcrypt.hash(parsed.data.password, salt);
    dataToUpdate.mustChangePassword = true;
    dataToUpdate.tokenVersion = { increment: 1 };
  }

  const updated = await prisma.adminUser.update({
    where: { id },
    data: dataToUpdate,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      status: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const currentUserId = (req as any).user?.id;
  await prisma.activityLog.create({
    data: {
      entityType: 'ADMIN_USER',
      entityId: updated.id,
      action: ActionType.UPDATE,
      details: {
        action: 'STAFF_UPDATED',
        updatedFields: Object.keys(dataToUpdate).filter((k) => k !== 'passwordHash'),
        status: updated.status,
        role: updated.role,
      },
      userId: currentUserId || updated.id,
      ipAddress: req.ip || null,
    },
  });

  return res.json({
    success: true,
    message: 'Staff account updated successfully.',
    data: updated,
  });
}

export async function adminResetStaffPassword(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }

  const existing = await prisma.adminUser.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Staff user not found.' });
  }

  // Generate temporary password if not provided
  const tempPassword = parsed.data.newPassword || `Temp@${Math.random().toString(36).slice(-6)}1`;

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(tempPassword, salt);

  // Invalidate all active sessions for this user and require password change
  const updated = await prisma.adminUser.update({
    where: { id },
    data: {
      passwordHash,
      mustChangePassword: true,
      tokenVersion: { increment: 1 },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      mustChangePassword: true,
    },
  });

  const currentUserId = (req as any).user?.id;
  await prisma.activityLog.create({
    data: {
      entityType: 'ADMIN_USER',
      entityId: updated.id,
      action: ActionType.STATUS_CHANGE,
      details: {
        action: 'ADMIN_PASSWORD_RESET',
        staffEmail: existing.email,
        staffName: existing.name,
        sessionsRevoked: true,
        mustChangePasswordRequired: true,
      },
      userId: currentUserId || updated.id,
      ipAddress: req.ip || null,
    },
  });

  return res.json({
    success: true,
    message: `Password reset successfully for ${existing.name}. All active sessions have been revoked. Staff must change password at next login.`,
    data: {
      staff: updated,
      temporaryPassword: tempPassword,
    },
  });
}

export async function changeOwnPassword(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }

  const parsed = changeOwnPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.adminUser.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({ success: false, message: 'User account not found.' });
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    return res.status(400).json({ success: false, message: 'Current password does not match.' });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({ success: false, message: 'New password cannot be identical to the current password.' });
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(newPassword, salt);

  const updatedUser = await prisma.adminUser.update({
    where: { id: userId },
    data: {
      passwordHash,
      mustChangePassword: false,
      tokenVersion: { increment: 1 },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      mustChangePassword: true,
      tokenVersion: true,
    },
  });

  // Reissue fresh JWT auth token
  const token = generateToken({
    userId: updatedUser.id,
    email: updatedUser.email,
    name: updatedUser.name,
    role: updatedUser.role,
    tokenVersion: updatedUser.tokenVersion,
  });

  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  await prisma.activityLog.create({
    data: {
      entityType: 'ADMIN_USER',
      entityId: userId,
      action: ActionType.UPDATE,
      details: { action: 'STAFF_PASSWORD_CHANGE', email: user.email },
      userId: userId,
      ipAddress: req.ip || null,
    },
  });

  return res.json({
    success: true,
    message: 'Your password has been changed successfully.',
    data: {
      user: updatedUser,
      token,
    },
  });
}

export async function deleteStaff(req: Request, res: Response) {
  const { id } = req.params;
  const currentUserId = (req as any).user?.id;

  if (currentUserId === id) {
    return res.status(400).json({ success: false, message: 'Cannot delete your own administrator account.' });
  }

  const existing = await prisma.adminUser.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          allocationsCreated: true,
          stayRecords: true,
          aadhaarRecords: true,
          activityLogs: true,
        },
      },
    },
  });

  if (!existing) {
    return res.status(404).json({ success: false, message: 'Staff user not found.' });
  }

  // Safeguard: Prevent deleting the last active SUPER_ADMIN
  if (existing.role === UserRole.SUPER_ADMIN) {
    const activeSuperAdminCount = await prisma.adminUser.count({
      where: {
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    if (activeSuperAdminCount <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the last active System Administrator.',
      });
    }
  }

  const hasHistory =
    existing._count.allocationsCreated > 0 ||
    existing._count.stayRecords > 0 ||
    existing._count.aadhaarRecords > 0;

  if (hasHistory) {
    // Soft deactivate to preserve foreign key constraints and audit integrity
    await prisma.adminUser.update({
      where: { id },
      data: {
        status: UserStatus.INACTIVE,
        tokenVersion: { increment: 1 },
      },
    });

    await prisma.activityLog.create({
      data: {
        entityType: 'ADMIN_USER',
        entityId: id,
        action: ActionType.DELETE,
        details: { action: 'STAFF_DEACTIVATED_PRESERVE_HISTORY', name: existing.name, email: existing.email },
        userId: currentUserId,
        ipAddress: req.ip || null,
      },
    });

    return res.json({
      success: true,
      message: `Staff user ${existing.name} has historical records and was safely deactivated instead of deleted. Active sessions revoked.`,
    });
  }

  await prisma.adminUser.delete({ where: { id } });

  await prisma.activityLog.create({
    data: {
      entityType: 'ADMIN_USER',
      entityId: id,
      action: ActionType.DELETE,
      details: { action: 'STAFF_PERMANENTLY_DELETED', name: existing.name, email: existing.email },
      userId: currentUserId,
      ipAddress: req.ip || null,
    },
  });

  return res.json({
    success: true,
    message: `Staff user ${existing.name} has been permanently removed.`,
  });
}
