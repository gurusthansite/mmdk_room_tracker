import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import { UserRole } from '@prisma/client';
import {
  listHotels,
  getHotelById,
  createHotel,
  updateHotel,
  deleteHotel,
} from '../controllers/hotel.controller';

const router = Router();

// All hotel routes require authentication
router.use(requireAuth);

const READ_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ALLOCATION_MANAGER,
  UserRole.RECEPTION_STAFF,
  UserRole.VIEWER,
];

const WRITE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ALLOCATION_MANAGER,
];

// View Hotels
router.get('/', requireRole(READ_ROLES), listHotels);
router.get('/:id', requireRole(READ_ROLES), getHotelById);

// Create & Edit Hotels (Admin / Allocation Manager only)
router.post('/', requireRole(WRITE_ROLES), createHotel);
router.put('/:id', requireRole(WRITE_ROLES), updateHotel);

// Delete Hotel (Super Admin only)
router.delete('/:id', requireRole([UserRole.SUPER_ADMIN]), deleteHotel);

export default router;
