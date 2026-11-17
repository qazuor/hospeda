/**
 * HOS-2326 (spec HOS-2335 §5.1, AC-C3, AC-C4) — the rules that decide whether a
 * refusal carries a portal link, applied in one place for every tool.
 *
 * @module test/mcp/tools/refusal-action
 */

import { ServiceErrorCode } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLoggerWarn } = vi.hoisted(() => ({ mockLoggerWarn: vi.fn() }));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { error: vi.fn(), info: vi.fn(), warn: mockLoggerWarn, debug: vi.fn() }
}));

import { attachRefusalAction } from '../../../src/mcp/tools/refusal-action';
import type {
    ToolDefinition,
    ToolErrorCode,
    ToolErrorPayload,
    ToolRefusalLink
} from '../../../src/mcp/tools/tool-definition';
import { toToolFailure, unexpectedToolFailure } from '../../../src/mcp/tools/tool-errors';
import { env, validateApiEnv } from '../../../src/utils/env';

const SITE = 'https://hospeda.test';
const ID = '9a1f5c2e-6b7d-4e8f-a0b1-c2d3e4f5a6b7';

const EDITOR_LINK: ToolRefusalLink = {
    destination: { kind: 'listingEditor', vertical: 'accommodation', id: ID, section: 'basicInfo' }
};
const LIST_LINK: ToolRefusalLink = {
    destination: { kind: 'ownerListings', vertical: 'accommodation' }
};

/** A definition whose `refusalAction` answers `link` (a spy). */
function toolAnswering(link: ToolRefusalLink | undefined) {
    const refusalAction = vi.fn(() => link);
    return {
        definition: { name: 'probe', refusalAction } satisfies Pick<
            ToolDefinition,
            'name' | 'refusalAction'
        >,
        refusalAction
    };
}

/** Maps `error` and attaches its link, the way the executor does. */
function attach(args: {
    readonly error: ToolErrorPayload;
    readonly link?: ToolRefusalLink;
    readonly definition?: Pick<ToolDefinition, 'name' | 'refusalAction'>;
}) {
    const failure = toToolFailure({ error: args.error });
    const definition = args.definition ?? toolAnswering(args.link).definition;
    return attachRefusalAction({ failure, error: args.error, input: { id: ID }, definition });
}

const error = (code: ToolErrorCode, extra: Partial<ToolErrorPayload> = {}): ToolErrorPayload => ({
    code,
    message: 'internal',
    ...extra
});

