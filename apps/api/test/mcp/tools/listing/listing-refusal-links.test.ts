/**
 * HOS-2326 (spec HOS-2335 §5.1, AC-C1, AC-C4) — where the refusals of the
 * listing and inquiry tools point: the editor section that owns a refused
 * field, the plans of a vertical, the owner's lists and the inquiry inbox.
 *
 * @module test/mcp/tools/listing/listing-refusal-links
 */

import { ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/lib/mcp/record-tool-call', () => ({ recordMcpToolCall: vi.fn() }));

import { handleMcpToolCall, REFUSAL_ACTION_LINE_PREFIX } from '../../../../src/lib/mcp/bind-tool';
import { buildMcpAuthInfo } from '../../../../src/lib/mcp/caller';
import { getInquiryTool } from '../../../../src/mcp/tools/inquiry/get-inquiry';
import { listInquiriesTool } from '../../../../src/mcp/tools/inquiry/list-inquiries';
import { replyInquiryTool } from '../../../../src/mcp/tools/inquiry/reply-inquiry';
import { getListingTool } from '../../../../src/mcp/tools/listing/get-listing';
import {
    getListingStatsTool,
    NO_STATS_ENTITLEMENT_REASON
} from '../../../../src/mcp/tools/listing/get-listing-stats';
import {
    firstMissingSection,
    readListingRef,
    sectionForField
} from '../../../../src/mcp/tools/listing/listing-refusal-actions';
import { setListingPublicationTool } from '../../../../src/mcp/tools/listing/set-listing-publication';
import { updateListingBasicTool } from '../../../../src/mcp/tools/listing/update-listing-basic';
import { attachRefusalAction } from '../../../../src/mcp/tools/refusal-action';
import type { ToolDefinition, ToolErrorPayload } from '../../../../src/mcp/tools/tool-definition';
import { toToolFailure } from '../../../../src/mcp/tools/tool-errors';
import { env, validateApiEnv } from '../../../../src/utils/env';

const SITE = 'https://hospeda.test';
const USER_ID = '2f6e1c3a-8b9d-4a7e-b5c4-d3e2f1a0b9c8';
const ID = '7d3c2b1a-0f9e-4d8c-b7a6-958473625140';
const mcpAuth = {
    userId: USER_ID,
    clientId: 'https://claude.ai/oauth/mcp-client-metadata',
    clientName: 'Claude',
    scopes: ['openid']
} as const;

/** The SDK context of a verified request. */
function ctx() {
    const actor = {
        id: USER_ID,
        roles: ['HOST'],
        permissions: [],
        emailVerified: true
    } as unknown as Actor;
    return {
        http: {
            authInfo: buildMcpAuthInfo({
                token: 'tok',
                actor,
                mcpAuth,
                resourceUrl: 'https://api.test/mcp'
            })
        }
    };
}

/** Text of the first content block of a result. */
function textOf(result: Awaited<ReturnType<typeof handleMcpToolCall>>): string {
    const [first] = result.content;
    return first?.type === 'text' ? first.text : '';
}

/** What the executor makes of `error` raised by `definition` for `input`. */
function failureOf(args: {
    readonly definition: Pick<ToolDefinition, 'name' | 'refusalAction'>;
    readonly error: ToolErrorPayload;
    readonly input: unknown;
}) {
    return attachRefusalAction({
        failure: toToolFailure({ error: args.error }),
        error: args.error,
        input: args.input,
        definition: args.definition
    });
}

const editor = (vertical: string, slug?: string) => {
    const base =
        vertical === 'accommodation'
            ? `${SITE}/es/mi-cuenta/propiedades/${ID}/editar/`
            : `${SITE}/es/mi-cuenta/comercio/${vertical}/${ID}/editar/`;
    return slug === undefined ? base : `${base}${slug}/`;
};

describe('listing refusal links', () => {
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

    describe('update_listing_basic: a field the tool does not edit', () => {
        /** Calls the tool over MCP with `fields` and returns the result. */
        const call = (vertical: string, fields: Record<string, unknown>) =>
            handleMcpToolCall({
                definition: updateListingBasicTool,
                input: { vertical, id: ID, ...fields },
                ctx: ctx()
            });

        it('AC-C1: `name` of an accommodation → text ends with the absolute datos URL', async () => {
            // Act
            const result = await call('accommodation', { name: 'Nuevo nombre' });

            // Assert
            const url = `${SITE}/es/mi-cuenta/propiedades/${ID}/editar/datos/`;
            expect(result.isError).toBe(true);
            expect(textOf(result).endsWith(`\n${REFUSAL_ACTION_LINE_PREFIX} ${url}`)).toBe(true);
            expect(result.structuredContent).toMatchObject({ action: { url } });
        });

        it.each([
            ['accommodation', 'name', 'datos'],
            ['accommodation', 'photos', 'fotos'],
            ['accommodation', 'images', 'fotos'],
            ['accommodation', 'basePrice', 'capacidad-precio'],
            ['accommodation', 'price', 'capacidad-precio'],
            ['accommodation', 'latitude', 'ubicacion'],
            ['accommodation', 'location', 'ubicacion'],
            ['accommodation', 'maxGuests', 'capacidad-precio'],
            ['venue', 'name', 'datos'],
            ['venue', 'summary', 'datos'],
            ['venue', 'priceRange', 'precio'],
            ['venue', 'location', 'ubicacion'],
            ['venue', 'phone', 'contacto'],
            ['venue', 'photos', 'fotos'],
            ['experience', 'priceFrom', 'precio'],
            ['experience', 'location', 'punto-de-encuentro'],
            ['experience', 'website', 'contacto']
        ])('%s: `%s` → the %s section', async (vertical, field, slug) => {
            // Act
            const result = await call(vertical, { [field]: 'x' });

            // Assert
            expect(result.structuredContent).toMatchObject({
                action: { url: editor(vertical, slug) }
            });
        });

        it.each([
            ['accommodation', 'openingHours'],
            ['accommodation', 'totallyUnknown'],
            ['venue', 'totallyUnknown']
        ])('%s: `%s` has no section → the editor hub', async (vertical, field) => {
            // Act
            const result = await call(vertical, { [field]: 'x' });

            // Assert
            expect(result.structuredContent).toMatchObject({ action: { url: editor(vertical) } });
        });

        it('links the first offending field when several are refused', async () => {
            // Act
            const result = await call('accommodation', { amenityIds: [], photos: 'x', name: 'y' });

            // Assert: `photos` comes first among the refused keys.
            expect(result.structuredContent).toMatchObject({
                action: { url: editor('accommodation', 'fotos') }
            });
        });

        it('adds no link to a problem with a field the tool does edit', async () => {
            // Act
            const result = await call('accommodation', { description: 'corta' });

            // Assert
            expect(result.isError).toBe(true);
            expect(result.structuredContent).toBeUndefined();
        });

        it('adds no link when the call has no valid vertical', async () => {
            // Act
            const result = await call('hotel', { name: 'x' });

            // Assert
            expect(result.structuredContent).toBeUndefined();
        });

        it('falls back to the owner list when the id is not a valid id', async () => {
            // Act
            const result = await handleMcpToolCall({
                definition: updateListingBasicTool,
                input: { vertical: 'venue', id: 'not-an-id', name: 'x' },
                ctx: ctx()
            });

            // Assert
            expect(result.structuredContent).toMatchObject({
                action: { url: `${SITE}/es/mi-cuenta/comercio/` }
            });
        });

        it('a not-found points at the owner list only (AC-C4)', () => {
            // Act
            const failure = failureOf({
                definition: updateListingBasicTool,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'x' },
                input: { vertical: 'accommodation', id: ID, description: 'x'.repeat(40) }
            });

            // Assert
            expect(failure.action?.url).toBe(`${SITE}/es/mi-cuenta/propiedades/`);
        });
    });

    describe('get_listing', () => {
        it.each([
            ['accommodation', `${SITE}/es/mi-cuenta/propiedades/`],
            ['venue', `${SITE}/es/mi-cuenta/comercio/`],
            ['experience', `${SITE}/es/mi-cuenta/comercio/`]
        ])('a missing or foreign %s → the owner list, never the asked id (AC-C4)', (vertical, url) => {
            // Act
            const failure = failureOf({
                definition: getListingTool,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'x' },
                input: { vertical, id: ID }
            });

            // Assert
            expect(failure.action?.url).toBe(url);
            expect(JSON.stringify(failure)).not.toContain(ID);
        });

        it('has no link without a valid vertical', () => {
            expect(
                failureOf({
                    definition: getListingTool,
                    error: { code: ServiceErrorCode.NOT_FOUND, message: 'x' },
                    input: {}
                }).action
            ).toBeUndefined();
        });
    });

    describe('get_listing_stats', () => {
        it.each([
            ['accommodation', 'anfitriones'],
            ['venue', 'comer-y-salir'],
            ['experience', 'experiencias']
        ])('NO_STATS_ENTITLEMENT on a %s → its plans page', (vertical, slug) => {
            // Act
            const failure = failureOf({
                definition: getListingStatsTool,
                error: {
                    code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
                    message: 'x',
                    reason: NO_STATS_ENTITLEMENT_REASON
                },
                input: { vertical, listingId: ID, period: '30d' }
            });

            // Assert
            expect(failure.action?.url).toBe(`${SITE}/es/planes/${slug}/`);
        });

        it('a foreign listing → the owner list (the id lives under `listingId`)', () => {
            // Act
            const failure = failureOf({
                definition: getListingStatsTool,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'x' },
                input: { vertical: 'venue', listingId: ID }
            });

            // Assert
            expect(failure.action?.url).toBe(`${SITE}/es/mi-cuenta/comercio/`);
        });
    });

    describe.each([
        ['get_inquiry', getInquiryTool],
        ['list_inquiries', listInquiriesTool],
        ['reply_inquiry', replyInquiryTool]
    ])('%s', (_name, definition) => {
        it.each([
            ServiceErrorCode.NOT_FOUND,
            ServiceErrorCode.GONE,
            ServiceErrorCode.FORBIDDEN
        ])('%s → the inquiry inbox, not one thread (AC-C4)', (code) => {
            // Act
            const failure = failureOf({
                definition,
                error: { code, message: 'x' },
                input: { inquiryId: ID }
            });

            // Assert
            expect(failure.action?.url).toBe(`${SITE}/es/mi-cuenta/consultas-propietario/`);
        });

        it('a validation problem or a transient failure has no link', () => {
            for (const code of [
                ServiceErrorCode.VALIDATION_ERROR,
                ServiceErrorCode.SERVICE_UNAVAILABLE
            ]) {
                expect(
                    failureOf({
                        definition,
                        error: { code, message: 'x' },
                        input: { inquiryId: ID }
                    }).action
                ).toBeUndefined();
            }
        });
    });

    describe('shared listing fallbacks', () => {
        it.each([
            [ServiceErrorCode.ENTITLEMENT_REQUIRED, `${SITE}/es/planes/comer-y-salir/`],
            [ServiceErrorCode.LIMIT_REACHED, `${SITE}/es/mi-cuenta/suscripcion/`],
            [ServiceErrorCode.FORBIDDEN, `${SITE}/es/mi-cuenta/comercio/`]
        ])('%s on a venue', (code, url) => {
            // Act
            const failure = failureOf({
                definition: getListingTool,
                error: { code, message: 'x' },
                input: { vertical: 'venue', id: ID }
            });

            // Assert
            expect(failure.action?.url).toBe(url);
        });
    });
});

