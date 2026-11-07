import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit recommended for GCM

function getEncryptionKey(): Buffer {
  const keyHex = config.aadhaarEncryptionKey;
  if (!keyHex || keyHex.length !== 64) {
    // 32 bytes = 64 hex characters
    throw new Error('AADHAAR_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  }
  return Buffer.from(keyHex, 'hex');
}

export interface EncryptedData {
  encryptedText: string; // Hex-encoded ciphertext
  iv: string;            // Hex-encoded IV
  authTag: string;       // Hex-encoded GCM authentication tag
  lastFourDigits: string;// Last 4 characters unencrypted for search/masked UI
}

/**
 * Encrypts a sensitive string (e.g. 12-digit Aadhaar) using AES-256-GCM.
 */
export function encryptSensitiveData(plainText: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  const cleanDigits = plainText.replace(/\D/g, '');
  const lastFourDigits = cleanDigits.slice(-4);

  return {
    encryptedText: encrypted,
    iv: iv.toString('hex'),
    authTag,
    lastFourDigits,
  };
}

/**
 * Decrypts AES-256-GCM encrypted data.
 */
export function decryptSensitiveData(encryptedHex: string, ivHex: string, authTagHex: string): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Formats Aadhaar for safe UI display (e.g., "XXXX-XXXX-1234").
 */
export function formatMaskedAadhaar(lastFourDigits: string): string {
  return `XXXX-XXXX-${lastFourDigits}`;
}
