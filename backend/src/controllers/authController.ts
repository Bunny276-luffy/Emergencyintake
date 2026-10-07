import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { generateToken } from '../middleware/authHandler';
import { HttpStatus } from '../utils/httpStatus';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
});

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        error: { message: 'Validation failed', details: parsed.error.issues }
      });
      return;
    }

    const { username, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) {
      res.status(HttpStatus.UNAUTHORIZED).json({ success: false, error: { message: 'Invalid credentials' } });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      res.status(HttpStatus.UNAUTHORIZED).json({ success: false, error: { message: 'Invalid credentials' } });
      return;
    }

    const token = generateToken({ id: user.id, role: user.role });

    res.status(HttpStatus.OK).json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        ambulanceId: user.ambulanceId,
        paramedicId: user.paramedicId,
        hospitalId: user.hospitalId
      }
    });
  } catch (error) {
    logger.error(`Login error: ${error}`);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'An unexpected error occurred' });
  }
};
