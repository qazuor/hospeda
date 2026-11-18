/**
 * The contract every HOS-2332 tool owes (spec HOS-2335 §5.0, AC-C39):
 *
 * - **C-2**: one flat `type: "object"` input schema, no top-level union.
 * - **C-3**: every write is audited through the MCP binding, with the usage as
 *   its target, the step of a two-step call, and the note's LENGTH, never the note.
 * - **AC-C39**: the usage tools are role-blind. No role enum, no role read, and
 *   no permission, exactly like the three transitions whose route guard
 *   (`usage-endpoint-shape.guard.test.ts`) forbids `requiredPermissions`.
 *
 * The static checks read the source with comments removed only for the match,
 * and each has a positive control, so an absence means something.
 *
 * @module test/mcp/tools/host-trade/host-trade-tools.contract
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ServiceErrorCode } from '@repo/schemas';
import { HostTradeUsageService } from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    actorFor,
    buildUsageService,
    CLIENT,
    makeFakeRedis,
    usageRow
} from './host-trade-tools.harness';

const mocks = vi.hoisted(() => ({
    usageService: undefined as unknown,
    redis: undefined as unknown,
    record: vi.fn()
}));

vi.mock('../../../../src/mcp/tools/host-trade/host-trade-tool-services', () => ({
    getHostTradeUsageToolService: () => mocks.usageService,
    getHostTradeToolService: () => ({})
}));
vi.mock('../../../../src/utils/redis', () => ({ getRedisClient: vi.fn(async () => mocks.redis) }));
vi.mock('../../../../src/lib/mcp/record-tool-call', () => ({ recordMcpToolCall: mocks.record }));
vi.mock('../../../../src/lib/mcp/tool-rate-limit', () => ({
    consumeMcpToolCall: vi.fn(async () => true)
}));
vi.mock('../../../../src/lib/host-trade-notifications', () => ({
    notifyUsageConfirmed: vi.fn(),
    notifyUsageRejected: vi.fn(),
    notifyUsageDeclared: vi.fn()
}));

import { buildToolInputJsonSchema, handleMcpToolCall } from '../../../../src/lib/mcp/bind-tool';
import { buildMcpAuthInfo } from '../../../../src/lib/mcp/caller';
import {
    confirmBenefitUsageTool,
    rejectBenefitUsageTool
} from '../../../../src/mcp/tools/host-trade/answer-benefit-usage';
import { listBenefitUsagesTool } from '../../../../src/mcp/tools/host-trade/list-benefit-usages';
import { searchProvidersTool } from '../../../../src/mcp/tools/host-trade/search-providers';
import { undoBenefitRejectionTool } from '../../../../src/mcp/tools/host-trade/undo-benefit-rejection';
import type { ToolDefinition } from '../../../../src/mcp/tools/tool-definition';
import { validateApiEnv } from '../../../../src/utils/env';

const TOOLS: readonly ToolDefinition[] = [
    searchProvidersTool,
    listBenefitUsagesTool,
    confirmBenefitUsageTool,
    rejectBenefitUsageTool,
    undoBenefitRejectionTool
];

const SRC = join(process.cwd(), 'src');

/** The sources of the role-blind usage surface (tools + the shared transitions). */
const ROLE_BLIND_FILES = [
    'mcp/tools/host-trade/list-benefit-usages.ts',
    'mcp/tools/host-trade/answer-benefit-usage.ts',
    'mcp/tools/host-trade/undo-benefit-rejection.ts',
    'mcp/tools/host-trade/benefit-usage-refusals.ts',
    'mcp/tools/host-trade/host-trade-tool-services.ts',
    'lib/host-trade-usage-transitions.ts'
] as const;

/** What a role or permission decision looks like in code. */
const ROLE_OR_PERMISSION =
    /\bRoleEnum\b|\bPermissionEnum\b|\.roles\b|\.permissions\b|hasPermission|hasRole/;

