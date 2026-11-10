/**
 * Tests for {@link assembleVenueContext}'s `nightInfo` gate (HOS-1864).
 *
 * The other venue tests exercise the pure helpers; this one drives the async
 * assembler so the DECISION at the call site is protected. The assembler reads
 * the section map and passes `nightInfo` into the block only when the map says
 * `available` (`venue-ai-context.ts:347`). Locking `available` to `true` — or
 * deciding from the venue type/business lines instead (G-FAC-03) — must turn
 * these tests red.
 *
 * Only the data readers are mocked (`@repo/db` and the Drizzle operators); the
 * assembler itself is the real module. No rubro is compared here (G-FAC-03):
 * the assertions are about whether the night section is present, never about
 * the venue type.
 */

import type { ListingSectionState } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------

const { mockGetDb, mockApiLogger, tables } = vi.hoisted(() => {
    const table = (name: string) => ({ __table: name });
    return {
        mockGetDb: vi.fn(),
        mockApiLogger: {
            info: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
            error: vi.fn()
        },
        tables: {
            venues: table('venues'),
            venueFaqs: table('venueFaqs'),
            venueMenuItems: table('venueMenuItems'),
            venueMenuSections: table('venueMenuSections')
        }
    };
});

// Mock ONLY the data readers. The assembler is imported for real below.
vi.mock('@repo/db', () => ({
    getDb: mockGetDb,
    ...tables
}));

vi.mock('drizzle-orm', async (importOriginal) => {
    const actual = await importOriginal<typeof import('drizzle-orm')>();
    return {
        ...actual,
        eq: vi.fn(() => ({ op: 'eq' })),
        and: vi.fn(() => ({ op: 'and' })),
        isNull: vi.fn(() => ({ op: 'isNull' })),
        asc: vi.fn(() => ({ op: 'asc' }))
    };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: mockApiLogger
}));

// ---------------------------------------------------------------------------
// Import SUT (after mocks)
// ---------------------------------------------------------------------------

import type { AssembleChatContextInput } from '../../../src/services/ai-context/types.js';
import { assembleVenueContext } from '../../../src/services/ai-context/venue-ai-context.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VENUE_ID = '00000000-0000-4000-8000-000000000000';

/** A nightlife row: the `nightInfo` columns carry values even when gated off. */
function makeVenueRow(): Record<string, unknown> {
    return {
        id: VENUE_ID,
        name: 'La Noche',
        summary: 'Boliche del centro',
        description: 'Música y tragos.',
        type: 'BOLICHE',
        priceRange: 'MEDIUM',
        menuUrl: null,
        openingHours: { viernes: '23:00-04:00' },
        averageRating: 4.2,
        reviewsCount: 8,
        entryKind: 'paid',
        entryNoteI18n: { es: 'Entrada hasta la 1' },
        entryPriceFrom: 500_000,
        policies: {
            minAge: 18,
            dressCode: 'smart_casual',
            dressCodeNote: { es: 'No se permite musculosa' }
        }
    };
}

const ACTOR = {
    id: 'user-1',
    roles: ['owner'],
    permissions: [],
    isAuthenticated: true
};

const RESOLVED_PROMPT = 'You are a neutral venue assistant.';

/** One section state, with its traits map, as `resolveListingSections` shapes it. */
function section(state: ListingSectionState) {
    return { state, traits: new Map() };
}

/** The listing section map the assembler consumes, keyed by section id. */
function sectionsFor(nightState: ListingSectionState): AssembleChatContextInput['listingSections'] {
    return new Map([
        ['nightInfo', section(nightState)],
        ['menu', section('available')]
    ]);
}

/**
 * Installs a `getDb()` whose fluent chain resolves each query by the table it
 * starts from. The three reads the assembler makes are the venue row, the FAQs
 * and the carta; anything else resolves empty.
 */
function installDb(rows: ReadonlyMap<unknown, ReadonlyArray<unknown>>): void {
    const makeOrdered = (value: ReadonlyArray<unknown>) => ({
        limit: vi.fn().mockResolvedValue(value)
    });
    const makeWhere = (value: ReadonlyArray<unknown>) => ({
        orderBy: vi.fn(() => makeOrdered(value)),
        limit: vi.fn().mockResolvedValue(value)
    });
    const from = vi.fn((table: unknown) => {
        const value = rows.get(table) ?? [];
        return {
            where: vi.fn(() => makeWhere(value)),
            leftJoin: vi.fn(() => ({ where: vi.fn(() => makeWhere(value)) }))
        };
    });
    mockGetDb.mockReturnValue({ select: vi.fn(() => ({ from })) });
}

async function assemble(nightState: ListingSectionState): Promise<string> {
    installDb(
        new Map<unknown, ReadonlyArray<unknown>>([
            [tables.venues, [makeVenueRow()]],
            [tables.venueFaqs, []],
            [tables.venueMenuItems, []]
        ])
    );

    const out = await assembleVenueContext({
        actor: ACTOR as never,
        entityId: VENUE_ID,
        resolvedPrompt: RESOLVED_PROMPT,
        locale: 'es',
        listingSections: sectionsFor(nightState)
    });

    return out.systemMessage;
}

// ---------------------------------------------------------------------------
// assembleVenueContext — nightInfo gate
// ---------------------------------------------------------------------------

describe('assembleVenueContext — nightInfo gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('includes the night section when the map says available', async () => {
        const message = await assemble('available');

        expect(message).toContain('### Info para salir');
        expect(message).toContain('**Edad mínima**: 18');
    });

    it('omits it when the map says absent, even though the row carries minAge', async () => {
        const message = await assemble('absent');

        expect(message).not.toContain('### Info para salir');
        expect(message).not.toContain('**Edad mínima**');
    });

    it('omits it when the map says locked', async () => {
        const message = await assemble('locked');

        expect(message).not.toContain('### Info para salir');
        expect(message).not.toContain('**Edad mínima**');
    });
});
