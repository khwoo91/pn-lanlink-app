import CryptoJS from 'crypto-js';

/**
 * Hash a plain password using SHA-256.
 */
export const hashPassword = (password: string): string => {
  return CryptoJS.SHA256(password).toString(CryptoJS.enc.Hex);
};

/**
 * Verify if a plain password matches a given SHA-256 hash.
 */
export const verifyPassword = (password: string, hash: string): boolean => {
  const inputHash = hashPassword(password);
  return inputHash === hash;
};
