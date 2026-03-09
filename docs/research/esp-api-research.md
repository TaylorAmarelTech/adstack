# ESP API Research for Newsletter Ad Marketplace

> Research conducted March 2026. All information verified against current API documentation and developer experiences.

---

## 1. Beehiiv API (Primary Integration)

### API Version & Base URL

- **Current version**: v2
- **Base URL**: `https://api.beehiiv.com/v2`
- **Documentation**: https://developers.beehiiv.com

### Authentication

- **Method**: Bearer token (API key)
- **Header**: `Authorization: Bearer <API_KEY>`
- **Key creation**: Settings > API (under Workspace Settings). Copy the key immediately -- it cannot be retrieved after leaving the page.

### Plan Requirements

| Feature | Plan Required |
|---------|--------------|
| API access (read/write subscribers) | All paid plans (Scale and above recommended) |
| Webhooks | **Scale plan and above** ($49/mo, or $43/mo annual) |
| Create Post (beta) | Enterprise only |
| Custom fields | All plans with API access |

- **Scale plan**: starts at $49/mo, up to 100k subscribers
- **Max plan**: starts at $109/mo, includes white-labeling
- The free Launch plan may have API access but with limitations

### Key Endpoints

#### List Subscriptions
```
GET /v2/publications/{publicationId}/subscriptions
```
- **Pagination**: Cursor-based (recommended) or offset-based (deprecated, max 100 pages)
- **Limit**: 1-100 results per page (default 10)
- **Expand parameters**: `stats`, `custom_fields`, `subscription_premium_tiers`, `referrals`

#### Get Subscription by Email
```
GET /v2/publications/{publicationId}/subscriptions/by_email/{email}
```

#### Get Subscription by ID
```
GET /v2/publications/{publicationId}/subscriptions/{subscriptionId}
```

#### Create Subscription
```
POST /v2/publications/{publicationId}/subscriptions
```
Body:
```json
{
  "email": "subscriber@example.com",
  "reactivate_existing": false,
  "send_welcome_email": false,
  "utm_source": "ad_marketplace",
  "custom_fields": [
    { "name": "existing_field_name", "value": "field_value" }
  ]
}
```
Note: Custom fields must already exist on the publication. New field names are silently discarded.

#### Update Subscription
```
PUT /v2/publications/{publicationId}/subscriptions/{subscriptionId}
```

#### List Posts
```
GET /v2/publications/{publicationId}/posts
```

#### Get Aggregate Post Stats
```
GET /v2/publications/{publicationId}/posts/aggregate_stats
```
Query params: `audience` (free/premium/all), `platform` (web/email/both/all), `status`, `content_tags`

#### Custom Fields
```
GET /v2/publications/{publicationId}/custom_fields
GET /v2/publications/{publicationId}/custom_fields/{customFieldId}
```

#### Segments
```
GET /v2/publications/{publicationId}/segments
```

### Per-Subscriber Engagement Data

**Yes, available via the `expand=stats` parameter.** When you include `expand[]=stats` in your subscription queries, the response includes per-subscriber statistics:
- Total emails delivered
- Total emails opened
- Open rate
- Click rate (using "Verified Clicks" -- confirmed as genuine, not bot clicks)

This is critical for the ad marketplace -- you can get per-subscriber engagement quality metrics.

### Webhooks

**Requires Scale plan or above.**

Available events:
- `post.sent`
- `subscription.created`
- `subscription.confirmed`
- `subscription.deleted`
- `subscription.tier.created`
- `subscription.tier.deleted`
- `subscription.upgraded`
- `subscription.downgraded`
- `survey_response.submitted`

Create webhook via API:
```
POST /v2/publications/{publicationId}/webhooks
```

**Signature verification**: The documentation references webhook security but specific HMAC details are not publicly well-documented. Plan to use a shared secret approach.

**Retry behavior**: Not publicly documented in detail. Implement idempotent handlers.

### Rate Limits

Beehiiv documents rate limits but does not publicly share exact numbers prominently. Based on developer reports:
- Rate limiting is implemented per API key
- The API returns standard 429 responses when limits are exceeded
- Recommendation: implement exponential backoff and stay under ~100 requests/minute to be safe
- Pagination limit of 100 items per page helps manage data volume

