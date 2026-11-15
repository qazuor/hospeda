/**
 * HOS-2184 T-012 — transport-agnostic tool executor: authentication, person
 * state (authorization step 2, real `@repo/verticals` allow-list), handler
 * error mapping and input parsing.
 *
 * @module test/mcp/tools/run-tool
 */

import { ServiceErrorCode } from '@repo/schemas';
import { type Actor, ServiceError } from '@repo/service-core';
import { EMAIL_UNVERIFIED_ALLOWED_OPERATIONS } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const { mockLoggerError } = vi.hoisted(() => ({ mockLoggerError: vi.fn() }));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { error: mockLoggerError, info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import { executeTool, parseToolInput, runTool } from '../../../src/mcp/tools/run-tool';
import { defineTool, type ToolDefinition } from '../../../src/mcp/tools/tool-definition';
import {
    TOOL_NOT_FOUND_MESSAGE,
    TOOL_UNEXPECTED_ERROR_MESSAGE
} from '../../../src/mcp/tools/tool-errors';

const USER_ID = '5b0c8f7e-2a43-4c1e-9d4f-0a6b2c9e1f11';
const context = { channel: 'mcp' } as const;

/** A user actor with the given verification state. */
const userActor = (emailVerified: boolean | undefined): Actor =>
    ({ id: USER_ID, roles: ['HOST'], permissions: [], emailVerified }) as unknown as Actor;

const inputSchema = z.object({ listingId: z.string().uuid() }).strict();
const LISTING_ID = '9a1f5c2e-6b7d-4e8f-a0b1-c2d3e4f5a6b7';

/** A tool whose handler is a spy. */
function makeTool(overrides: Partial<ToolDefinition<typeof inputSchema, { ok: true }>> = {}) {
    const handler = vi.fn(async () => ({ data: { ok: true as const } }));
    const definition = defineTool({
        name: 'probe_tool',
        title: 'Probe',
        description: 'Probe',
        inputSchema,
        isWrite: true,
        handler,
        ...overrides
    });
    return { definition, handler };
}

describe('executeTool', () => {
    beforeEach(() => {
        mockLoggerError.mockReset();
    });

    describe('person state (authorization step 2)', () => {
        it('uses a real allow-list that admits READ_OWN', () => {
            expect(EMAIL_UNVERIFIED_ALLOWED_OPERATIONS).toContain('READ_OWN');
        });

        it('refuses an unverified user on a write tool and never runs it', async () => {
            // Arrange
            const { definition, handler } = makeTool();

            // Act
            const outcome = await executeTool({
                definition,
                actor: userActor(false),
                input: { listingId: LISTING_ID },
                context
            });

            // Assert
            expect(outcome).toMatchObject({
                ok: false,
                failure: { kind: 'denied', code: ServiceErrorCode.EMAIL_NOT_VERIFIED }
            });
            expect(handler).not.toHaveBeenCalled();
        });

        it('lets an unverified user run a READ_OWN read tool', async () => {
            // Arrange
            const { definition, handler } = makeTool({
                isWrite: false,
                emailUnverifiedOperation: 'READ_OWN'
            });

            // Act
            const outcome = await executeTool({
                definition,
                actor: userActor(false),
                input: { listingId: LISTING_ID },
                context
            });

            // Assert
            expect(outcome).toEqual({ ok: true, data: { ok: true } });
            expect(handler).toHaveBeenCalledWith({
                actor: userActor(false),
                input: { listingId: LISTING_ID },
                context
            });
        });

        it('refuses an unverified user on a read tool that declares no operation', async () => {
            // Arrange
            const { definition } = makeTool({ isWrite: false });

            // Act
            const outcome = await executeTool({
                definition,
                actor: userActor(false),
                input: { listingId: LISTING_ID },
                context
            });

            // Assert
            expect(outcome.ok).toBe(false);
        });

        it.each([true, undefined])('lets emailVerified=%s run a write tool', async (verified) => {
            // Arrange
            const { definition } = makeTool();

            // Act
            const outcome = await executeTool({
                definition,
                actor: userActor(verified),
                input: { listingId: LISTING_ID },
                context
            });

            // Assert
            expect(outcome.ok).toBe(true);
        });
    });

    it('refuses a guest actor as UNAUTHORIZED', async () => {
        // Arrange
        const { definition, handler } = makeTool({ emailUnverifiedOperation: 'READ_OWN' });
        const guest = {
            id: '00000000-0000-4000-8000-000000000000',
            roles: ['GUEST'],
            permissions: []
        } as unknown as Actor;

        // Act
        const outcome = await executeTool({
            definition,
            actor: guest,
            input: { listingId: LISTING_ID },
            context
        });

        // Assert
        expect(outcome).toMatchObject({
            ok: false,
            failure: { code: ServiceErrorCode.UNAUTHORIZED, requiresReauthentication: true }
        });
        expect(handler).not.toHaveBeenCalled();
    });

    it('maps a returned service error', async () => {
        // Arrange
        const { definition } = makeTool({
            handler: async () => ({
                error: { code: ServiceErrorCode.NOT_FOUND, message: `Venue ${LISTING_ID} missing` }
            })
        });

        // Act
        const outcome = await executeTool({
            definition,
            actor: userActor(true),
            input: { listingId: LISTING_ID },
            context
        });

        // Assert
        expect(outcome).toEqual({
            ok: false,
            failure: {
                kind: 'denied',
                code: ServiceErrorCode.NOT_FOUND,
                message: TOOL_NOT_FOUND_MESSAGE,
                requiresReauthentication: false,
                unexpected: false
            }
        });
        expect(mockLoggerError).not.toHaveBeenCalled();
    });

    it('maps a thrown ServiceError with its details and reason', async () => {
        // Arrange
        const { definition } = makeTool({
            reasonMessages: { MESSAGE_TOO_LONG: 'El mensaje es demasiado largo.' },
            handler: async () => {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'too long',
                    undefined,
                    'MESSAGE_TOO_LONG'
                );
            }
        });

        // Act
        const outcome = await executeTool({
            definition,
            actor: userActor(true),
            input: { listingId: LISTING_ID },
            context
        });

        // Assert
        expect(outcome).toMatchObject({
            ok: false,
            failure: { kind: 'error', message: 'El mensaje es demasiado largo.' }
        });
    });

    it('answers an unexpected throw generically, logs it, and leaks nothing', async () => {
        // Arrange
        const boom = new Error('connect ECONNREFUSED 10.0.0.5:5432 password=hunter2');
        const { definition } = makeTool({
            handler: async () => {
                throw boom;
            }
        });

        // Act
        const outcome = await executeTool({
            definition,
            actor: userActor(true),
            input: { listingId: LISTING_ID },
            context
        });

        // Assert
        expect(outcome).toEqual({
            ok: false,
            failure: {
                kind: 'error',
                code: 'UNEXPECTED',
                message: TOOL_UNEXPECTED_ERROR_MESSAGE,
                requiresReauthentication: false,
                unexpected: true
            }
        });
        expect(JSON.stringify(outcome)).not.toMatch(/ECONNREFUSED|hunter2|at /);
        expect(mockLoggerError).toHaveBeenCalledTimes(1);
        expect(mockLoggerError.mock.calls[0]?.[0]).toMatchObject({
            tool: 'probe_tool',
            code: 'UNEXPECTED',
            error: boom.message,
            stack: boom.stack
        });
    });

    it('logs a returned INTERNAL_ERROR but answers generically', async () => {
        // Arrange
        const { definition } = makeTool({
            handler: async () => ({
                error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'db exploded' }
            })
        });

        // Act
        const outcome = await executeTool({
            definition,
            actor: userActor(true),
            input: { listingId: LISTING_ID },
            context
        });

        // Assert
        expect(outcome).toMatchObject({
            ok: false,
            failure: { message: TOOL_UNEXPECTED_ERROR_MESSAGE }
        });
        expect(mockLoggerError).toHaveBeenCalledTimes(1);
    });
});

describe('parseToolInput / runTool', () => {
    it('reports invalid raw input as a Spanish validation failure', () => {
        // Act
        const parsed = parseToolInput({
            definition: { inputSchema },
            input: { listingId: 'nope', extra: 1 }
        });

        // Assert
        expect(parsed.ok).toBe(false);
        if (!parsed.ok) {
            expect(parsed.failure.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(parsed.failure.message).toMatch(/^Los datos enviados no son válidos: /);
            expect(parsed.failure.message).toContain('campo «listingId»');
        }
    });

    it('runTool never calls the handler on invalid input', async () => {
        // Arrange
        const { definition, handler } = makeTool();

        // Act
        const outcome = await runTool({ definition, actor: userActor(true), input: {}, context });

        // Assert
        expect(outcome.ok).toBe(false);
        expect(handler).not.toHaveBeenCalled();
    });

    it('runTool parses then executes valid input', async () => {
        // Arrange
        const { definition, handler } = makeTool();

        // Act
        const outcome = await runTool({
            definition,
            actor: userActor(true),
            input: { listingId: LISTING_ID },
            context
        });

        // Assert
        expect(outcome).toEqual({ ok: true, data: { ok: true } });
        expect(handler).toHaveBeenCalledTimes(1);
    });
});
