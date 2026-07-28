/**
 * BETA-199 — discovery guard for NEW nested embeds of an accommodation.
 *
 * The behavioural half of this contract lives in `accommodation-public-card.test.ts`
 * and `accommodation-protected-card.test.ts`: for each schema that embeds an
 * accommodation as a relation, they parse the PARENT with a premium-carrying fixture
 * and assert the rich-description pair cannot survive. That is substitution-proof —
 * it holds no matter which schema the parent names.
 *
 * What those tests cannot do is notice a FOURTH embedder nobody wrote a test for.
 * They iterate a hardcoded list; a new entity embedding an accommodation would ship
 * with the premium pair reaching the wire and every suite green. Hence this file: it
 * reads `src/entities` off disk and fails when the set of files referencing an
 * accommodation schema stops matching the set those tests cover.
 *
 * It is deliberately a plain allowlist rather than a rule about which schemas may be
 * embedded. An earlier revision tried the latter and stated it as "outside the
 * defining module, an accommodation is embedded through a *CardSchema or not at all"
 * — which the tree itself falsifies: all three embedders legitimately embed
 * `AccommodationAdminSchema` for their admin tier. A guard whose header overstates
 * what it checks is worse than no guard, because it is read as coverage.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ENTITIES_DIR = fileURLToPath(new URL('../../../src/entities/', import.meta.url));

/** Any accommodation schema whose shape can carry the premium pair. */
const ACCOMMODATION_SCHEMA = /\bAccommodation(?:Public|Protected|Admin)?Schema\b/;

/**
 * Files allowed to reference one, each for a stated reason.
 *
 * The three embedders are covered behaviourally by the card tests. The
 * `accommodation/*` siblings are the entity's own module — they compose the base
 * schema into query/crud/batch/relations shapes and embed nothing.
 */
const ALLOWED = new Map<string, string>([
    ['ownerPromotion/owner-promotion.access.schema.ts', 'embeds a card + admin tier'],
    ['post/post.access.schema.ts', 'embeds a card + admin tier'],
    ['accommodationReview/accommodationReview.access.schema.ts', 'embeds a card + admin tier'],
    ['accommodation/accommodation.batch.schema.ts', "accommodation's own module"],
    ['accommodation/accommodation.crud.schema.ts', "accommodation's own module"],
    ['accommodation/accommodation.query.schema.ts', "accommodation's own module"],
    ['accommodation/accommodation.relations.schema.ts', "accommodation's own module"]
]);

/** The files that DEFINE these schemas — naming them there is the point. */
const DEFINING = new Set([
    'accommodation/accommodation.access.schema.ts',
    'accommodation/accommodation.schema.ts'
]);

/**
 * Source with string literals and comments blanked out.
 *
 * Strings go FIRST, and both patterns are line-bounded. Blanking comments first —
 * which this did until round 2 of review caught it — truncates `'https://…'` at the
 * `//`, orphans the opening quote, and lets the string pass pair it with some later
 * quote, silently blanking everything in between. That was not theoretical: it ate
 * ~60% of `calendarConnectGoogle.ts` and real `export const` lines in two schema
 * files. The `\n` in each negated class is what bounds the damage of any quote that
 * still ends up unpaired (an apostrophe in a comment is already gone by then).
 */
function code(source: string): string {
    return source
        .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
        .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ');
}

/** Every `.ts` file under `src/entities`, recursively, repo-relative. */
function allEntityFiles(dir: string = ENTITIES_DIR): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            out.push(...allEntityFiles(full));
        } else if (name.endsWith('.ts')) {
            out.push(full);
        }
    }
    return out;
}

/** Files referencing an accommodation schema, excluding the ones that define it. */
function referencingFiles(): string[] {
    return allEntityFiles()
        .map((full) => ({ name: full.slice(ENTITIES_DIR.length), full }))
        .filter(({ name }) => !DEFINING.has(name))
        .filter(({ full }) => ACCOMMODATION_SCHEMA.test(code(readFileSync(full, 'utf8'))))
        .map(({ name }) => name)
        .sort();
}

describe('accommodation nested-embed discovery guard (BETA-199)', () => {
    it('no schema references an accommodation without a card test covering it', () => {
        const unexpected = referencingFiles().filter((name) => !ALLOWED.has(name));

        expect(
            unexpected,
            `These schemas reference an accommodation schema but are not covered by accommodation-public-card.test.ts / accommodation-protected-card.test.ts. A nested accommodation is never reached by the rich-description gate — the helpers that enforce it take a flat top-level object, and the owning service eager-loads every column. Embed AccommodationPublicCardSchema / AccommodationProtectedCardSchema, then add the relation to the card tests' it.each list.`
        ).toEqual([]);
    });

    it('still finds the embedders the card tests cover', () => {
        // Non-vacuity, and the reason this is an allowlist rather than a denylist:
        // if discovery silently returns nothing — wrong directory, a stripper that
        // eats whole files — the assertion above passes while checking nothing.
        const found = referencingFiles();
        for (const embedder of [
            'ownerPromotion/owner-promotion.access.schema.ts',
            'post/post.access.schema.ts',
            'accommodationReview/accommodationReview.access.schema.ts'
        ]) {
            expect(found).toContain(embedder);
        }
    });

    it('blanks strings without swallowing the code after them', () => {
        // The defect round 2 found, pinned. A URL literal must not take the rest of
        // the file with it.
        const sample = [
            "const url = 'https://cdn.example.com/x';",
            'export const Foo = z.object({ a: AccommodationProtectedSchema });',
            "const other = 'y';"
        ].join('\n');

        const stripped = code(sample);

        expect(stripped).toContain('export const Foo');
        expect(ACCOMMODATION_SCHEMA.test(stripped)).toBe(true);
        expect(stripped).not.toContain('cdn.example.com');
    });

    it('still ignores a schema named only in prose', () => {
        // The other half of `code()`: a comment or a message string naming a schema
        // is not a reference, or every file carrying an explanatory block would be
        // flagged.
        const sample = [
            '/** Never embed AccommodationProtectedSchema here. */',
            '// AccommodationAdminSchema is fine for the admin tier.',
            "const msg = 'AccommodationPublicSchema';"
        ].join('\n');

        expect(ACCOMMODATION_SCHEMA.test(code(sample))).toBe(false);
    });
});
