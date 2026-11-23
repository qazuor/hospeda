/**
 * HOS-2184 T-023 — `reply_inquiry` served end to end through the REAL `/mcp`
 * route with the REAL registry (`initApp`, real `mcpAuthMiddleware`, real SDK
 * handler, real confirmation-token store over an in-memory Redis fake). Outer
 * boundary mocks are the ones `mcp-inquiry-tools.test.ts` uses;
 * `ConversationService` and `MessageService` are spied on their prototypes.
 */

import { getDb } from '@repo/db';
import { ConversationStatusEnum, PermissionEnum } from '@repo/schemas';
import { type Actor, ConversationService, MessageService } from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const {
    USER_ID,
    CLIENT_ID,
    VALID_TOKEN,
    ACTOR,
    findOneMock,
    ownerAccommodationIds,
    listContext,
    threadContext,
    recordCall,
    redisHolder
} = vi.hoisted(() => {
    const userId = '6c1e4d2b-9a8f-4e7d-a6c5-b4a3928170f6';
    return {
        USER_ID: userId,
        CLIENT_ID: 'https://claude.ai/oauth/mcp-client-metadata',
        VALID_TOKEN: 'valid-access-token-0123456789',
        ACTOR: { id: userId, roles: ['HOST'], emailVerified: true },
        findOneMock: vi.fn(),
        ownerAccommodationIds: vi.fn(),
        listContext: vi.fn(),
        threadContext: vi.fn(),
        recordCall: vi.fn(),
        redisHolder: { redis: undefined as unknown }
    };
});

vi.mock('../../../src/mcp/tools/inquiry/inquiry-readers', () => ({
    readOwnerAccommodationIds: ownerAccommodationIds,
    readInquiryListContext: listContext,
    readInquiryThreadContext: threadContext
}));

vi.mock('../../../src/lib/mcp/record-tool-call', () => ({ recordMcpToolCall: recordCall }));

