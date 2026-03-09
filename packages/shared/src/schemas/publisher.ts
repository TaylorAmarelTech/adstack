import { z } from 'zod';
import { PUBLISHER_PLANS } from '../constants/index.js';

const createPublisher = z.object({
  name: z.string().min(1).max(100),
  companyName: z.string().max(200).optional(),
});

const updatePublisher = z.object({
  name: z.string().min(1).max(100).optional(),
  companyName: z.string().max(200).optional(),
  avatarUrl: z.string().url().optional(),
  settings: z
    .object({
      autoApproveAds: z.boolean().optional(),
      autoApproveCategories: z.array(z.string()).optional(),
      agentMode: z.enum(['manual', 'semi_auto', 'full_auto']).optional(),
    })
    .optional(),
});

const publisherResponse = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  companyName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  plan: z.enum(PUBLISHER_PLANS),
  createdAt: z.string().datetime(),
});

export const publisherSchemas = {
  createPublisher,
  updatePublisher,
  publisherResponse,
};

export type CreatePublisher = z.infer<typeof createPublisher>;
export type UpdatePublisher = z.infer<typeof updatePublisher>;
export type PublisherResponse = z.infer<typeof publisherResponse>;
