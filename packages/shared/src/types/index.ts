/**
 * Shared TypeScript types used across API and web apps.
 * These types are NOT Zod schemas — they represent internal domain models
 * and utility types that don't need runtime validation.
 */

import type {
  AD_FORMATS,
  AD_PLACEMENTS,
  CAMPAIGN_STATUSES,
  ENRICHMENT_TIERS,
  ESP_PROVIDERS,
  LIFECYCLE_STAGES,
  NEGOTIATION_STATUSES,
  PRICING_MODELS,
  PUBLISHER_PLANS,
} from '../constants/index.js';

// --- Utility types ---

export type EspProvider = (typeof ESP_PROVIDERS)[number];
export type PublisherPlan = (typeof PUBLISHER_PLANS)[number];
export type AdPlacement = (typeof AD_PLACEMENTS)[number];
export type AdFormat = (typeof AD_FORMATS)[number];
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export type NegotiationStatus = (typeof NEGOTIATION_STATUSES)[number];
export type PricingModel = (typeof PRICING_MODELS)[number];
export type EnrichmentTier = (typeof ENRICHMENT_TIERS)[number];
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

// --- API response types ---

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiListResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// --- Domain types ---

export interface SubscriberCluster {
  clusterId: string;
  centroid: number[];
  label: string;
  subscriberCount: number;
  avgEngagementScore: number;
  topInterests: string[];
  topRoles: string[];
  newsletters: string[];
  superClusterId: string;
}

export interface AudienceMetadata {
  newsletterId: string;
  totalSubscribers: number;
  activeSubscribers: number;
  audienceProfile: {
    topInterests: Array<{ category: string; weight: number }>;
    roleMix: Record<string, number>;
    geoDistribution: Record<string, number>;
    engagementDistribution: {
      high: number;
      medium: number;
      low: number;
    };
  };
  clusters: Array<{
    clusterId: string;
    label: string;
    size: number;
    avgEngagement: number;
    topInterests: string[];
  }>;
}

export interface MatchResult {
  newsletterId: string;
  newsletterName: string;
  publisherName: string;
  matchScore: number;
  audienceProfile: AudienceMetadata['audienceProfile'];
  matchingClusters: Array<{
    clusterId: string;
    label: string;
    size: number;
    avgEngagement: number;
    relevanceScore: number;
  }>;
  availableSlots: Array<{
    slotId: string;
    placement: AdPlacement;
    format: AdFormat;
    floorCPM: number;
    estimatedImpressions: number;
    estimatedCost: number;
  }>;
  estimatedReach: number;
  estimatedCPM: number;
}
