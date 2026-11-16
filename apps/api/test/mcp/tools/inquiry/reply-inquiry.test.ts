/**
 * HOS-2184 T-023 — `reply_inquiry`: two steps, literal text.
 *
 * Step 1 (no token) previews and stores a token; step 2 (token) sends exactly
 * the previewed text. Services are spied on their prototypes; the token store
 * runs for real against an in-memory Redis fake (GETDEL single use, TTL), and
 * the display-data reader (the tool's only database access) is mocked at its
 * module boundary.
 *
 * @module test/mcp/tools/inquiry/reply-inquiry
 */

import {
    ConversationStatusEnum,
    MessageSenderTypeEnum,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { type Actor, ConversationService, MessageService, ServiceError } from '@repo/service-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { threadContext, redisHolder } = vi.hoisted(() => ({
    threadContext: vi.fn(),
    redisHolder: { redis: undefined as unknown, throwOnGet: false }
}));

vi.mock('../../../../src/mcp/tools/inquiry/inquiry-readers', () => ({
    readOwnerAccommodationIds: vi.fn(),
    readInquiryListContext: vi.fn(),
    readInquiryThreadContext: threadContext
}));
vi.mock('../../../../src/utils/redis', () => ({
    getRedisClient: vi.fn(async () => {
        if (redisHolder.throwOnGet) {
            throw new Error('redis down');
        }
        return redisHolder.redis;
    })
}));

import { CONFIRMATION_TOKEN_TTL_SECONDS } from '../../../../src/mcp/tools/inquiry/confirmation-token-store';
import { replyInquiryTool } from '../../../../src/mcp/tools/inquiry/reply-inquiry';
import { runTool } from '../../../../src/mcp/tools/run-tool';
import {
    TOOL_NOT_FOUND_MESSAGE,
    TOOL_VALIDATION_MESSAGE
} from '../../../../src/mcp/tools/tool-errors';

const OWNER_ID = '1f2e3d4c-5b6a-4789-8abc-def012345678';
const OTHER_ID = '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';
const STAFF_ID = '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b';
const OWN_ACC = 'a1111111-1111-4111-8111-111111111111';
const OTHER_ACC = 'a2222222-2222-4222-8222-222222222222';
const CONV_OWN = 'c1111111-1111-4111-8111-111111111111';
const CONV_OTHER_OWN = 'c3333333-3333-4333-8333-333333333333';
const CONV_BLOCKED = 'c4444444-4444-4444-8444-444444444444';
const CONV_FOREIGN = 'c9999999-9999-4999-8999-999999999999';
const CLIENT = 'https://claude.ai/oauth/mcp-client-metadata';
const TEXT = '  Hola Lucía, sí tenemos lugar.\nTe espero!  ';
const context = { channel: 'mcp', clientId: CLIENT } as const;

const actorFor = (
    id: string,
    permissions: readonly string[] = [PermissionEnum.CONVERSATION_REPLY_OWN]
) => ({ id, roles: ['HOST'], permissions, emailVerified: true }) as unknown as Actor;

const ACCOMMODATION_OWNER: Readonly<Record<string, string>> = {
    [OWN_ACC]: OWNER_ID,
    [OTHER_ACC]: OTHER_ID
};

const conversation = (overrides: Record<string, unknown>) => ({
    id: CONV_OWN,
    accommodationId: OWN_ACC,
    userId: null,
    anonymousName: 'Lucía',
    status: ConversationStatusEnum.PENDING_OWNER,
    ...overrides
});
const CONVERSATIONS = [
    conversation({}),
    conversation({ id: CONV_OTHER_OWN }),
    conversation({ id: CONV_BLOCKED, status: ConversationStatusEnum.BLOCKED }),
    conversation({ id: CONV_FOREIGN, accommodationId: OTHER_ACC })
];

/** In-memory Redis fake with TTL driven by an injected clock. */
function makeFakeRedis() {
    let nowMs = 0;
    const data = new Map<string, { value: string; expiresAt: number }>();
    return {
        redis: {
            set: vi.fn(async (key: string, value: string, _ex: string, seconds: number) => {
                data.set(key, { value, expiresAt: nowMs + seconds * 1000 });
                return 'OK';
            }),
            getdel: vi.fn(async (key: string) => {
                const entry = data.get(key);
                data.delete(key);
                return entry && entry.expiresAt > nowMs ? entry.value : null;
            })
        },
        data,
        advance: (ms: number) => {
            nowMs += ms;
        }
    };
}

type OwnedResult = Awaited<ReturnType<ConversationService['findOwnedConversation']>>;
type CreatedResult = Awaited<ReturnType<MessageService['createMessage']>>;

