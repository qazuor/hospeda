/**
 * HOS-346 — province gate + curated locality aliases.
 *
 * Two additions to {@link buildDestinationHint}, deliberately NOT a smarter
 * matcher. The previous attempt layered exact / alias / containment / tokens /
 * Levenshtein plus address-qualifier parsing, and five rounds of adversarial
 * review found a confidently-wrong pre-fill in whatever the previous round had
 * added (PR #2529). The failure surface was the *interaction* between layers,
 * which cannot be enumerated.
 *
 * So:
 *
 * - **The province gate can only REMOVE confidence, never grant it.** It adds
 *   no match at all, so by construction it cannot introduce a wrong pre-fill.
 * - **The alias table is a closed, enumerable map** resolved by slug through an
 *   exact lookup — no `ILIKE`. It cannot surprise anyone with
 *   `Colonia Elía → Colón`, because `colonia elia` is not a key.
 *
 * The corpus tests below mostly pass already (the HOS-286 exact-name guard
 * catches them). They are here as regression guards: this domain punishes any
 * future loosening, and the corpus is the accumulated evidence of how.
 */

import { describe, expect, it, vi } from 'vitest';

import { buildDestinationHint } from '../../../../src/services/accommodation-import/resolvers/destination.js';
import type { DestinationService } from '../../../../src/services/destination/destination.service.js';
import type { Actor } from '../../../../src/types/index.js';

const fakeActor: Actor = {
    id: 'actor-uuid-0001',
    permissions: [],
    roles: ['HOST']
} as unknown as Actor;

/** A catalog row as the search/getBySlug stubs return it. */
type Row = { readonly id: string; readonly name: string };

const CDU: Row = { id: 'city-cdu', name: 'Concepción del Uruguay' };
const CASEROS: Row = { id: 'city-caseros', name: 'Caseros' };
const CONCORDIA: Row = { id: 'city-concordia', name: 'Concordia' };
const COLON: Row = { id: 'city-colon', name: 'Colón' };

/**
 * Builds a DestinationService mock with controllable `search` and `getBySlug`.
 *
 * @param search - rows the substring search returns.
 * @param bySlug - slug → row map for the alias lookup.
 */
function serviceMock(options: {
    readonly search?: readonly Row[];
    readonly bySlug?: Readonly<Record<string, Row & { destinationType?: string }>>;
}): DestinationService {
    const items = options.search ?? [];
    return {
        search: vi.fn().mockResolvedValue({ data: { items, total: items.length } }),
        getBySlug: vi.fn().mockImplementation(async (_actor: Actor, slug: string) => ({
            data: options.bySlug?.[slug]
                ? { destinationType: 'CITY', ...options.bySlug[slug] }
                : null
        }))
    } as unknown as DestinationService;
}

// ---------------------------------------------------------------------------
// A — province gate (AC-2, AC-3)
// ---------------------------------------------------------------------------

