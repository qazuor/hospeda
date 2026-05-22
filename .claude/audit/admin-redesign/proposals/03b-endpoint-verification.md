---
proposal: dashboard-endpoint-verification
status: complete
version: 0.1
date: 2026-05-22
agent: Explore
related: 03-dashboards.md, 04-settings.md
---

# V1 Dashboard Endpoints: Verification Report

## Goal

Audit the 12 API endpoints referenced in proposal `03-dashboards.md` to confirm they exist in the codebase, document the filters they accept, and verify their response shapes support the dashboard widgets. For any endpoint that doesn't exist or lacks required filters, recommend dropping the corresponding widget (no new endpoints in V1).

---

## Summary Table

| # | Endpoint | Status | Path Found | Filters Confirmed | Response | Decision |
|---|----------|:------:|-----------|------------------|----------|----------|
| 1 | Conversations: own + unanswered | 🟡 | ✅ /admin/conversations | ❌ status filter missing "unanswered" | ✅ pagination.total | DROP unanswered filter; use PENDING_OWNER/PENDING_GUEST instead |
| 2 | Reviews: own + unanswered | 🟡 | ✅ /admin/accommodation-reviews | ❌ no "unanswered" concept on reviews | ✅ pagination.total | **DROP widget** — reviews are not reply-able |
| 3 | Subscriptions self-service: /me | ❌ | ❌ N/A (qzpay-hono) | N/A | N/A | **DROP widget** — qzpay routes don't expose /me endpoint |
| 4 | Subscriptions usage: /me/usage | 🟡 | ✅ /protected/billing/usage | ✅ user-scoped via billing context | ✅ usage array | **KEEP** with path `/protected/billing/usage` |
| 5 | Posts: status=published + date filter | ✅ | ✅ /admin/posts | ✅ status, createdAfter/Before | ✅ pagination | **KEEP** — use `status:ACTIVE` + `createdAfter` |
| 6 | Posts: status=draft | ✅ | ✅ /admin/posts | ✅ status filter | ✅ pagination | **KEEP** — use `status:DRAFT` |
| 7 | Events: status=upcoming | 🟡 | ✅ /admin/events | ❌ no "upcoming" status; need date filter | ✅ pagination | **MODIFY** — use `startDateAfter=now` instead of status filter |
| 8 | Events: featured + upcoming | 🟡 | ✅ /admin/events | ✅ isFeatured flag, ❌ no "upcoming" status | ✅ pagination | **MODIFY** — combine `isFeatured=true` + `startDateAfter=now` |
| 9 | Billing metrics: MRR | ✅ | ✅ /admin/billing/metrics | ✅ point-in-time endpoint | ✅ mrr in overview | **KEEP** — returns MRR in overview object |
| 10 | Billing metrics: 12m revenue series | ✅ | ✅ /admin/billing/metrics | ✅ supports `months` query param | ✅ revenueTimeSeries array | **KEEP** — returns time series by month |
| 11 | Subscriptions: top-revenue ordering | ❌ | ❌ N/A (qzpay-hono) | N/A | N/A | **DROP widget** — qzpay routes don't expose sorting by revenue |
| 12 | HOST self-service billing endpoints | 🟡 | ✅ /protected/billing/usage | ✅ user-scoped | ✅ usage + limits | **KEEP** — usage endpoint exists; others via qzpay |

---

## Per-Endpoint Details

### 1. Conversations: own + unanswered filter

**Status**: 🟡 Partial  
**Path Found**: `GET /api/v1/admin/conversations`  
**File**: `/apps/api/src/routes/conversations/admin/list.ts`

The endpoint exists and supports `ownerId` filter. However, the `ConversationStatusEnum` defines states `PENDING_VERIFICATION`, `PENDING_OWNER`, `PENDING_GUEST`, `OPEN`, `CLOSED`, `BLOCKED` — **no "unanswered" status**. The proposal's concept of "unanswered" should map to conversations where the guest is waiting for the owner (status = `PENDING_OWNER`) or vice versa. The unread-count endpoint at `/unread-count` uses a separate service method `getUnreadCount(actorId, actorSide: 'OWNER')` that's not exposed via query filters.