### TypeScript SDK

**Official SDK exists**: `@beehiiv/sdk` (npm package `@beehiiv/sdk`)
- Current version: 0.1.9
- **Status: BETA** -- breaking changes may occur without major version bumps
- Pin the exact version in package.json

```typescript
import { BeehiivClient } from '@beehiiv/sdk';

const client = new BeehiivClient({ token: process.env.BEEHIIV_API_KEY });

// List subscriptions with stats
const subscriptions = await client.subscriptions.list(publicationId, {
  expand: ['stats', 'custom_fields'],
  limit: 100,
});
```

**Recommendation**: Use the official SDK but wrap it in your own adapter layer. The beta status means you need insulation from breaking changes.

### Developer Experience Pain Points

1. **Beta SDK**: Breaking changes without semver major bumps
2. **Rate limits not clearly documented**: Must discover empirically or contact support
3. **Cursor pagination migration**: Old integrations using page-based must migrate
4. **Custom fields silently dropped**: If a custom field name doesn't exist, the API discards it without error
5. **Post creation is Enterprise-only**: Can't programmatically create ad posts on lower plans
6. **Stats expand can be slow**: Including `expand=stats` on large subscriber lists impacts response time

---

## 2. ConvertKit / Kit API

### API Version & Base URL

- **Current version**: v4 (v3 still available but deprecated)
- **v4 Base URL**: `https://api.kit.com/v4`
- **v3 Base URL**: `https://api.convertkit.com/v3` (legacy)
- **Documentation**: https://developers.kit.com/v4

**Important**: v4 API keys are NOT compatible with v3. They are separate systems.

### Authentication

- **v4**: OAuth 2.0 (for applications) or API Keys (for personal automations)
- **v3**: API key as query parameter (`?api_key=xxx`) or API secret for subscriber management

### Plan Requirements

| Feature | Plan Required |
|---------|--------------|
| API access | **Creator plan** ($25/mo) or above |
| Webhooks | Creator plan and above |
| Tags & segments | Creator plan and above |
| Free (Newsletter) plan | **No API access** |

### Key Endpoints (v4)

#### List Subscribers
```
GET /v4/subscribers
```
Cursor-based pagination only (no page/offset).

#### Get Subscriber
```
GET /v4/subscribers/{subscriberId}
```

#### List Subscriber Stats
```
GET /v4/subscribers/{subscriberId}/stats
```
Returns: email sends, opens, bounces, last activity timestamps.

#### Tags
```
GET /v4/tags
POST /v4/tags
POST /v4/tags/{tagId}/subscribers
DELETE /v4/tags/{tagId}/subscribers/{subscriberId}
```

#### Subscribers by Form
```
GET /v4/forms/{formId}/subscribers
```

### Per-Subscriber Engagement Data

**Yes, available in v4.** The v4 API provides:
- Per-subscriber stats: sends, opens, bounces, last activity timestamps
- **Behavioral filtering**: Pull lists of subscribers who opened specific broadcasts or clicked specific links within a chosen timeframe

This is excellent for the ad marketplace -- you can segment by engagement level.

### Webhooks

Available events:
- `subscriber.subscriber_activate`
- `subscriber.subscriber_unsubscribe`
- `subscriber.subscriber_bounce`
- `subscriber.subscriber_complain`
- `subscriber.form_subscribe` (requires `form_id`)
- `subscriber.course_subscribe` (requires `sequence_id`)
- `subscriber.course_complete` (requires `sequence_id`)
- `subscriber.link_click` (requires `initiator_value`)
- `subscriber.product_purchase` (requires `product_id`)
- `subscriber.tag_add` (requires `tag_id`)
- `subscriber.tag_remove` (requires `tag_id`)

Create webhook:
```
POST /v4/webhooks
```

**Notable**: `subscriber.link_click` is available as a webhook event -- this is very useful for engagement tracking.

### Rate Limits

- **120 requests per rolling 60-second window** per API key
- Applies to both v3 and v4
- Returns 429 on exceed

### TypeScript SDK

**No official TypeScript SDK.** You need raw HTTP calls or a community wrapper.

