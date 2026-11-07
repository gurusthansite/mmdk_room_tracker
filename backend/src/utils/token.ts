import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { config } from '../config';

export interface TokenPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  tokenVersion?: number;
}

export function generateToken(payload: TokenPayload): string {
  const options: SignOptions = {
    expiresIn: (config.jwtExpiresIn || '7d') as any,
  };
  return jwt.sign(payload, config.jwtSecret as Secret, options);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtSecret as Secret) as TokenPayload;
}
