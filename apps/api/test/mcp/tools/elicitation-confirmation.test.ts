/**
 * HOS-2247 — the shared out-of-band confirmation logic (spec §5.7): which plan a
 * call gets (D-17 strict), and how a retried answer is settled against the
 * confirmation store. The store runs for real over an in-memory Redis fake
 * (GETDEL single use, TTL).
 *
 * @module test/mcp/tools/elicitation-confirmation
 */

import { describe, expect, it, vi } from 'vitest';
import {
    CONFIRMATION_TOKEN_TTL_SECONDS,
    type ConfirmationRedis
} from '../../../src/mcp/tools/confirmation-token-store';
import {
    CONFIRMATION_TOKEN_REFUSED_REASON,
    confirmationAuditDetails,
    confirmationTokenRefused,
    discardUnsettledConfirmation,
    ELICITATION_REASON_MESSAGES,
    ELICITATION_STATE_INVALID_REASON,
    type ElicitationBinding,
    elicitationKeyPrefix,
    issueConfirmationState,
    planConfirmation,
    settleConfirmationAnswer
} from '../../../src/mcp/tools/elicitation-confirmation';
import { ELICITATION_STRICT } from '../../../src/mcp/tools/elicitation-policy';
import type { ToolContext } from '../../../src/mcp/tools/tool-definition';

/** In-memory Redis fake with TTL driven by an injected clock. */
function makeFakeRedis() {
    let nowMs = 0;
    const data = new Map<string, { value: string; expiresAt: number }>();
    const redis = {
        set: vi.fn(async (key: string, value: string, _ex: string, seconds: number) => {
            data.set(key, { value, expiresAt: nowMs + seconds * 1000 });
            return 'OK' as const;
        }),
        getdel: vi.fn(async (key: string) => {
            const entry = data.get(key);
            data.delete(key);
            return entry && entry.expiresAt > nowMs ? entry.value : null;
        })
    };
    return {
        deps: { getRedis: async () => redis as unknown as ConfirmationRedis },
        data,
        advance: (ms: number) => {
            nowMs += ms;
        }
    };
}

const BINDING: ElicitationBinding = {
    userId: 'u-1',
    clientId: 'https://claude.ai/oauth/mcp-client-metadata',
    tool: 'reply_inquiry',
    subjectId: 'c-1',
    payload: 'Hola, sí tenemos lugar.'
};

const CAPABLE: ToolContext = { channel: 'mcp', confirmation: { elicitationSupported: true } };
const answered = (decision: 'confirm' | 'decline' | 'cancel', stateId = 's'): ToolContext => ({
    channel: 'mcp',
    confirmation: { elicitationSupported: true, answer: { stateId, decision } }
});

describe('planConfirmation (D-17 strict)', () => {
    it.each([
        ['no context', undefined, undefined, { mode: 'token', step: 'preview' }],
        ['no context + token', undefined, 't', { mode: 'token', step: 'commit', token: 't' }],
        [
            'incapable client',
            { channel: 'mcp', confirmation: { elicitationSupported: false } },
            undefined,
            { mode: 'token', step: 'preview' }
        ],
        ['capable, first call', CAPABLE, undefined, { mode: 'elicitation', step: 'preview' }],
        ['capable + token', CAPABLE, 't', { mode: 'elicitation', step: 'token_refused' }],
        [
            'capable + confirm',
            answered('confirm', 'abc'),
            undefined,
            { mode: 'elicitation', step: 'commit', stateId: 'abc' }
        ],
        [
            'capable + decline',
            answered('decline', 'abc'),
            undefined,
            { mode: 'elicitation', step: 'declined', stateId: 'abc', decision: 'decline' }
        ],
        [
            'capable + cancel',
            answered('cancel', 'abc'),
            undefined,
            { mode: 'elicitation', step: 'declined', stateId: 'abc', decision: 'cancel' }
        ],
        [
            'capable + answer + token (the token is refused first)',
            answered('confirm'),
            't',
            { mode: 'elicitation', step: 'token_refused' }
        ]
    ] as const)('%s', (_label, context, token, expected) => {
        // Act
        const plan = planConfirmation({
            tool: 'reply_inquiry',
            confirmationToken: token,
            context: context as ToolContext | undefined
        });

        // Assert
        expect(plan).toEqual(expected);
    });

    it('is strict for every covered tool (owner decision D-17)', () => {
        // Assert
        expect(Object.values(ELICITATION_STRICT).every((strict) => strict)).toBe(true);
        expect(Object.keys(ELICITATION_STRICT).sort()).toEqual([
            'confirm_benefit_usage',
            'create_listing',
            'reject_benefit_usage',
            'reply_inquiry',
            'set_listing_publication'
        ]);
    });
});

