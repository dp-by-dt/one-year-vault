
import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// NOTE: These tables are defined to satisfy the project structure,
// but the core "Vault" data is stored LOCALLY in IndexedDB for privacy/offline support.
// The backend DB might only be used for optional sync if requested later,
// but for now, we strictly follow the "No Backend Storage" rule for vault content.

// We can keep a minimal "feedback" or "app_state" table if needed, 
// but strictly speaking, the user asked for NO backend storage for the vault.
// We will define the schemas for the *frontend* types here using Zod, 
// so the frontend generator knows the data shape.

// === LOCAL DATA TYPES (Not stored in Postgres) ===

export const vaultContentSchema = z.object({
  content: z.string().default(""),
  lastUpdated: z.number(),
});

export const encryptedVaultSchema = z.object({
  ciphertext: z.string(), // Base64
  iv: z.string(),         // Base64
  salt: z.string(),       // Base64
  lockedAt: z.number(),
});

// === EXPORTED TYPES ===
export type VaultContent = z.infer<typeof vaultContentSchema>;
export type EncryptedVault = z.infer<typeof encryptedVaultSchema>;
