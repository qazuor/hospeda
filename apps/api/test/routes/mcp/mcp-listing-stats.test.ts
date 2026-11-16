/**
 * HOS-2184 T-024 — `get_listing_stats` served end to end through the REAL
 * `/mcp` route with the REAL registry (`initApp`, real `mcpAuthMiddleware`,
 * real SDK handler). Outer-boundary mocks are the ones `mcp-listing-tools.test.ts`
 * uses; `getById` is spied on the vertical service prototype, the views on the
 * `entityViewService` singleton, and the latest-reviews reader (the tool's only
 * database access) is mocked at its module boundary.
 */

import { getDb } from '@repo/db';
import { PublicationStatusEnum } from '@repo/schemas';
import { type Actor, entityViewService, VenueService } from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { USER_ID, CLIENT_ID, VALID_TOKEN, ACTOR, findOneMock, latestReviews } = vi.hoisted(() => {
    const userId = '6c1e4d2b-9a8f-4e7d-a6c5-b4a3928170f6';
    return {
        USER_ID: userId,
        CLIENT_ID: 'https://claude.ai/oauth/mcp-client-metadata',
        VALID_TOKEN: 'valid-access-token-0123456789',
        ACTOR: { id: userId, roles: ['HOST'], permissions: [], emailVerified: true },
        findOneMock: vi.fn(),
        latestReviews: vi.fn()
    };
});

vi.mock('../../../src/mcp/tools/listing/listing-stats-readers', () => ({
    readLatestListingReviews: latestReviews
}));

vi.mock('../../../src/lib/mcp/record-tool-call', () => ({ recordMcpToolCall: vi.fn() }));

vi.mock('../../../src/lib/auth', () => {
    const instance = {
        api: { getSession: async () => null },
        handler: async () => new Response(null, { status: 404 }),
        $context: Promise.resolve({
            baseURL: 'https://api.test/api/auth',
            adapter: { findOne: findOneMock }
        })
    };
    return { getAuth: () => instance };
});

vi.mock('@better-auth/oauth-provider/resource-client', () => ({
    oauthProviderResourceClient: () => ({
        getActions: () => ({
            verifyAccessTokenRequest: async (request: Request) => {
                if (request.headers.get('authorization') === `Bearer ${VALID_TOKEN}`) {
                    return { sub: USER_ID, client_id: CLIENT_ID, scope: 'openid' };
                }
                const error = new Error('invalid access token') as Error & {
                    status: string;
                    statusCode: number;
                };
                error.name = 'APIError';
                error.status = 'UNAUTHORIZED';
                error.statusCode = 401;
                throw error;
            }
        })
    })
}));

vi.mock('../../../src/middlewares/actor', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../src/middlewares/actor')>()),
    buildActorForUser: vi.fn(async () => ({ ...ACTOR }) as unknown as Actor)
}));

import { initApp } from '../../../src/app';
import { TOOL_NOT_FOUND_MESSAGE } from '../../../src/mcp/tools/tool-errors';
import { env, validateApiEnv } from '../../../src/utils/env';

const PROTOCOL_VERSION = '2025-06-18';

