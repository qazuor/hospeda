/**
 * @fileoverview HOS-369 guard: every `entityType` in the `EntityChangeData`
 * union must have a `revalidation_config` baseline row.
 *
 * `RevalidationService.resolveConfigAndSchedule` skips the purge entirely when
 * the config lookup misses, and the miss is silent by construction: the call is
 * fire-and-forget, the log write happens downstream of the return, and the
 * service reports nothing back to the caller. So a new entity type can be wired
 * into the purge chain, ship, and evict nothing — which is exactly what happened
 * to `pointOfInterest`, `attraction`, `gastronomy`, and `experience` across all
 * of W2-4, on staging and production alike.
 *
 * The union is the contract ("these types schedule revalidation") and the seed
 * baseline is what makes the contract real. This test is the only thing that
 * holds them together — the type system cannot, since the lookup is a runtime
 * string match against a database row.
 *
 * Deliberately DERIVED from both files rather than asserting a hand-maintained
 * list: a list would need updating by the same person who forgot the config row,
 * so it would rot in precisely the case it exists to catch.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');

const ENTITY_CHANGE_TYPES_FILE = path.join(
    REPO_ROOT,
    'packages/service-core/src/revalidation/entity-change.types.ts'
);
const SEED_BASELINE_FILE = path.join(
    REPO_ROOT,
    'packages/seed/src/data/revalidationConfig/001-revalidation-config-defaults.json'
);

/**
 * Every `entityType` literal declared in the `EntityChangeData` union.
 *
 * Read from source rather than from the type: TypeScript unions are erased at
 * runtime, so there is nothing to enumerate at execution time.
 */
const declaredEntityTypes = (): readonly string[] => {
    const source = readFileSync(ENTITY_CHANGE_TYPES_FILE, 'utf8');
    const matches = source.matchAll(/readonly entityType:\s*'([^']+)'/g);
    return [...new Set([...matches].map((match) => match[1] as string))].sort();
};

/** Every `entityType` carried by the seed baseline fixture. */
const configuredEntityTypes = (): readonly string[] => {
    const entries = JSON.parse(readFileSync(SEED_BASELINE_FILE, 'utf8')) as ReadonlyArray<{
        entityType: string;
    }>;
    return [...new Set(entries.map((entry) => entry.entityType))].sort();
};

describe('every EntityChangeData type has a revalidation_config baseline row', () => {
    it('finds both sides — a broken path must fail, not silently pass', () => {
        // Without this, a renamed file or a changed declaration format turns the
        // guard into two empty sets, which compare equal and go green while
        // checking nothing.
        //
        // The floor is deliberately well below the real count: raising it to the
        // current total would duplicate the parity check below and turn every
        // legitimate removal of an entity type into an unrelated red. All this
        // needs to prove is that both readers still find their data.
        expect(declaredEntityTypes().length).toBeGreaterThan(1);
        expect(configuredEntityTypes().length).toBeGreaterThan(1);
    });

    it('has no entity type that schedules revalidation without a config row', () => {
        const missing = declaredEntityTypes().filter(
            (entityType) => !configuredEntityTypes().includes(entityType)
        );

        expect(
            missing,
            `These entity types schedule revalidation but have no revalidation_config baseline row, so every purge they trigger is a silent no-op: ${missing.join(', ')}. Add them to packages/seed/src/data/revalidationConfig/001-revalidation-config-defaults.json AND ship a seed data-migration for the already-seeded environments (dual-write rule).`
        ).toEqual([]);
    });

    it('has no config row for an entity type that no longer exists', () => {
        // The other direction: a row whose type was renamed or removed can never
        // be looked up again, so it is dead weight that reads as coverage.
        const orphaned = configuredEntityTypes().filter(
            (entityType) => !declaredEntityTypes().includes(entityType)
        );

        expect(
            orphaned,
            `These revalidation_config baseline rows have no matching entityType in the EntityChangeData union, so nothing can ever look them up: ${orphaned.join(', ')}.`
        ).toEqual([]);
    });
});
