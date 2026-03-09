import { z } from 'zod';
import { AD_FORMATS, AD_PLACEMENTS, ESP_PROVIDERS } from '../constants/index.js';

const createNewsletter = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  websiteUrl: z.string().url().optional(),
  primaryCategory: z.string().min(1),
  subcategories: z.array(z.string()).max(10).optional(),
  espProvider: z.enum(ESP_PROVIDERS),
  espApiKey: z.string().min(1),
  espPublicationId: z.string().optional(),
  espListId: z.string().optional(),
});

const updateNewsletter = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  websiteUrl: z.string().url().optional(),
  primaryCategory: z.string().optional(),
  subcategories: z.array(z.string()).max(10).optional(),
});

const createAdSlot = z.object({
  placement: z.enum(AD_PLACEMENTS),
  format: z.enum(AD_FORMATS),
  maxFrequency: z.enum(['every_issue', 'weekly', 'biweekly', 'monthly']),
  floorCPM: z.number().min(1).max(500),
  preferredCategories: z.array(z.string()).optional(),
  excludedCategories: z.array(z.string()).optional(),
  requiresApproval: z.boolean().default(true),
});

const updateAdSlot = z.object({
  placement: z.enum(AD_PLACEMENTS).optional(),
  format: z.enum(AD_FORMATS).optional(),
  maxFrequency: z.enum(['every_issue', 'weekly', 'biweekly', 'monthly']).optional(),
  floorCPM: z.number().min(1).max(500).optional(),
  preferredCategories: z.array(z.string()).optional(),
  excludedCategories: z.array(z.string()).optional(),
  requiresApproval: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const adSlotResponse = z.object({
  id: z.string().uuid(),
  newsletterId: z.string().uuid(),
  placement: z.enum(AD_PLACEMENTS),
  format: z.enum(AD_FORMATS),
  maxFrequency: z.enum(['every_issue', 'weekly', 'biweekly', 'monthly']),
  floorCPM: z.number(),
  preferredCategories: z.array(z.string()),
  excludedCategories: z.array(z.string()),
  requiresApproval: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
});

const newsletterResponse = z.object({
  id: z.string().uuid(),
  publisherId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  primaryCategory: z.string(),
  subcategories: z.array(z.string()),
  espProvider: z.enum(ESP_PROVIDERS),
  metrics: z.object({
    subscriberCount: z.number(),
    activeSubscribers: z.number(),
    avgOpenRate: z.number(),
    avgClickRate: z.number(),
  }),
  status: z.enum(['active', 'paused', 'pending_verification', 'suspended']),
  createdAt: z.string().datetime(),
});

export const newsletterSchemas = {
  createNewsletter,
  updateNewsletter,
  createAdSlot,
  updateAdSlot,
  adSlotResponse,
  newsletterResponse,
};

export type CreateNewsletter = z.infer<typeof createNewsletter>;
export type UpdateNewsletter = z.infer<typeof updateNewsletter>;
export type CreateAdSlot = z.infer<typeof createAdSlot>;
export type UpdateAdSlot = z.infer<typeof updateAdSlot>;
export type AdSlotResponse = z.infer<typeof adSlotResponse>;
export type NewsletterResponse = z.infer<typeof newsletterResponse>;
