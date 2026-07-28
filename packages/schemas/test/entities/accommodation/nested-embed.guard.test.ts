/**
 * BETA-199 — discovery guard for NEW nested embeds of an accommodation.
 *
 * The behavioural half of this contract lives in `accommodation-public-card.test.ts`
 * and `accommodation-protected-card.test.ts`: for each schema that embeds an
 * accommodation as a relation, they parse the PARENT with a premium-carrying fixture
 * and assert the rich-description pair cannot survive. That is substitution-proof —
 * it holds no matter which schema the parent names.
 *
 * What those tests cannot do is notice anything they do not already iterate, and
 * they iterate a hardcoded list of (file, relation field) pairs. Two blind spots
 * follow, and this file covers exactly those two — nothing more:
 *
 *   1. A FOURTH EMBEDDER. A new entity embedding an accommodation would ship with
 *      the premium pair on the wire and every suite green. Caught by comparing the
 *      set of files referencing an accommodation schema against a fixed allowlist.
 *   2. A SECOND RELATION inside an existing embedder — `featuredAccommodation:
 *      AccommodationProtectedSchema` alongside the card-tier one. The card tests
 *      iterate field names, so this is invisible to them. Caught by checking WHICH
 *      accommodation schemas each embedder names.
 *
 * What it does NOT cover, stated because the alternative is being read as coverage:
 * it walks `packages/schemas/src/entities` only, and it reasons about identifiers,
 * so a relation built from a locally-composed schema (`const X =
 * AccommodationProtectedSchema.extend({...})` in a third file, then embedded) is not
 * seen. The card tests are what make the three live relations safe; this is the net
 * for the shapes they cannot iterate.
 *
 * Check 2 is an allowlist of embeddable schemas rather than a denylist of forbidden
 * ones. An earlier revision used a denylist of four tier names while claiming to
 * match "any schema that can carry the premium pair" — false in this package, where
 * `AccommodationWithRelationsSchema` and friends carry it too. The set that is safe
 * to embed is small and fixed; the set that is dangerous grows on its own.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ENTITIES_DIR = fileURLToPath(new URL('../../../src/entities/', import.meta.url));

/**
 * Every schema exported by the accommodation module, read off disk.
 *
 * Derived rather than listed. An earlier revision hardcoded the four obvious tiers
 * (`Accommodation(Public|Protected|Admin)?Schema`) while documenting itself as
 * matching "any schema that can carry the premium pair" — false in this package,
 * where `AccommodationWithRelationsSchema`, `AccommodationWithOwnerSchema`,
 * `AccommodationCreateOutputSchema` and several siblings all derive from the base
 * entity and carry it too. Widening the regex to `Accommodation\w*Schema` instead
 * over-matches in the other direction: `AccommodationReviewSchema` and
 * `AccommodationCalendarSyncSchema` are OTHER entities that merely share the prefix.
 *
 * Reading the module's own exports is the only version of this that is both
 * complete and precise, and it stays correct when someone composes a new one.
 */
function accommodationSchemaNames(): Set<string> {
    const dir = join(ENTITIES_DIR, 'accommodation');
    const names = new Set<string>();
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
        const source = readFileSync(join(dir, file), 'utf8');
        for (const match of source.matchAll(/export const (Accommodation\w*Schema)\b/g)) {
            names.add(match[1] as string);
        }
    }
    return names;
}

const ACCOMMODATION_SCHEMAS = accommodationSchemaNames();

/**
 * The only accommodation schemas an EMBEDDER may name.
 *
 * An allowlist, not a denylist, for the reason above: the set of schemas that can
 * carry the premium pair grows every time someone composes a new one, while the
 * set that is safe to embed is fixed and small. The two card tiers omit the pair
 * outright; the admin tier carries it and is legitimate because those payloads are
 * permission-gated staff surfaces.
 */
const EMBEDDABLE = new Set([
    'AccommodationPublicCardSchema',
    'AccommodationProtectedCardSchema',
    'AccommodationAdminSchema'
]);