/** Source without comments, so prose about roles is never mistaken for code. */
function codeOf(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('C-2: flat input schemas', () => {
    it.each(TOOLS.map((tool) => [tool.name, tool] as const))('%s', (_name, tool) => {
        // Act
        const schema = buildToolInputJsonSchema({ definition: tool });

        // Assert
        expect(schema.type).toBe('object');
        expect(schema).not.toHaveProperty('oneOf');
        expect(schema).not.toHaveProperty('anyOf');
    });
});

describe('AC-C39: the usage tools are role-blind', () => {
    it('the matcher sees a role check when there is one (positive control)', () => {
        // Assert
        expect(ROLE_OR_PERMISSION.test(codeOf('if (actor.roles.includes(RoleEnum.HOST)) {}'))).toBe(
            true
        );
        expect(ROLE_OR_PERMISSION.test(codeOf('actor.permissions.includes(x)'))).toBe(true);
        expect(ROLE_OR_PERMISSION.test(codeOf('/** no RoleEnum here */ const a = 1;'))).toBe(false);
    });

    it.each(ROLE_BLIND_FILES)('%s references no role and no permission', (file) => {
        // Arrange
        const code = codeOf(readFileSync(join(SRC, file), 'utf8'));

        // Assert
        expect(code.length).toBeGreaterThan(0);
        expect(code).not.toMatch(ROLE_OR_PERMISSION);
    });

    it('the write tools declare no person-state exception (unverified email refused, like the routes)', () => {
        // Assert
        for (const tool of TOOLS) {
            expect(tool.emailUnverifiedOperation, tool.name).toBeUndefined();
        }
    });
});

describe('C-3: the writes are audited', () => {
    const USAGE = usageRow();

    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.usageService = buildUsageService([USAGE]).service;
        mocks.redis = makeFakeRedis();
        vi.spyOn(HostTradeUsageService.prototype, 'rejectUsage').mockResolvedValue({
            data: { usage: { ...USAGE, status: 'REJECTED' } }
        } as never);
        vi.spyOn(HostTradeUsageService.prototype, 'undoRejection').mockResolvedValue({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'Usage not found' }
        } as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const callThroughBinding = (definition: ToolDefinition, input: Record<string, unknown>) => {
        const actor = actorFor();
        return handleMcpToolCall({
            definition,
            input,
            ctx: {
                http: {
                    authInfo: buildMcpAuthInfo({
                        token: 'tok',
                        actor,
                        mcpAuth: {
                            userId: actor.id,
                            clientId: CLIENT,
                            clientName: 'Claude',
                            scopes: ['openid']
                        },
                        resourceUrl: 'https://api.test/mcp'
                    })
                }
            }
        });
    };

    it('records the preview and the commit of a rejection, with the note length only', async () => {
        // Act
        const preview = await callThroughBinding(rejectBenefitUsageTool, {
            usageId: USAGE.id,
            note: 'No vino.'
        });
        const token = JSON.parse((preview.content as { text: string }[])[0]?.text ?? '{}')
            .confirmationToken as string;
        await callThroughBinding(rejectBenefitUsageTool, {
            usageId: USAGE.id,
            note: 'No vino.',
            confirmationToken: token
        });

        // Assert
        expect(mocks.record).toHaveBeenCalledTimes(2);
        const [first, second] = mocks.record.mock.calls.map((call) => call[0]);
        expect(first).toMatchObject({
            tool: 'reject_benefit_usage',
            outcome: 'success',
            target: { type: 'host_trade_usage', id: USAGE.id },
            details: { step: 'preview' },
            contentLength: 'No vino.'.length
        });
        expect(second).toMatchObject({ outcome: 'success', details: { step: 'commit' } });
        expect(JSON.stringify(mocks.record.mock.calls)).not.toContain('No vino.');
    });

    it('records a refused undo as denied', async () => {
        // Act
        await callThroughBinding(undoBenefitRejectionTool, { usageId: USAGE.id });

        // Assert
        expect(mocks.record).toHaveBeenCalledTimes(1);
        expect(mocks.record.mock.calls[0]?.[0]).toMatchObject({
            tool: 'undo_benefit_rejection',
            outcome: 'denied',
            errorCode: ServiceErrorCode.NOT_FOUND,
            target: { type: 'host_trade_usage', id: USAGE.id }
        });
    });

    it('audits a read as a read, without a length or details (HOS-2335 D-12)', async () => {
        // Act
        await callThroughBinding(listBenefitUsagesTool, { side: 'host' });

        // Assert
        expect(mocks.record).toHaveBeenCalledTimes(1);
        const row = mocks.record.mock.calls[0]?.[0];
        expect(row).toMatchObject({ tool: 'list_benefit_usages', isWrite: false });
        expect(row).not.toHaveProperty('contentLength');
        expect(row).not.toHaveProperty('details');
    });
});
