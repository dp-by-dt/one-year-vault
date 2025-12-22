import { useState, useEffect, useCallback } from "react";
import { openDB, IDBPDatabase } from "idb";
import { VaultContent, EncryptedVault, vaultContentSchema, encryptedVaultSchema } from "@shared/schema";
import { z } from "zod";
import * as Crypto from "../lib/crypto";

const DB_NAME = "vault-db";
const STORE_DRAFT = "draft";
const STORE_LOCKED = "locked";

type VaultState = 
  | { status: "loading" }
  | { status: "open"; content: string; lastUpdated: number }
  | { status: "locked"; lockedAt: number };

export function useVault() {
  const [state, setState] = useState<VaultState>({ status: "loading" });
  const [db, setDb] = useState<IDBPDatabase | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize DB
  useEffect(() => {
    async function initDB() {
      try {
        const database = await openDB(DB_NAME, 1, {
          upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_DRAFT)) {
              db.createObjectStore(STORE_DRAFT);
            }
            if (!db.objectStoreNames.contains(STORE_LOCKED)) {
              db.createObjectStore(STORE_LOCKED);
            }
          },
        });
        setDb(database);
      } catch (e) {
        console.error("Failed to init DB:", e);
        setError("Could not initialize storage.");
      }
    }
    initDB();
  }, []);

  // Check vault status once DB is ready
  useEffect(() => {
    if (!db) return;

    async function checkStatus() {
      try {
        // Check for locked vault first
        const lockedData = await db!.get(STORE_LOCKED, "vault_data");
        if (lockedData) {
          try {
            const parsed = encryptedVaultSchema.parse(lockedData);
            setState({ status: "locked", lockedAt: parsed.lockedAt });
            return;
          } catch (e) {
            console.error("Invalid locked data structure", e);
            // Fallthrough to check draft if locked data is corrupt? 
            // Better to show error, but for now let's assume no data.
          }
        }

        // Check for draft
        const draftData = await db!.get(STORE_DRAFT, "current");
        if (draftData) {
          try {
            const parsed = vaultContentSchema.parse(draftData);
            setState({ status: "open", content: parsed.content, lastUpdated: parsed.lastUpdated });
          } catch (e) {
             // Schema migration or corruption
             console.warn("Draft schema mismatch, resetting content");
             setState({ status: "open", content: "", lastUpdated: Date.now() });
          }
        } else {
          // New vault
          setState({ status: "open", content: "", lastUpdated: Date.now() });
        }
      } catch (e) {
        console.error("Error checking vault status:", e);
        setError("Failed to load vault status.");
      }
    }
    checkStatus();
  }, [db]);

  // Save draft content (debounced save logic should be handled by the UI or a separate effect, 
  // here we just provide the raw async function)
  const saveDraft = useCallback(async (content: string) => {
    if (!db) return;
    try {
      const data: VaultContent = { content, lastUpdated: Date.now() };
      await db.put(STORE_DRAFT, data, "current");
      setState(prev => prev.status === "open" ? { ...prev, content, lastUpdated: data.lastUpdated } : prev);
    } catch (e) {
      console.error("Failed to save draft:", e);
      setError("Failed to save changes.");
    }
  }, [db]);

  // Lock the vault
  const lockVault = useCallback(async (password: string) => {
    if (!db || state.status !== "open") return;
    
    try {
      const content = state.content;
      
      // 1. Generate crypto params
      const salt = Crypto.generateSalt();
      const iv = Crypto.generateIV();
      
      // 2. Derive key
      const key = await Crypto.deriveKey(password, salt);
      
      // 3. Encrypt
      const encryptedBuffer = await Crypto.encryptContent(content, key, iv);
      
      // 4. Prepare for storage
      const vaultData: EncryptedVault = {
        ciphertext: Crypto.bufferToBase64(encryptedBuffer),
        iv: Crypto.bufferToBase64(iv),
        salt: Crypto.bufferToBase64(salt),
        lockedAt: Date.now(),
      };
      
      // 5. Transaction: Save locked, Delete draft
      const tx = db.transaction([STORE_LOCKED, STORE_DRAFT], "readwrite");
      await tx.objectStore(STORE_LOCKED).put(vaultData, "vault_data");
      await tx.objectStore(STORE_DRAFT).delete("current");
      await tx.done;
      
      setState({ status: "locked", lockedAt: vaultData.lockedAt });
    } catch (e) {
      console.error("Encryption failed:", e);
      throw new Error("Failed to lock vault. Please try again.");
    }
  }, [db, state]);

  // Unlock the vault (Restore)
  const unlockVault = useCallback(async (password: string) => {
    if (!db || state.status !== "locked") return;

    try {
      const lockedData = await db.get(STORE_LOCKED, "vault_data");
      if (!lockedData) throw new Error("No locked vault found.");
      
      const vault = encryptedVaultSchema.parse(lockedData);
      
      // 1. Reconstruct buffers
      const salt = Crypto.base64ToBuffer(vault.salt);
      const iv = Crypto.base64ToBuffer(vault.iv);
      const ciphertext = Crypto.base64ToBuffer(vault.ciphertext);
      
      // 2. Derive key again
      const key = await Crypto.deriveKey(password, salt);
      
      // 3. Decrypt
      const content = await Crypto.decryptContent(ciphertext, key, iv);
      
      // 4. Transaction: Save draft, Delete locked
      const tx = db.transaction([STORE_LOCKED, STORE_DRAFT], "readwrite");
      await tx.objectStore(STORE_DRAFT).put({ content, lastUpdated: Date.now() }, "current");
      await tx.objectStore(STORE_LOCKED).delete("vault_data");
      await tx.done;
      
      setState({ status: "open", content, lastUpdated: Date.now() });
    } catch (e) {
      console.error("Decryption failed:", e);
      throw new Error("Incorrect password or corrupted data.");
    }
  }, [db, state]);

  // Download encrypted vault
  const downloadVault = useCallback(async () => {
    if (!db) return;
    const lockedData = await db.get(STORE_LOCKED, "vault_data");
    if (!lockedData) return;
    
    const blob = new Blob([JSON.stringify(lockedData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vault-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [db]);

  return {
    state,
    error,
    saveDraft,
    lockVault,
    unlockVault,
    downloadVault
  };
}