vi.mock('../../../src/utils/redis', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../src/utils/redis')>()),
    getRedisClient: vi.fn(async () => redisHolder.redis)
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
    buildActorForUser: vi.fn(
        async () =>
            ({
                ...ACTOR,
                permissions: [
                    PermissionEnum.ACCOMMODATION_CREATE,
                    PermissionEnum.CONVERSATION_REPLY_OWN
                ]
            }) as unknown as Actor
    )
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
const CONV_ID = 'c1111111-1111-4111-8111-111111111111';
const TEXT = 'Hola Lucía, sí tenemos lugar. ¡Te espero!';

/** In-memory Redis fake (GETDEL single use). */
function makeFakeRedis() {
    const data = new Map<string, string>();
    return {
        data,
        set: vi.fn(async (key: string, value: string) => {
            data.set(key, value);
            return 'OK';
        }),
        getdel: vi.fn(async (key: string) => {
            const value = data.get(key) ?? null;
            data.delete(key);
            return value;
        })
    };
}

type OwnedResult = Awaited<ReturnType<ConversationService['findOwnedConversation']>>;
type CreatedResult = Awaited<ReturnType<MessageService['createMessage']>>;

describe('/mcp reply_inquiry (end to end)', () => {
    const original = {
        enabled: undefined as boolean | undefined,
        url: undefined as string | undefined
    };
    let fake: ReturnType<typeof makeFakeRedis>;
    let createMessage: ReturnType<typeof vi.spyOn>;

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
        fake = makeFakeRedis();
        redisHolder.redis = fake;
        threadContext.mockResolvedValue({ accommodationName: 'Cabañas del Río', guestName: null });
        vi.spyOn(ConversationService.prototype, 'findOwnedConversation').mockImplementation(
            async (_actor, input) =>
                ({
                    data:
                        input.conversationId === CONV_ID
                            ? {
                                  id: CONV_ID,
                                  accommodationId: ACC_ID,
                                  userId: null,
                                  anonymousName: 'Lucía',
                                  status: ConversationStatusEnum.PENDING_OWNER
                              }
                            : null
                }) as unknown as OwnedResult
        );
        vi.spyOn(MessageService.prototype, 'assertMessageBodyAllowed').mockResolvedValue(undefined);
        vi.spyOn(ConversationService.prototype, 'markReadByOwner').mockResolvedValue({
            data: { conversationId: CONV_ID }
        });
        createMessage = vi.spyOn(MessageService.prototype, 'createMessage').mockResolvedValue({
            data: { id: 'msg-1', createdAt: new Date('2026-11-16T12:00:00Z') }
        } as unknown as CreatedResult);
    });

    afterEach(() => {
        env.HOSPEDA_MCP_ENABLED = original.enabled as boolean;
        env.HOSPEDA_MCP_RESOURCE_URL = original.url;
        vi.mocked(getDb).mockReset();
        findOneMock.mockReset();
        ownerAccommodationIds.mockReset();
        listContext.mockReset();
        threadContext.mockReset();
        recordCall.mockReset();
        vi.restoreAllMocks();
    });

    it('lists reply_inquiry as a write tool that messages a third party', async () => {
        // Act
        const message = await rpc('tools/list', {});

        // Assert
        const entry = message.result?.tools?.find((t) => t.name === 'reply_inquiry');
        expect(entry).toMatchObject({
            annotations: {
                title: 'Responder consulta',
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: true
            },
            inputSchema: { type: 'object', required: ['inquiryId', 'text'] }
        });
        expect(String(entry?.description)).toContain('untrusted_data');
    });

    it('previews first, then sends exactly the confirmed text, and audits both calls', async () => {
        // Act: step 1
        const first = await callTool('reply_inquiry', { inquiryId: CONV_ID, text: TEXT });

        // Assert: preview, nothing sent
        expect(first.result?.isError).toBeUndefined();
        const preview = JSON.parse(first.result?.content?.[0]?.text ?? 'null');
        expect(preview).toMatchObject({
            status: 'confirmation_required',
            inquiryId: CONV_ID,
            accommodationName: 'Cabañas del Río',
            text: TEXT,
            expiresInSeconds: 600
        });
        expect(createMessage).not.toHaveBeenCalled();

        // Act: step 2
        const second = await callTool('reply_inquiry', {
            inquiryId: CONV_ID,
            text: TEXT,
            confirmationToken: preview.confirmationToken
        });

        // Assert: sent, literal, as the token subject
        expect(second.result?.isError).toBeUndefined();
        expect(JSON.parse(second.result?.content?.[0]?.text ?? 'null')).toEqual({
            status: 'sent',
            inquiryId: CONV_ID,
            messageId: 'msg-1',
            sentAt: '2026-11-16T12:00:00.000Z'
        });
        expect(createMessage).toHaveBeenCalledTimes(1);
        expect(createMessage).toHaveBeenCalledWith(expect.anything(), {
            conversationId: CONV_ID,
            senderType: 'OWNER',
            body: TEXT,
            userId: USER_ID
        });
        expect(recordCall).toHaveBeenCalledTimes(2);
        expect(recordCall.mock.calls.map(([call]) => call.details)).toEqual([
            { step: 'preview' },
            { step: 'send' }
        ]);
        expect(recordCall).toHaveBeenLastCalledWith(
            expect.objectContaining({
                tool: 'reply_inquiry',
                outcome: 'success',
                target: { type: 'conversation', id: CONV_ID },
                contentLength: TEXT.length
            })
        );
    });

    it('rejects a reused token and altered text over the wire', async () => {
        // Arrange
        const first = await callTool('reply_inquiry', { inquiryId: CONV_ID, text: TEXT });
        const { confirmationToken } = JSON.parse(first.result?.content?.[0]?.text ?? 'null');

        // Act
        const altered = await callTool('reply_inquiry', {
            inquiryId: CONV_ID,
            text: `${TEXT} Gratis.`,
            confirmationToken
        });
        const reused = await callTool('reply_inquiry', {
            inquiryId: CONV_ID,
            text: TEXT,
            confirmationToken
        });

        // Assert: the mismatch burned the token, nothing was sent
        for (const message of [altered, reused]) {
            expect(message.result?.isError).toBe(true);
            expect(message.result?.content?.[0]?.text).toContain('No se envió nada');
        }
        expect(createMessage).not.toHaveBeenCalled();
        expect(recordCall).toHaveBeenLastCalledWith(
            expect.objectContaining({ tool: 'reply_inquiry', outcome: 'error' })
        );
    });

    it("answers another user's inquiry as not found and issues no token", async () => {
        // Act
        const message = await callTool('reply_inquiry', {
            inquiryId: 'c9999999-9999-4999-8999-999999999999',
            text: TEXT
        });

        // Assert
        expect(message.result).toMatchObject({
            isError: true,
            content: [
                {
                    text: notFoundWithListLink({
                        siteUrl: env.HOSPEDA_SITE_URL,
                        path: 'mi-cuenta/consultas-propietario'
                    })
                }
            ]
        });
        expect(fake.set).not.toHaveBeenCalled();
    });

    it('says so, and sends nothing, when the token store is unavailable', async () => {
        // Arrange
        redisHolder.redis = undefined;

        // Act
        const message = await callTool('reply_inquiry', { inquiryId: CONV_ID, text: TEXT });

        // Assert
        expect(message.result).toMatchObject({ isError: true });
        expect(message.result?.content?.[0]?.text).toContain('El servicio no está disponible');
        expect(createMessage).not.toHaveBeenCalled();
    });
});