/** Points the global `getDb` mock at a live user row (bearer middleware). */
function givenLiveUser(): void {
    const row = {
        id: USER_ID,
        name: 'Ana',
        email: 'ana@test.dev',
        image: null,
        emailVerified: true,
        mustChangePassword: false,
        deletedAt: null,
        banned: false,
        banExpires: null
    };
    const limit = vi.fn().mockResolvedValue([row]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    vi.mocked(getDb).mockReturnValue({ select } as unknown as ReturnType<typeof getDb>);
}

interface RpcResult {
    readonly error?: { readonly code: number; readonly message: string };
    readonly result?: {
        readonly tools?: readonly Record<string, unknown>[];
        readonly content?: readonly { readonly text: string }[];
        readonly isError?: boolean;
    };
}

/** Sends one JSON-RPC request to `/mcp` and reads the (JSON or SSE) answer. */
async function rpc(method: string, params: Record<string, unknown>): Promise<RpcResult> {
    const res = await initApp().request('/mcp', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            accept: 'application/json, text/event-stream',
            authorization: `Bearer ${VALID_TOKEN}`,
            'mcp-protocol-version': PROTOCOL_VERSION
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    const payload = (res.headers.get('content-type') ?? '').includes('text/event-stream')
        ? (text.split('\n').find((l) => l.startsWith('data: ')) ?? 'data: null').slice(6)
        : text;
    return JSON.parse(payload) as RpcResult;
}

const callTool = (name: string, args: Record<string, unknown>) =>
    rpc('tools/call', { name, arguments: args });

const VENUE_ID = 'b1111111-1111-4111-8111-111111111111';

describe('/mcp get_listing_stats (end to end)', () => {
    const original = {
        enabled: undefined as boolean | undefined,
        url: undefined as string | undefined
    };

    beforeAll(() => {
        validateApiEnv();
        original.enabled = env.HOSPEDA_MCP_ENABLED;
        original.url = env.HOSPEDA_MCP_RESOURCE_URL;
    });

    beforeEach(() => {
        env.HOSPEDA_MCP_ENABLED = true;
        env.HOSPEDA_MCP_RESOURCE_URL = 'https://api.test/mcp';
        givenLiveUser();
        findOneMock.mockImplementation(async ({ model }: { readonly model: string }) =>
            model === 'oauthClient' ? { name: 'Claude', disabled: false } : { id: 'consent-1' }
        );
        latestReviews.mockResolvedValue([]);
    });

    afterEach(() => {
        env.HOSPEDA_MCP_ENABLED = original.enabled as boolean;
        env.HOSPEDA_MCP_RESOURCE_URL = original.url;
        vi.mocked(getDb).mockReset();
        findOneMock.mockReset();
        latestReviews.mockReset();
        vi.restoreAllMocks();
    });

    it('lists get_listing_stats as a read-only tool', async () => {
        // Act
        const message = await rpc('tools/list', {});

        // Assert
        const entry = message.result?.tools?.find((t) => t.name === 'get_listing_stats');
        expect(entry).toMatchObject({
            annotations: {
                title: 'Estadísticas de la publicación',
                readOnlyHint: true,
                openWorldHint: false
            },
            inputSchema: { type: 'object', required: ['vertical', 'listingId'] }
        });
        expect(String(entry?.description)).toContain('untrusted_data');
    });

    it("returns the token subject's listing views and reviews", async () => {
        // Arrange
        vi.spyOn(VenueService.prototype, 'getById').mockResolvedValue({
            data: {
                id: VENUE_ID,
                ownerId: USER_ID,
                name: 'La Parrilla',
                slug: 'la-parrilla',
                publicationStatus: PublicationStatusEnum.PUBLISHED,
                reviewsCount: 2,
                averageRating: 4
            }
        } as unknown as Awaited<ReturnType<VenueService['getById']>>);
        const views = vi
            .spyOn(entityViewService, 'getDailySeriesComparisonForOwnListing')
            .mockResolvedValue({
                data: {
                    previous: [
                        { date: '2026-06-07', total: 2 },
                        { date: '2026-06-08', total: 2 }
                    ],
                    current: [
                        { date: '2026-06-09', total: 5 },
                        { date: '2026-06-10', total: 1 }
                    ]
                }
            });
        latestReviews.mockResolvedValue([
            {
                title: null,
                content: 'Muy rica la parrilla',
                averageRating: 4,
                createdAt: new Date('2026-06-10T12:00:00Z')
            }
        ]);

        // Act
        const message = await callTool('get_listing_stats', {
            vertical: 'venue',
            listingId: VENUE_ID,
            period: '7d'
        });

        // Assert
        expect(message.result?.isError).toBeUndefined();
        expect(views).toHaveBeenCalledWith(
            expect.objectContaining({
                entityType: 'VENUE',
                listingId: VENUE_ID,
                window: '7d'
            })
        );
        expect(JSON.parse(message.result?.content?.[0]?.text ?? 'null')).toEqual({
            listingId: VENUE_ID,
            vertical: 'venue',
            name: 'La Parrilla',
            period: '7d',
            views: {
                current: { from: '2026-06-09', to: '2026-06-10', views: 6 },
                previous: { from: '2026-06-07', to: '2026-06-08', views: 4 },
                change: 2,
                changePercent: 50
            },
            reviews: {
                count: 2,
                averageRating: 4,
                latest: [
                    {
                        title: null,
                        comment:
                            '<untrusted_data source="review">\nMuy rica la parrilla\n</untrusted_data>',
                        rating: 4,
                        createdAt: '2026-06-10T12:00:00.000Z'
                    }
                ]
            }
        });
    });

    it("answers another user's listing as not found", async () => {
        // Arrange
        vi.spyOn(VenueService.prototype, 'getById').mockResolvedValue({
            data: {
                id: VENUE_ID,
                ownerId: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d',
                name: 'Ajena',
                slug: 'ajena',
                publicationStatus: PublicationStatusEnum.PUBLISHED,
                reviewsCount: 0,
                averageRating: 0
            }
        } as unknown as Awaited<ReturnType<VenueService['getById']>>);
        const views = vi.spyOn(entityViewService, 'getDailySeriesComparisonForOwnListing');

        // Act
        const message = await callTool('get_listing_stats', {
            vertical: 'venue',
            listingId: VENUE_ID
        });

        // Assert
        expect(message.result).toMatchObject({
            isError: true,
            content: [{ text: TOOL_NOT_FOUND_MESSAGE }]
        });
        expect(views).not.toHaveBeenCalled();
    });
});
