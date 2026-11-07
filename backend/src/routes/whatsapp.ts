import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import { UserRole } from '@prisma/client';
import {
  prepareAllocationMessage,
  recordWhatsAppOpened,
  confirmWhatsAppSent,
  recordWhatsAppFailed,
  listMessageLogs,
} from '../controllers/whatsapp.controller';

const router = Router();

// All WhatsApp routes require authentication
router.use(requireAuth);

const STAFF_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ALLOCATION_MANAGER,
  UserRole.RECEPTION_STAFF,
];

const ALL_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ALLOCATION_MANAGER,
  UserRole.RECEPTION_STAFF,
  UserRole.VIEWER,
];

// 1. Prepare message & generate Click-to-Chat link
router.post('/prepare', requireRole(STAFF_ROLES), prepareAllocationMessage);

// 2. Record staff opened WhatsApp link (PREPARED -> OPENED)
router.patch('/messages/:id/open', requireRole(STAFF_ROLES), recordWhatsAppOpened);

// 3. Staff manually confirms message was sent (OPENED -> STAFF_CONFIRMED_SENT)
router.patch('/messages/:id/confirm-sent', requireRole(STAFF_ROLES), confirmWhatsAppSent);

// 4. Staff reports sending failed or was cancelled (-> FAILED)
router.patch('/messages/:id/failed', requireRole(STAFF_ROLES), recordWhatsAppFailed);

// 5. Query message logs history
router.get('/messages', requireRole(ALL_ROLES), listMessageLogs);

export default router;
