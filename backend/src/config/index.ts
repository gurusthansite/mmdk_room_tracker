import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres@127.0.0.1:5433/accommodation_db?schema=public',
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_jwt_key_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  aadhaarEncryptionKey: process.env.AADHAAR_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
};

// Production Security Validation
if (config.nodeEnv === 'production') {
  if (config.jwtSecret === 'dev_secret_jwt_key_2026') {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET must be set to a secure secret in production!');
  }
  if (config.aadhaarEncryptionKey === '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef') {
    throw new Error('FATAL SECURITY ERROR: AADHAAR_ENCRYPTION_KEY must be set to a dedicated 64-char hex key in production!');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('FATAL CONFIGURATION ERROR: DATABASE_URL is required in production!');
  }
}
