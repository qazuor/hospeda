/**
 * HOS-346 slice 2 — province qualifiers carried INSIDE the locality string.
 *
 * Listing sites hand over `"Colón, Entre Ríos"` rather than a clean city, and
 * the substring search returns nothing for it: no catalog name contains that
 * whole string. Today the field is simply left empty.
 *
 * The move is NOT to parse the address. Positional parsing is what produced
 * `"San José, Colón, Entre Ríos"` → Colón across five rounds of adversarial
 * review, because in Entre Ríos 7 of the 22 catalog cities are ALSO department
 * names and the Argentine address order is `city, department, province`.
 *
 * Instead: strip a trailing qualifier only when it is an item of a CLOSED list
 * (a province, a country, or a bare postal code), feed the province into the
 * confidence gate, and then require the remainder to match a catalog name
 * EXACTLY. Two properties keep this safe:
 *
 * - The remainder is never fuzzy-matched. It either IS a catalog name or it
 *   resolves nothing, so no new single-wrong-row path appears.
 * - The extracted province can only DENY confidence, exactly like the payload
 *   province from slice 1.
 *
 * Owner decision (2026-08-16): when the province contradicts, still SHOW what
 * the search returned as a suggestion, and pre-select nothing.
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

type Row = { readonly id: string; readonly name: string };

const COLON: Row = { id: 'city-colon', name: 'Colón' };
const CASEROS: Row = { id: 'city-caseros', name: 'Caseros' };
const SAN_JOSE: Row = { id: 'city-sanjose', name: 'San José' };
const GUALEGUAY: Row = { id: 'city-gualeguay', name: 'Gualeguay' };
const GUALEGUAYCHU: Row = { id: 'city-gchu', name: 'Gualeguaychú' };

/**
 * Query-aware DestinationService mock: the resolver may search twice (once with
 * the raw locality, once with the qualifier-stripped remainder), so the stub
 * has to answer per query the way PostgreSQL's `ILIKE '%q%'` would.
 *
 * @param catalog - Rows the catalog holds for this test.
 */
function serviceMock(catalog: readonly Row[]): DestinationService {
    return {
        search: vi.fn().mockImplementation(async (_actor: Actor, params: { q?: string }) => {
            const q = (params.q ?? '').toLowerCase();
            // Mirrors PostgreSQL: `ILIKE '%%'` matches EVERY row. A mock that
            // returned [] for an empty query would be kinder than the database
            // and would hide the empty-remainder hazard entirely — the exact
            // shape of bug this suite exists to catch.
            const items = catalog.filter((r) => r.name.toLowerCase().includes(q));
            return { data: { items, total: items.length } };
        }),
        getBySlug: vi.fn().mockResolvedValue({ data: null })
    } as unknown as DestinationService;
}

