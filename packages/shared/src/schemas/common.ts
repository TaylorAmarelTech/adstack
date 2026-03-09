import { z } from 'zod';

/** Reusable pagination query schema */
const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Standard API success response wrapper */
const apiResponse = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

/** Standard API list response wrapper with pagination */
const apiListResponse = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  });

/** Standard API error response */
const apiError = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

/** UUID string */
const id = z.string().uuid();

/** ISO date string */
const dateString = z.string().datetime();

/** Sort order */
const sortOrder = z.enum(['asc', 'desc']).default('desc');

export const commonSchemas = {
  paginationQuery,
  apiResponse,
  apiListResponse,
  apiError,
  id,
  dateString,
  sortOrder,
};
