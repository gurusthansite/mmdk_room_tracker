import { Router } from 'express';
import healthRouter from './health';
import authRouter from './auth';
import roomRouter from './room';
import hotelRouter from './hotel';
import registrationRouter from './registration';
import allocationRouter from './allocation';
import whatsappRouter from './whatsapp';
import receptionRouter from './reception';
import searchRouter from './search';
import activityRouter from './activity';
import reportRouter from './report';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/rooms', roomRouter);
router.use('/hotels', hotelRouter);
router.use('/registrations', registrationRouter);
router.use('/allocations', allocationRouter);
router.use('/whatsapp', whatsappRouter);
router.use('/reception', receptionRouter);
router.use('/search', searchRouter);
router.use('/activity', activityRouter);
router.use('/reports', reportRouter);

export default router;
