/**
 * HOS-2247 — `reply_inquiry` confirmed out of band, end to end through the REAL
 * `/mcp` route on protocol revision 2026-07-28 (`initApp`, real
 * `mcpAuthMiddleware`, real SDK handler with the low-level `Server`, real
 * confirmation store over an in-memory Redis fake). It proves the SDK hands the
 * per-request envelope, `inputResponses` and `requestState` to the
 * `tools/call` handler (spec U-11), and covers AC-C57 to AC-C63 on the wire.
 * Same outer-boundary mocks as `mcp-reply-inquiry.test.ts`.
 */

import {
    CLIENT_CAPABILITIES_META_KEY,
    PROTOCOL_VERSION_META_KEY
} from '@modelcontextprotocol/server';
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
                permissions: [PermissionEnum.CONVERSATION_REPLY_OWN]
            }) as unknown as Actor
    )
}));

import { initApp } from '../../../src/app';
import { blockForConfirmation } from '../../../src/mcp/tools/confirmation-text';
import {
    ELICITATION_REASON_MESSAGES,
    ELICITATION_STATE_INVALID_REASON
} from '../../../src/mcp/tools/elicitation-confirmation';
import { env, validateApiEnv } from '../../../src/utils/env';

const MODERN = '2026-07-28';
const LEGACY = '2025-06-18';

/** A JSON-RPC answer, read loosely: the tests assert its shape. */
interface RpcResult {
    readonly error?: { readonly code: number; readonly message: string };
    readonly result?: Record<string, unknown> & {
        readonly content?: readonly { readonly text: string }[];
        readonly isError?: boolean;
    };
}

/** How a test call presents itself. */
interface CallOptions {
    /** Protocol revision; the 2026-07-28 one carries the `_meta` envelope. */
    readonly version?: string;
    /** `clientCapabilities.elicitation` of the envelope (`null`: not declared). */
    readonly elicitation?: unknown;
    /** The retry's state and answers. */
    readonly retry?: { readonly requestState?: string; readonly inputResponses?: unknown };
}

/** Sends one `tools/call` of `reply_inquiry` to `/mcp` and reads the (JSON or SSE) answer. */
async function callReply(
    args: Record<string, unknown>,
    { version = MODERN, elicitation = {}, retry }: CallOptions = {}
): Promise<RpcResult> {
    const modern = version >= MODERN;
    const params = {
        name: 'reply_inquiry',
        arguments: args,
        ...(modern
            ? {
                  _meta: {
                      [PROTOCOL_VERSION_META_KEY]: version,
                      [CLIENT_CAPABILITIES_META_KEY]: elicitation === null ? {} : { elicitation }
                  }
              }
            : {}),
        ...(retry ?? {})
    };
    const res = await initApp().request('/mcp', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            accept: 'application/json, text/event-stream',
            authorization: `Bearer ${VALID_TOKEN}`,
            'mcp-protocol-version': version,
            // 2026-07-28 transport: method and tool name repeated as headers.
            ...(modern ? { 'mcp-method': 'tools/call', 'mcp-name': 'reply_inquiry' } : {})
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params })
    });
    const text = await res.text();
    expect(res.status, text).toBe(200);
    const payload = (res.headers.get('content-type') ?? '').includes('text/event-stream')
        ? (text.split('\n').find((l) => l.startsWith('data: ')) ?? 'data: null').slice(6)
        : text;
    return JSON.parse(payload) as RpcResult;
}

/** The answer a client sends back for the `confirm` request. */
const answer = (response: unknown) => ({ confirm: response });
const CONFIRMED = answer({ action: 'accept', content: { confirm: true } });

/** Text of a tool result. */
const textOf = (message: RpcResult): string => message.result?.content?.[0]?.text ?? '';

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

