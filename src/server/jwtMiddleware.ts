// JWT authentication middleware

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from './jwt';
import { storage } from './storage';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export async function jwtAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Check for dev token first (development only)
  const devToken = req.headers['x-dev-token'];
  if (devToken === 'dev' && process.env.NODE_ENV !== 'production') {
    // Create or get dev user
    const devUser = await storage.upsertUser({
      id: 'dev-user-123',
      email: 'dev@smartvault.app',
      firstName: 'Dev',
      lastName: 'User',
    });

    req.user = {
      id: devUser.id,
      email: devUser.email,
      firstName: devUser.firstName,
      lastName: devUser.lastName,
    };
    return next();
  }

  // Check for JWT token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  // Get user from database
  const user = await storage.getUserById(payload.userId);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  req.user = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  };

  next();
}

