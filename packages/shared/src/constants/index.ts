/** Application-wide constants */

export const APP_NAME = 'AdStack';

/** API versioning */
export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

/** Pagination defaults */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Engagement score thresholds */
export const ENGAGEMENT = {
  HIGH: 0.7,
  MEDIUM: 0.3,
  LOW: 0,
} as const;

/** Subscriber lifecycle stages */
export const LIFECYCLE_STAGES = [
  'new',
  'active',
  'at_risk',
  'dormant',
  'churned',
] as const;

/** Supported ESP providers */
export const ESP_PROVIDERS = [
  'beehiiv',
  'convertkit',
  'mailchimp',
  'substack',
  'other',
] as const;

/** Ad placement types */
export const AD_PLACEMENTS = [
  'top_banner',
  'mid_content',
  'bottom',
  'dedicated',
  'classified',
] as const;

/** Ad creative formats */
export const AD_FORMATS = [
  'text_link',
  'text_block',
  'image_text',
  'native_mention',
  'sponsored_section',
] as const;

/** Campaign statuses */
export const CAMPAIGN_STATUSES = [
  'draft',
  'active',
  'paused',
  'completed',
  'cancelled',
] as const;

/** Negotiation statuses */
export const NEGOTIATION_STATUSES = [
  'initiated',
  'counter_offered',
  'accepted',
  'rejected',
  'expired',
  'withdrawn',
] as const;

/** Pricing models */
export const PRICING_MODELS = ['cpm', 'cpc', 'hybrid'] as const;

/** Publisher subscription tiers */
export const PUBLISHER_PLANS = ['free', 'pro', 'enterprise'] as const;

/** Enrichment tiers */
export const ENRICHMENT_TIERS = [1, 2, 3] as const;

/** Embedding dimensions (using OpenAI text-embedding-3-small reduced to 768) */
export const EMBEDDING_DIMENSIONS = 768;

/** K-anonymity threshold for ad targeting */
export const K_ANONYMITY_THRESHOLD = 50;

/** Maximum negotiation rounds */
export const MAX_NEGOTIATION_ROUNDS = 3;

/** CPM bounds (prevents erroneous values) */
export const CPM_BOUNDS = {
  MIN: 1,
  MAX: 500,
} as const;

/** Minimum campaign spend in USD */
export const MIN_CAMPAIGN_SPEND = 50;

/** Platform transaction fee rates by publisher plan */
export const TRANSACTION_FEE_RATES = {
  free: 0.15,
  pro: 0.12,
  enterprise: 0.10,
} as const;
