CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."placement_status" AS ENUM('scheduled', 'placed', 'delivered', 'verified', 'disputed', 'settled');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('pending', 'processing', 'completed', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."ad_frequency" AS ENUM('every_issue', 'weekly', 'biweekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."ad_placement_type" AS ENUM('top_banner', 'mid_content', 'bottom', 'dedicated', 'classified');--> statement-breakpoint
CREATE TYPE "public"."ad_slot_format" AS ENUM('text_link', 'text_block', 'image_text', 'native_mention', 'sponsored_section');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'active', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."pricing_model" AS ENUM('cpm', 'cpc', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."consent_action" AS ENUM('grant', 'revoke');--> statement-breakpoint
CREATE TYPE "public"."ad_format" AS ENUM('text_link', 'text_block', 'image_text', 'native_mention', 'sponsored_section');--> statement-breakpoint
CREATE TYPE "public"."moderation_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."negotiation_status" AS ENUM('initiated', 'counter_offered', 'accepted', 'rejected', 'expired', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."esp_provider" AS ENUM('beehiiv', 'convertkit', 'mailchimp', 'substack', 'other');--> statement-breakpoint
CREATE TYPE "public"."newsletter_status" AS ENUM('active', 'paused', 'pending_verification', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."agent_mode" AS ENUM('manual', 'semi_auto', 'full_auto');--> statement-breakpoint
CREATE TYPE "public"."publisher_plan" AS ENUM('free', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."lifecycle_stage" AS ENUM('new', 'active', 'at_risk', 'dormant', 'churned');--> statement-breakpoint
CREATE TYPE "public"."subscriber_status" AS ENUM('active', 'unsubscribed', 'bounced', 'complained');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'processing', 'completed', 'refunded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('ad_placement', 'enrichment_fee', 'subscription', 'refund');--> statement-breakpoint
CREATE TABLE "ad_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"newsletter_id" uuid NOT NULL,
	"ad_slot_id" uuid NOT NULL,
	"creative_id" uuid NOT NULL,
	"negotiation_id" uuid,
	"agreed_cpm" real NOT NULL,
	"agreed_cpc" real,
	"placement_date" timestamp with time zone NOT NULL,
	"target_cluster_ids" jsonb DEFAULT '[]'::jsonb,
	"status" "placement_status" DEFAULT 'scheduled' NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"unique_clicks" integer DEFAULT 0 NOT NULL,
	"ctr" real DEFAULT 0 NOT NULL,
	"cost" real DEFAULT 0 NOT NULL,
	"clicks_by_cluster" jsonb DEFAULT '{}'::jsonb,
	"publisher_payout" real,
	"platform_fee" real,
	"stripe_transfer_id" varchar(255),
	"settlement_status" "settlement_status" DEFAULT 'pending',
	"settled_at" timestamp with time zone,
	"placed_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"newsletter_id" uuid NOT NULL,
	"placement" "ad_placement_type" NOT NULL,
	"format" "ad_slot_format" NOT NULL,
	"max_frequency" "ad_frequency" DEFAULT 'every_issue' NOT NULL,
	"floor_cpm" real NOT NULL,
	"preferred_categories" jsonb DEFAULT '[]'::jsonb,
	"excluded_categories" jsonb DEFAULT '[]'::jsonb,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advertisers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(100) NOT NULL,
	"company_name" varchar(200) NOT NULL,
	"website_url" text,
	"logo_url" text,
	"password_hash" varchar(255) NOT NULL,
	"stripe_customer_id" varchar(255),
	"billing_email" varchar(255),
	"settings" jsonb DEFAULT '{"agentEnabled":false,"agentConfig":{"maxCPM":50,"maxDailySpend":100,"autoApproveBelow":20,"targetCategories":[],"excludeCategories":[]},"notificationPreferences":{"email":true,"webhook":false,"webhookUrl":null}}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advertisers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"advertiser_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"total_budget" real NOT NULL,
	"daily_budget_cap" real NOT NULL,
	"spent_to_date" real DEFAULT 0 NOT NULL,
	"pricing_model" "pricing_model" NOT NULL,
	"max_cpm" real,
	"max_cpc" real,
	"targeting" jsonb NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"preferred_days" jsonb DEFAULT '[]'::jsonb,
	"total_impressions" integer DEFAULT 0 NOT NULL,
	"total_clicks" integer DEFAULT 0 NOT NULL,
	"avg_ctr" real DEFAULT 0 NOT NULL,
	"placement_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriber_clusters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"newsletter_id" uuid NOT NULL,
	"super_cluster_id" uuid,
	"centroid" vector(768) NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"subscriber_count" integer DEFAULT 0 NOT NULL,
	"avg_engagement_score" real DEFAULT 0 NOT NULL,
	"top_interests" jsonb DEFAULT '[]'::jsonb,
	"top_roles" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscriber_id" uuid NOT NULL,
	"action" "consent_action" NOT NULL,
	"tier" smallint NOT NULL,
	"ip" varchar(45) NOT NULL,
	"consent_version" varchar(20) NOT NULL,
	"consent_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"format" "ad_format" NOT NULL,
	"headline" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"cta_text" varchar(50) NOT NULL,
	"cta_url" text NOT NULL,
	"image_url" text,
	"variants" jsonb DEFAULT '[]'::jsonb,
	"moderation_status" "moderation_status" DEFAULT 'pending' NOT NULL,
	"moderation_notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriber_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscriber_id" uuid NOT NULL,
	"newsletter_id" uuid NOT NULL,
	"embedding" vector(768) NOT NULL,
	"text_description" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"model_id" text DEFAULT 'text-embedding-3-small' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriber_embeddings_subscriber_id_unique" UNIQUE("subscriber_id")
);
--> statement-breakpoint
CREATE TABLE "negotiations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"newsletter_id" uuid NOT NULL,
	"ad_slot_id" uuid NOT NULL,
	"buyer_agent_id" uuid NOT NULL,
	"publisher_agent_id" uuid NOT NULL,
	"status" "negotiation_status" DEFAULT 'initiated' NOT NULL,
	"round" smallint DEFAULT 1 NOT NULL,
	"offers" jsonb DEFAULT '[]'::jsonb,
	"agreed_terms" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publisher_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"website_url" text,
	"logo_url" text,
	"primary_category" varchar(100) NOT NULL,
	"subcategories" jsonb DEFAULT '[]'::jsonb,
	"esp_provider" "esp_provider" NOT NULL,
	"esp_config" jsonb NOT NULL,
	"subscriber_count" integer DEFAULT 0 NOT NULL,
	"active_subscribers" integer DEFAULT 0 NOT NULL,
	"avg_open_rate" real DEFAULT 0 NOT NULL,
	"avg_click_rate" real DEFAULT 0 NOT NULL,
	"send_frequency" varchar(20),
	"last_send_at" timestamp with time zone,
	"status" "newsletter_status" DEFAULT 'pending_verification' NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publishers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(100) NOT NULL,
	"company_name" varchar(200),
	"avatar_url" text,
	"password_hash" varchar(255) NOT NULL,
	"plan" "publisher_plan" DEFAULT 'free' NOT NULL,
	"plan_expires_at" timestamp with time zone,
	"stripe_connect_account_id" varchar(255),
	"settings" jsonb DEFAULT '{"autoApproveAds":false,"autoApproveCategories":[],"agentMode":"manual","notificationPreferences":{"email":true,"webhook":false,"webhookUrl":null}}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publishers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_hash" varchar(64) NOT NULL,
	"newsletter_id" uuid NOT NULL,
	"publisher_id" uuid NOT NULL,
	"esp_subscriber_id" varchar(255),
	"email" text NOT NULL,
	"subscribed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" varchar(255),
	"medium" varchar(100),
	"campaign" varchar(255),
	"tags" jsonb DEFAULT '[]'::jsonb,
	"status" "subscriber_status" DEFAULT 'active' NOT NULL,
	"open_rate_30d" real DEFAULT 0 NOT NULL,
	"open_rate_90d" real DEFAULT 0 NOT NULL,
	"click_rate_30d" real DEFAULT 0 NOT NULL,
	"click_rate_90d" real DEFAULT 0 NOT NULL,
	"last_open_at" timestamp with time zone,
	"last_click_at" timestamp with time zone,
	"total_opens" integer DEFAULT 0 NOT NULL,
	"total_clicks" integer DEFAULT 0 NOT NULL,
	"engagement_score" real DEFAULT 0 NOT NULL,
	"preferred_open_hour" smallint,
	"primary_device" varchar(20),
	"email_client" varchar(50),
	"lifecycle_stage" "lifecycle_stage" DEFAULT 'new' NOT NULL,
	"country" varchar(2),
	"region" varchar(100),
	"timezone" varchar(50),
	"profile_data" jsonb,
	"ai_enrichment" jsonb,
	"embedding_id" uuid,
	"embedding_version" integer DEFAULT 0 NOT NULL,
	"embedding_updated_at" timestamp with time zone,
	"cluster_id" uuid,
	"enrichment_tier" smallint DEFAULT 1 NOT NULL,
	"profile_completeness" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "transaction_type" NOT NULL,
	"payer_id" uuid NOT NULL,
	"payee_id" uuid,
	"gross_amount" real NOT NULL,
	"platform_fee" real NOT NULL,
	"stripe_fee" real DEFAULT 0 NOT NULL,
	"net_amount" real NOT NULL,
	"currency" varchar(3) DEFAULT 'usd' NOT NULL,
	"stripe_payment_intent_id" varchar(255),
	"stripe_transfer_id" varchar(255),
	"reference_type" varchar(50) NOT NULL,
	"reference_id" uuid NOT NULL,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ad_placements" ADD CONSTRAINT "ad_placements_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_placements" ADD CONSTRAINT "ad_placements_newsletter_id_newsletters_id_fk" FOREIGN KEY ("newsletter_id") REFERENCES "public"."newsletters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_slots" ADD CONSTRAINT "ad_slots_newsletter_id_newsletters_id_fk" FOREIGN KEY ("newsletter_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_advertiser_id_advertisers_id_fk" FOREIGN KEY ("advertiser_id") REFERENCES "public"."advertisers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_newsletter_id_newsletters_id_fk" FOREIGN KEY ("newsletter_id") REFERENCES "public"."newsletters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletters" ADD CONSTRAINT "newsletters_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_newsletter_id_newsletters_id_fk" FOREIGN KEY ("newsletter_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consent_log_subscriber_idx" ON "consent_log" USING btree ("subscriber_id");--> statement-breakpoint
CREATE INDEX "embeddings_newsletter_idx" ON "subscriber_embeddings" USING btree ("newsletter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_email_newsletter_idx" ON "subscribers" USING btree ("email_hash","newsletter_id");--> statement-breakpoint
CREATE INDEX "subscribers_publisher_idx" ON "subscribers" USING btree ("publisher_id");--> statement-breakpoint
CREATE INDEX "subscribers_cluster_idx" ON "subscribers" USING btree ("cluster_id");--> statement-breakpoint
CREATE INDEX "subscribers_enrichment_tier_idx" ON "subscribers" USING btree ("enrichment_tier");--> statement-breakpoint
CREATE INDEX "subscribers_engagement_score_idx" ON "subscribers" USING btree ("engagement_score");--> statement-breakpoint
CREATE INDEX "embeddings_hnsw_idx" ON "subscriber_embeddings" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);