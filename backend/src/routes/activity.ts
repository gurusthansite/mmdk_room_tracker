import { Router } from 'express';
import {
  getActivityLogs,
  getActivityInsights,
  getStaffList,
  exportActivityLogs,
} from '../controllers/activity.controller';
import { requireAuth, requireRole } from '../middlewares/auth';
import { UserRole } from '@prisma/client';

const router = Router();

// Viewing operational audit trails and insights
router.get(
  '/',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER, UserRole.RECEPTION_STAFF]),
  getActivityLogs
);

router.get(
  '/insights',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER, UserRole.RECEPTION_STAFF, UserRole.VIEWER]),
  getActivityInsights
);

router.get(
  '/staff',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER, UserRole.RECEPTION_STAFF]),
  getStaffList
);

// Restrict Excel audit log export to Super Admin & Allocation Manager
router.get(
  '/export',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER]),
  exportActivityLogs
);

export default router;