describe('attachRefusalAction', () => {
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
        mockLoggerWarn.mockReset();
    });

    describe('the link', () => {
        it('is built from the configured site URL with the destination label', () => {
            const failure = attach({ error: error(ServiceErrorCode.FORBIDDEN), link: EDITOR_LINK });

            expect(failure.action).toEqual({
                url: `${SITE}/es/mi-cuenta/propiedades/${ID}/editar/datos/`,
                label: 'Abrir el editor de la publicación'
            });
        });

        it('follows the site URL, so no host is hardcoded', () => {
            env.HOSPEDA_SITE_URL = 'https://staging.example.org/';

            const failure = attach({ error: error(ServiceErrorCode.FORBIDDEN), link: EDITOR_LINK });

            expect(failure.action?.url).toBe(
                `https://staging.example.org/es/mi-cuenta/propiedades/${ID}/editar/datos/`
            );
        });

        it('uses the label the tool gives', () => {
            const failure = attach({
                error: error(ServiceErrorCode.FORBIDDEN),
                link: { ...EDITOR_LINK, label: 'Completar datos' }
            });

            expect(failure.action?.label).toBe('Completar datos');
        });

        it('passes the code, reason and details of the error to the tool', () => {
            const { definition, refusalAction } = toolAnswering(undefined);
            const payload = error(ServiceErrorCode.FORBIDDEN, { reason: 'X', details: { a: 1 } });

            attach({ error: payload, definition });

            expect(refusalAction).toHaveBeenCalledWith({ error: payload, input: { id: ID } });
        });

        it('is absent when the tool has no link for the refusal', () => {
            expect(attach({ error: error(ServiceErrorCode.FORBIDDEN) }).action).toBeUndefined();
        });

        it('is absent for a tool without refusalAction', () => {
            const failure = attach({
                error: error(ServiceErrorCode.FORBIDDEN),
                definition: { name: 'plain' }
            });

            expect(failure.action).toBeUndefined();
        });
    });

    describe('transient and unexpected failures carry no link (AC-C3)', () => {
        it.each([
            ServiceErrorCode.SERVICE_UNAVAILABLE,
            ServiceErrorCode.PROVIDER_ERROR,
            ServiceErrorCode.PROVIDER_RATE_LIMITED,
            ServiceErrorCode.PROVIDER_TIMEOUT,
            ServiceErrorCode.QUOTA_EXCEEDED,
            ServiceErrorCode.UNAUTHORIZED,
            'RATE_LIMIT_EXCEEDED' as const
        ])('%s, even when the tool offers one', (code) => {
            const refusalAction = vi.fn(() => EDITOR_LINK);

            const failure = attach({
                error: error(code),
                definition: { name: 'probe', refusalAction }
            });

            expect(failure.action).toBeUndefined();
            expect(refusalAction).not.toHaveBeenCalled();
        });

        it('drops a link the handler set on a transient failure, and its help topic', () => {
            const payload = error(ServiceErrorCode.SERVICE_UNAVAILABLE, {
                link: EDITOR_LINK,
                helpTopicId: 'topic'
            });

            const failure = attach({ error: payload });

            expect(failure.action).toBeUndefined();
            expect(failure.helpTopicId).toBeUndefined();
        });

        it('an unexpected failure (no specific mapping) has no link', () => {
            const payload = error(ServiceErrorCode.INTERNAL_ERROR);

            const failure = attach({ error: payload, link: EDITOR_LINK });

            expect(failure.unexpected).toBe(true);
            expect(failure.action).toBeUndefined();
        });

        it('a non-ServiceError throw has no link', () => {
            const failure = attachRefusalAction({
                failure: unexpectedToolFailure(),
                error: error(ServiceErrorCode.INTERNAL_ERROR),
                input: {},
                definition: toolAnswering(EDITOR_LINK).definition
            });

            expect(failure.action).toBeUndefined();
        });
    });

    describe('a not-found answer never confirms an id (AC-C4)', () => {
        it.each([
            ServiceErrorCode.NOT_FOUND,
            ServiceErrorCode.GONE
        ])('%s drops a link built around an id', (code) => {
            const failure = attach({ error: error(code), link: EDITOR_LINK });

            expect(failure.action).toBeUndefined();
        });

        it.each([
            ServiceErrorCode.NOT_FOUND,
            ServiceErrorCode.GONE
        ])('%s keeps the owner listings link', (code) => {
            const failure = attach({ error: error(code), link: LIST_LINK });

            expect(failure.action?.url).toBe(`${SITE}/es/mi-cuenta/propiedades/`);
        });

        it('keeps the inquiry inbox but not one thread', () => {
            const inbox = attach({
                error: error(ServiceErrorCode.NOT_FOUND),
                link: { destination: { kind: 'inquiry' } }
            });
            const thread = attach({
                error: error(ServiceErrorCode.NOT_FOUND),
                link: { destination: { kind: 'inquiry', conversationId: ID } }
            });

            expect(inbox.action?.url).toBe(`${SITE}/es/mi-cuenta/consultas-propietario/`);
            expect(thread.action).toBeUndefined();
        });

        it('still allows an id link on a refusal that is not a not-found', () => {
            const failure = attach({ error: error(ServiceErrorCode.FORBIDDEN), link: EDITOR_LINK });

            expect(failure.action).toBeDefined();
        });
    });

    describe('a link set by the handler is a destination, never a URL', () => {
        const SUBSCRIPTION_LINK: ToolRefusalLink = { destination: { kind: 'subscription' } };

        it('is built into a URL by the executor and wins over the tool refusalAction', () => {
            const { definition, refusalAction } = toolAnswering(EDITOR_LINK);

            const failure = attach({
                error: error(ServiceErrorCode.ENTITLEMENT_REQUIRED, { link: SUBSCRIPTION_LINK }),
                definition
            });

            expect(failure.action?.url).toBe(`${SITE}/es/mi-cuenta/suscripcion/`);
            expect(refusalAction).not.toHaveBeenCalled();
        });

        it('cannot emit an off-origin URL: a raw `action` on the payload is ignored', () => {
            const evil = { url: 'https://evil.example/phish', label: 'Entrá acá' };
            const payload = { ...error(ServiceErrorCode.FORBIDDEN), action: evil };

            const failure = attach({ error: payload });
            const withLink = attach({
                error: { ...payload, link: SUBSCRIPTION_LINK }
            });

            expect(failure.action).toBeUndefined();
            expect(JSON.stringify(failure)).not.toContain('evil.example');
            expect(withLink.action?.url).toBe(`${SITE}/es/mi-cuenta/suscripcion/`);
            expect(JSON.stringify(withLink)).not.toContain('evil.example');
        });

        it('every emitted URL starts with the configured site origin', () => {
            const failure = attach({
                error: error(ServiceErrorCode.FORBIDDEN, { link: EDITOR_LINK })
            });

            expect(new URL(failure.action?.url ?? '').origin).toBe(new URL(SITE).origin);
        });

        it('a handler link with an id is dropped on a not-found answer', () => {
            const failure = attach({
                error: error(ServiceErrorCode.NOT_FOUND, { link: EDITOR_LINK })
            });

            expect(failure.action).toBeUndefined();
        });

        it('a handler link with no id is kept on a not-found answer', () => {
            const failure = attach({
                error: error(ServiceErrorCode.NOT_FOUND, { link: LIST_LINK })
            });

            expect(failure.action?.url).toBe(`${SITE}/es/mi-cuenta/propiedades/`);
        });

        it('keeps its help topic', () => {
            const failure = attach({
                error: error(ServiceErrorCode.FORBIDDEN, { helpTopicId: 'publish-requirements' })
            });

            expect(failure.helpTopicId).toBe('publish-requirements');
        });
    });

    describe('it never throws', () => {
        it('answers no link when the tool throws, and logs it', () => {
            const failure = attach({
                error: error(ServiceErrorCode.FORBIDDEN),
                definition: {
                    name: 'probe',
                    refusalAction: () => {
                        throw new Error('boom');
                    }
                }
            });

            expect(failure.action).toBeUndefined();
            expect(failure.message).toBe('Tu cuenta no tiene permiso para hacer esta acción.');
            expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
        });

        it('answers no link when the destination cannot be built, and logs it', () => {
            env.HOSPEDA_SITE_URL = '';

            const failure = attach({ error: error(ServiceErrorCode.FORBIDDEN), link: EDITOR_LINK });

            expect(failure.action).toBeUndefined();
            expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
        });
    });
});

describe('toToolFailure', () => {
    it('keeps the help topic of the payload but never copies an action from it', () => {
        const payload = {
            ...error(ServiceErrorCode.FORBIDDEN, { helpTopicId: 'topic' }),
            action: { url: 'https://evil.example/', label: 'x' }
        };
        const failure = toToolFailure({ error: payload });

        expect(failure).not.toHaveProperty('action');
        expect(failure.helpTopicId).toBe('topic');
    });

    it('adds neither key when the payload has none', () => {
        const failure = toToolFailure({ error: error(ServiceErrorCode.FORBIDDEN) });

        expect(failure).not.toHaveProperty('action');
        expect(failure).not.toHaveProperty('helpTopicId');
    });
});
