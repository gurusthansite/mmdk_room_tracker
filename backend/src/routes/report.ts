import { Router } from 'express';
import {
  getReportOverview,
  getOccupancyReport,
  getRegistrationReport,
  getParticipantReport,
  getDailyOperationalReport,
  exportReportExcel,
  exportReportPdf,
} from '../controllers/report.controller';
import { requireAuth, requireRole } from '../middlewares/auth';
import { UserRole } from '@prisma/client';

const router = Router();

// Viewing analytics & reports (All authenticated administrative roles)
router.get(
  '/overview',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER, UserRole.RECEPTION_STAFF, UserRole.VIEWER]),
  getReportOverview
);

router.get(
  '/occupancy',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER, UserRole.RECEPTION_STAFF, UserRole.VIEWER]),
  getOccupancyReport
);

router.get(
  '/registrations',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER, UserRole.RECEPTION_STAFF, UserRole.VIEWER]),
  getRegistrationReport
);

router.get(
  '/participants',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER, UserRole.RECEPTION_STAFF, UserRole.VIEWER]),
  getParticipantReport
);

router.get(
  '/operational-daily',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER, UserRole.RECEPTION_STAFF, UserRole.VIEWER]),
  getDailyOperationalReport
);

// Exports: Restricted to Super Admin & Allocation Manager
router.get(
  '/export/excel',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER]),
  exportReportExcel
);

router.get(
  '/export/pdf',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER]),
  exportReportPdf
);

export default router;
