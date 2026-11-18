/**
 * Shared fixtures of the `create_listing` tests (HOS-2329): ids, valid inputs per
 * vertical, the in-memory Redis fake, the spies the `vi.mock` factories point
 * at, and the service spies. Each test file keeps its own `vi.mock` calls
 * (vitest hoists them per file) and points them at {@link mocks}.
 *
 * Listing access runs for real over mocked ports; the token store runs for real
 * over the Redis fake (GETDEL single use, TTL); the Maps resolver runs for real
 * over an injected hop fetcher (never the network).
 *
 * @module test/mcp/tools/listing/create-listing.harness
 */

import { VerticalEnum } from '@repo/schemas';
import {
    AccommodationService,
    type Actor,
    DestinationService,
    ExperienceService,
    VenueService
} from '@repo/service-core';
import { vi } from 'vitest';
import type { MapsHopFetcher } from '../../../../src/mcp/tools/listing/google-maps-link-fetcher';

/** The spies every test file hands to its `vi.mock` factories. */
export const mocks = {
    loadFacts: vi.fn(),
    coverage: vi.fn(),
    effectiveSet: vi.fn(),
    preTrialDraftLimits: vi.fn(),
    record: vi.fn(),
    invalidateCache: vi.fn(),
    analytics: vi.fn(),
    precheck: vi.fn(),
    redis: undefined as unknown
};

export const OWNER_ID = '1f2e3d4c-5b6a-4789-8abc-def012345678';
export const OTHER_ID = '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';
export const CREATED_ID = '9a1f5c2e-6b7d-4e8f-a0b1-c2d3e4f5a6b7';
export const DESTINATION_ID = 'd1111111-1111-4111-8111-111111111111';
export const UNKNOWN_DESTINATION_ID = 'd9999999-9999-4999-8999-999999999999';
export const CLIENT = 'https://claude.ai/oauth/mcp-client-metadata';
export const OTHER_CLIENT = 'https://chatgpt.com/oauth/client';
export const context = { channel: 'mcp', clientId: CLIENT } as const;

/** A full Maps URL (zero network calls) at Concepción del Uruguay. */
export const FULL_MAPS_URL =
    'https://www.google.com/maps/place/Calle+Falsa+123/@-32.4825,-58.2372,17z/data=!3d-32.4826!4d-58.2373';
export const FULL_MAPS_POINT = { lat: -32.4826, lng: -58.2373 };
/** A short link, resolved through the injected fetcher. */
export const SHORT_MAPS_URL = 'https://maps.app.goo.gl/AbCdEf123';

export const actorFor = (
    id: string = OWNER_ID,
    options: { readonly emailVerified?: boolean } = {}
): Actor =>
    ({
        id,
        roles: ['USER'],
        permissions: [],
        emailVerified: options.emailVerified ?? true
    }) as unknown as Actor;

export const VERTICALS = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
] as const;
export type Vertical = (typeof VERTICALS)[number];

/** A valid input per vertical, with no location. */
export const VALID_INPUT: Readonly<Record<Vertical, Readonly<Record<string, unknown>>>> = {
    [VerticalEnum.ACCOMMODATION]: {
        vertical: VerticalEnum.ACCOMMODATION,
        name: 'Cabañas del Río',
        type: 'CABIN',
        summary: 'Cabañas frente al río con parrilla.',
        destinationId: DESTINATION_ID,
        maxGuests: 4
    },
    [VerticalEnum.VENUE]: {
        vertical: VerticalEnum.VENUE,
        name: 'La Parrilla de Juan',
        type: 'PARRILLA',
        summary: 'Parrilla tradicional en el centro.',
        description:
            'Parrilla tradicional con cortes de la zona, abierta al mediodía y a la noche todos los días.',
        destinationId: DESTINATION_ID
    },
    [VerticalEnum.EXPERIENCE]: {
        vertical: VerticalEnum.EXPERIENCE,
        name: 'Kayak al atardecer',
        type: 'BOAT_TRIP',
        summary: 'Paseo en kayak por el río Uruguay.',
        description:
            'Salida guiada en kayak por el río Uruguay al atardecer, con equipo incluido y guía bilingüe.',
        destinationId: DESTINATION_ID,
        priceFrom: 1500000,
        priceUnit: 'per_person'
    }
};

