
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Minimal status endpoint
  app.get(api.status.path, async (req, res) => {
    const status = await storage.getStatus();
    res.json({ ...status, version: "1.0.0" });
  });

  return httpServer;
}
