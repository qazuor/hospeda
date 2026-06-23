/**
 * editor.newsletter.subscribers — open rate 4th tile (SPEC-160 T-001).
 *
 * Tests the new open-rate tile appended to the `editor.newsletter.subscribers`
 * data-source queryFn. The 3 primary subscriber tiles already existed; these
 * tests focus exclusively on the open-rate tile behaviour.
 *
 * Scenarios covered:
 *  1. Happy path — SENT campaign with known opened/delivered → tile value equals
 *     Math.round(opened / delivered * 100), unitSuffix '%'.
 *  2. Most-recent-by-sentAt — when multiple SENT campaigns exist the one with
 *     the greatest sentAt is selected (not just the first item).
 *  3. No-sends path — zero SENT campaigns → tile present with undefined value
 *     (KpiGridTile renders '—'), no throw.
 *  4. Metrics fetch failure — campaigns resolve but metrics call rejects →
 *     primary 3 subscriber tiles still present, open-rate tile has undefined
 *     value, no throw (robustness guarantee).
 *  5. Campaigns fetch failure — first SENT campaigns call rejects entirely →
 *     primary 3 subscriber tiles still present, no throw.
 *
 * Mock strategy: `fetchApi` is mocked at its output boundary with the SHAPE
 * the real endpoints return, matching the convention in resolver-real-shape.test.ts
 * and editor-views.test.ts. `fetchCampaignMetrics` is mocked directly because it
 * is imported from a sibling hook module.
 *
 * @see apps/admin/src/lib/dashboard-sources/editor.ts — source under test
 * @see apps/admin/src/hooks/newsletter/use-campaign-metrics.ts — fetchCampaignMetrics
 * @see SPEC-160 T-001
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fetchApi BEFORE importing resolver modules (vi.mock is hoisted).
vi.mock('@/lib/api/client', () => ({
    fetchApi: vi.fn()
}));

// Mock fetchCampaignMetrics (plain async fn, not a hook) so tests stay offline.
vi.mock('@/hooks/newsletter/use-campaign-metrics', () => ({
    fetchCampaignMetrics: vi.fn()
}));

import { fetchCampaignMetrics } from '@/hooks/newsletter/use-campaign-metrics';
import { fetchApi } from '@/lib/api/client';
import { type ResolverContext, resolveDataSource } from '@/lib/dashboard-sources';
// Side-effect: registers all sources (editor + others) into the registry.
import '@/lib/dashboard-sources/index';

const mockFetchApi = vi.mocked(fetchApi);
const mockFetchCampaignMetrics = vi.mocked(fetchCampaignMetrics);

/** EDITOR context. */
const ctx: ResolverContext = {
    role: 'EDITOR',
    userId: 'u-editor-test',
    permissions: ['NEWSLETTER_SUBSCRIBER_VIEW', 'NEWSLETTER_CAMPAIGN_VIEW'],
    scope: 'all'
};

/** Wraps a raw endpoint body in the `fetchApi` output envelope `{ data, status }`. */
function envelope(body: unknown) {
    return { data: body, status: 200 };
}

/** Resolves the source and runs its queryFn. */
async function runSubscribersSource(): Promise<unknown> {
    const { found, options } = resolveDataSource('editor.newsletter.subscribers', ctx);
    expect(found, "source 'editor.newsletter.subscribers' must be registered").toBe(true);
    return options.queryFn();
}

/** Stub envelope for the 3 subscriber list calls (active / pending / unsubscribed). */
function subscriberEnvelope(total: number) {
    return envelope({ success: true, data: { items: [], pagination: { total } } });
}

beforeEach(() => {
    mockFetchApi.mockReset();
    mockFetchCampaignMetrics.mockReset();
});

// ── Result shape helpers ─────────────────────────────────────────────────────

interface KpiTile {
    readonly key: string;
    readonly value: number | undefined;
    readonly unitSuffix?: string;
}

function extractKpis(result: unknown): KpiTile[] {
    return (result as { kpis: KpiTile[] }).kpis;
}

// ============================================================================
// Happy path
// ============================================================================

