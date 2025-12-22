
import { z } from 'zod';

// ============================================
// API CONTRACT
// Since this is an offline-first local app, there are NO data saving endpoints.
// We only keep a minimal health check or status endpoint.
// ============================================

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  // Minimal system endpoints
  status: {
    method: 'GET' as const,
    path: '/api/status',
    responses: {
      200: z.object({ status: z.string(), version: z.string() }),
    },
  },
};

// ============================================
// REQUIRED: buildUrl helper
// ============================================
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
