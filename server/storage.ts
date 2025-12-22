
import { db } from "./db";
// No backend storage needed for this local-only app.
// Keeping the interface for compatibility with the template structure.

export interface IStorage {
  // Define any system-level storage methods here if needed later
  getStatus(): Promise<{ status: string }>;
}

export class MemStorage implements IStorage {
  async getStatus(): Promise<{ status: string }> {
    return { status: "operational" };
  }
}

export const storage = new MemStorage();