describe('buildDestinationHint — province gate (HOS-346 A)', () => {
    it('should deny confidence when the province contradicts Entre Ríos', async () => {
        // Arrange — "Caseros" is a real city in Tres de Febrero, Buenos Aires,
        // AND a real city in Entre Ríos. The name matches exactly, so the
        // HOS-286 guard alone would happily pre-fill the wrong province.
        const destinationService = serviceMock({ search: [CASEROS] });

        // Act
        const result = await buildDestinationHint({
            locality: 'Caseros',
            region: 'Buenos Aires',
            destinationService,
            actor: fakeActor
        });

        // Assert
        expect(result.confident).toBe(false);
    });

    it('should grant confidence when the province IS Entre Ríos', async () => {
        // Arrange
        const destinationService = serviceMock({ search: [CASEROS] });

        // Act
        const result = await buildDestinationHint({
            locality: 'Caseros',
            region: 'Entre Ríos',
            destinationService,
            actor: fakeActor
        });

        // Assert
        expect(result.confident).toBe(true);
    });

    it('should accept the province written without accents', async () => {
        // Arrange — payloads are inconsistent about accents.
        const destinationService = serviceMock({ search: [CASEROS] });

        // Act
        const result = await buildDestinationHint({
            locality: 'Caseros',
            region: 'entre rios',
            destinationService,
            actor: fakeActor
        });

        // Assert
        expect(result.confident).toBe(true);
    });

    it('should preserve today behaviour when the province is absent (fail-open)', async () => {
        // Arrange — owner decision 2026-08-16: absence does not block. It keeps
        // the auto-fills that already work on adapters carrying no province.
        const destinationService = serviceMock({ search: [CASEROS] });

        // Act
        const result = await buildDestinationHint({
            locality: 'Caseros',
            destinationService,
            actor: fakeActor
        });

        // Assert
        expect(result.confident).toBe(true);
    });

    it('should deny confidence for the Brazilian homonym that accent folding exposed', async () => {
        // Arrange — domain fact #7 of HOS-346. `unaccent()` (PR #2835) makes
        // 'Concórdia' (Santa Catarina, BR) collapse onto Concordia (ER), and
        // the ML adapter accepts mercadolivre.com.br. The search stub here
        // simulates that post-#2835 behaviour on purpose: this test is about
        // the GATE, not about the SQL.
        const destinationService = serviceMock({ search: [CONCORDIA] });

        // Act
        const result = await buildDestinationHint({
            locality: 'Concórdia',
            region: 'Santa Catarina',
            country: 'Brasil',
            destinationService,
            actor: fakeActor
        });

        // Assert
        expect(result.confident).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// B — curated aliases (AC-4, AC-6)
// ---------------------------------------------------------------------------

describe('buildDestinationHint — curated aliases (HOS-346 B)', () => {
    it('should resolve the abbreviation MercadoLibre actually emits', async () => {
        // Arrange — "C. del Uruguay" is the exact string measured on item
        // MLA1771107139. The substring search finds nothing, because the
        // catalog name contains 'ción del uruguay', not 'c. del uruguay'.
        const destinationService = serviceMock({
            search: [],
            bySlug: { 'concepcion-del-uruguay': CDU }
        });

        // Act
        const result = await buildDestinationHint({
            locality: 'C. del Uruguay',
            destinationService,
            actor: fakeActor
        });

        // Assert
        expect(result.candidates).toStrictEqual([{ id: CDU.id, name: CDU.name }]);
        expect(result.confident).toBe(true);
    });

    it('should still honour the province gate on an alias hit', async () => {
        // Arrange — an alias must not be a way around the gate.
        const destinationService = serviceMock({
            search: [],
            bySlug: { 'concepcion-del-uruguay': CDU }
        });

        // Act
        const result = await buildDestinationHint({
            locality: 'C. del Uruguay',
            region: 'Buenos Aires',
            destinationService,
            actor: fakeActor
        });

        // Assert
        expect(result.confident).toBe(false);
    });

    it('should NOT fire on a substring — the alias matches the whole locality', async () => {
        // Arrange — "Salto, C. del Uruguay" names Salto (Uruguay). Matching the
        // alias as a substring would resolve it to CdelU, which is the exact
        // class of error the five rounds kept producing.
        const destinationService = serviceMock({
            search: [],
            bySlug: { 'concepcion-del-uruguay': CDU }
        });

        // Act
        const result = await buildDestinationHint({
            locality: 'Salto, C. del Uruguay',
            destinationService,
            actor: fakeActor
        });

        // Assert
        expect(result.candidates).toStrictEqual([]);
        expect(result.confident).toBe(false);
    });

    it('should ignore an alias whose slug is not in the catalog', async () => {
        // Arrange — a stale alias entry must degrade to "no candidates", never
        // throw and never invent a destination.
        const destinationService = serviceMock({ search: [], bySlug: {} });

        // Act
        const result = await buildDestinationHint({
            locality: 'C. del Uruguay',
            destinationService,
            actor: fakeActor
        });

        // Assert
        expect(result.candidates).toStrictEqual([]);
        expect(result.confident).toBe(false);
    });

    it('should ignore an alias resolving to a non-CITY destination', async () => {
        // Arrange — the host's own City picker queries CITY only, so the
        // resolver must never produce an id that picker could not have made.
        const destinationService = serviceMock({
            search: [],
            bySlug: {
                'concepcion-del-uruguay': {
                    ...CDU,
                    destinationType: 'DEPARTMENT'
                }
            }
        });

        // Act
        const result = await buildDestinationHint({
            locality: 'C. del Uruguay',
            destinationService,
            actor: fakeActor
        });

        // Assert
        expect(result.candidates).toStrictEqual([]);
        expect(result.confident).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// C — the adversarial corpus (AC-5)
// ---------------------------------------------------------------------------

describe('buildDestinationHint — adversarial corpus never pre-fills (HOS-346 C)', () => {
    it.each([
        // [scraped locality, the single catalog row the substring search returns]
        ['Colonia Elía', COLON],
        ['Colonia Ayuí', COLON],
        ['Colonia Avellaneda', COLON],
        ['Paraná', { id: 'city-paranacito', name: 'Villa Paranacito' }],
        ['San José de Feliciano', { id: 'city-sanjose', name: 'San José' }],
        ['Santa Elena', { id: 'city-santaana', name: 'Santa Ana' }],
        ['Santa Anita', { id: 'city-santaana', name: 'Santa Ana' }],
        ['Pueblo General Belgrano', { id: 'city-liebig', name: 'Pueblo Liebig' }],
        ['Salto, Uruguay', CDU],
        ['Paysandú, Uruguay', CDU],
        ['Costa Uruguay Sur', CDU],
        ['Santa Fe', { id: 'city-santaana', name: 'Santa Ana' }],
        ['El Salvador', { id: 'city-sansalvador', name: 'San Salvador' }],
        ['La Concepción', CDU],
        ['San José, Colón, Entre Ríos', COLON]
    ])('should never mark %s as confident', async (locality, row) => {
        // Arrange — every one of these is a REAL locality of the region, and
        // each returned exactly ONE catalog row, which is the shape the review
        // UI pre-fills.
        const destinationService = serviceMock({ search: [row] });

        // Act
        const result = await buildDestinationHint({
            locality,
            destinationService,
            actor: fakeActor
        });

        // Assert
        expect(result.confident).toBe(false);
    });

    it('should never mark the postal-code case as confident', async () => {
        // Arrange — "Caseros, Buenos Aires, 1678". The previous attempt stopped
        // its scan at the postal code and never saw the province.
        const destinationService = serviceMock({ search: [CASEROS] });

        // Act
        const result = await buildDestinationHint({
            locality: 'Caseros, Buenos Aires, 1678',
            destinationService,
            actor: fakeActor
        });

        // Assert
        expect(result.confident).toBe(false);
    });
});