/** In-memory Redis fake with TTL driven by an injected clock. */
export function makeFakeRedis() {
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

/** A hop fetcher that redirects a short link once to a full Maps URL. */
export function shortLinkFetcher(target: string = FULL_MAPS_URL) {
    return vi.fn<MapsHopFetcher>(async () => ({ status: 302, location: target }));
}

/** The destination catalog: one known CITY. */
export function givenDestinations() {
    return {
        getById: vi
            .spyOn(DestinationService.prototype, 'getById')
            .mockImplementation(async (_actor, id) =>
                id === DESTINATION_ID
                    ? ({ data: { id, name: 'Concepción del Uruguay' } } as never)
                    : ({ data: null } as never)
            ),
        search: vi.spyOn(DestinationService.prototype, 'search').mockResolvedValue({
            data: { items: [{ id: DESTINATION_ID, name: 'Concepción del Uruguay' }], total: 1 }
        } as never)
    };
}

/** The three create services, spied on their prototypes. */
export function givenCreateServices() {
    return {
        [VerticalEnum.ACCOMMODATION]: vi
            .spyOn(AccommodationService.prototype, 'createForOnboarding')
            .mockResolvedValue({
                data: {
                    status: 'created',
                    accommodation: { id: CREATED_ID, slug: 'cabanas-del-rio' }
                }
            } as never),
        [VerticalEnum.VENUE]: vi.spyOn(VenueService.prototype, 'createForOwner').mockResolvedValue({
            data: { id: CREATED_ID, slug: 'la-parrilla-de-juan' }
        } as never),
        [VerticalEnum.EXPERIENCE]: vi
            .spyOn(ExperienceService.prototype, 'createForOwner')
            .mockResolvedValue({ data: { id: CREATED_ID, slug: 'kayak-al-atardecer' } } as never)
    };
}

/** The precheck answer: a free slot unless told otherwise. */
export function givenPrecheck(options: { readonly atLimit?: boolean } = {}): void {
    mocks.precheck.mockResolvedValue({
        currentCount: options.atLimit ? 1 : 0,
        maxAllowed: 1,
        hasQuota: !options.atLimit,
        draftCount: 0,
        drafts: [],
        decision: options.atLimit ? 'upgrade_only' : 'create_direct'
    });
}

/** Runs the tool, built with an optional Maps fetcher (lazy import: see the amenities harness). */
export const run = async (
    input: Record<string, unknown>,
    options: {
        readonly actor?: Actor;
        readonly fetchHop?: MapsHopFetcher;
        readonly context?: { readonly channel: 'mcp'; readonly clientId?: string };
    } = {}
) => {
    const { buildCreateListingTool } = await import(
        '../../../../src/mcp/tools/listing/create-listing'
    );
    const { runTool } = await import('../../../../src/mcp/tools/run-tool');
    return runTool({
        definition: buildCreateListingTool(options.fetchHop ? { fetchHop: options.fetchHop } : {}),
        actor: options.actor ?? actorFor(),
        input,
        context: options.context ?? context
    });
};

/** Runs the preview and returns its token. */
export async function previewToken(
    input: Record<string, unknown>,
    options: Parameters<typeof run>[1] = {}
): Promise<string> {
    const outcome = await run(input, options);
    if (!outcome.ok) throw new Error(`preview failed: ${outcome.failure.message}`);
    const data = outcome.data as { readonly confirmationToken?: string };
    if (!data.confirmationToken) throw new Error('preview returned no token');
    return data.confirmationToken;
}