Recommendation: Build a thin HTTP client using `fetch` or `axios`.

### Developer Experience Notes

1. **v4 is still relatively new** -- some features may be in flux
2. Cursor-based pagination is cleaner than v3's page-based approach
3. The engagement stats endpoints are a significant improvement over v3
4. OAuth setup required for multi-tenant applications (which this ad marketplace is)
5. No official SDK means more boilerplate code

---

## 3. Mailchimp API

### API Version & Base URL

- **Current version**: Marketing API v3
- **Base URL**: `https://{dc}.api.mailchimp.com/3.0` (where `{dc}` is the data center from your API key, e.g., `us21`)
- **Documentation**: https://mailchimp.com/developer/marketing/

### Authentication

- **Method**: HTTP Basic Auth or OAuth 2.0
- **Basic Auth**: Username can be any string, password is the API key
- **Header**: `Authorization: Basic base64(anystring:API_KEY)`

### Plan Requirements

| Feature | Plan Required |
|---------|--------------|
| Marketing API access | **All plans including Free** |
| Transactional (Mandrill) webhooks | Standard or Premium plan |
| Marketing webhooks | All plans |
| API key generation | All plans |

### Key Endpoints

#### List Members (Subscribers)
```
GET /3.0/lists/{list_id}/members
```
Returns subscriber data including email, status, merge fields, tags, etc.

#### Get Member
```
GET /3.0/lists/{list_id}/members/{subscriber_hash}
```
Where `subscriber_hash` = MD5 hash of lowercase email address.

#### Get Subscriber Email Activity (Per-Campaign)
```
GET /3.0/reports/{campaign_id}/email-activity/{subscriber_hash}
```
Returns opens, clicks, and bounces for a specific subscriber in a specific campaign.

#### List Email Activity (All Subscribers in Campaign)
```
GET /3.0/reports/{campaign_id}/email-activity
```

#### Member Activity Feed (All Activity for a Member)
```
GET /3.0/lists/{list_id}/members/{subscriber_hash}/activity-feed
```
Returns recent activity across campaigns: opens, clicks, bounces, subscribes, etc.

#### Campaign Reports
```
GET /3.0/reports/{campaign_id}
```
Aggregate stats: open rate, click rate, bounce rate, etc.

#### Click Reports
```
GET /3.0/reports/{campaign_id}/click-details
```

### Per-Subscriber Engagement Data

**Yes, available but requires per-campaign queries.** Unlike Beehiiv which gives aggregate stats per subscriber, Mailchimp requires you to:
1. List campaigns
2. For each campaign, query email activity per subscriber
3. Aggregate yourself

This is more work but gives granular per-email engagement data.

**Key limitation**: The email activity endpoint returns data for recent campaigns only. Historical data may be limited depending on plan.

### Webhooks

#### Marketing Webhooks (Audience Events)
Event types: `subscribe`, `unsubscribe`, `profile`, `cleaned`, `upemail`, `campaign`

- Delivered as `application/x-www-form-urlencoded` POST
- Can filter by source: subscriber action, admin action, or API action

#### Transactional Webhooks (Mandrill -- Email Delivery Events)
Event types: `send`, `deferral`, `hard-bounce`, `soft-bounce`, `delivered`, `open`, `click`, `spam`, `unsub`, `reject`

- Batched up to 1,000 events per request in `mandrill_events` JSON array
- Include user agent string and geolocation data for opens/clicks

### Webhook Signature Verification

**Marketing webhooks**: Use `x-mailchimp-signature` header with HMAC-SHA256

**Transactional webhooks (Mandrill)**: Use `X-Mandrill-Signature` header with HMAC-SHA1
1. Start with the webhook URL string
2. Sort POST variables alphabetically by key, append key+value to URL string
3. HMAC-SHA1 hash with webhook authentication key
4. Compare with header value

**Gotcha**: The webhook URL must match EXACTLY as entered in Mailchimp, including trailing slashes.

### Rate Limits

- **10 simultaneous connections** (not requests/minute, but concurrent connections)
- 429 error when exceeded
- 120-second timeout on API calls
- 20 searches/minute for message search endpoint
- **No option to raise limits** on a per-customer basis