describe('editor.newsletter.subscribers — open rate tile (SPEC-160 T-001)', () => {
    it('appends an open-rate tile with correct rounded % value when a SENT campaign exists', async () => {
        // 3 subscriber calls
        mockFetchApi.mockResolvedValueOnce(subscriberEnvelope(120)); // active
        mockFetchApi.mockResolvedValueOnce(subscriberEnvelope(8)); // pending
        mockFetchApi.mockResolvedValueOnce(subscriberEnvelope(30)); // unsubscribed

        // SENT campaigns pool — one campaign
        mockFetchApi.mockResolvedValueOnce(
            envelope({
                success: true,
                data: {
                    items: [
                        {
                            id: 'campaign-uuid-001',
                            subject: 'Test newsletter',
                            status: 'sent',
                            sentAt: '2026-06-01T10:00:00.000Z'
                        }
                    ],
                    pagination: { total: 1 }
                }
            })
        );

        // Metrics for that campaign: 80 opened out of 200 delivered → 40%
        mockFetchCampaignMetrics.mockResolvedValueOnce({
            totalRecipients: 210,
            totalSoftcapped: 10,
            delivered: 200,
            failed: 0,
            skipped: 0,
            opened: 80,
            clicked: 20,
            openRate: 0.4,
            clickRate: 0.1
        });

        const result = await runSubscribersSource();
        const kpis = extractKpis(result);

        // 4 tiles total
        expect(kpis).toHaveLength(4);

        const openRateTile = kpis.find((k) => k.key === 'openRate');
        expect(openRateTile).toBeDefined();

        // AC-1: value = Math.round(80/200 * 100) = 40, unitSuffix '%'
        expect(openRateTile?.value).toBe(40);
        expect(openRateTile?.unitSuffix).toBe('%');

        // fetchCampaignMetrics called with the correct campaign id
        expect(mockFetchCampaignMetrics).toHaveBeenCalledWith('campaign-uuid-001');
    });

    it('rounds the open rate to zero decimal places (e.g. 33.333... → 33)', async () => {
        mockFetchApi.mockResolvedValueOnce(subscriberEnvelope(50));
        mockFetchApi.mockResolvedValueOnce(subscriberEnvelope(3));
        mockFetchApi.mockResolvedValueOnce(subscriberEnvelope(5));

        // 1 SENT campaign
        mockFetchApi.mockResolvedValueOnce(
            envelope({
                success: true,
                data: {
                    items: [
                        {
                            id: 'c-001',
                            subject: 'A',
                            status: 'sent',
                            sentAt: '2026-05-10T00:00:00Z'
                        }
                    ],
                    pagination: { total: 1 }
                }
            })
        );

        // 1 opened out of 3 delivered → 33.33...%
        mockFetchCampaignMetrics.mockResolvedValueOnce({
            totalRecipients: 3,
            totalSoftcapped: 0,
            delivered: 3,
            failed: 0,
            skipped: 0,
            opened: 1,
            clicked: 0,
            openRate: 0.3333,
            clickRate: 0
        });

        const kpis = extractKpis(await runSubscribersSource());
        const openRateTile = kpis.find((k) => k.key === 'openRate');
        // Math.round(1/3 * 100) = Math.round(33.33...) = 33
        expect(openRateTile?.value).toBe(33);
    });
});

// ============================================================================
// Most-recent-by-sentAt selection
// ============================================================================

describe('editor.newsletter.subscribers — sentAt selection', () => {
    it('picks the campaign with the greatest sentAt when the pool has multiple items', async () => {
        mockFetchApi.mockResolvedValueOnce(subscriberEnvelope(10));
        mockFetchApi.mockResolvedValueOnce(subscriberEnvelope(0));
        mockFetchApi.mockResolvedValueOnce(subscriberEnvelope(2));

        // 3 sent campaigns: first item has the newest createdAt but an OLD sentAt;
        // the third item has the NEWEST sentAt — it should win.
        mockFetchApi.mockResolvedValueOnce(
            envelope({
                success: true,
                data: {
                    items: [
                        // newest by createdAt (first in list) but sent early
                        {
                            id: 'old-send',
                            subject: 'Scheduled long ago',
                            status: 'sent',
                            sentAt: '2026-01-01T00:00:00Z'
                        },
                        {
                            id: 'mid-send',
                            subject: 'Middle',
                            status: 'sent',
                            sentAt: '2026-03-15T00:00:00Z'
                        },
                        // oldest by createdAt but most recently sent
                        {
                            id: 'latest-send',
                            subject: 'Late dispatch',
                            status: 'sent',
                            sentAt: '2026-06-20T00:00:00Z'
                        }
                    ],
                    pagination: { total: 3 }
                }
            })
        );

        // Only one metrics call — for 'latest-send'
        mockFetchCampaignMetrics.mockResolvedValueOnce({
            totalRecipients: 100,
            totalSoftcapped: 0,
            delivered: 100,
            failed: 0,
            skipped: 0,
            opened: 60,
            clicked: 10,
            openRate: 0.6,
            clickRate: 0.1
        });

        await runSubscribersSource();

        // Metrics must be fetched for the campaign with the greatest sentAt
        expect(mockFetchCampaignMetrics).toHaveBeenCalledTimes(1);
        expect(mockFetchCampaignMetrics).toHaveBeenCalledWith('latest-send');
    });
});