/** Files that embed an accommodation into another entity's schema. */
const EMBEDDERS = [
    'ownerPromotion/owner-promotion.access.schema.ts',
    'post/post.access.schema.ts',
    'accommodationReview/accommodationReview.access.schema.ts'
] as const;

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

/** The accommodation schemas a given source names, by identifier. */
function accommodationSchemasNamedIn(source: string): string[] {
    const stripped = code(source);
    return [...ACCOMMODATION_SCHEMAS]
        .filter((name) => new RegExp(`\\b${name}\\b`).test(stripped))
        .sort();
}

/**
 * Identifier shape used for DISCOVERY — the accommodation TIERS.
 *
 * Narrower than {@link ACCOMMODATION_SCHEMAS} on purpose, and the two answer
 * different questions. This one asks "is a file starting to touch accommodations
 * at all", where the tiers are what anyone embedding one actually reaches for;
 * matching all 61 exports instead sweeps in `AccommodationSummarySchema`,
 * `AccommodationFiltersSchema` and other shapes that cannot carry the premium pair,
 * turning the allowlist into noise. The full set is used where precision matters —
 * checking WHICH schema an embedder names.
 *
 * The gap this leaves, stated rather than papered over: a fourth embedder reaching
 * straight for `AccommodationWithRelationsSchema` is not discovered. Tracked as a
 * follow-up alongside the other guard-hardening items.
 */
const ACCOMMODATION_TIER = /\bAccommodation(?:Public|Protected|Admin)?(?:Card)?Schema\b/;

/** Files referencing an accommodation tier, excluding the ones that define it. */
function referencingFiles(): string[] {
    return allEntityFiles()
        .map((full) => ({ name: full.slice(ENTITIES_DIR.length), full }))
        .filter(({ name }) => !DEFINING.has(name))
        .filter(({ full }) => ACCOMMODATION_TIER.test(code(readFileSync(full, 'utf8'))))
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

    it.each(EMBEDDERS)('%s names only embeddable accommodation schemas', (embedder) => {
        // The per-FIELD half of the contract, which the per-FILE allowlist above
        // cannot express. `accommodation-protected-card.test.ts` parses the three
        // relations that exist today, by hardcoded name — so a SECOND relation
        // added to one of these files (`featuredAccommodation:
        // AccommodationProtectedSchema`) is iterated by nothing and would ship the
        // premium pair through `GET /protected/posts`.
        //
        // An earlier revision had this check and round 2 deleted it, on the
        // grounds that its header overstated the rule (it claimed "*CardSchema or
        // nothing", which the legitimate admin embeds falsify). The header was
        // wrong; the check was not. Fix the prose, keep the check.
        const named = accommodationSchemasNamedIn(
            readFileSync(join(ENTITIES_DIR, embedder), 'utf8')
        );
        const forbidden = named.filter((name) => !EMBEDDABLE.has(name));

        expect(
            forbidden,
            `${embedder} names ${forbidden.join(', ')}. An embedded accommodation is never reached by the rich-description gate, so a relation may only use a card tier (which omits the premium pair) or the admin tier (permission-gated). Add the relation to accommodation-protected-card.test.ts too.`
        ).toEqual([]);

        // Non-vacuity: an empty match set would satisfy the assertion above.
        expect(named.length).toBeGreaterThan(0);
    });

    it('still finds the embedders the card tests cover', () => {
        // Non-vacuity for discovery: if it silently returns nothing — wrong
        // directory, a stripper that eats whole files — the first assertion passes
        // while checking nothing.
        const found = referencingFiles();
        for (const embedder of EMBEDDERS) {
            expect(found).toContain(embedder);
        }
        // Counted, not just spot-checked: a stripper regression that hides a file
        // shows up here rather than silently shrinking coverage. The routes guard
        // has a raw-vs-stripped equality check for this; comments legitimately name
        // schemas here, so the fixed set is the anchor instead.
        expect(found.length).toBe(ALLOWED.size);
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
        expect(ACCOMMODATION_TIER.test(stripped)).toBe(true);
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

        expect(ACCOMMODATION_TIER.test(code(sample))).toBe(false);
    });
});
