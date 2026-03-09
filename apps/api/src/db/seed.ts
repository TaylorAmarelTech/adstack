import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { hash } from 'argon2';
import * as schema from './schema/index.js';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://adstack:adstack_dev@localhost:5433/adstack_dev';

async function main() {
  console.log('Seeding database...');

  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    max: 1,
  });

  const db = drizzle(pool, { schema });

  // Hash the default password for all users
  const passwordHash = await hash('password123');

  // ── Publishers ──────────────────────────────────────────────
  const [publisher1, _publisher2] = await db
    .insert(schema.publishers)
    .values([
      {
        email: 'alex@techweekly.io',
        name: 'Alex Chen',
        companyName: 'TechWeekly Media',
        passwordHash,
        plan: 'pro',
        settings: {
          autoApproveAds: false,
          autoApproveCategories: ['technology', 'saas'],
          agentMode: 'semi_auto',
          notificationPreferences: {
            email: true,
            webhook: false,
            webhookUrl: null,
          },
        },
      },
      {
        email: 'sarah@creativepulse.co',
        name: 'Sarah Martinez',
        companyName: 'Creative Pulse Publishing',
        passwordHash,
        plan: 'free',
        settings: {
          autoApproveAds: false,
          autoApproveCategories: [],
          agentMode: 'manual',
          notificationPreferences: {
            email: true,
            webhook: false,
            webhookUrl: null,
          },
        },
      },
    ])
    .returning();

  console.log(`  Created ${2} publishers`);
  const pub1 = publisher1!;

  // ── Advertisers ─────────────────────────────────────────────
  const [advertiser1, _advertiser2] = await db
    .insert(schema.advertisers)
    .values([
      {
        email: 'mike@cloudtools.dev',
        name: 'Mike Johnson',
        companyName: 'CloudTools Inc.',
        websiteUrl: 'https://cloudtools.dev',
        passwordHash,
        settings: {
          agentEnabled: true,
          agentConfig: {
            maxCPM: 45,
            maxDailySpend: 200,
            autoApproveBelow: 25,
            targetCategories: ['technology', 'devtools', 'cloud'],
            excludeCategories: ['gambling', 'crypto'],
          },
          notificationPreferences: {
            email: true,
            webhook: false,
            webhookUrl: null,
          },
        },
      },
      {
        email: 'lisa@designhq.com',
        name: 'Lisa Park',
        companyName: 'DesignHQ',
        websiteUrl: 'https://designhq.com',
        passwordHash,
        settings: {
          agentEnabled: false,
          agentConfig: {
            maxCPM: 30,
            maxDailySpend: 100,
            autoApproveBelow: 15,
            targetCategories: ['design', 'creative', 'marketing'],
            excludeCategories: [],
          },
          notificationPreferences: {
            email: true,
            webhook: false,
            webhookUrl: null,
          },
        },
      },
    ])
    .returning();

  console.log(`  Created ${2} advertisers`);
  const adv1 = advertiser1!;

  // ── Newsletters (3 for publisher1) ──────────────────────────
  const [newsletter1, newsletter2, newsletter3] = await db
    .insert(schema.newsletters)
    .values([
      {
        publisherId: pub1.id,
        name: 'TechWeekly',
        description:
          'A weekly roundup of the most important technology news, trends, and analysis for developers and tech leaders.',
        websiteUrl: 'https://techweekly.io',
        primaryCategory: 'technology',
        subcategories: ['programming', 'devops', 'cloud'],
        espProvider: 'beehiiv',
        espConfig: {
          apiKey: 'enc_fake_beehiiv_key_001',
          publicationId: 'pub_techweekly',
          listId: null,
          webhookSecret: 'whsec_fake_001',
          lastSyncAt: null,
          syncStatus: 'active',
          syncError: null,
        },
        subscriberCount: 45_200,
        activeSubscribers: 38_900,
        avgOpenRate: 0.42,
        avgClickRate: 0.08,
        sendFrequency: 'weekly',
        status: 'active',
        verifiedAt: new Date('2025-06-15T10:00:00Z'),
      },
      {
        publisherId: pub1.id,
        name: 'AI Insider',
        description:
          'Deep dives into artificial intelligence, machine learning, and the future of AI in business. Written for practitioners and decision-makers.',
        websiteUrl: 'https://aiinsider.io',
        primaryCategory: 'artificial_intelligence',
        subcategories: ['machine_learning', 'llm', 'data_science'],
        espProvider: 'beehiiv',
        espConfig: {
          apiKey: 'enc_fake_beehiiv_key_002',
          publicationId: 'pub_aiinsider',
          listId: null,
          webhookSecret: 'whsec_fake_002',
          lastSyncAt: null,
          syncStatus: 'active',
          syncError: null,
        },
        subscriberCount: 28_700,
        activeSubscribers: 24_100,
        avgOpenRate: 0.51,
        avgClickRate: 0.11,
        sendFrequency: 'biweekly',
        status: 'active',
        verifiedAt: new Date('2025-08-01T14:30:00Z'),
      },
      {
        publisherId: pub1.id,
        name: 'Startup Grind Daily',
        description:
          'Daily briefing for founders and startup operators. Funding rounds, product launches, and tactical advice.',
        websiteUrl: 'https://startupgrinddaily.com',
        primaryCategory: 'startups',
        subcategories: ['venture_capital', 'saas', 'growth'],
        espProvider: 'convertkit',
        espConfig: {
          apiKey: 'enc_fake_ck_key_001',
          publicationId: null,
          listId: 'list_sgd_main',
          webhookSecret: 'whsec_fake_003',
          lastSyncAt: null,
          syncStatus: 'active',
          syncError: null,
        },
        subscriberCount: 15_400,
        activeSubscribers: 12_200,
        avgOpenRate: 0.38,
        avgClickRate: 0.065,
        sendFrequency: 'daily',
        status: 'active',
        verifiedAt: new Date('2025-09-10T09:00:00Z'),
      },
    ])
    .returning();

  console.log(`  Created ${3} newsletters`);
  const nl1 = newsletter1!;
  const nl2 = newsletter2!;
  const nl3 = newsletter3!;

  // ── Ad Slots (2 per newsletter) ─────────────────────────────
  const adSlotValues = [
    // TechWeekly slots
    {
      newsletterId: nl1.id,
      placement: 'top_banner' as const,
      format: 'image_text' as const,
      maxFrequency: 'every_issue' as const,
      floorCPM: 35,
      preferredCategories: ['technology', 'saas', 'devtools'],
      excludedCategories: ['gambling', 'adult'],
      requiresApproval: true,
      isActive: true,
    },
    {
      newsletterId: nl1.id,
      placement: 'mid_content' as const,
      format: 'native_mention' as const,
      maxFrequency: 'every_issue' as const,
      floorCPM: 25,
      preferredCategories: ['technology', 'cloud'],
      excludedCategories: ['gambling', 'adult'],
      requiresApproval: false,
      isActive: true,
    },
    // AI Insider slots
    {
      newsletterId: nl2.id,
      placement: 'top_banner' as const,
      format: 'image_text' as const,
      maxFrequency: 'every_issue' as const,
      floorCPM: 50,
      preferredCategories: ['artificial_intelligence', 'machine_learning', 'saas'],
      excludedCategories: ['gambling'],
      requiresApproval: true,
      isActive: true,
    },
    {
      newsletterId: nl2.id,
      placement: 'bottom' as const,
      format: 'text_block' as const,
      maxFrequency: 'weekly' as const,
      floorCPM: 20,
      preferredCategories: ['technology', 'data_science'],
      excludedCategories: [],
      requiresApproval: true,
      isActive: true,
    },
    // Startup Grind Daily slots
    {
      newsletterId: nl3.id,
      placement: 'top_banner' as const,
      format: 'text_block' as const,
      maxFrequency: 'every_issue' as const,
      floorCPM: 30,
      preferredCategories: ['startups', 'saas', 'venture_capital'],
      excludedCategories: ['adult'],
      requiresApproval: true,
      isActive: true,
    },
    {
      newsletterId: nl3.id,
      placement: 'mid_content' as const,
      format: 'native_mention' as const,
      maxFrequency: 'every_issue' as const,
      floorCPM: 22,
      preferredCategories: ['startups', 'growth'],
      excludedCategories: [],
      requiresApproval: false,
      isActive: true,
    },
  ];

  await db.insert(schema.adSlots).values(adSlotValues);
  console.log(`  Created ${adSlotValues.length} ad slots`);

  // ── Campaigns (2 for advertiser1) ───────────────────────────
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysLater = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const [campaign1, campaign2] = await db
    .insert(schema.campaigns)
    .values([
      {
        advertiserId: adv1.id,
        name: 'CloudTools Spring Launch',
        status: 'active',
        totalBudget: 5000,
        dailyBudgetCap: 200,
        spentToDate: 0,
        pricingModel: 'cpm',
        maxCPM: 45,
        targeting: {
          audienceDescription:
            'Software developers and DevOps engineers interested in cloud infrastructure and developer tools',
          audienceEmbeddingId: null,
          categories: ['technology', 'devtools', 'cloud'],
          geoTargeting: ['US', 'CA', 'GB'],
          minEngagementScore: 0.3,
          minSubscriberCount: 5000,
          excludeNewsletters: [],
          targetClusterIds: [],
        },
        startDate: now,
        endDate: thirtyDaysLater,
        preferredDays: [1, 2, 3, 4, 5], // Weekdays
      },
      {
        advertiserId: adv1.id,
        name: 'CloudTools AI Integration Promo',
        status: 'draft',
        totalBudget: 3000,
        dailyBudgetCap: 150,
        spentToDate: 0,
        pricingModel: 'hybrid',
        maxCPM: 40,
        maxCPC: 2.5,
        targeting: {
          audienceDescription:
            'AI/ML engineers and data scientists using cloud platforms for model training and deployment',
          audienceEmbeddingId: null,
          categories: ['artificial_intelligence', 'machine_learning', 'cloud'],
          geoTargeting: ['US'],
          minEngagementScore: 0.4,
          minSubscriberCount: 10000,
          excludeNewsletters: [],
          targetClusterIds: [],
        },
        startDate: thirtyDaysLater,
        endDate: sixtyDaysLater,
        preferredDays: [2, 3, 4], // Tue-Thu
      },
    ])
    .returning();

  console.log(`  Created ${2} campaigns`);
  const cmp1 = campaign1!;
  const cmp2 = campaign2!;

  // ── Creatives (2 per campaign) ──────────────────────────────
  const creativeValues = [
    // Campaign 1 creatives
    {
      campaignId: cmp1.id,
      format: 'image_text' as const,
      headline: 'Ship 10x Faster with CloudTools',
      body: 'CloudTools is the all-in-one platform for modern development teams. Deploy, monitor, and scale your applications with zero config. Trusted by 5,000+ teams worldwide.',
      ctaText: 'Start Free Trial',
      ctaUrl: 'https://cloudtools.dev/signup?ref=adstack-tw',
      imageUrl: 'https://cdn.cloudtools.dev/ads/hero-dashboard.png',
      moderationStatus: 'approved' as const,
      isActive: true,
    },
    {
      campaignId: cmp1.id,
      format: 'native_mention' as const,
      headline: 'Why Top Teams Choose CloudTools',
      body: "We've been using CloudTools for 6 months and our deployment time dropped from 45 minutes to under 3. Here's how the CloudTools CLI changed our workflow.",
      ctaText: 'Learn More',
      ctaUrl: 'https://cloudtools.dev/case-studies?ref=adstack-tw',
      moderationStatus: 'approved' as const,
      isActive: true,
    },
    // Campaign 2 creatives
    {
      campaignId: cmp2.id,
      format: 'image_text' as const,
      headline: 'AI Model Deployment Made Simple',
      body: 'CloudTools AI now supports one-click deployment for PyTorch, TensorFlow, and Hugging Face models. Auto-scaling GPU instances with pay-per-inference pricing.',
      ctaText: 'Try CloudTools AI',
      ctaUrl: 'https://cloudtools.dev/ai?ref=adstack-ai',
      imageUrl: 'https://cdn.cloudtools.dev/ads/ai-deploy.png',
      moderationStatus: 'pending' as const,
      isActive: true,
    },
    {
      campaignId: cmp2.id,
      format: 'text_block' as const,
      headline: 'From Notebook to Production in Minutes',
      body: 'Stop wrestling with MLOps. CloudTools AI turns your Jupyter notebooks into production-ready APIs with built-in monitoring, A/B testing, and automatic model versioning.',
      ctaText: 'See How It Works',
      ctaUrl: 'https://cloudtools.dev/ai/demo?ref=adstack-ai',
      moderationStatus: 'pending' as const,
      isActive: true,
    },
  ];

  await db.insert(schema.creatives).values(creativeValues);
  console.log(`  Created ${creativeValues.length} creatives`);

  // ── Done ────────────────────────────────────────────────────
  console.log('\nSeed completed successfully!');
  console.log('\nTest credentials:');
  console.log('  Publishers:');
  console.log('    alex@techweekly.io / password123');
  console.log('    sarah@creativepulse.co / password123');
  console.log('  Advertisers:');
  console.log('    mike@cloudtools.dev / password123');
  console.log('    lisa@designhq.com / password123');

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