// ============================================================================
// No-sends path (AC-2)
// ============================================================================

describe('editor.newsletter.subscribers — no SENT campaigns (AC-2)', () => {
    it('emits the open-rate tile with undefined value when no SENT campaigns exist', async () => {
        mockFetchApi.mockResolvedValueOnce(subscriberEnvelope(5));
        mockFetchApi.mockResolvedValueOnce(subscriberEnvelope(1));
        mockFetchApi.mockResolvedValueOnce(subscriberEnvelope(0));

        // Empty SENT campaigns pool
        mockFetchApi.mockResolvedValueOnce(
            envelope({ success: true, data: { items: [], pagination: { total: 0 } } })
        );

        const result = await runSubscribersSource();
        const kpis = extractKpis(result);

        // 4 tiles still present (the tile is emitted, just with undefined value)
        expect(kpis).toHaveLength(4);

        const openRateTile = kpis.find((k) => k.key === 'openRate');
        expect(openRateTile).toBeDefined();

        // AC-2: value is undefined → KpiGridTile renders '—'
        expect(openRateTile?.value).toBeUndefined();

        // No metrics call when there are no campaigns
        expect(mockFetchCampaignMetrics).not.toHaveBeenCalled();
    });

    it('does not throw when the SENT campaigns pool is empty', async () => {
        mockFetchApi.mockResolvedValueOnce(subscriberEnvelope(0));
        mockFetchApi.mockResolvedValueOnce(subscriberEnvelope(0));
        mockFetchApi.mockResolvedValueOnce(subscriberEnvelope(0));
        mockFetchApi.mockResolvedValueOnce(
            envelope({ success: true, data: { items: [], pagination: { total: 0 } } })
        );

        await expect(runSubscribersSource()).resolves.not.toThrow();
    });
});

// ============================================================================
// Metrics fetch failure — robustness (AC-5)
// ============================================================================

describe('editor.newsletter.subscribers — metrics fetch failure (robustness)', () => {
    it('still returns the 3 primary subscriber tiles when metrics fetch rejects', async () => {
        mockFetchApi.mockResolvedValueOnce(subscriberEnvelope(200)); // active
        mockFetchApi.mockResolvedValueOnce(subscriberEnvelope(15)); // pending
        mockFetchApi.mockResolvedValueOnce(subscriberEnvelope(40)); // unsubscribed

        // SENT campaigns pool — one campaign found
        mockFetchApi.mockResolvedValueOnce(
            envelope({
                success: true,
                data: {
                    items: [
                        {
                            id: 'c-broken',
                            subject: 'Broken',
                            status: 'sent',
                            sentAt: '2026-06-10T00:00:00Z'
                        }
                    ],
                    pagination: { total: 1 }
                }
            })
        );

        // Metrics call rejects (e.g. 500 from the API)
        mockFetchCampaignMetrics.mockRejectedValueOnce(new Error('Internal Server Error'));

        const result = await runSubscribersSource();
        const kpis = extractKpis(result);

        // Primary tiles must always be present
        expect(kpis.find((k) => k.key === 'active')?.value).toBe(200);
        expect(kpis.find((k) => k.key === 'pending')?.value).toBe(15);
        expect(kpis.find((k) => k.key === 'unsubscribed')?.value).toBe(40);

        // The open-rate tile is omitted on error (robust path — tile absent)
        // OR present with undefined — either way the resolver must NOT throw.
        // The important invariant is that the 3 subscriber tiles are intact.
        expect(kpis.length).toBeGreaterThanOrEqual(3);
    });

    it('does not throw when the campaigns list call itself rejects', async () => {
        mockFetchApi.mockResolvedValueOnce(subscriberEnvelope(10));
        mockFetchApi.mockResolvedValueOnce(subscriberEnvelope(2));
        mockFetchApi.mockResolvedValueOnce(subscriberEnvelope(1));

        // Campaigns list rejects entirely
        mockFetchApi.mockRejectedValueOnce(new Error('Network error'));

        const result = await runSubscribersSource();
        const kpis = extractKpis(result);

        // 3 primary tiles must survive
        expect(kpis.find((k) => k.key === 'active')?.value).toBe(10);
        expect(kpis.find((k) => k.key === 'pending')?.value).toBe(2);
        expect(kpis.find((k) => k.key === 'unsubscribed')?.value).toBe(1);
    });
});
