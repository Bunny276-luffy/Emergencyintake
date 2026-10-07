import { Router } from 'express';
import healthRoutes from './healthRoutes';
import publicRoutes from './publicRoutes';
import ambulanceRoutes from './ambulanceRoutes';
import paramedicRoutes from './paramedicRoutes';
import hospitalRoutes from './hospitalRoutes';
import dispatchRoutes from './dispatchRoutes';
import adminRoutes from './adminRoutes';

const router = Router();

// Health route group
router.use('/health', healthRoutes);

// 6 Modular Application API route groups
router.use('/public', publicRoutes);
router.use('/ambulance', ambulanceRoutes);
router.use('/paramedic', paramedicRoutes);
router.use('/hospital', hospitalRoutes);
router.use('/dispatch', dispatchRoutes);
router.use('/admin', adminRoutes);

export default router;