describe('confirmationAuditDetails (C-3)', () => {
    it('adds nothing for a client without the capability (rows unchanged, AC-C62)', () => {
        // Act + Assert
        expect(
            confirmationAuditDetails({
                tool: 'reply_inquiry',
                confirmationToken: 't',
                context: { channel: 'mcp' }
            })
        ).toBeUndefined();
    });

    it.each([
        [CAPABLE, undefined, { confirmation: 'elicitation', step: 'preview' }],
        [answered('confirm'), undefined, { confirmation: 'elicitation', step: 'commit' }],
        [answered('decline'), undefined, { confirmation: 'elicitation', step: 'declined' }],
        [answered('cancel'), undefined, { confirmation: 'elicitation', step: 'declined' }],
        [CAPABLE, 't', { confirmation: 'token', step: 'commit' }]
    ] as const)('capable call %# → %o', (context, token, expected) => {
        // Act + Assert
        expect(
            confirmationAuditDetails({ tool: 'create_listing', confirmationToken: token, context })
        ).toEqual(expected);
    });
});

describe('settleConfirmationAnswer (the store binding)', () => {
    async function issue(fake: ReturnType<typeof makeFakeRedis>, binding = BINDING) {
        const issued = await issueConfirmationState({ binding, deps: fake.deps });
        if (!issued.ok) throw new Error('issue failed');
        return issued.stateId;
    }

    it('stores the state under its own prefix, with the token TTL, and returns only a random id', async () => {
        // Arrange
        const fake = makeFakeRedis();

        // Act
        const stateId = await issue(fake);

        // Assert
        expect(stateId).toMatch(/^[A-Za-z0-9_-]{43}$/);
        const [key] = [...fake.data.keys()];
        expect(elicitationKeyPrefix('reply_inquiry')).toBe('mcp:elicit:reply_inquiry:');
        expect(key?.startsWith('mcp:elicit:reply_inquiry:')).toBe(true);
        expect(key).not.toContain(stateId);
        expect(JSON.stringify([...fake.data.values()])).not.toContain(BINDING.payload as string);
        fake.advance(CONFIRMATION_TOKEN_TTL_SECONDS * 1000 - 1);
        expect(fake.data.size).toBe(1);
    });

    it('confirms once for the exact binding, then refuses the replay (single use)', async () => {
        // Arrange
        const fake = makeFakeRedis();
        const stateId = await issue(fake);
        const plan = { mode: 'elicitation', step: 'commit', stateId } as const;

        // Act
        const first = await settleConfirmationAnswer({ binding: BINDING, plan, deps: fake.deps });
        const replay = await settleConfirmationAnswer({ binding: BINDING, plan, deps: fake.deps });

        // Assert
        expect(first).toEqual({ kind: 'confirmed' });
        expect(replay).toMatchObject({
            kind: 'refused',
            error: { reason: ELICITATION_STATE_INVALID_REASON }
        });
    });

    it('refuses a retry presented for another tool (its states live under another prefix)', async () => {
        // Arrange
        const fake = makeFakeRedis();
        const stateId = await issue(fake);

        // Act
        const otherTool = await settleConfirmationAnswer({
            binding: { ...BINDING, tool: 'create_listing' },
            plan: { mode: 'elicitation', step: 'commit', stateId },
            deps: fake.deps
        });

        // Assert
        expect(otherTool).toMatchObject({
            kind: 'refused',
            error: { reason: ELICITATION_STATE_INVALID_REASON }
        });
    });

    it.each([
        ['another user', { userId: 'u-2' }],
        ['another OAuth client', { clientId: 'https://chatgpt.com/oauth/client' }],
        ['another subject', { subjectId: 'c-2' }],
        ['another payload', { payload: 'Hola, NO tenemos lugar.' }]
    ])('refuses a retry bound to %s, and burns the record', async (_label, change) => {
        // Arrange
        const fake = makeFakeRedis();
        const stateId = await issue(fake);
        const plan = { mode: 'elicitation', step: 'commit', stateId } as const;

        // Act
        const mismatched = await settleConfirmationAnswer({
            binding: { ...BINDING, ...change },
            plan,
            deps: fake.deps
        });
        const genuine = await settleConfirmationAnswer({ binding: BINDING, plan, deps: fake.deps });

        // Assert: refused, and the genuine retry finds nothing left (burnt).
        expect(mismatched).toMatchObject({
            kind: 'refused',
            error: { code: 'VALIDATION_ERROR', reason: ELICITATION_STATE_INVALID_REASON }
        });
        expect(genuine).toMatchObject({ kind: 'refused' });
    });

    it.each([
        ['an unknown state', 'Zm9yZ2VkLXN0YXRlLXRoYXQtbm9ib2R5LWlzc3VlZC1ldmVy'],
        ['an empty state', ''],
        ['a token-store key', 'mcp:confirm:reply_inquiry:abc']
    ])('refuses %s as invalid, whatever the answer says', async (_label, stateId) => {
        // Arrange
        const fake = makeFakeRedis();
        await issue(fake);

        // Act
        const confirm = await settleConfirmationAnswer({
            binding: BINDING,
            plan: { mode: 'elicitation', step: 'commit', stateId },
            deps: fake.deps
        });
        const decline = await settleConfirmationAnswer({
            binding: BINDING,
            plan: { mode: 'elicitation', step: 'declined', stateId, decision: 'decline' },
            deps: fake.deps
        });

        // Assert
        expect(confirm).toMatchObject({ error: { reason: ELICITATION_STATE_INVALID_REASON } });
        expect(decline).toMatchObject({ error: { reason: ELICITATION_STATE_INVALID_REASON } });
    });

    it('refuses an expired state', async () => {
        // Arrange
        const fake = makeFakeRedis();
        const stateId = await issue(fake);
        fake.advance(CONFIRMATION_TOKEN_TTL_SECONDS * 1000);

        // Act
        const settled = await settleConfirmationAnswer({
            binding: BINDING,
            plan: { mode: 'elicitation', step: 'commit', stateId },
            deps: fake.deps
        });

        // Assert
        expect(settled).toMatchObject({ error: { reason: ELICITATION_STATE_INVALID_REASON } });
    });

    it.each([
        ['decline', 'USER_DECLINED'],
        ['cancel', 'USER_CANCELLED']
    ] as const)('a %s is refused as %s and burns the record', async (decision, code) => {
        // Arrange
        const fake = makeFakeRedis();
        const stateId = await issue(fake);

        // Act
        const declined = await settleConfirmationAnswer({
            binding: BINDING,
            plan: { mode: 'elicitation', step: 'declined', stateId, decision },
            deps: fake.deps
        });
        const confirmAfter = await settleConfirmationAnswer({
            binding: BINDING,
            plan: { mode: 'elicitation', step: 'commit', stateId },
            deps: fake.deps
        });

        // Assert
        expect(declined).toMatchObject({ kind: 'refused', error: { code } });
        expect(confirmAfter).toMatchObject({
            kind: 'refused',
            error: { reason: ELICITATION_STATE_INVALID_REASON }
        });
        expect(fake.data.size).toBe(0);
    });

    it('hands back the stash bound with the state', async () => {
        // Arrange
        const fake = makeFakeRedis();
        const binding: ElicitationBinding = { ...BINDING, tool: 'create_listing' };
        const stash = { point: { lat: -32.48, lng: -58.23 } };
        const issued = await issueConfirmationState({ binding, stash, deps: fake.deps });
        if (!issued.ok) throw new Error('issue failed');

        // Act
        const settled = await settleConfirmationAnswer({
            binding,
            plan: { mode: 'elicitation', step: 'commit', stateId: issued.stateId },
            deps: fake.deps
        });

        // Assert
        expect(settled).toEqual({ kind: 'confirmed', stash });
    });

    it('fails closed without Redis', async () => {
        // Arrange
        const down = { getRedis: async () => undefined };

        // Act
        const issued = await issueConfirmationState({ binding: BINDING, deps: down });
        const settled = await settleConfirmationAnswer({
            binding: BINDING,
            plan: { mode: 'elicitation', step: 'commit', stateId: 'x' },
            deps: down
        });

        // Assert
        expect(issued).toEqual({ ok: false, reason: 'UNAVAILABLE' });
        expect(settled).toEqual({ kind: 'unavailable' });
    });
});

