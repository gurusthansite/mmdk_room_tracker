import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import { UserRole } from '@prisma/client';
import {
  getReceptionOverview,
  searchReception,
  getReceptionDossier,
  getUnifiedParticipantProfile,
  recordActualParticipants,
  collectAadhaarRecord,
  confirmReception,
  checkInParticipants,
  checkOutParticipant,
  transferParticipant,
  extendStay,
  changeAssignment,
  batchChangeAssignment,
  updateParticipantPhone,
  checkInAgain,
} from '../controllers/reception.controller';

const router = Router();

// All reception routes require authentication
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

// 1. Overview & Counters
router.get('/overview', requireRole(ALL_ROLES), getReceptionOverview);

// 2. Rapid Search & Lookup
router.get('/lookup', requireRole(ALL_ROLES), searchReception);

// 3. Full Reception Dossier
router.get('/dossier/:id', requireRole(ALL_ROLES), getReceptionDossier);

// 3B. Unified Participant Profile
router.get('/participant-profile/:id', requireRole(ALL_ROLES), getUnifiedParticipantProfile);

// 4. Record Arriving Participants
router.post('/participants', requireRole(STAFF_ROLES), recordActualParticipants);

// 5. Encrypted Aadhaar Collection
router.post('/aadhaar', requireRole(STAFF_ROLES), collectAadhaarRecord);

// 6. Reception Review & Allocation Confirmation
router.post('/confirm', requireRole(STAFF_ROLES), confirmReception);

// 7. Actual Check-in
router.post('/check-in', requireRole(STAFF_ROLES), checkInParticipants);

// 8. Actual Checkout
router.post('/check-out', requireRole(STAFF_ROLES), checkOutParticipant);

// 9. Room / Bed / Mat Transfer
router.post('/transfer', requireRole(STAFF_ROLES), transferParticipant);

// 10. Stay Extension
router.post('/extend-stay', requireRole(STAFF_ROLES), extendStay);

// 11. Change Room / Bed / Mat Assignment (Pre or Post Check-in)
router.post('/change-assignment', requireRole(STAFF_ROLES), changeAssignment);
router.post('/batch-change-assignment', requireRole(STAFF_ROLES), batchChangeAssignment);

// 12. Update Participant Phone
router.put('/participants/:id/phone', requireRole(STAFF_ROLES), updateParticipantPhone);

// 13. Accidental Checkout Recovery (Check In Again with Same Participant ID)
router.post('/check-in-again', requireRole(STAFF_ROLES), checkInAgain);

export default router;
