import { Router, Request, Response } from 'express';
import { 
  login, 
  logout, 
  getMe, 
  listStaff, 
  createStaff, 
  updateStaff, 
  deleteStaff,
  adminResetStaffPassword,
  changeOwnPassword,
} from '../controllers/auth.controller';
import { requireAuth, requireRole } from '../middlewares/auth';
import { loginRateLimiter } from '../middlewares/rateLimiter';
import { UserRole } from '@prisma/client';

const router = Router();

// Public auth endpoints
router.post('/login', loginRateLimiter, login);
router.post('/logout', logout);

// Protected session endpoints
router.get('/me', requireAuth, getMe);
router.post('/change-password', requireAuth, changeOwnPassword);

// Staff account management (SUPER_ADMIN only)
router.get('/staff', requireAuth, requireRole([UserRole.SUPER_ADMIN]), listStaff);
router.post('/staff', requireAuth, requireRole([UserRole.SUPER_ADMIN]), createStaff);
router.put('/staff/:id', requireAuth, requireRole([UserRole.SUPER_ADMIN]), updateStaff);
router.delete('/staff/:id', requireAuth, requireRole([UserRole.SUPER_ADMIN]), deleteStaff);
router.post('/staff/:id/reset-password', requireAuth, requireRole([UserRole.SUPER_ADMIN]), adminResetStaffPassword);

// Role-protected test routes (RBAC validation)
router.get(
  '/admin-only',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN]),
  (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Access granted to SUPER_ADMIN resource.',
      user: req.user,
    });
  }
);

router.get(
  '/manager-only',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER]),
  (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Access granted to Manager/Admin resource.',
      user: req.user,
    });
  }
);

export default router;