describe('sectionForField', () => {
    it.each([
        ['accommodation', 'name', 'basicInfo'],
        ['accommodation', 'photos', 'photos'],
        ['accommodation', 'price', 'capacityPricing'],
        ['accommodation', 'bedrooms', 'capacityPricing'],
        ['accommodation', 'longitude', 'location'],
        ['venue', 'media.featuredImage', 'media'],
        ['venue', 'priceRange', 'price'],
        ['venue', 'openingHours', 'openingHours'],
        ['venue', 'contactInfo', 'contact'],
        ['experience', 'meetingPoint', 'meetingPoint'],
        ['experience', 'priceFrom', 'price']
    ] as const)('%s / %s → %s', (vertical, field, section) => {
        expect(sectionForField({ vertical, field })).toBe(section);
    });

    it.each([
        ['accommodation', 'openingHours'],
        ['accommodation', 'unknownField'],
        ['venue', 'maxGuests'],
        ['venue', 'constructor'],
        ['venue', '__proto__']
    ] as const)('%s / %s → no section', (vertical, field) => {
        expect(sectionForField({ vertical, field })).toBeUndefined();
    });
});

describe('firstMissingSection', () => {
    it('reads accommodation requirement ids through their own editor section', () => {
        expect(
            firstMissingSection({ vertical: 'accommodation', missing: ['bedrooms', 'mainImage'] })
        ).toBe('capacityPricing');
        expect(firstMissingSection({ vertical: 'accommodation', missing: ['mainImage'] })).toBe(
            'photos'
        );
        expect(firstMissingSection({ vertical: 'accommodation', missing: ['description'] })).toBe(
            'basicInfo'
        );
    });

    it('reads venue and experience completeness field names', () => {
        expect(
            firstMissingSection({ vertical: 'venue', missing: ['openingHours', 'contactInfo'] })
        ).toBe('openingHours');
        expect(firstMissingSection({ vertical: 'experience', missing: ['priceFrom'] })).toBe(
            'price'
        );
    });

    it('skips an item with no section and takes the next', () => {
        expect(
            firstMissingSection({ vertical: 'venue', missing: ['ownerId', 'media.featuredImage'] })
        ).toBe('media');
    });

    it('answers nothing when no item has a section', () => {
        expect(firstMissingSection({ vertical: 'venue', missing: ['ownerId'] })).toBeUndefined();
        expect(firstMissingSection({ vertical: 'venue', missing: [] })).toBeUndefined();
    });
});

