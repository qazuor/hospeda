/**
 * HOS-2247 — `confirm_benefit_usage` and `reject_benefit_usage` confirmed out of
 * band (spec §5.7, D-17), folded from PR-14. On a client that declared form
 * elicitation the preview issues no token; the state is bound to user, client,
 * tool, usage id and note. Only a confirm writes and emails; a decline, a
 * cancel, a forged or mismatched state and a token write nothing and email
 * nobody. The service's PENDING compare-and-set still decides two confirmed
 * answers racing. Same fakes as `answer-benefit-usage.test.ts`; the tools run
 * through `executeConfirmableTool`, the executor the MCP binder uses.
 *
 * @module test/mcp/tools/host-trade/answer-benefit-usage.elicitation
 */

import { ServiceErrorCode } from '@repo/schemas';
import { HostTradeUsageService } from '@repo/service-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    actorFor,
    buildUsageService,
    CLIENT,
    HOST_PROVIDER_ID,
    makeFakeRedis,
    OTHER_CLIENT,
    usageRow
} from './host-trade-tools.harness';

const mocks = vi.hoisted(() => ({
    usageService: undefined as unknown,
    redis: undefined as unknown,
    notifyUsageConfirmed: vi.fn(),
    notifyUsageRejected: vi.fn(),
    notifyUsageDeclared: vi.fn()
}));

vi.mock('../../../../src/mcp/tools/host-trade/host-trade-tool-services', () => ({
    getHostTradeUsageToolService: () => mocks.usageService,
    getHostTradeToolService: () => {
        throw new Error('the usage answers never read the directory');
    }
}));
vi.mock('../../../../src/utils/redis', () => ({
    getRedisClient: vi.fn(async () => mocks.redis)
}));
vi.mock('../../../../src/lib/host-trade-notifications', () => ({
    notifyUsageConfirmed: mocks.notifyUsageConfirmed,
    notifyUsageRejected: mocks.notifyUsageRejected,
    notifyUsageDeclared: mocks.notifyUsageDeclared
}));

import {
    CONFIRMATION_TOKEN_REFUSED_REASON,
    ELICITATION_REASON_MESSAGES,
    ELICITATION_STATE_INVALID_REASON
} from '../../../../src/mcp/tools/elicitation-confirmation';
import {
    confirmBenefitUsageTool,
    rejectBenefitUsageTool
} from '../../../../src/mcp/tools/host-trade/answer-benefit-usage';
import { executeConfirmableTool, runTool } from '../../../../src/mcp/tools/run-tool';
import type {
    ToolConfirmationDecision,
    ToolContext
} from '../../../../src/mcp/tools/tool-definition';

/** A provider declared it, with a note; the host-provider answers as HOST. */
const USAGE = usageRow({
    id: 'c1111111-1111-4111-8111-111111111111',
    note: 'Arreglamos la instalación del quincho.'
});
const OTHER_USAGE = usageRow({ id: 'c6666666-6666-4666-8666-666666666666' });
const ROWS = [USAGE, OTHER_USAGE];

type Tool = typeof confirmBenefitUsageTool | typeof rejectBenefitUsageTool;

let writes: { confirm: ReturnType<typeof vi.spyOn>; reject: ReturnType<typeof vi.spyOn> };

beforeEach(() => {
    vi.clearAllMocks();
    mocks.usageService = buildUsageService(ROWS).service;
    mocks.redis = makeFakeRedis();
    writes = {
        confirm: vi
            .spyOn(HostTradeUsageService.prototype, 'confirmUsage')
            .mockImplementation((async ({ usageId }: { usageId: string }) => ({
                data: { usage: { ...ROWS.find((row) => row.id === usageId), status: 'CONFIRMED' } }
            })) as never),
        reject: vi
            .spyOn(HostTradeUsageService.prototype, 'rejectUsage')
            .mockImplementation((async ({ usageId }: { usageId: string }) => ({
                data: { usage: { ...ROWS.find((row) => row.id === usageId), status: 'REJECTED' } }
            })) as never)
    };
});

afterEach(() => {
    vi.restoreAllMocks();
});

/** A capable client's context, optionally carrying the retry's answer. */
const capable = (
    answer?: { readonly stateId: string; readonly decision: ToolConfirmationDecision },
    clientId: string = CLIENT
): ToolContext => ({
    channel: 'mcp',
    clientId,
    confirmation: { elicitationSupported: true, ...(answer ? { answer } : {}) }
});

