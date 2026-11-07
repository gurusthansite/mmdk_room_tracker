import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import { UserRole } from '@prisma/client';
import {
  checkAvailability,
  listAllocations,
  getAllocationById,
  createAllocation,
  updateAllocation,
  cancelAllocation,
} from '../controllers/allocation.controller';

const router = Router();

// All routes require valid session authentication
router.use(requireAuth);

// 1. Availability check (All authenticated staff)
router.get(
  '/availability',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER, UserRole.RECEPTION_STAFF, UserRole.VIEWER]),
  checkAvailability
);

// 2. List allocations (All authenticated staff)
router.get(
  '/',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER, UserRole.RECEPTION_STAFF, UserRole.VIEWER]),
  listAllocations
);

// 3. Single allocation details (All authenticated staff)
router.get(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER, UserRole.RECEPTION_STAFF, UserRole.VIEWER]),
  getAllocationById
);

// 4. Create allocation (Reception Staff, Allocation Manager, Super Admin)
router.post(
  '/',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER, UserRole.RECEPTION_STAFF]),
  createAllocation
);

// 5. Update allocation (Reception Staff, Allocation Manager, Super Admin)
router.put(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER, UserRole.RECEPTION_STAFF]),
  updateAllocation
);

// 6. Cancel allocation (SUPER_ADMIN and ALLOCATION_MANAGER only)
router.post(
  '/:id/cancel',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER]),
  cancelAllocation
);

// 7. Delete alias -> cancel
router.delete(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER]),
  cancelAllocation
);

export default router;
