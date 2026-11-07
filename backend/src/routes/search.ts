import { Router } from 'express';
import { globalSearch } from '../controllers/search.controller';
import { requireAuth } from '../middlewares/auth';

const router = Router();

// Global search requires authentication for any staff role
router.get('/', requireAuth, globalSearch);

export default router;
