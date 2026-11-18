/**
 * HOS-2184 T-013/T-014/T-016/T-018 — the listing tools served end to end through the REAL
 * `/mcp` route with the REAL registry (`initApp`, real `mcpAuthMiddleware`,
 * real SDK handler, real `registerMcpToolHandlers`). Outer-boundary mocks are
 * the ones `mcp-tools.test.ts` uses; the listing services are spied on their
 * prototypes; the listing-access ports `update_listing_basic` decides
 * through are mocked like `test/middlewares/listing-access.test.ts` does.
 */

import { getDb } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import {
    AccommodationService,
    type Actor,
    AmenityService,
    ExperienceService,
    FeatureService,
    VenueService
} from '@repo/service-core';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { USER_ID, CLIENT_ID, VALID_TOKEN, ACTOR, findOneMock, loadFacts, redisStore } = vi.hoisted(
    () => {
        const userId = '6c1e4d2b-9a8f-4e7d-a6c5-b4a3928170f6';
        return {
            USER_ID: userId,
            CLIENT_ID: 'https://claude.ai/oauth/mcp-client-metadata',
            VALID_TOKEN: 'valid-access-token-0123456789',
            ACTOR: { id: userId, roles: ['HOST'], permissions: [], emailVerified: true },
            findOneMock: vi.fn(),
            loadFacts: vi.fn(),
            redisStore: new Map<string, string>()
        };
    }
);

// Publishing is two steps (HOS-2247, D-19): the confirmation store over a Map.
vi.mock('../../../src/utils/redis', () => ({
    getRedisClient: vi.fn(async () => ({
        set: async (key: string, value: string) => {
            redisStore.set(key, value);
            return 'OK';
        },
        getdel: async (key: string) => {
            const value = redisStore.get(key) ?? null;
            redisStore.delete(key);
            return value;
        }
    }))
}));

vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts,
        billing: { coverage: async () => ({ covered: true, sources: [{ type: 'BASE' }] }) },
        effectiveSet: async ({ userId }: { readonly userId: string }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical: VerticalEnum.VENUE,
                hasLiveNonTrialTitle: true,
                inheritsTouristVip: false,
                entries: [
                    { key: 'edit_venue_info', value: 1, strategy: 'MAX' },
                    { key: 'publish_venue', value: 1, strategy: 'MAX' }
                ]
            }),
        preTrialDraftLimits: async () => new Map()
    })
}));

vi.mock('../../../src/lib/mcp/record-tool-call', () => ({ recordMcpToolCall: vi.fn() }));

// The catalog-relation readers are the tools' only database access.
vi.mock('../../../src/utils/listing-catalog-relations', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../src/utils/listing-catalog-relations')>()),
    fetchVenueAmenities: vi.fn(async () => [
        { amenityId: '44444444-4444-4444-8444-444444444444', slug: 'wifi' }
    ]),
    fetchVenueFeatures: vi.fn(async () => [])
}));

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
import { env, validateApiEnv } from '../../../src/utils/env';
import { notFoundWithListLink } from './not-found-text';

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

const ACC_ID = 'a1111111-1111-4111-8111-111111111111';
const VENUE_ID = 'b1111111-1111-4111-8111-111111111111';