/** Runs a tool the way the MCP binder does (confirmation requests surface). */
const runCapable = (
    tool: Tool,
    input: Record<string, unknown>,
    ctx: ToolContext,
    actorId: string = HOST_PROVIDER_ID
) =>
    executeConfirmableTool({
        definition: tool,
        actor: actorFor(actorId),
        input: tool.inputSchema.parse(input),
        context: ctx
    });

/** Step 1 on a capable client: the form request. */
async function ask(tool: Tool, input: Record<string, unknown>) {
    const outcome = await runCapable(tool, input, capable());
    if (outcome.ok !== 'confirmation_required') throw new Error('expected a confirmation request');
    return outcome.request;
}

/** Everything a write or an email would leave behind. */
const sideEffects = () =>
    writes.confirm.mock.calls.length +
    writes.reject.mock.calls.length +
    mocks.notifyUsageConfirmed.mock.calls.length +
    mocks.notifyUsageRejected.mock.calls.length;

const TOOLS = [
    ['confirm_benefit_usage', confirmBenefitUsageTool, {}],
    ['reject_benefit_usage', rejectBenefitUsageTool, { note: 'No vino nadie.' }]
] as const;

describe.each(TOOLS)('%s confirmed out of band', (_name, tool, extra) => {
    const input = { usageId: USAGE.id, ...extra };

    it('the preview asks the form, never a token, and writes and emails nothing', async () => {
        // Act
        const request = await ask(tool, input);

        // Assert
        expect(request.message).toContain('«Electricidad Sur»');
        expect(request.message).toContain('2026-11-01');
        expect(request.message).toContain('│ Arreglamos la instalación del quincho.');
        expect(request.message).not.toContain('confirmationToken');
        expect(sideEffects()).toBe(0);
    });

    it('confirm writes once and sends the one email; a replay changes nothing', async () => {
        // Arrange
        const { stateId } = await ask(tool, input);

        // Act
        const first = await runCapable(tool, input, capable({ stateId, decision: 'confirm' }));
        const replay = await runCapable(tool, input, capable({ stateId, decision: 'confirm' }));

        // Assert
        expect(first.ok).toBe(true);
        expect(replay).toMatchObject({
            ok: false,
            failure: { message: ELICITATION_REASON_MESSAGES[ELICITATION_STATE_INVALID_REASON] }
        });
        expect(sideEffects()).toBe(2);
    });

    it.each([
        ['decline', 'USER_DECLINED'],
        ['cancel', 'USER_CANCELLED']
    ] as const)('a %s writes nothing and emails nobody', async (decision, code) => {
        // Arrange
        const { stateId } = await ask(tool, input);

        // Act
        const outcome = await runCapable(tool, input, capable({ stateId, decision }));
        const confirmAfter = await runCapable(
            tool,
            input,
            capable({ stateId, decision: 'confirm' })
        );

        // Assert
        expect(outcome).toMatchObject({ ok: false, failure: { code } });
        expect(confirmAfter.ok).toBe(false);
        expect(sideEffects()).toBe(0);
    });

    it.each([
        ['a forged state', { stateId: 'Zm9yZ2VkLXN0YXRlLW5vYm9keS1ldmVyLWlzc3VlZC14eHg' }, {}],
        ['another usage', {}, { usageId: OTHER_USAGE.id }],
        ['another OAuth client', { clientId: OTHER_CLIENT }, {}]
    ])('%s writes nothing and emails nobody', async (_label, answerChange, inputChange) => {
        // Arrange
        const { stateId } = await ask(tool, input);
        const { clientId, ...rest } = { clientId: CLIENT, stateId, ...answerChange };

        // Act
        const outcome = await runCapable(
            tool,
            { ...input, ...inputChange },
            capable({ stateId: rest.stateId, decision: 'confirm' }, clientId)
        );

        // Assert
        expect(outcome).toMatchObject({
            ok: false,
            failure: { message: ELICITATION_REASON_MESSAGES[ELICITATION_STATE_INVALID_REASON] }
        });
        expect(sideEffects()).toBe(0);
    });

    it('AC-C63: a token from a capable client is refused, nothing written or emailed', async () => {
        // Arrange: a token the same user got on a client without the capability.
        const preview = await runTool({
            definition: tool,
            actor: actorFor(HOST_PROVIDER_ID),
            input,
            context: { channel: 'mcp', clientId: CLIENT }
        });
        const token =
            preview.ok && 'confirmationToken' in preview.data
                ? preview.data.confirmationToken
                : undefined;
        expect(typeof token).toBe('string');

        // Act
        const outcome = await runCapable(tool, { ...input, confirmationToken: token }, capable());

        // Assert
        expect(outcome).toMatchObject({
            ok: false,
            failure: {
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: ELICITATION_REASON_MESSAGES[CONFIRMATION_TOKEN_REFUSED_REASON]
            }
        });
        expect(sideEffects()).toBe(0);
    });
});