describe('buildDestinationHint — province qualifier inside the locality (HOS-346)', () => {
    it('should resolve "Colón, Entre Ríos" and pre-select it', async () => {
        // Arrange
        const destinationService = serviceMock([COLON]);

        // Act
        const result = await buildDestinationHint({
            locality: 'Colón, Entre Ríos',
            destinationService,
            actor: fakeActor
        });

        // Assert
        expect(result.candidates).toStrictEqual([{ id: COLON.id, name: COLON.name }]);
        expect(result.confident).toBe(true);
    });

    it('should keep the ORIGINAL scraped locality in the hint', async () => {
        // Arrange — the UI echoes this back to the host; it must show what the
        // listing said, not our internal remainder.
        const destinationService = serviceMock([COLON]);

        // Act
        const result = await buildDestinationHint({
            locality: 'Colón, Entre Ríos',
            destinationService,
            actor: fakeActor
        });

        // Assert
        expect(result.scrapedLocality).toBe('Colón, Entre Ríos');
    });

    it('should SHOW the candidate but pre-select nothing when the province contradicts', async () => {
        // Arrange — Colón is a real city in Buenos Aires AND in Entre Ríos.
        // Owner decision: show what the search brought, pre-select nothing.
        const destinationService = serviceMock([COLON]);

        // Act
        const result = await buildDestinationHint({
            locality: 'Colón, Buenos Aires',
            destinationService,
            actor: fakeActor
        });

        // Assert
        expect(result.candidates).toStrictEqual([{ id: COLON.id, name: COLON.name }]);
        expect(result.confident).toBe(false);
    });

    it('should see the province past a trailing postal code', async () => {
        // Arrange — "Caseros, Buenos Aires, 1678". The previous attempt stopped
        // its scan at the postal code and never reached the province, which is
        // how a Buenos Aires listing pre-filled Caseros (Entre Ríos).
        const destinationService = serviceMock([CASEROS]);

        // Act
        const result = await buildDestinationHint({
            locality: 'Caseros, Buenos Aires, 1678',
            destinationService,
            actor: fakeActor
        });

        // Assert — asserting only `confident: false` would pass on the broken
        // version too, where nothing resolves at all. The candidate has to be
        // REACHED (so the postal code did not stop the scan) and then denied.
        expect(result.candidates).toStrictEqual([{ id: CASEROS.id, name: CASEROS.name }]);
        expect(result.confident).toBe(false);
    });

    it('should NOT resolve a city+department+province chain', async () => {
        // Arrange — THE case that killed the previous attempt. San José is the
        // city, Colón is the DEPARTMENT. After stripping only the province, the
        // remainder is "San José, Colón", which is not a catalog name — so it
        // resolves nothing rather than resolving Colón.
        const destinationService = serviceMock([COLON, SAN_JOSE]);

        // Act
        const result = await buildDestinationHint({
            locality: 'San José, Colón, Entre Ríos',
            destinationService,
            actor: fakeActor
        });

        // Assert
        expect(result.candidates).toStrictEqual([]);
        expect(result.confident).toBe(false);
    });

    it('should not resolve a full street address (documented limitation)', async () => {
        // Arrange — what Google Places hands over when it finds no `locality`
        // component. Taking the last segment before the province would be
        // positional parsing, which is out of scope by design.
        const destinationService = serviceMock([COLON]);

        // Act
        const result = await buildDestinationHint({
            locality: 'Av. Costanera 500, Colón, Entre Ríos, Argentina',
            destinationService,
            actor: fakeActor
        });

        // Assert
        expect(result.confident).toBe(false);
    });

    it('should keep only the exact remainder when the substring returns a pair', async () => {
        // Arrange — the documented over-wide case: `ILIKE '%Gualeguay%'` also
        // returns Gualeguaychú. Without requiring the remainder to match a
        // catalog name EXACTLY, a verbatim city would arrive as an ambiguous
        // pair and lose its pre-selection.
        const destinationService = serviceMock([GUALEGUAY, GUALEGUAYCHU]);

        // Act
        const result = await buildDestinationHint({
            locality: 'Gualeguay, Entre Ríos',
            destinationService,
            actor: fakeActor
        });

        // Assert
        expect(result.candidates).toStrictEqual([{ id: GUALEGUAY.id, name: GUALEGUAY.name }]);
        expect(result.confident).toBe(true);
    });

    it('should survive a locality that is ONLY a province', async () => {
        // Arrange — stripping leaves an empty remainder.
        const destinationService = serviceMock([COLON, CASEROS, SAN_JOSE]);

        // Act
        const result = await buildDestinationHint({
            locality: 'Entre Ríos',
            destinationService,
            actor: fakeActor
        });

        // Assert
        expect(result.candidates).toStrictEqual([]);
        expect(result.confident).toBe(false);
    });

    it('should never search for an empty remainder', async () => {
        // Arrange — `ILIKE '%%'` matches EVERY row, so querying the empty
        // remainder would pull the whole catalog back for nothing.
        //
        // This assertion exists because the outcome alone cannot see the
        // guard: the exact-match filter discards those rows anyway, so the
        // hint looks identical with the guard removed. Asserting the CALL is
        // the only way to keep it non-vacuous — the very trap HOS-346 records
        // ("a test went green describing a branch an earlier guard already
        // intercepted").
        const destinationService = serviceMock([COLON, CASEROS, SAN_JOSE]);

        // Act
        await buildDestinationHint({
            locality: 'Entre Ríos',
            destinationService,
            actor: fakeActor
        });

        // Assert
        const calls = vi.mocked(destinationService.search).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        for (const [, params] of calls) {
            expect((params as { q?: string }).q ?? '').not.toBe('');
        }
    });

    it('should let the payload province win over the one written in the string', async () => {
        // Arrange — a structured field beats text we parsed ourselves.
        const destinationService = serviceMock([COLON]);

        // Act
        const result = await buildDestinationHint({
            locality: 'Colón, Entre Ríos',
            region: 'Buenos Aires',
            destinationService,
            actor: fakeActor
        });

        // Assert
        expect(result.confident).toBe(false);
    });

    it('should leave a plain city untouched', async () => {
        // Arrange — non-regression: no qualifier, no second search, same result
        // as before this change.
        const destinationService = serviceMock([COLON]);

        // Act
        const result = await buildDestinationHint({
            locality: 'Colón',
            destinationService,
            actor: fakeActor
        });

        // Assert
        expect(result.candidates).toStrictEqual([{ id: COLON.id, name: COLON.name }]);
        expect(result.confident).toBe(true);
    });
});