describe('readListingRef', () => {
    it('reads the vertical and a valid id', () => {
        expect(readListingRef({ input: { vertical: 'venue', id: ID, extra: 1 } })).toEqual({
            vertical: 'venue',
            id: ID
        });
    });

    it('reads the id from `listingId` when asked', () => {
        expect(
            readListingRef({ input: { vertical: 'venue', listingId: ID }, idKey: 'listingId' })
        ).toEqual({
            vertical: 'venue',
            id: ID
        });
        expect(
            readListingRef({ input: { vertical: 'venue', id: ID }, idKey: 'listingId' })
        ).toEqual({
            vertical: 'venue'
        });
    });

    it('drops an invalid id and keeps the vertical', () => {
        expect(readListingRef({ input: { vertical: 'venue', id: 'nope' } })).toEqual({
            vertical: 'venue'
        });
    });

    it.each([
        undefined,
        null,
        'text',
        {},
        { vertical: 'tourist' },
        { vertical: 5 }
    ])('answers nothing for %j', (input) => {
        expect(readListingRef({ input })).toBeUndefined();
    });
});

describe('set_listing_publication refusalAction', () => {
    it('is declared, so the executor can ask it', () => {
        expect(typeof setListingPublicationTool.refusalAction).toBe('function');
    });
});
