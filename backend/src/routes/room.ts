import { Router } from 'express';
import { 
  listRooms, 
  getRoomById, 
  createRoom, 
  createBulkRooms,
  updateRoom, 
  addUnitToRoom, 
  updateUnit, 
  rewriteUnitStatus,
  deleteRoom,
  deleteBulkRooms,
  bulkAssignHotel
} from '../controllers/room.controller';
import { requireAuth, requireRole } from '../middlewares/auth';
import { UserRole } from '@prisma/client';

const router = Router();

// All room routes require authentication
router.use(requireAuth);

// Read routes: Room inventory management is restricted to Admins, Managers and Auditors
router.get('/', requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER, UserRole.VIEWER]), listRooms);
router.get('/:id', requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER, UserRole.VIEWER]), getRoomById);

// Create / Edit routes (Admin and Allocation Manager)
router.post(
  '/bulk',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER]),
  createBulkRooms
);

router.post(
  '/', 
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER]), 
  createRoom
);

router.put(
  '/:id', 
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER]), 
  updateRoom
);

router.post(
  '/:id/units', 
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER]), 
  addUnitToRoom
);

// Unit structure/category updates (Admin and Allocation Manager only - NOT reception staff)
router.put(
  '/:id/units/:unitId', 
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER]), 
  updateUnit
);

// Direct rewrite of bed status: Check-In, Check-Out, Release Allocation, Maintenance/Active
router.post(
  '/units/:unitId/rewrite-status',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER, UserRole.RECEPTION_STAFF]),
  rewriteUnitStatus
);

// Delete room (Super Admin and Allocation Manager)
router.post(
  '/bulk-assign-hotel',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER]),
  bulkAssignHotel
);

router.post(
  '/bulk-delete',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER]),
  deleteBulkRooms
);

router.delete(
  '/bulk',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER]),
  deleteBulkRooms
);

router.delete(
  '/:id', 
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER]), 
  deleteRoom
);

export default router;
