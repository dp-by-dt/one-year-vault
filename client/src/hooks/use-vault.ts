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
          }
        }

        // Check for draft
        const draftData = await db!.get(STORE_DRAFT, "current");
        let content = "";
        let lastUpdated = Date.now();
        
        if (draftData) {
          try {
            const parsed = vaultContentSchema.parse(draftData);
            content = parsed.content;
            lastUpdated = parsed.lastUpdated;
          } catch (e) {
            console.warn("Draft schema mismatch, resetting content");
            content = "";
            lastUpdated = Date.now();
          }
        }

        // Check if auto-lock date has passed (Jan 1, 2026)
        const lockDate = new Date(2026, 0, 1); // Jan 1, 2026
        const now = new Date();
        
        if (now >= lockDate) {
          // Auto-lock the vault with preset password
          try {
            const salt = Crypto.generateSalt();
            const iv = Crypto.generateIV();
            const key = await Crypto.deriveKey("DPBYDT", salt);
            const encryptedBuffer = await Crypto.encryptContent(content, key, iv);
            
            const vaultData: EncryptedVault = {
              ciphertext: Crypto.bufferToBase64(encryptedBuffer),
              iv: Crypto.bufferToBase64(iv),
              salt: Crypto.bufferToBase64(salt),
              lockedAt: Date.now(),
            };
            
            const tx = db.transaction([STORE_LOCKED, STORE_DRAFT], "readwrite");
            await tx.objectStore(STORE_LOCKED).put(vaultData, "vault_data");
            await tx.objectStore(STORE_DRAFT).delete("current");
            await tx.done;
            
            setState({ status: "locked", lockedAt: vaultData.lockedAt });
          } catch (e) {
            console.error("Auto-lock failed:", e);
            setState({ status: "open", content, lastUpdated });
          }
        } else {
          // Vault still open
          setState({ status: "open", content, lastUpdated });
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

  // Lock the vault (Manual - not used now, but kept for reference)
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

  // Unlock the vault (Restore) - only accepts preset password "DPBYDT"
  const unlockVault = useCallback(async (password: string) => {
    if (!db || state.status !== "locked") return;

    // Validate against preset password
    if (password !== "DPBYDT") {
      throw new Error("Incorrect password. Please try again.");
    }

    try {
      const lockedData = await db.get(STORE_LOCKED, "vault_data");
      if (!lockedData) throw new Error("No locked vault found.");
      
      const vault = encryptedVaultSchema.parse(lockedData);
      
      // 1. Reconstruct buffers
      const salt = Crypto.base64ToBuffer(vault.salt);
      const iv = Crypto.base64ToBuffer(vault.iv);
      const ciphertext = Crypto.base64ToBuffer(vault.ciphertext);
      
      // 2. Derive key with preset password
      const key = await Crypto.deriveKey("DPBYDT", salt);
      
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
