/**
 * Web Crypto API wrappers for secure client-side encryption.
 * We do not store keys. We derive them from a password.
 */

// Generate a random salt for PBKDF2
export function generateSalt(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(16));
}

// Generate a random IV for AES-GCM
export function generateIV(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(12));
}

// Derive a key from a password and salt using PBKDF2
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypt text content
export async function encryptContent(content: string, key: CryptoKey, iv: Uint8Array): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  return window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    enc.encode(content)
  );
}

// Decrypt text content
export async function decryptContent(ciphertext: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<string> {
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    ciphertext
  );
  
  const dec = new TextDecoder();
  return dec.decode(decrypted);
}

// Helpers for converting between Buffers and Base64 strings for storage
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToBuffer(base64: string): Uint8Array {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}