### TypeScript SDK

**Official package**: `@mailchimp/mailchimp_marketing`

```typescript
import mailchimp from '@mailchimp/mailchimp_marketing';

mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: 'us21', // data center prefix
});

const response = await mailchimp.lists.getListMembersInfo('list_id');
```

**Type definitions**: Install `@types/mailchimp__mailchimp_marketing` separately from DefinitelyTyped.

**Known issues**:
1. The official package's built-in `types.d.ts` only defines an `OpenAPI` namespace, not proper module types
2. This causes conflicts with TypeScript's module resolution -- the DefinitelyTyped types are needed
3. The package is auto-generated from `mailchimp-client-lib-codegen`, resulting in inconsistent DX
4. Some developers report needing to delete the built-in `types.d.ts` to get things working

**Recommendation**: Use the official SDK but expect TypeScript friction. The community types help but may lag behind the API.

---

## 4. Substack

### API Status: Effectively None for Third-Party Integration

#### Official API
Substack launched a "Developer API" that requires:
1. Creating a Substack account
2. Agreeing to Terms of Use
3. Submitting an access form (3-5 business day review)

**However**, this API is extremely limited -- it primarily allows retrieving public information about Substack profiles via their LinkedIn handle. It is NOT a full subscriber management or engagement API.

#### What's NOT Available via Official API
- Subscriber lists
- Per-subscriber engagement data (opens, clicks)
- Webhook events
- Email send management
- Custom fields or tagging

#### Workarounds

1. **CSV Export**: Dashboard > Subscribers > Export CSV. Includes email, subscription date, status (active/paused/cancelled), type (free/paid). **No engagement data.**

2. **Reverse-Engineered Internal API**: Several developers have documented Substack's internal API endpoints by inspecting network requests:
   - `substack-api` npm package (unofficial)
   - Python: `NHagar/substack_api` on GitHub
   - These use cookie-based authentication from browser sessions
   - **Risk**: Violates ToS, endpoints can change without notice, no rate limit documentation

3. **Zapier**: Limited integration available -- primarily for new subscriber triggers. No engagement data.

4. **Email forwarding/parsing**: Set up email forwarding rules to capture Substack emails and parse engagement from headers. Very fragile.

#### Viability Assessment

**Substack integration should be DEFERRED from MVP.** Reasons:
- No official API for subscriber/engagement data
- Unofficial approaches are fragile and ToS-violating
- No webhooks for real-time sync
- CSV export is manual and lacks engagement data
- The platform actively avoids providing developer tools

**Future consideration**: If Substack opens a proper API, revisit. For now, focus on Beehiiv, Kit, and Mailchimp which have robust APIs.

---

## 5. ESP Adapter Pattern

### Recommended Architecture

```typescript
// Common interface that all ESP adapters implement
interface ESPAdapter {
  // Identity
  readonly provider: 'beehiiv' | 'convertkit' | 'mailchimp';

  // Subscriber operations
  listSubscribers(options: ListSubscribersOptions): AsyncGenerator<NormalizedSubscriber>;
  getSubscriber(identifier: string): Promise<NormalizedSubscriber | null>;

  // Engagement data
  getSubscriberEngagement(subscriberId: string): Promise<SubscriberEngagement>;
  getPublicationStats(): Promise<PublicationStats>;

  // Webhook management
  registerWebhook(url: string, events: WebhookEventType[]): Promise<WebhookRegistration>;
  verifyWebhookSignature(headers: Record<string, string>, body: string): boolean;
  parseWebhookPayload(body: string, eventType: string): NormalizedWebhookEvent;

  // Custom fields / tags
  getCustomFields(): Promise<CustomField[]>;
  setSubscriberField(subscriberId: string, field: string, value: string): Promise<void>;
}
```

### Common Data Model