describe('each tool binds its own name', () => {
    it.each([
        ['a confirm state answered on reject', confirmBenefitUsageTool, rejectBenefitUsageTool],
        ['a reject state answered on confirm', rejectBenefitUsageTool, confirmBenefitUsageTool]
    ] as const)('%s writes nothing and emails nobody', async (_label, asked, answered) => {
        // Arrange
        const { stateId } = await ask(asked, { usageId: USAGE.id });

        // Act
        const outcome = await runCapable(
            answered,
            { usageId: USAGE.id },
            capable({ stateId, decision: 'confirm' })
        );

        // Assert
        expect(outcome).toMatchObject({
            ok: false,
            failure: { message: ELICITATION_REASON_MESSAGES[ELICITATION_STATE_INVALID_REASON] }
        });
        expect(sideEffects()).toBe(0);
    });
});

describe('reject_benefit_usage binds the rejection note', () => {
    it.each([
        ['a changed note', { note: 'Otra nota.' }],
        ['a removed note', { note: undefined }]
    ])('%s on the retry writes nothing and emails nobody', async (_label, change) => {
        // Arrange
        const input = { usageId: USAGE.id, note: 'No vino nadie.' };
        const { stateId } = await ask(rejectBenefitUsageTool, input);

        // Act
        const outcome = await runCapable(
            rejectBenefitUsageTool,
            { ...input, ...change },
            capable({ stateId, decision: 'confirm' })
        );

        // Assert
        expect(outcome.ok).toBe(false);
        expect(sideEffects()).toBe(0);
    });

    it('the form shows the note the other party receives, as a block', async () => {
        // Act
        const request = await ask(rejectBenefitUsageTool, {
            usageId: USAGE.id,
            note: 'No vino nadie.\nLlamé dos veces.'
        });

        // Assert
        expect(request.message).toContain('│ No vino nadie.\n│ Llamé dos veces.');
        expect(request.message.endsWith('¿Confirmás el rechazo?')).toBe(true);
    });
});

describe('the PENDING compare-and-set still decides a race', () => {
    it('a confirm and a reject, both confirmed in parallel: one writes and emails', async () => {
        // Arrange: the service's UPDATE keyed on PENDING; the second matches no row.
        let answered = false;
        const casWrite = (status: string) =>
            (async ({ usageId }: { usageId: string }) => {
                if (answered) {
                    return {
                        error: {
                            code: ServiceErrorCode.VALIDATION_ERROR,
                            message: 'Usage is no longer PENDING, expected PENDING'
                        }
                    };
                }
                answered = true;
                return { data: { usage: { ...ROWS.find((row) => row.id === usageId), status } } };
            }) as never;
        writes.confirm.mockImplementation(casWrite('CONFIRMED'));
        writes.reject.mockImplementation(casWrite('REJECTED'));
        const usageId = USAGE.id;
        const confirmState = (await ask(confirmBenefitUsageTool, { usageId })).stateId;
        const rejectState = (await ask(rejectBenefitUsageTool, { usageId })).stateId;

        // Act
        const [confirmed, rejected] = await Promise.all([
            runCapable(
                confirmBenefitUsageTool,
                { usageId },
                capable({ stateId: confirmState, decision: 'confirm' })
            ),
            runCapable(
                rejectBenefitUsageTool,
                { usageId },
                capable({ stateId: rejectState, decision: 'confirm' })
            )
        ]);

        // Assert
        expect(confirmed.ok).toBe(true);
        expect(rejected).toMatchObject({
            ok: false,
            failure: { code: ServiceErrorCode.VALIDATION_ERROR }
        });
        expect(mocks.notifyUsageConfirmed).toHaveBeenCalledTimes(1);
        expect(mocks.notifyUsageRejected).not.toHaveBeenCalled();
    });
});