describe('/mcp reply_inquiry confirmed out of band (2026-07-28, end to end)', () => {
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

    /** Step 1 on a capable client: the state the client must echo back. */
    async function askConfirmation(
        args: Record<string, unknown> = { inquiryId: CONV_ID, text: TEXT }
    ) {
        const first = await callReply(args);
        expect(first.error).toBeUndefined();
        expect(first.result?.resultType).toBe('input_required');
        const state = first.result?.requestState;
        if (typeof state !== 'string') throw new Error('no requestState');
        return { first, state };
    }

    it('AC-C57: a capable client gets ONE form elicitation with the exact text and the inquiry label, and nothing is sent', async () => {
        // Act
        const { first, state } = await askConfirmation();

        // Assert
        const requests = first.result?.inputRequests as Record<
            string,
            { method: string; params: Record<string, unknown> }
        >;
        expect(Object.keys(requests)).toEqual(['confirm']);
        expect(requests.confirm?.method).toBe('elicitation/create');
        const params = requests.confirm?.params ?? {};
        expect(params.mode).toBe('form');
        expect(params.message).toContain(`\n${blockForConfirmation({ text: TEXT })}\n`);
        expect(params.message).toContain('\n│ Hola Lucía, sí tenemos lugar. ¡Te espero\n│ !\n');
        expect(params.message).toContain('Cabañas del Río');
        expect(params.message).toContain('Lucía');
        expect(params.requestedSchema).toEqual({
            type: 'object',
            properties: { confirm: expect.objectContaining({ type: 'boolean' }) },
            required: ['confirm']
        });
        expect(JSON.stringify(first)).not.toContain('confirmationToken');
        expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(createMessage).not.toHaveBeenCalled();
        expect([...fake.data.keys()]).toEqual([
            expect.stringMatching(/^mcp:elicit:reply_inquiry:/)
        ]);
    });

    it('AC-C58: confirm on the retry sends exactly once, and audits preview then commit as elicitation', async () => {
        // Arrange
        const { state } = await askConfirmation();

        // Act
        const second = await callReply(
            { inquiryId: CONV_ID, text: TEXT },
            { retry: { requestState: state, inputResponses: CONFIRMED } }
        );

        // Assert
        expect(second.result?.isError).toBeUndefined();
        expect(JSON.parse(textOf(second))).toMatchObject({ status: 'sent', messageId: 'msg-1' });
        expect(createMessage).toHaveBeenCalledTimes(1);
        expect(createMessage).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ body: TEXT })
        );
        expect(recordCall.mock.calls.map(([call]) => [call.outcome, call.details])).toEqual([
            ['success', { step: 'preview', confirmation: 'elicitation' }],
            ['success', { step: 'commit', confirmation: 'elicitation' }]
        ]);
    });

    it.each([
        ['a decline', answer({ action: 'decline' }), 'USER_DECLINED'],
        [
            'confirm left unchecked',
            answer({ action: 'accept', content: { confirm: false } }),
            'USER_DECLINED'
        ],
        ['a cancel', answer({ action: 'cancel' }), 'USER_CANCELLED'],
        ['no answer at all', undefined, 'USER_CANCELLED']
    ])('AC-C59: %s writes nothing, burns the state and is audited as denied', async (_label, inputResponses, code) => {
        // Arrange
        const { state } = await askConfirmation();

        // Act
        const second = await callReply(
            { inquiryId: CONV_ID, text: TEXT },
            { retry: { requestState: state, ...(inputResponses ? { inputResponses } : {}) } }
        );

        // Assert
        expect(second.result?.isError).toBe(true);
        expect(createMessage).not.toHaveBeenCalled();
        expect(fake.data.size).toBe(0);
        expect(recordCall).toHaveBeenLastCalledWith(
            expect.objectContaining({
                outcome: 'denied',
                errorCode: code,
                details: { step: 'declined', confirmation: 'elicitation' }
            })
        );
    });

    it('AC-C60: a reused, unknown, expired or altered state writes nothing and gets the same refusal', async () => {
        // Arrange
        const used = await askConfirmation();
        await callReply(
            { inquiryId: CONV_ID, text: TEXT },
            { retry: { requestState: used.state, inputResponses: CONFIRMED } }
        );
        const expired = await askConfirmation();
        fake.data.clear();
        const altered = await askConfirmation();
        const retryWith = (state: string, args = { inquiryId: CONV_ID, text: TEXT }) =>
            callReply(args, { retry: { requestState: state, inputResponses: CONFIRMED } });

        // Act
        const refusals = [
            await retryWith(used.state),
            await retryWith('Zm9yZ2VkLXN0YXRlLW5vYm9keS1ldmVyLWlzc3VlZC14eHg'),
            await retryWith(expired.state),
            await retryWith(altered.state, { inquiryId: CONV_ID, text: `${TEXT} Y algo más.` })
        ];
        const genuineAfterAltered = await retryWith(altered.state);

        // Assert
        expect(createMessage).toHaveBeenCalledTimes(1);
        const texts = new Set(refusals.map(textOf));
        expect(texts.size).toBe(1);
        expect(refusals.every((r) => r.result?.isError === true)).toBe(true);
        expect(textOf(genuineAfterAltered)).toBe([...texts][0]);
    });

    it.each([
        [
            'an inquiry that is not found',
            { inquiryId: 'c9999999-9999-4999-8999-999999999999', text: TEXT }
        ],
        ['malformed input', { inquiryId: CONV_ID, text: '' }]
    ])('L2: a retry refused before settling (%s) still burns the state', async (_label, args) => {
        // Arrange
        const { state } = await askConfirmation();

        // Act
        const refused = await callReply(args, {
            retry: { requestState: state, inputResponses: CONFIRMED }
        });
        const genuine = await callReply(
            { inquiryId: CONV_ID, text: TEXT },
            { retry: { requestState: state, inputResponses: CONFIRMED } }
        );

        // Assert
        expect(refused.result?.isError).toBe(true);
        expect(genuine.result?.isError).toBe(true);
        expect(textOf(genuine)).toContain(
            ELICITATION_REASON_MESSAGES[ELICITATION_STATE_INVALID_REASON]
        );
        expect(createMessage).not.toHaveBeenCalled();
        expect(fake.data.size).toBe(0);
    });

    it('AC-C61: two retries racing with the same state write exactly once', async () => {
        // Arrange
        const { state } = await askConfirmation();
        const retry = () =>
            callReply(
                { inquiryId: CONV_ID, text: TEXT },
                { retry: { requestState: state, inputResponses: CONFIRMED } }
            );

        // Act
        const results = await Promise.all([retry(), retry()]);

        // Assert
        expect(createMessage).toHaveBeenCalledTimes(1);
        expect(results.filter((r) => r.result?.isError === true)).toHaveLength(1);
    });

    it('AC-C63: a capable client never gets a token, and one it sends is refused with nothing written', async () => {
        // Arrange: a token issued to the same user on a client without the capability.
        const legacyPreview = await callReply(
            { inquiryId: CONV_ID, text: TEXT },
            { version: LEGACY }
        );
        const token = JSON.parse(textOf(legacyPreview)).confirmationToken;
        expect(typeof token).toBe('string');

        // Act
        const withToken = await callReply({
            inquiryId: CONV_ID,
            text: TEXT,
            confirmationToken: token
        });

        // Assert
        expect(withToken.result?.isError).toBe(true);
        expect(textOf(withToken)).toContain('SIN confirmationToken');
        expect(createMessage).not.toHaveBeenCalled();
        expect(recordCall).toHaveBeenLastCalledWith(
            expect.objectContaining({
                errorCode: 'VALIDATION_ERROR',
                details: { step: 'commit', confirmation: 'token' }
            })
        );
    });

    it.each([
        ['a 2025-era client', { version: LEGACY }],
        ['a 2026-07-28 client without elicitation', { elicitation: null }],
        ['a 2026-07-28 client with URL elicitation only', { elicitation: { url: {} } }]
    ])('AC-C62: %s keeps the token flow', async (_label, options) => {
        // Act
        const preview = await callReply({ inquiryId: CONV_ID, text: TEXT }, options);
        const data = JSON.parse(textOf(preview));
        const sent = await callReply(
            { inquiryId: CONV_ID, text: TEXT, confirmationToken: data.confirmationToken },
            options
        );

        // Assert
        expect(preview.result?.resultType ?? 'complete').not.toBe('input_required');
        expect(data).toMatchObject({ status: 'confirmation_required', text: TEXT });
        expect(JSON.parse(textOf(sent))).toMatchObject({ status: 'sent' });
        expect(createMessage).toHaveBeenCalledTimes(1);
        expect(recordCall.mock.calls.map(([call]) => call.details)).toEqual([
            { step: 'preview' },
            { step: 'commit' }
        ]);
    });
});