```typescript
interface NormalizedSubscriber {
  // Identifiers
  id: string;                          // ESP-specific ID
  externalId: string;                  // Our internal ID mapping
  email: string;

  // Status
  status: 'active' | 'inactive' | 'unsubscribed' | 'bounced' | 'pending';
  subscribedAt: Date;

  // Engagement metrics (normalized 0-1 scale)
  engagement: {
    openRate: number | null;           // null if not available
    clickRate: number | null;
    totalEmailsReceived: number | null;
    totalOpens: number | null;
    totalClicks: number | null;
    lastActivityAt: Date | null;
  };

  // Segmentation
  tags: string[];
  customFields: Record<string, string>;

  // Subscription tier (for premium newsletters)
  tier: 'free' | 'premium' | null;

  // Source tracking
  source: string | null;
  referredBy: string | null;
}

interface SubscriberEngagement {
  subscriberId: string;

  // Aggregate metrics
  lifetimeOpenRate: number | null;
  lifetimeClickRate: number | null;

  // Recent activity
  recentCampaigns: CampaignEngagement[];

  // Engagement score (calculated by us, 0-100)
  engagementScore: number;
}

interface CampaignEngagement {
  campaignId: string;
  sentAt: Date;
  opened: boolean;
  openedAt: Date | null;
  clicked: boolean;
  clickedAt: Date | null;
  links: { url: string; clicks: number }[];
}

interface NormalizedWebhookEvent {
  provider: string;
  eventType: 'subscriber.created' | 'subscriber.deleted' | 'subscriber.updated' |
             'email.sent' | 'email.opened' | 'email.clicked' | 'email.bounced';
  timestamp: Date;
  subscriberEmail: string;
  rawPayload: unknown;
  metadata: Record<string, unknown>;
}
```

### Engagement Data Richness Comparison

| Capability | Beehiiv | Kit (ConvertKit) | Mailchimp |
|-----------|---------|-------------------|-----------|
| Aggregate open rate per subscriber | Yes (expand=stats) | Yes (v4 stats) | Must compute from campaigns |
| Aggregate click rate per subscriber | Yes (verified clicks) | Yes (v4 stats) | Must compute from campaigns |
| Per-campaign engagement | Via post stats | Via broadcast filtering | Yes (email activity endpoint) |
| Behavioral filtering (who opened X) | No | Yes (v4) | Yes (via segments) |
| Real-time engagement webhooks | No (no open/click events) | Yes (link_click event) | Yes (Mandrill transactional) |
| Click verification (bot filtering) | Yes (Verified Clicks) | No | No |
| Engagement score / last activity | No | Yes (last_activity_at) | Via activity feed |

### Verdict on Richest Engagement Data

**Kit (ConvertKit) v4** provides the richest engagement data out-of-the-box with per-subscriber stats, behavioral filtering, and link-click webhooks.

**Beehiiv** is close second with its `expand=stats` approach and Verified Clicks (bot filtering), but lacks real-time engagement webhooks (no open/click events).

**Mailchimp** has the data but requires the most work to aggregate -- you must query per-campaign and compute engagement scores yourself.

### Most Developer-Friendly

1. **Beehiiv**: Official TypeScript SDK (beta), clean REST API, good docs
2. **Kit v4**: Clean API design, but no SDK -- need raw HTTP
3. **Mailchimp**: Official SDK exists but TypeScript types are problematic. Most mature API but most complex.

---

## 6. Webhook Infrastructure

### Multi-ESP Webhook Architecture

```
[Beehiiv] ----POST----> [/webhooks/beehiiv]  -----> [Verify] --> [Queue] --> [Worker]
[Kit]     ----POST----> [/webhooks/kit]       -----> [Verify] --> [Queue] --> [Worker]
[Mailchimp]---POST----> [/webhooks/mailchimp] -----> [Verify] --> [Queue] --> [Worker]
```

### Signature Verification Per ESP

| ESP | Header | Algorithm | Notes |
|-----|--------|-----------|-------|
| Beehiiv | Not well-documented | Likely HMAC-based | Use shared secret from webhook creation |
| Kit (ConvertKit) | Not documented publicly | No documented signing | Rely on endpoint obscurity + IP allowlisting |
| Mailchimp Marketing | `x-mailchimp-signature` | HMAC-SHA256 | Verify against webhook secret |
| Mailchimp Transactional | `X-Mandrill-Signature` | HMAC-SHA1 | URL + sorted POST params + key |

### Implementation Pattern (Node.js/Express)