describe('refusals', () => {
    it('a token on a capable client is refused with its own Spanish message', () => {
        // Act
        const refused = confirmationTokenRefused();

        // Assert
        expect(refused.error).toMatchObject({
            code: 'VALIDATION_ERROR',
            reason: CONFIRMATION_TOKEN_REFUSED_REASON
        });
        expect(ELICITATION_REASON_MESSAGES[CONFIRMATION_TOKEN_REFUSED_REASON]).toContain(
            'SIN confirmationToken'
        );
    });
});

describe('discardUnsettledConfirmation (L2: a refused retry burns its state)', () => {
    it('burns the state a retry carried, so it can never be settled afterwards', async () => {
        // Arrange
        const fake = makeFakeRedis();
        const issued = await issueConfirmationState({ binding: BINDING, deps: fake.deps });
        if (!issued.ok) throw new Error('issue failed');

        // Act
        await discardUnsettledConfirmation({
            tool: 'reply_inquiry',
            confirmation: {
                elicitationSupported: true,
                answer: { stateId: issued.stateId, decision: 'confirm' }
            },
            deps: fake.deps
        });
        const settled = await settleConfirmationAnswer({
            binding: BINDING,
            plan: { mode: 'elicitation', step: 'commit', stateId: issued.stateId },
            deps: fake.deps
        });

        // Assert
        expect(fake.data.size).toBe(0);
        expect(settled).toMatchObject({ error: { reason: ELICITATION_STATE_INVALID_REASON } });
    });

    it.each([
        ['no answer on the call', 'reply_inquiry', undefined],
        [
            'a tool that is not covered',
            'get_listing',
            { stateId: 'x', decision: 'confirm' as const }
        ]
    ])('touches nothing for %s', async (_label, tool, answer) => {
        // Arrange
        const fake = makeFakeRedis();
        await issueConfirmationState({ binding: BINDING, deps: fake.deps });

        // Act
        await discardUnsettledConfirmation({
            tool,
            confirmation: { elicitationSupported: true, ...(answer ? { answer } : {}) },
            deps: fake.deps
        });

        // Assert
        expect(fake.data.size).toBe(1);
    });

    it('never throws when the store is down', async () => {
        // Act + Assert
        await expect(
            discardUnsettledConfirmation({
                tool: 'reply_inquiry',
                confirmation: {
                    elicitationSupported: true,
                    answer: { stateId: 's', decision: 'confirm' }
                },
                deps: { getRedis: async () => undefined }
            })
        ).resolves.toBeUndefined();
    });
});
