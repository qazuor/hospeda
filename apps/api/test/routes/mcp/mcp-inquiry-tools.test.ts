/**
 * HOS-2184 T-020/T-021 — the inquiry tools served end to end through the REAL
 * `/mcp` route with the REAL registry (`initApp`, real `mcpAuthMiddleware`,
 * real SDK handler). Outer-boundary mocks are the ones `mcp-listing-tools.test.ts`
 * uses; `ConversationService` is spied on its prototype and the display-data
 * readers (the tools' only database access) are mocked at their module
 * boundary.
 */

import { getDb } from '@repo/db';
import { ConversationStatusEnum, PermissionEnum } from '@repo/schemas';
import { type Actor, ConversationService } from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { USER_ID, CLIENT_ID, VALID_TOKEN, ACTOR, findOneMock, ownerAccommodationIds, listContext } =
    vi.hoisted(() => {
        const userId = '6c1e4d2b-9a8f-4e7d-a6c5-b4a3928170f6';
        return {
            USER_ID: userId,
            CLIENT_ID: 'https://claude.ai/oauth/mcp-client-metadata',
            VALID_TOKEN: 'valid-access-token-0123456789',
            ACTOR: { id: userId, roles: ['HOST'], emailVerified: true },
            findOneMock: vi.fn(),
            ownerAccommodationIds: vi.fn(),
            listContext: vi.fn()
        };
    });

vi.mock('../../../src/mcp/tools/inquiry/inquiry-readers', () => ({
    readOwnerAccommodationIds: ownerAccommodationIds,
    readInquiryListContext: listContext,
    readInquiryThreadContext: vi.fn()
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
    buildActorForUser: vi.fn(
        async () =>
            ({
                ...ACTOR,
                permissions: [PermissionEnum.CONVERSATION_VIEW_OWN]
            }) as unknown as Actor
    )
}));

import { initApp } from '../../../src/app';
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

const ACC_ID = 'a1111111-1111-4111-8111-111111111111';
const CONV_ID = 'c1111111-1111-4111-8111-111111111111';

describe('/mcp inquiry tools (end to end)', () => {
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
        ownerAccommodationIds.mockReset();
        listContext.mockReset();
        vi.restoreAllMocks();
    });

    it('lists list_inquiries as a read-only tool', async () => {
        // Act
        const message = await rpc('tools/list', {});

        // Assert
        const entry = message.result?.tools?.find((t) => t.name === 'list_inquiries');
        expect(entry).toMatchObject({
            annotations: { title: 'Mis consultas', readOnlyHint: true, openWorldHint: false },
            inputSchema: { type: 'object' }
        });
        expect(String(entry?.description)).toContain('untrusted_data');
    });

    it("list_inquiries returns the token subject's inquiries with guest text wrapped", async () => {
        // Arrange
        ownerAccommodationIds.mockResolvedValue([ACC_ID]);
        listContext.mockResolvedValue({
            accommodationNames: new Map([[ACC_ID, 'Cabañas del Río']]),
            guestNames: new Map(),
            lastMessages: new Map([[CONV_ID, 'Hola, ¿hay lugar para febrero?']]),
            unreadCounts: new Map([[CONV_ID, 1]])
        });
        const listForOwner = vi
            .spyOn(ConversationService.prototype, 'listForOwner')
            .mockResolvedValue({
                data: {
                    items: [
                        {
                            id: CONV_ID,
                            accommodationId: ACC_ID,
                            userId: null,
                            anonymousName: 'Lucía',
                            status: ConversationStatusEnum.PENDING_OWNER,
                            lastActivityAt: new Date('2026-11-10T12:00:00Z'),
                            createdAt: new Date('2026-11-09T08:00:00Z')
                        }
                    ],
                    total: 1,
                    page: 1,
                    pageSize: 20
                }
            } as unknown as Awaited<ReturnType<ConversationService['listForOwner']>>);

        // Act
        const message = await callTool('list_inquiries', { status: 'PENDING_OWNER' });

        // Assert
        expect(message.result?.isError).toBeUndefined();
        expect(listForOwner).toHaveBeenCalledWith(
            expect.objectContaining({ id: USER_ID }),
            expect.objectContaining({
                userId: USER_ID,
                accommodationIds: [ACC_ID],
                status: 'PENDING_OWNER'
            })
        );
        expect(JSON.parse(message.result?.content?.[0]?.text ?? 'null')).toEqual({
            inquiries: [
                {
                    id: CONV_ID,
                    accommodationId: ACC_ID,
                    accommodationName: 'Cabañas del Río',
                    status: 'PENDING_OWNER',
                    guestName: '<untrusted_data source="guest_name">\nLucía\n</untrusted_data>',
                    lastMessagePreview:
                        '<untrusted_data source="guest_message">\nHola, ¿hay lugar para febrero?\n</untrusted_data>',
                    unreadCount: 1,
                    lastActivityAt: '2026-11-10T12:00:00.000Z',
                    createdAt: '2026-11-09T08:00:00.000Z'
                }
            ],
            pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
        });
    });
});