```typescript
// Webhook receiver -- respond fast, process async
app.post('/webhooks/:provider', express.raw({ type: '*/*' }), async (req, res) => {
  const provider = req.params.provider;
  const rawBody = req.body.toString();

  // 1. Verify signature (provider-specific)
  const adapter = getESPAdapter(provider);
  if (!adapter.verifyWebhookSignature(req.headers, rawBody)) {
    return res.status(401).send('Invalid signature');
  }

  // 2. Enqueue for async processing
  await webhookQueue.add('process-webhook', {
    provider,
    headers: req.headers,
    body: rawBody,
    receivedAt: new Date().toISOString(),
  });

  // 3. Respond immediately
  res.status(200).send('OK');
});
```

### Webhook Retry Behavior

| ESP | Retry Policy | Notes |
|-----|-------------|-------|
| Beehiiv | Not documented | Assume standard retry with backoff |
| Kit | Not documented | Assume limited retries |
| Mailchimp Marketing | Retries on failure | Will disable webhook after repeated failures |
| Mailchimp Transactional | Batches up to 1000 events | Retries with backoff |

### Queue vs Inline Processing

**Use queue-based processing.** Reasons:

1. **Fast ACK**: Webhook providers expect 2xx within seconds (GitHub: 10s window). If your processing is slow, you'll get retries and eventually webhook disabling.

2. **Reliability**: If processing fails, the event stays in the queue for retry. With inline processing, a failure means data loss.

3. **Ordering**: Events may arrive out of order. A queue lets workers process idempotently using event timestamps and subscriber IDs.

4. **Backpressure**: During high-volume sends (e.g., newsletter goes out to 100k), you could receive thousands of webhooks in minutes. A queue absorbs the burst.

**Recommended stack**: BullMQ (Redis-backed) for MVP, with option to migrate to SQS/Cloud Tasks later.

```typescript
import { Queue, Worker } from 'bullmq';

const webhookQueue = new Queue('webhooks', { connection: redisConnection });

const worker = new Worker('webhooks', async (job) => {
  const { provider, body } = job.data;
  const adapter = getESPAdapter(provider);
  const event = adapter.parseWebhookPayload(body, job.data.eventType);

  // Idempotency check
  const processed = await db.webhookEvents.findUnique({
    where: { eventId: event.id }
  });
  if (processed) return; // Skip duplicate

  // Process the event
  await processWebhookEvent(event);

  // Record as processed
  await db.webhookEvents.create({ data: { eventId: event.id, ... } });
}, { connection: redisConnection });
```

### Handling Out-of-Order Events

- Use `timestamp` from the event payload, not arrival time
- For subscriber status changes, use "last-write-wins" with timestamp comparison
- Store raw events in an audit log table for debugging
- Use database transactions when updating subscriber state

---

## 7. Tracking Pixel & Click Redirect

### How Tracking Pixels Work

A tracking pixel is a 1x1 transparent image embedded in HTML email:

```html
<img src="https://track.yourdomain.com/open?eid=abc123&sid=sub456"
     width="1" height="1" style="display:none" />
```

When the email client loads images:
1. HTTP GET request hits your server with `eid` (email ID) and `sid` (subscriber ID)
2. Server logs: timestamp, subscriber ID, email ID, IP, user agent
3. Server returns a 1x1 transparent GIF (43 bytes)

```typescript
app.get('/open', (req, res) => {
  const { eid, sid } = req.query;

  // Log the open event (async, don't block response)
  trackingQueue.add('open', { emailId: eid, subscriberId: sid,
    ip: req.ip, userAgent: req.headers['user-agent'], timestamp: new Date() });

  // Return 1x1 transparent GIF
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': pixel.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  });
  res.end(pixel);
});
```

### How Click Tracking Works

Replace links in the email with redirect URLs:

**Original**: `https://advertiser.com/product?ref=newsletter`
**Tracked**: `https://track.yourdomain.com/click?lid=link789&sid=sub456&url=https%3A%2F%2Fadvertiser.com%2Fproduct`

```typescript
app.get('/click', (req, res) => {
  const { lid, sid, url } = req.query;

  // Log the click (async)
  trackingQueue.add('click', { linkId: lid, subscriberId: sid,
    ip: req.ip, userAgent: req.headers['user-agent'], timestamp: new Date() });

  // Redirect to destination
  res.redirect(302, decodeURIComponent(url));
});
```

