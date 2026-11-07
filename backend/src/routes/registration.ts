import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import { UserRole } from '@prisma/client';
import {
  listRegistrations,
  getRegistrationById,
  createRegistration,
  updateRegistration,
  archiveRegistration,
  restoreRegistration,
  downloadImportTemplate,
  previewExcelImport,
  executeExcelImport,
  exportRegistrations,
} from '../controllers/registration.controller';

const router = Router();

// All registration routes require valid session authentication
router.use(requireAuth);

// 1. Template download (All authenticated staff)
router.get(
  '/template',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER, UserRole.RECEPTION_STAFF, UserRole.VIEWER]),
  downloadImportTemplate
);

// 2. Excel Export (All authenticated staff)
router.get(
  '/export',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER, UserRole.RECEPTION_STAFF, UserRole.VIEWER]),
  exportRegistrations
);

// 3. Excel Import Preview & Execution (SUPER_ADMIN and ALLOCATION_MANAGER only)
router.post(
  '/import/preview',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER]),
  previewExcelImport
);

router.post(
  '/import',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER]),
  executeExcelImport
);

// 4. Listing (All authenticated staff)
router.get(
  '/',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER, UserRole.RECEPTION_STAFF, UserRole.VIEWER]),
  listRegistrations
);

// 5. Single Registration Details (All authenticated staff)
router.get(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER, UserRole.RECEPTION_STAFF, UserRole.VIEWER]),
  getRegistrationById
);

// 6. Create Registration (Walk-ins allowed for Reception Staff, Allocation Manager, and Super Admin)
router.post(
  '/',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER, UserRole.RECEPTION_STAFF]),
  createRegistration
);

// 7. Update Registration (Allowed for Reception Staff during check-in/review)
router.put(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER, UserRole.RECEPTION_STAFF]),
  updateRegistration
);

// 8. Archive Registration (Soft Delete) (SUPER_ADMIN and ALLOCATION_MANAGER only)
router.delete(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER]),
  archiveRegistration
);

// 9. Restore Archived Registration (SUPER_ADMIN and ALLOCATION_MANAGER only)
router.post(
  '/restore/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ALLOCATION_MANAGER]),
  restoreRegistration
);

export default router;