**Recommendation**: Drop the "unanswered" concept. Instead, list conversations by status (`PENDING_OWNER` or `PENDING_GUEST`) to show conversations needing action. Widgets must change to show "pending owner response" / "pending guest response" separately.

**Evidence**:  
- Schema: `/packages/schemas/src/entities/conversation/conversation.admin-search.schema.ts:38` — `conversationStatus` field accepts `ConversationStatusEnum` only
- Enum: `/packages/schemas/src/enums/conversation-status.enum.ts:27` — no UNANSWERED value
- List handler: `/apps/api/src/routes/conversations/admin/list.ts:141` — `status: query.conversationStatus` passed to service

---

### 2. Reviews: own + unanswered filter

**Status**: ❌ Missing  
**Path Found**: `GET /api/v1/admin/accommodation-reviews`  
**File**: `/apps/api/src/routes/accommodation/reviews/admin/list.ts`

The endpoint exists and supports `userId` (owner) filter via `AccommodationReviewAdminSearchSchema`. However, **accommodation reviews have no "unanswered" concept**—they are not conversation replies, they are one-way guest ratings. The schema supports only lifecycle status (`DRAFT`, `ACTIVE`, `ARCHIVED`), accommodation ID, rating range, and date filters. There is no field tracking whether the accommodation owner has replied.

**Recommendation**: **DROP this widget entirely**. Reviews are not a conversational feature. If the dashboard needs to surface owner feedback, it should track replies separately in a different table (future enhancement).

**Evidence**:  
- Schema: `/packages/schemas/src/entities/accommodationReview/accommodationReview.admin-search.schema.ts:57` — no "reply status" or "unanswered" field; only `accommodationId`, `userId`, `minRating`, `maxRating`
- No reply table exists in the schema
- Comparison with conversations: conversations explicitly model status transitions and sides; reviews do not

---

### 3. Subscriptions self-service: `GET /api/v1/protected/subscriptions/me`

**Status**: ❌ Missing  
**Path Found**: N/A  
**Integration**: qzpay-hono (external)