### Privacy Impact -- This Is Critical

#### Apple Mail Privacy Protection (MPP)
- **~64% of email subscribers** use MPP-capable Apple Mail (as of 2025)
- Apple pre-fetches ALL images (including tracking pixels) via proxy, whether or not the user opens the email
- Result: **open rate data is inflated to near 100%** for Apple Mail users
- You cannot distinguish real opens from Apple pre-fetches
- This has been in effect since iOS 15 (2021) and adoption continues to grow

#### Gmail Image Proxy
- Gmail caches images server-side
- All image requests come from Google's proxy IPs, not the subscriber's IP
- Geolocation data from opens is unreliable
- Open timestamps may be delayed

#### Impact on Tracking Pixel Usefulness
- **Open tracking is increasingly unreliable** (MPP + Gmail = majority of users)
- **Click tracking remains reliable** -- clicks require user action, can't be proxied
- Industry trend: "Clicks are the new opens" for engagement measurement

### Should You Build Custom Tracking for MVP?

**No. Here's why:**

1. **All three supported ESPs already track opens and clicks.** Beehiiv, Kit, and Mailchimp all provide engagement data via their APIs.

2. **Open tracking is broken** due to MPP/Gmail. Building your own won't fix this.

3. **Click tracking adds complexity** for marginal benefit -- the ESP is already doing it.

4. **When custom tracking IS needed**: Only if you need to:
   - Track engagement for ad-specific content (e.g., did the subscriber click the ad link specifically?)
   - Provide engagement verification to advertisers independent of publisher's ESP data
   - Support an ESP that doesn't provide engagement data (like Substack -- but we're deferring that)

**MVP recommendation**: Rely on ESP-native engagement data via API. Build custom ad-click tracking (redirect links for ad URLs only) as a Phase 2 feature for advertiser reporting/verification.

---

## Summary: Integration Priority & Approach

### MVP Integration Order

1. **Beehiiv** (Primary) -- Official TS SDK, good engagement data via expand=stats, webhook support
2. **Mailchimp** (Secondary) -- Largest install base, API on all plans, but more complex engagement queries
3. **Kit/ConvertKit** (Tertiary) -- Best engagement API (v4), but requires OAuth for multi-tenant, no SDK

### Deferred
4. **Substack** -- No viable API. Defer until official API exists.

### Key Technical Decisions

| Decision | Recommendation |
|----------|---------------|
| Adapter pattern | Yes -- common ESPAdapter interface with provider-specific implementations |
| Webhook processing | Queue-based (BullMQ + Redis) with fast ACK |
| Custom tracking pixels | No for MVP -- rely on ESP data |
| Custom click tracking | Phase 2 -- for ad-specific click verification |
| Subscriber sync | Pull-based (periodic API polling) + push-based (webhooks) hybrid |
| Engagement scoring | Compute from ESP data: weighted combination of open rate, click rate, recency |

### Rate Limit Budget (Per Publisher)

| ESP | Limit | Sync Strategy |
|-----|-------|---------------|
| Beehiiv | ~100 req/min (estimated) | Full sync daily, webhook for real-time |
| Kit | 120 req/60s | Full sync daily, webhook for real-time |
| Mailchimp | 10 concurrent connections | Batch operations, queue requests |

---

## Sources