describe('/mcp listing tools (end to end)', () => {
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
    });

    afterEach(() => {
        env.HOSPEDA_MCP_ENABLED = original.enabled as boolean;
        env.HOSPEDA_MCP_RESOURCE_URL = original.url;
        vi.mocked(getDb).mockReset();
        findOneMock.mockReset();
        vi.restoreAllMocks();
    });

    it('lists list_my_listings and get_listing as read-only tools', async () => {
        // Act
        const message = await rpc('tools/list', {});

        // Assert
        expect(message.result?.tools).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'list_my_listings',
                    annotations: {
                        title: 'Mis publicaciones',
                        readOnlyHint: true,
                        openWorldHint: false
                    }
                }),
                expect.objectContaining({
                    name: 'get_listing',
                    annotations: {
                        title: 'Ver publicación',
                        readOnlyHint: true,
                        openWorldHint: false
                    },
                    inputSchema: expect.objectContaining({ required: ['vertical', 'id'] })
                })
            ])
        );
    });

    it('lists list_amenities_and_features as read-only and serves the catalog', async () => {
        // Arrange
        vi.spyOn(AmenityService.prototype, 'search').mockResolvedValue({
            data: {
                items: [{ id: '44444444-4444-4444-8444-444444444444', slug: 'wifi' }],
                total: 1
            }
        } as unknown as Awaited<ReturnType<AmenityService['search']>>);
        vi.spyOn(FeatureService.prototype, 'search').mockResolvedValue({
            data: { items: [], total: 0 }
        } as unknown as Awaited<ReturnType<FeatureService['search']>>);

        // Act
        const list = await rpc('tools/list', {});
        const call = await callTool('list_amenities_and_features', { vertical: 'venue' });

        // Assert
        expect(list.result?.tools).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'list_amenities_and_features',
                    annotations: expect.objectContaining({ readOnlyHint: true }),
                    inputSchema: expect.objectContaining({ required: ['vertical'] })
                })
            ])
        );
        expect(call.result?.isError).toBeUndefined();
        const body = JSON.parse(call.result?.content?.[0]?.text ?? 'null');
        expect(body.features).toEqual([]);
        expect(body.amenities).toHaveLength(1);
        expect(body.amenities[0]).toMatchObject({
            id: '44444444-4444-4444-8444-444444444444',
            slug: 'wifi'
        });
        expect(body.amenities[0].name).not.toBe('wifi');
    });

    it("list_my_listings returns the token subject's listings", async () => {
        // Arrange
        const accList = vi.spyOn(AccommodationService.prototype, 'list').mockResolvedValue({
            data: {
                items: [
                    {
                        id: ACC_ID,
                        name: 'Cabañas del Río',
                        publicationStatus: PublicationStatusEnum.PUBLISHED
                    }
                ],
                total: 1
            }
        } as unknown as Awaited<ReturnType<AccommodationService['list']>>);
        vi.spyOn(VenueService.prototype, 'listOwn').mockResolvedValue({
            data: {
                listings: [
                    {
                        id: VENUE_ID,
                        name: 'La Parrilla',
                        publicationStatus: PublicationStatusEnum.DRAFT
                    }
                ]
            }
        } as unknown as Awaited<ReturnType<VenueService['listOwn']>>);
        vi.spyOn(ExperienceService.prototype, 'listOwn').mockResolvedValue({
            data: { listings: [] }
        } as unknown as Awaited<ReturnType<ExperienceService['listOwn']>>);

        // Act
        const message = await callTool('list_my_listings', {});

        // Assert
        expect(message.result?.isError).toBeUndefined();
        expect(JSON.parse(message.result?.content?.[0]?.text ?? 'null')).toEqual({
            listings: [
                {
                    id: ACC_ID,
                    vertical: 'accommodation',
                    name: 'Cabañas del Río',
                    publicationStatus: 'PUBLISHED'
                },
                {
                    id: VENUE_ID,
                    vertical: 'venue',
                    name: 'La Parrilla',
                    publicationStatus: 'DRAFT'
                }
            ],
            total: 2,
            hasMore: false
        });
        expect(accList).toHaveBeenCalledWith(
            expect.objectContaining({ id: USER_ID }),
            expect.objectContaining({ where: { ownerId: USER_ID } })
        );
    });

    it('get_listing returns an own venue', async () => {
        // Arrange
        vi.spyOn(VenueService.prototype, 'getById').mockResolvedValue({
            data: {
                id: VENUE_ID,
                ownerId: USER_ID,
                name: 'La Parrilla',
                slug: 'la-parrilla',
                publicationStatus: PublicationStatusEnum.DRAFT,
                description: 'Parrilla de barrio.',
                openingHours: null,
                contactInfo: null
            }
        } as unknown as Awaited<ReturnType<VenueService['getById']>>);

        // Act
        const message = await callTool('get_listing', { vertical: 'venue', id: VENUE_ID });

        // Assert
        expect(message.result?.isError).toBeUndefined();
        expect(JSON.parse(message.result?.content?.[0]?.text ?? 'null')).toEqual({
            id: VENUE_ID,
            vertical: 'venue',
            name: 'La Parrilla',
            publicationStatus: 'DRAFT',
            publicUrl: null,
            description: 'Parrilla de barrio.',
            openingHours: null,
            contactInfo: null,
            amenities: [{ id: '44444444-4444-4444-8444-444444444444', slug: 'wifi' }],
            features: []
        });
    });

    it("get_listing answers another user's venue as not found", async () => {
        // Arrange
        vi.spyOn(VenueService.prototype, 'getById').mockResolvedValue({
            data: {
                id: VENUE_ID,
                ownerId: 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0',
                name: 'Bar Ajeno',
                slug: 'bar-ajeno',
                publicationStatus: PublicationStatusEnum.PUBLISHED
            }
        } as unknown as Awaited<ReturnType<VenueService['getById']>>);

        // Act
        const message = await callTool('get_listing', { vertical: 'venue', id: VENUE_ID });

        // Assert
        expect(message.result).toMatchObject({
            isError: true,
            content: [
                {
                    text: notFoundWithListLink({
                        siteUrl: env.HOSPEDA_SITE_URL,
                        path: 'mi-cuenta/comercio'
                    })
                }
            ]
        });
    });
});
