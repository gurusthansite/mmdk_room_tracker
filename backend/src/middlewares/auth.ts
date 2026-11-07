import { Request, Response, NextFunction } from 'express';
import { UserRole, UserStatus } from '@prisma/client';
import { verifyToken } from '../utils/token';
import { prisma } from '../config/prisma';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone: string | null;
  status: UserStatus;
  mustChangePassword?: boolean;
  tokenVersion?: number;
  lastLoginAt: Date | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    let token: string | undefined;

    // 1. Check HttpOnly cookie
    if (req.cookies && req.cookies.auth_token) {
      token = req.cookies.auth_token;
    } 
    // 2. Check Bearer Authorization header (for API clients, automated tests)
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No session or token provided.',
      });
    }

    // Verify token
    let payload;
    try {
      payload = verifyToken(token);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Session expired. Please log in again.',
          expired: true,
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token.',
      });
    }

    // Verify user exists and is active in database
    const user = await prisma.adminUser.findUnique({
      where: { id: payload.userId },
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

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found.',
      });
    }

    if (payload.tokenVersion !== undefined && user.tokenVersion !== payload.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: 'Session has been invalidated due to a password reset. Please log in again.',
      });
    }

    if (user.status !== UserStatus.ACTIVE) {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.status.toLowerCase()}. Access denied.`,
      });
    }

    // Security Hardening: Enforce password change before allowing access to any business resources
    if (user.mustChangePassword) {
      const originalUrl = req.originalUrl || '';
      const path = req.path || '';
      const isAllowedEndpoint = 
        originalUrl.includes('/auth/change-password') ||
        originalUrl.includes('/auth/me') ||
        originalUrl.includes('/auth/logout') ||
        path.endsWith('/change-password') ||
        path.endsWith('/me') ||
        path.endsWith('/logout');

      if (!isAllowedEndpoint) {
        return res.status(403).json({
          success: false,
          mustChangePassword: true,
          message: 'Password change required before accessing other resources.',
        });
      }
    }

    req.user = user;
    next();
  } catch (error: any) {
    console.error('requireAuth Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal authentication error.',
    });
  }
}

/**
 * Role-Based Access Control (RBAC) middleware generator.
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Role '${req.user.role}' is not authorized to access this resource. Required: [${allowedRoles.join(', ')}].`,
      });
    }

    next();
  };
}