### Beehiiv
- [Beehiiv Developer Documentation](https://developers.beehiiv.com/welcome/getting-started)
- [List Subscriptions Endpoint](https://developers.beehiiv.com/api-reference/subscriptions/index)
- [Get Subscription by Email](https://developers.beehiiv.com/api-reference/subscriptions/get-by-email)
- [Aggregate Stats Endpoint](https://developers.beehiiv.com/api-reference/posts/aggregate-stats)
- [Custom Fields API](https://developers.beehiiv.com/api-reference/custom-fields/index)
- [Webhooks Documentation](https://developers.beehiiv.com/webhooks)
- [Create Webhook](https://developers.beehiiv.com/api-reference/webhooks/create)
- [Beehiiv TypeScript SDK (npm)](https://www.npmjs.com/package/@beehiiv/sdk)
- [Beehiiv TypeScript SDK (GitHub)](https://github.com/beehiiv/typescript-sdk)
- [Beehiiv Pricing](https://www.beehiiv.com/pricing)
- [Plan Types and Pricing](https://www.beehiiv.com/support/article/23874462928663-plan-types-and-subscriber-plan-tier-pricing)
- [Beehiiv API & Integrations](https://www.beehiiv.com/features/api-and-integrations)
- [Verified Clicks](https://www.beehiiv.com/support/article/28404633659159-introducing-verified-clicks-accurate-email-engagement-metrics)

### ConvertKit / Kit
- [Kit API v4 Documentation](https://developers.kit.com/v4)
- [Kit API v4 Introduction](https://developers.kit.com/v4.html)
- [Kit Developer Docs - Webhooks](https://developers.kit.com/api-reference/webhooks/create-a-webhook)
- [Kit Changelog](https://updates.kit.com/changelog)
- [Kit Pricing](https://kit.com/pricing)
- [ConvertKit API Essentials (Rollout)](https://rollout.com/integration-guides/convertkit/api-essentials)

### Mailchimp
- [Mailchimp Marketing API Reference](https://mailchimp.com/developer/marketing/api/)
- [API Fundamentals](https://mailchimp.com/developer/marketing/docs/fundamentals/)
- [Get Subscriber Email Activity](https://mailchimp.com/developer/marketing/api/email-activity-reports/get-subscriber-email-activity/)
- [Member Activity Feed](https://mailchimp.com/developer/marketing/api/list-member-activity-feed/)
- [Email Activity Reports](https://mailchimp.com/developer/marketing/api/email-activity-reports/)
- [Audience Webhooks Guide](https://mailchimp.com/developer/marketing/guides/sync-audience-data-webhooks/)
- [Transactional Webhooks Docs](https://mailchimp.com/developer/transactional/docs/webhooks/)
- [Transactional Webhook Authentication](https://mandrill.zendesk.com/hc/en-us/articles/360039232513-How-to-Authenticate-Webhook-Requests)
- [Mailchimp Marketing Node SDK (GitHub)](https://github.com/mailchimp/mailchimp-marketing-node)
- [Mailchimp Webhooks Guide (Inventive HQ)](https://inventivehq.com/blog/mailchimp-webhooks-guide)

### Substack
- [Substack Developer API](https://support.substack.com/hc/en-us/articles/45099095296916-Substack-Developer-API)
- [Does Substack have an API?](https://support.substack.com/hc/en-us/articles/360038433912-Does-Substack-have-an-API)
- [Unofficial Substack API (GitHub)](https://github.com/NHagar/substack_api)
- [Reverse-Engineering Substack API](https://iam.slys.dev/p/no-official-api-no-problem-how-i)
- [SubstackAPI.com Documentation](https://substackapi.com/docs)

### Tracking & Privacy
- [Email Tracking Pixels in 2026 (Sparkle)](https://sparkle.io/blog/email-tracking-pixels/)
- [Apple Mail Privacy Protection (Postmark)](https://postmarkapp.com/blog/how-apples-mail-privacy-changes-affect-email-open-tracking)
- [Apple MPP Guide (Twilio)](https://www.twilio.com/en-us/blog/insights/apple-mail-privacy-protection)
- [Apple MPP Impact (Campaign Monitor)](https://www.campaignmonitor.com/resources/guides/apple-mail-privacy-protection-guide/)

### Webhook Infrastructure
- [Building Robust Webhook Services (Twimbit)](https://twimbit.com/about/blogs/building-robust-webhook-services-in-node-js-best-practices-and-techniques)
- [Queue-Based Webhook Processing (TecHighness)](https://www.techighness.com/post/node-js-mongodb-queue-for-webhook-processing/)
- [Adapter Pattern in TypeScript (Refactoring Guru)](https://refactoring.guru/design-patterns/adapter/typescript/example)
- [Service Abstraction Pattern](https://juliomarquez.com/blog/service-abstraction-over-direct-integration/)
- [HMAC Webhook Security (Webhooks.fyi)](https://webhooks.fyi/security/hmac)
