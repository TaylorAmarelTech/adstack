import { z } from 'zod';
import { AD_FORMATS, CAMPAIGN_STATUSES, PRICING_MODELS } from '../constants/index.js';

const createCampaign = z.object({
  name: z.string().min(1).max(200),
  totalBudget: z.number().min(50),
  dailyBudgetCap: z.number().min(5),
  pricingModel: z.enum(PRICING_MODELS),
  maxCPM: z.number().min(1).max(500).optional(),
  maxCPC: z.number().min(0.1).max(50).optional(),
  targeting: z.object({
    audienceDescription: z.string().min(10).max(1000),
    categories: z.array(z.string()).optional(),
    geoTargeting: z.array(z.string()).optional(),
    minEngagementScore: z.number().min(0).max(1).optional(),
    minSubscriberCount: z.number().int().min(0).optional(),
    excludeNewsletters: z.array(z.string().uuid()).optional(),
  }),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  preferredDays: z.array(z.number().int().min(0).max(6)).optional(),
});

const updateCampaign = z.object({
  name: z.string().min(1).max(200).optional(),
  totalBudget: z.number().min(50).optional(),
  dailyBudgetCap: z.number().min(5).optional(),
  status: z.enum(CAMPAIGN_STATUSES).optional(),
  maxCPM: z.number().min(1).max(500).optional(),
  maxCPC: z.number().min(0.1).max(50).optional(),
  endDate: z.string().datetime().optional(),
});

const createCreative = z.object({
  format: z.enum(AD_FORMATS),
  headline: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  ctaText: z.string().min(1).max(50),
  ctaUrl: z.string().url(),
  imageUrl: z.string().url().optional(),
});

const matchingQuery = z.object({
  audienceDescription: z.string().min(10).max(1000),
  filters: z
    .object({
      categories: z.array(z.string()).optional(),
      geoTargeting: z.array(z.string()).optional(),
      minEngagementScore: z.number().min(0).max(1).optional(),
      minSubscriberCount: z.number().int().min(0).optional(),
    })
    .optional(),
  maxResults: z.number().int().min(1).max(100).default(20),
  pricingModel: z.enum(PRICING_MODELS).optional(),
  maxCPM: z.number().optional(),
});

const campaignResponse = z.object({
  id: z.string().uuid(),
  advertiserId: z.string().uuid(),
  name: z.string(),
  status: z.enum(CAMPAIGN_STATUSES),
  totalBudget: z.number(),
  spentToDate: z.number(),
  pricingModel: z.enum(PRICING_MODELS),
  performance: z.object({
    totalImpressions: z.number(),
    totalClicks: z.number(),
    totalSpend: z.number(),
    avgCTR: z.number(),
    placementCount: z.number(),
  }),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const campaignSchemas = {
  createCampaign,
  updateCampaign,
  createCreative,
  matchingQuery,
  campaignResponse,
};

export type CreateCampaign = z.infer<typeof createCampaign>;
export type UpdateCampaign = z.infer<typeof updateCampaign>;
export type CreateCreative = z.infer<typeof createCreative>;
export type MatchingQuery = z.infer<typeof matchingQuery>;
export type CampaignResponse = z.infer<typeof campaignResponse>;
