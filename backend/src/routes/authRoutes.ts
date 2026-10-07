import { Router } from 'express';
import { login } from '../controllers/authController';
import { loginLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/login', loginLimiter, login);

export default router;