describe('reply_inquiry', () => {
    let fake: ReturnType<typeof makeFakeRedis>;
    let findOwned: ReturnType<typeof vi.spyOn>;
    let assertBody: ReturnType<typeof vi.spyOn>;
    let createMessage: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        fake = makeFakeRedis();
        redisHolder.redis = fake.redis;
        redisHolder.throwOnGet = false;
        threadContext.mockResolvedValue({ accommodationName: 'Cabañas del Río', guestName: null });
        findOwned = vi
            .spyOn(ConversationService.prototype, 'findOwnedConversation')
            .mockImplementation(async (actor, input) => {
                const found = CONVERSATIONS.find(
                    (c) =>
                        c.id === input.conversationId &&
                        ACCOMMODATION_OWNER[c.accommodationId as string] === actor.id
                );
                return { data: found ?? null } as unknown as OwnedResult;
            });
        assertBody = vi
            .spyOn(MessageService.prototype, 'assertMessageBodyAllowed')
            .mockResolvedValue(undefined);
        createMessage = vi.spyOn(MessageService.prototype, 'createMessage').mockImplementation(
            async (_actor, input) =>
                ({
                    data: {
                        id: 'msg-1',
                        conversationId: input.conversationId,
                        body: input.body,
                        createdAt: new Date('2026-11-16T12:00:00Z')
                    }
                }) as unknown as CreatedResult
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
        threadContext.mockReset();
    });

    /** Runs the tool as the owner unless told otherwise. */
    const run = (
        input: Record<string, unknown>,
        options: { actor?: Actor; ctx?: { channel: 'mcp'; clientId?: string } } = {}
    ) =>
        runTool({
            definition: replyInquiryTool,
            actor: options.actor ?? actorFor(OWNER_ID),
            input,
            context: options.ctx ?? context
        });

    /** Step 1, returning the token. */
    async function preview(text = TEXT, inquiryId = CONV_OWN) {
        const outcome = await run({ inquiryId, text });
        if (!outcome.ok) {
            throw new Error(`expected a preview, got ${outcome.failure.message}`);
        }
        const data = outcome.data as { confirmationToken: string };
        return data.confirmationToken;
    }

    describe('definition', () => {
        it('is an audited write that messages a third party', () => {
            expect(replyInquiryTool.isWrite).toBe(true);
            expect(replyInquiryTool.hints).toEqual({
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: true
            });
            expect(
                replyInquiryTool.auditTarget?.({ input: { inquiryId: CONV_OWN, text: 'x' } })
            ).toEqual({ type: 'conversation', id: CONV_OWN });
            expect(
                replyInquiryTool.auditContentLength?.({
                    input: { inquiryId: CONV_OWN, text: TEXT }
                })
            ).toBe(TEXT.length);
        });

        it('demands verbatim text in the parameter description', () => {
            const text = replyInquiryTool.inputSchema.shape.text.description ?? '';
            expect(text).toContain('verbatim');
            expect(text).toContain('Do not rewrite');
        });
    });

    describe('step 1: preview', () => {
        it('returns the exact text, the context and a token, and sends nothing', async () => {
            const outcome = await run({ inquiryId: CONV_OWN, text: TEXT });

            expect(outcome.ok).toBe(true);
            if (!outcome.ok) return;
            expect(outcome.data).toMatchObject({
                status: 'confirmation_required',
                inquiryId: CONV_OWN,
                accommodationName: 'Cabañas del Río',
                guestName: '<untrusted_data source="guest_name">\nLucía\n</untrusted_data>',
                text: TEXT,
                expiresInSeconds: CONFIRMATION_TOKEN_TTL_SECONDS
            });
            const data = outcome.data as { confirmationToken: string; instructions: string };
            expect(data.confirmationToken.length).toBeGreaterThanOrEqual(43);
            expect(data.instructions).toContain('NO se envió nada');
            expect(data.instructions).toContain('confirmationToken');
            expect(createMessage).not.toHaveBeenCalled();
            expect(assertBody).toHaveBeenCalledWith({ body: TEXT });
            expect(fake.data.size).toBe(1);
        });

        it('keeps the text byte for byte (no trimming)', async () => {
            const outcome = await run({ inquiryId: CONV_OWN, text: TEXT });

            expect(outcome.ok && (outcome.data as { text: string }).text).toBe(TEXT);
        });

        it.each([
            ['empty text', { inquiryId: CONV_OWN, text: '' }],
            ['over 5000 characters', { inquiryId: CONV_OWN, text: 'a'.repeat(5001) }],
            ['a malformed inquiry id', { inquiryId: 'nope', text: 'Hola' }],
            ['an unknown field', { inquiryId: CONV_OWN, text: 'Hola', extra: true }],
            ['an empty token', { inquiryId: CONV_OWN, text: 'Hola', confirmationToken: '' }]
        ])('rejects %s before anything runs', async (_label, input) => {
            const outcome = await run(input);

            expect(outcome.ok).toBe(false);
            if (outcome.ok) return;
            expect(outcome.failure.message).toContain(TOOL_VALIDATION_MESSAGE);
            expect(findOwned).not.toHaveBeenCalled();
            expect(fake.data.size).toBe(0);
        });

        it('surfaces a moderation rejection and stores no token', async () => {
            assertBody.mockRejectedValue(
                new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'Message body contains content that is not allowed',
                    undefined,
                    'MESSAGE_CONTENT_BLOCKED'
                )
            );

            const outcome = await run({ inquiryId: CONV_OWN, text: 'badword' });

            expect(outcome.ok).toBe(false);
            if (outcome.ok) return;
            expect(outcome.failure.message).toContain('contenido que Hospeda no permite');
            expect(outcome.failure.message).toContain('No se envió nada');
            expect(fake.data.size).toBe(0);
            expect(createMessage).not.toHaveBeenCalled();
        });

        it('refuses a blocked conversation up front', async () => {
            const outcome = await run({ inquiryId: CONV_BLOCKED, text: 'Hola' });

            expect(outcome.ok).toBe(false);
            if (outcome.ok) return;
            expect(outcome.failure.message).toContain('bloqueada');
            expect(fake.data.size).toBe(0);
        });

        it('fails closed when the token store is unavailable', async () => {
            redisHolder.redis = undefined;

            const outcome = await run({ inquiryId: CONV_OWN, text: TEXT });

            expect(outcome.ok).toBe(false);
            if (outcome.ok) return;
            expect(outcome.failure.message).toBe(
                'El servicio no está disponible en este momento, probá más tarde. No se envió nada.'
            );
            expect(createMessage).not.toHaveBeenCalled();
        });
    });

    describe('step 2: send', () => {
        it('sends exactly the previewed text as the owner and returns the message id', async () => {
            const confirmationToken = await preview();

            const outcome = await run({ inquiryId: CONV_OWN, text: TEXT, confirmationToken });

            expect(outcome).toEqual({
                ok: true,
                data: {
                    status: 'sent',
                    inquiryId: CONV_OWN,
                    messageId: 'msg-1',
                    sentAt: '2026-11-16T12:00:00.000Z'
                }
            });
            expect(createMessage).toHaveBeenCalledTimes(1);
            expect(createMessage).toHaveBeenCalledWith(expect.anything(), {
                conversationId: CONV_OWN,
                senderType: MessageSenderTypeEnum.OWNER,
                body: TEXT,
                userId: OWNER_ID
            });
        });

        it('never sends without a valid token', async () => {
            const outcome = await run({
                inquiryId: CONV_OWN,
                text: TEXT,
                confirmationToken: 'made-up-token-that-was-never-issued'
            });

            expect(outcome.ok).toBe(false);
            if (outcome.ok) return;
            expect(outcome.failure.message).toContain('SIN confirmationToken');
            expect(createMessage).not.toHaveBeenCalled();
        });

        it('rejects altered text', async () => {
            const confirmationToken = await preview();

            const outcome = await run({
                inquiryId: CONV_OWN,
                text: `${TEXT} Gratis.`,
                confirmationToken
            });

            expect(outcome.ok).toBe(false);
            expect(createMessage).not.toHaveBeenCalled();
        });

        it('rejects a token issued for another inquiry', async () => {
            const confirmationToken = await preview(TEXT, CONV_OTHER_OWN);

            const outcome = await run({ inquiryId: CONV_OWN, text: TEXT, confirmationToken });

            expect(outcome.ok).toBe(false);
            expect(createMessage).not.toHaveBeenCalled();
        });

        it('rejects a token issued to another OAuth client', async () => {
            const confirmationToken = await preview();

            const outcome = await run(
                { inquiryId: CONV_OWN, text: TEXT, confirmationToken },
                { ctx: { channel: 'mcp', clientId: 'https://other.example/client' } }
            );

            expect(outcome.ok).toBe(false);
            expect(createMessage).not.toHaveBeenCalled();
        });

        it('rejects a token issued to another user', async () => {
            const confirmationToken = await preview();
            // The other owner also owns CONV_OWN here, so only the user binding can refuse.
            findOwned.mockResolvedValue({ data: CONVERSATIONS[0] } as unknown as OwnedResult);

            const outcome = await run(
                { inquiryId: CONV_OWN, text: TEXT, confirmationToken },
                { actor: actorFor(OTHER_ID) }
            );

            expect(outcome.ok).toBe(false);
            expect(createMessage).not.toHaveBeenCalled();
        });

        it('rejects a reused token (single use)', async () => {
            const confirmationToken = await preview();
            await run({ inquiryId: CONV_OWN, text: TEXT, confirmationToken });

            const second = await run({ inquiryId: CONV_OWN, text: TEXT, confirmationToken });

            expect(second.ok).toBe(false);
            expect(createMessage).toHaveBeenCalledTimes(1);
        });

        it('rejects an expired token', async () => {
            const confirmationToken = await preview();
            fake.advance(CONFIRMATION_TOKEN_TTL_SECONDS * 1000 + 1);

            const outcome = await run({ inquiryId: CONV_OWN, text: TEXT, confirmationToken });

            expect(outcome.ok).toBe(false);
            expect(createMessage).not.toHaveBeenCalled();
        });

        it('burns the token on a mismatch: the right text cannot follow it', async () => {
            const confirmationToken = await preview();
            await run({ inquiryId: CONV_OWN, text: 'otro texto', confirmationToken });

            const retry = await run({ inquiryId: CONV_OWN, text: TEXT, confirmationToken });

            expect(retry.ok).toBe(false);
            expect(createMessage).not.toHaveBeenCalled();
        });

        it('fails closed, sending nothing, when the store is unavailable', async () => {
            const confirmationToken = await preview();
            redisHolder.throwOnGet = true;

            const outcome = await run({ inquiryId: CONV_OWN, text: TEXT, confirmationToken });

            expect(outcome.ok).toBe(false);
            if (outcome.ok) return;
            expect(outcome.failure.message).toContain('El servicio no está disponible');
            expect(createMessage).not.toHaveBeenCalled();
        });

        it('surfaces the authoritative moderation rejection of createMessage', async () => {
            const confirmationToken = await preview();
            createMessage.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Message body contains content that is not allowed',
                    reason: 'MESSAGE_CONTENT_BLOCKED'
                }
            } as unknown as CreatedResult);

            const outcome = await run({ inquiryId: CONV_OWN, text: TEXT, confirmationToken });

            expect(outcome.ok).toBe(false);
            if (outcome.ok) return;
            expect(outcome.failure.message).toContain('contenido que Hospeda no permite');
        });
    });

    describe('authorization (AC-6)', () => {
        it.each([
            ['a foreign conversation', CONV_FOREIGN, OWNER_ID],
            ['a missing conversation', 'cdddddd0-dddd-4ddd-8ddd-dddddddddddd', OWNER_ID]
        ])('answers %s as not found without touching the token store', async (_l, id, userId) => {
            const outcome = await run({ inquiryId: id, text: TEXT }, { actor: actorFor(userId) });

            expect(outcome.ok).toBe(false);
            if (outcome.ok) return;
            expect(outcome.failure.message).toBe(TOOL_NOT_FOUND_MESSAGE);
            expect(fake.redis.set).not.toHaveBeenCalled();
            expect(assertBody).not.toHaveBeenCalled();
        });

        it("answers a staff actor asking for someone else's conversation as not found, in both steps", async () => {
            const staff = actorFor(STAFF_ID, [
                PermissionEnum.CONVERSATION_REPLY_OWN,
                PermissionEnum.CONVERSATION_REPLY_ANY
            ]);

            const step1 = await run({ inquiryId: CONV_OWN, text: TEXT }, { actor: staff });
            const step2 = await run(
                { inquiryId: CONV_OWN, text: TEXT, confirmationToken: 'whatever' },
                { actor: staff }
            );

            for (const outcome of [step1, step2]) {
                expect(outcome.ok).toBe(false);
                if (!outcome.ok) {
                    expect(outcome.failure.message).toBe(TOOL_NOT_FOUND_MESSAGE);
                }
            }
            expect(fake.redis.set).not.toHaveBeenCalled();
            expect(fake.redis.getdel).not.toHaveBeenCalled();
            expect(createMessage).not.toHaveBeenCalled();
        });

        it('refuses an actor without CONVERSATION_REPLY_OWN before reading anything', async () => {
            const outcome = await run(
                { inquiryId: CONV_OWN, text: TEXT },
                { actor: actorFor(OWNER_ID, [PermissionEnum.CONVERSATION_VIEW_OWN]) }
            );

            expect(outcome.ok).toBe(false);
            if (outcome.ok) return;
            expect(outcome.failure.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(findOwned).not.toHaveBeenCalled();
        });

        it('refuses a call that carries no OAuth client', async () => {
            const outcome = await run(
                { inquiryId: CONV_OWN, text: TEXT },
                { ctx: { channel: 'mcp' } }
            );

            expect(outcome.ok).toBe(false);
            expect(fake.redis.set).not.toHaveBeenCalled();
        });
    });
});
