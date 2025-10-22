import crypto from 'crypto';

// Encryption key for GitHub tokens
// In production, this should be stored securely in environment variables
const ENCRYPTION_KEY = process.env.GITHUB_TOKEN_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Ensure we have a valid encryption key
if (!process.env.GITHUB_TOKEN_ENCRYPTION_KEY) {
  console.warn('⚠️  GITHUB_TOKEN_ENCRYPTION_KEY not set. Using temporary key. Set this in production!');
}

function getEncryptionKey(): Buffer {
  // Convert hex string to buffer or use first 32 bytes
  const key = ENCRYPTION_KEY.slice(0, 64); // 32 bytes in hex = 64 chars
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a GitHub token before storing in database
 */
export function encryptToken(token: string): string {
  if (!token) return token;
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Token encryption failed:', error);
    throw new Error('Failed to encrypt token');
  }
}

/**
 * Decrypt a GitHub token from database
 */
export function decryptToken(encryptedToken: string): string {
  if (!encryptedToken) return encryptedToken;
  
  // Check if token is already in plain text (for backwards compatibility during migration)
  if (!encryptedToken.includes(':')) {
    console.warn('⚠️  Token appears to be unencrypted. Please re-connect GitHub to encrypt.');
    return encryptedToken;
  }
  
  try {
    const parts = encryptedToken.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format');
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Token decryption failed:', error);
    throw new Error('Failed to decrypt token. Token may be corrupted.');
  }
}

/**
 * Check if a token is encrypted
 */
export function isTokenEncrypted(token: string): boolean {
  if (!token) return false;
  // Encrypted tokens have the format: iv:authTag:encryptedData
  return token.includes(':') && token.split(':').length === 3;
}
