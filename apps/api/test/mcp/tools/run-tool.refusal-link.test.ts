/**
 * HOS-2326 (spec HOS-2335 §5.1) — the executor asks the tool for a portal link
 * on every failure: a handler error, a thrown `ServiceError`, and a malformed
 * call (where the tool reads the RAW input).
 *
 * @module test/mcp/tools/run-tool.refusal-link
 */

import { ServiceErrorCode } from '@repo/schemas';
import { type Actor, ServiceError } from '@repo/service-core';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import { executeTool, parseToolInput, runTool } from '../../../src/mcp/tools/run-tool';
import {
    defineTool,
    type ToolDefinition,
    type ToolErrorPayload
} from '../../../src/mcp/tools/tool-definition';
import { env, validateApiEnv } from '../../../src/utils/env';

const SITE = 'https://hospeda.test';
const USER_ID = '5b0c8f7e-2a43-4c1e-9d4f-0a6b2c9e1f11';
const LISTING_ID = '9a1f5c2e-6b7d-4e8f-a0b1-c2d3e4f5a6b7';
const context = { channel: 'mcp' } as const;
const actor = {
    id: USER_ID,
    roles: ['HOST'],
    permissions: [],
    emailVerified: true
} as unknown as Actor;

const inputSchema = z.object({ id: z.uuid() }).strict();

/** A tool whose handler answers `error` and whose link points at the subscription. */
function makeTool(overrides: Partial<ToolDefinition<typeof inputSchema, { ok: true }>> = {}) {
    const refusalAction = vi.fn(() => ({ destination: { kind: 'subscription' } }) as const);
    const definition = defineTool({
        name: 'probe_tool',
        title: 'Probe',
        description: 'Probe',
        inputSchema,
        isWrite: false,
        refusalAction,
        handler: async () => ({ data: { ok: true as const } }),
        ...overrides
    });
    return { definition, refusalAction };
}

const refuse = (error: ToolErrorPayload) => async () => ({ error });

describe('refusal links in the executor', () => {
    let originalSiteUrl: string;

    beforeAll(() => {
        validateApiEnv();
        originalSiteUrl = env.HOSPEDA_SITE_URL;
    });

    afterAll(() => {
        env.HOSPEDA_SITE_URL = originalSiteUrl;
    });

    beforeEach(() => {
        env.HOSPEDA_SITE_URL = SITE;
    });

    it('attaches the link to a handler refusal', async () => {
        const { definition, refusalAction } = makeTool({
            handler: refuse({
                code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
                message: 'x',
                reason: 'R'
            })
        });

        const outcome = await executeTool({
            definition,
            actor,
            input: { id: LISTING_ID },
            context
        });

        expect(outcome).toMatchObject({
            ok: false,
            failure: { action: { url: `${SITE}/es/mi-cuenta/suscripcion/` } }
        });
        expect(refusalAction).toHaveBeenCalledWith({
            error: expect.objectContaining({
                code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
                reason: 'R'
            }),
            input: { id: LISTING_ID }
        });
    });

    it('attaches the link to a thrown ServiceError, with its reason', async () => {
        const { definition, refusalAction } = makeTool({
            handler: async () => {
                throw new ServiceError(
                    ServiceErrorCode.LIMIT_REACHED,
                    'x',
                    undefined,
                    'THE_REASON'
                );
            }
        });

        const outcome = await executeTool({
            definition,
            actor,
            input: { id: LISTING_ID },
            context
        });

        expect(outcome.ok).toBe(false);
        expect(refusalAction).toHaveBeenCalledWith({
            error: expect.objectContaining({ reason: 'THE_REASON' }),
            input: { id: LISTING_ID }
        });
    });

    it('adds no link to a transient failure and does not ask the tool', async () => {
        const { definition, refusalAction } = makeTool({
            handler: refuse({ code: ServiceErrorCode.SERVICE_UNAVAILABLE, message: 'x' })
        });

        const outcome = await executeTool({
            definition,
            actor,
            input: { id: LISTING_ID },
            context
        });

        expect(outcome).toMatchObject({ ok: false });
        expect(outcome.ok === false && outcome.failure.action).toBeUndefined();
        expect(refusalAction).not.toHaveBeenCalled();
    });

    it('adds no link when the person-state check refuses before the handler', async () => {
        const { definition, refusalAction } = makeTool();

        const outcome = await executeTool({
            definition,
            actor: { ...actor, emailVerified: false } as unknown as Actor,
            input: { id: LISTING_ID },
            context
        });

        expect(outcome.ok).toBe(false);
        expect(refusalAction).not.toHaveBeenCalled();
    });

    it('asks the tool about a malformed call, with the RAW input and the zod issues', () => {
        const { definition, refusalAction } = makeTool();
        const raw = { id: LISTING_ID, name: 'Hotel' };

        const parsed = parseToolInput({ definition, input: raw });

        expect(parsed.ok).toBe(false);
        expect(parsed.ok === false && parsed.failure.action?.url).toBe(
            `${SITE}/es/mi-cuenta/suscripcion/`
        );
        expect(refusalAction).toHaveBeenCalledWith({
            error: expect.objectContaining({
                code: ServiceErrorCode.VALIDATION_ERROR,
                details: expect.arrayContaining([
                    expect.objectContaining({ code: 'unrecognized_keys', keys: ['name'] })
                ])
            }),
            input: raw
        });
    });

    it('runTool gives a malformed call the same link', async () => {
        const { definition } = makeTool();

        const outcome = await runTool({ definition, actor, input: { nope: 1 }, context });

        expect(outcome.ok === false && outcome.failure.action?.url).toBeDefined();
    });

    it('a malformed call to a tool without refusalAction or name still fails cleanly', () => {
        const parsed = parseToolInput({ definition: { inputSchema }, input: {} });

        expect(parsed.ok).toBe(false);
        expect(parsed.ok === false && parsed.failure.action).toBeUndefined();
    });
});