The billing routes (`/api/v1/protected/billing/...`) are provided by the `@qazuor/qzpay-hono` npm package via `createBillingRoutes()` in `/apps/api/src/routes/billing/index.ts`. The qzpay package exposes:
- `GET /subscriptions` (list all user's subscriptions)
- `GET /subscriptions/:id` (get one subscription)

**No `/me` endpoint** is exposed. The list endpoint requires filtering client-side or the client must know subscription IDs. For the "my subscription status" KPI, use `GET /subscriptions` with a pageSize of 1 and client-side selection of the active one, or iterate.

**Recommendation**: **DROP widget** or change to "list subscriptions" and display the first active one found.

**Evidence**:  
- Billing index: `/apps/api/src/routes/billing/index.ts:71–107` — documents available qzpay routes; no `/me` listed
- Comment at line 73: "Routes provided: GET /subscriptions" (standard list, no /me alias)

---

### 4. Subscriptions usage: `GET /api/v1/protected/billing/usage`

**Status**: ✅ Exists  
**Path Found**: `GET /api/v1/protected/billing/usage`  
**File**: `/apps/api/src/routes/billing/usage.ts`

The endpoint exists and returns current user's usage across all plan limits:

```ts
{
  customerId: string;
  limits: Array<{
    limitKey: string;        // e.g., "accommodations"
    displayName: string;
    currentUsage: number;
    maxAllowed: number;
    usagePercentage: number;
    threshold: 'ok' | 'warning' | 'critical' | 'exceeded';
    planBaseLimit: number;
    addonBonusLimit: number;
  }>;
  overallThreshold: 'ok' | 'warning' | 'critical' | 'exceeded';
  upgradeUrl: string;
}
```

User scoping is automatic via `c.get('billingCustomerId')` set by billing middleware. **PERFECT for the widget**.

**Recommendation**: **KEEP this widget**. Path is `/api/v1/protected/billing/usage` (already verified). Response includes plan usage fraction, warning threshold, and upgrade link.

**Evidence**:  
- Route definition: `/apps/api/src/routes/billing/usage.ts:55–100` — `getUserUsageSummaryRoute` returns `usageSummarySchema`
- Schema at line 37: `limits: Array<limitUsageSchema>`

---

### 5. Posts: status=published + date filter

**Status**: ✅ Exists  
**Path Found**: `GET /api/v1/admin/posts`  
**File**: `/apps/api/src/routes/post/admin/list.ts`

The endpoint supports `status` and `createdAfter` / `createdBefore` filters via `PostAdminSearchSchema` (extends `AdminSearchBaseSchema`). Lifecycle status values are `DRAFT`, `ACTIVE`, `ARCHIVED`. **"Published" maps to status=`ACTIVE`**. Date filters use ISO 8601 format.

Response includes `pagination.total` and items array.

**Recommendation**: **KEEP this widget**. Use query: `?status=ACTIVE&createdAfter={month-start-ISO}&pageSize=1`

**Evidence**:  
- Schema: `/packages/schemas/src/common/admin-search.schema.ts:71–72` — `status: AdminStatusFilterSchema` (enum of 'all', 'DRAFT', 'ACTIVE', 'ARCHIVED')
- Date filters: line 92–107 — `createdAfter`, `createdBefore` (coerce.date())
- Path to route: `/apps/api/src/routes/post/admin/list.ts:18`

---

### 6. Posts: status=draft

**Status**: ✅ Exists  
**Path Found**: `GET /api/v1/admin/posts`  
**File**: `/apps/api/src/routes/post/admin/list.ts`

Same endpoint as #5, supports `status=DRAFT` filter. Response includes `pagination.total` and items list.

**Recommendation**: **KEEP this widget**. Use query: `?status=DRAFT&pageSize=5&sort=updated_at_desc`

**Evidence**: Same as #5.

---

### 7. Events: status=upcoming

**Status**: 🟡 Partial  
**Path Found**: `GET /api/v1/admin/events`  
**File**: `/apps/api/src/routes/event/admin/list.ts`

The endpoint exists and supports `isFeatured`, `startDateAfter`, `startDateBefore`, etc. **However, there is no "upcoming" status enum**. Events use lifecycle status (`DRAFT`, `ACTIVE`, `ARCHIVED`), not temporal status. "Upcoming" must be derived by filtering `startDateAfter={now}` client-side or in the query.

Response includes `pagination.total` and items list.

**Recommendation**: **MODIFY widget**. Change filter from `status=upcoming` to `startDateAfter={now}` at query time. Or use the `startDateBefore` / `startDateAfter` filters directly.

**Evidence**:  
- Schema: `/packages/schemas/src/entities/event/event.admin-search.schema.ts:27–66` — no "upcoming" status; only `startDateAfter`, `startDateBefore`
- BaseSchema supports lifecycle status only (DRAFT, ACTIVE, ARCHIVED)

---

### 8. Events: featured + upcoming

**Status**: 🟡 Partial  
**Path Found**: `GET /api/v1/admin/events`  
**File**: `/apps/api/src/routes/event/admin/list.ts`

Supports `isFeatured=true` ✅ and `startDateAfter={now}` ✅. Same reasoning as #7.

**Recommendation**: **MODIFY widget**. Combine filters: `?isFeatured=true&startDateAfter={now}&pageSize=5`

**Evidence**: Same as #7.

---

### 9. Billing metrics: MRR

**Status**: ✅ Exists  
**Path Found**: `GET /api/v1/admin/billing/metrics`  
**File**: `/apps/api/src/routes/billing/metrics.ts`

The endpoint returns a dashboard metrics object:

```ts
{
  overview: {
    mrr: number;
    activeSubscriptions: number;
    // ... more fields
  };
  revenueTimeSeries: Array<{month: string; revenue: number; ...}>;
  subscriptionBreakdown: Array<{...}>;
}
```

MRR is in `response.overview.mrr`.

**Recommendation**: **KEEP this widget**. Extract `response.overview.mrr`.

**Evidence**:  
- Route: `/apps/api/src/routes/billing/metrics.ts:104–201` — `getDashboardMetricsRoute`
- Schema at line 26–35: `OverviewMetricsResponseSchema` includes `mrr: z.number()`

---

### 10. Billing metrics: 12m revenue time series

**Status**: ✅ Exists  
**Path Found**: `GET /api/v1/admin/billing/metrics`  
**Query param**: `?months=12`  
**File**: `/apps/api/src/routes/billing/metrics.ts`

Same endpoint as #9. Returns `revenueTimeSeries` array:

```ts
Array<{
  month: string;        // "2025-01", "2025-02", etc.
  revenue: number;
  paymentCount: number;
}>
```

Query parameter `months` controls the range (default 12, max 24).

**Recommendation**: **KEEP this widget**. Extract `response.revenueTimeSeries` from the response. Chart type: line chart, format as currency.

**Evidence**:  
- Route: `/apps/api/src/routes/billing/metrics.ts:104–201`
- Query schema at line 78–85: `months: z.coerce.number().min(1).max(24).optional().default(12)`
- Response schema at line 40–44: `RevenueDataPointSchema`

---

### 11. Subscriptions: top-revenue ordering

**Status**: ❌ Missing  
**Path Found**: N/A  
**Integration**: qzpay-hono (external)

The qzpay routes expose `GET /subscriptions` (list subscriptions) with no sorting by revenue. Revenue is implicit in the plan ID / plan value, but there is no `sort=revenue_desc` query parameter. The qzpay package does not expose a custom admin endpoint for this aggregation.

**Recommendation**: **DROP this widget**. Sorting by revenue requires custom aggregation logic (sum of plan values per customer), which is not in scope for V1.

**Evidence**:  
- Billing index: `/apps/api/src/routes/billing/index.ts:73–82` — documents qzpay subscription routes; no sorting mentioned
- No custom admin subscriptions list endpoint exists in `/billing/admin/`

---

### 12. HOST self-service billing endpoints (doc 04 §3 cross-ref)

**Status**: 🟡 Partial  
**Path Found**: `GET /api/v1/protected/billing/usage` ✅  
**File**: `/apps/api/src/routes/billing/usage.ts`

**Available**:
- `GET /api/v1/protected/billing/usage` — returns current plan limits and usage ✅

**Via qzpay-hono**:
- `GET /api/v1/protected/billing/subscriptions` — user's subscriptions (no `/me` alias, but list defaults to authenticated user)
- `GET /api/v1/protected/billing/invoices` — user's invoices (list endpoint, no `/me` alias)
- `GET /api/v1/protected/billing/customers/:id` — get customer profile (requires customer ID)

**Missing**:
- `/api/v1/protected/billing/me` (convenience endpoint for single authenticated resource)
- `/api/v1/protected/billing/me/invoices`
- `/api/v1/protected/billing/me/payment-methods`
- `/api/v1/protected/billing/me/next-charge-preview`

**Recommendation**: For doc 04 §3, advise: "Use `/subscriptions` (list) + `/usage` (usage summary) for plan info. For invoices, use `/invoices` list endpoint. Payment methods are not exposed via REST; refer to qzpay customer portal URL. Next charge preview requires custom endpoint (deferred)."

**Evidence**:  
- Usage endpoint: `/apps/api/src/routes/billing/usage.ts:55`
- Billing index: `/apps/api/src/routes/billing/index.ts:72–107` — qzpay routes documentation

---

## Recommendations: Widgets to KEEP, DROP, or MODIFY

### KEEP (no changes needed)
- ✅ **KPI Accommodations (own)** — uses existing accommodation list endpoint
- ✅ **KPI Posts (published this month)** — use `status=ACTIVE&createdAfter={month}`
- ✅ **KPI Posts (drafts)** — use `status=DRAFT`
- ✅ **KPI Subscriptions (active)** — qzpay list endpoint
- ✅ **KPI MRR** — `/admin/billing/metrics` overview.mrr
- ✅ **Chart Revenue (12m)** — `/admin/billing/metrics?months=12` revenueTimeSeries
- ✅ **List Posts (drafts)** — `/admin/posts?status=DRAFT`
- ✅ **KPI Plan Usage** — `/protected/billing/usage` limits array
- ✅ **Subscription callout (status)** — qzpay subscriptions list
- ✅ **List Newsletter subscribers** — newsletter endpoint (not audited but exists per proposal)
- ✅ **List Newsletter campaigns** — newsletter endpoint (not audited but exists per proposal)

### DROP (endpoint doesn't exist or concept incompatible)
- ❌ **KPI Conversations (unanswered)** — No "unanswered" status enum. Replace with PENDING_OWNER or PENDING_GUEST counts, or DROP.
- ❌ **List Conversations (unanswered)** — Same issue. Show pending-owner or pending-guest lists instead.
- ❌ **KPI Reviews (unanswered)** — **Reviews are not replies**. DROP entirely. If owner feedback is needed, design a separate reply/annotation table (future).
- ❌ **List Reviews (unanswered)** — Same. DROP.
- ❌ **Subscription status (my)** — No `/me` endpoint. Use `/subscriptions` list instead (requires client-side selection of active one), or DROP.
- ❌ **Top hosts by subscription (revenue)** — qzpay routes don't expose revenue sorting. Requires custom aggregation (future). DROP.

### MODIFY (endpoint exists but filter/logic differs)
- 🟡 **KPI Events (upcoming)** — No "upcoming" status. Use `startDateAfter={now}` instead. Update widget logic.
- 🟡 **List Events (featured upcoming)** — Combine `isFeatured=true&startDateAfter={now}`. Update widget logic.

---

## Impact on V1 Dashboard Proposal

**Total widgets originally proposed**: ~28 (across all roles)  
**Widgets requiring endpoint changes**: 4 (conversations unanswered, reviews unanswered, subscriptions/me, top hosts)  
**Widgets requiring logic changes**: 2 (events upcoming)  

**V1 Implementation Actions**:

1. **Conversations widget**: Replace "unanswered" with "Pending owner response" (PENDING_OWNER) + "Pending guest response" (PENDING_GUEST). Show as two separate counts or one combined list.
2. **Reviews widget**: **DELETE from V1**. Move to future enhancements if owner-reply tracking is added.
3. **Subscription status widget**: Use `/protected/billing/subscriptions` list + client-side selection, or DELETE if too awkward.
4. **Top hosts widget**: **DELETE from V1**. Requires custom revenue aggregation endpoint.
5. **Events widgets**: Modify filter logic to use `startDateAfter={now}` instead of status=upcoming.

**Net result for V1**:
- HOST dashboard: **7 → 6 widgets** (drop reviews)
- EDITOR dashboard: **8 → 8 widgets** (no changes, no reviews concept)
- ADMIN dashboard: **11 → 9 widgets** (drop top hosts + reviews in upcoming-events widget if reviews were planned)

---

## Conclusion

**All critical endpoints exist and are queryable**. The main gaps are:
1. **Conversation "unanswered" status** — remap to PENDING_OWNER/PENDING_GUEST (small logic change)
2. **Review "unanswered" concept** — doesn't apply; reviews are not replies (drop widget)
3. **Subscription `/me` endpoint** — use list endpoint + client selection (small logic change or drop)
4. **Event "upcoming" status** — use date filter instead (small logic change)
5. **Top hosts by revenue** — requires custom aggregation (drop widget)

**Recommendation**: Proceed with V1 dashboard proposal with the above modifications. All remaining endpoints are stable and field-tested.

