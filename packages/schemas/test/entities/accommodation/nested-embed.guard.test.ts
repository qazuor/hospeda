/**
 * BETA-199 — static guard over NESTED embeds of the accommodation access schemas.
 *
 * `richDescription` + `richDescriptionI18n` are premium, gated per-owner. Both the
 * public and the protected tier enforce that gate with DATA-level helpers
 * (`filterAccommodationByEntitlements`, `stripRichDescriptionFields`, the owner
 * lookup in `protected/getById`) which all operate on a FLAT, top-level
 * accommodation object.
 *
 * None of them ever reaches an accommodation that arrives NESTED inside another
 * entity's payload. The owning services eager-load those relations with no column
 * allowlist (`getDefaultListRelations()` → Drizzle `with:` → every column), and
 * `stripWithSchema` keeps whatever the schema declares. So a schema that embeds the
 * full `AccommodationPublicSchema` / `AccommodationProtectedSchema` reopens the hole
 * those helpers exist to close, on a route nobody thinks of as an accommodation route.
 *
 * That is not hypothetical twice over. The public tier hit it first, which is why
 * `AccommodationPublicCardSchema` exists. The protected tier hit it the moment
 * BETA-199 declared the pair for the owner's editor: `GET /protected/owner-promotions`
 * eager-loads `accommodation: true`, and before the card variant it would have handed
 * the premium pair to a downgraded host with no gate anywhere in the path.
 *
 * The rule this pins: OUTSIDE `accommodation.access.schema.ts`, an accommodation is
 * embedded through a `*CardSchema` or not at all.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ENTITIES_DIR = fileURLToPath(new URL('../../../src/entities/', import.meta.url));

/** The file that DEFINES the schemas, and so is the one place naming them is fine. */
const DEFINING_FILE = join(ENTITIES_DIR, 'accommodation', 'accommodation.access.schema.ts');

/** Full-tier schemas that must never be embedded as a nested relation. */
const FORBIDDEN_IN_EMBEDS = ['AccommodationPublicSchema', 'AccommodationProtectedSchema'] as const;

/** Schemas known today to embed an accommodation — the non-vacuity anchor. */
const KNOWN_EMBEDDERS = [
    'ownerPromotion/owner-promotion.access.schema.ts',
    'post/post.access.schema.ts',
    'accommodationReview/accommodationReview.access.schema.ts'
] as const;

/** Every `.ts` file under `src/entities`, recursively. */
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

/**
 * Source with comments and string literals blanked out, so a schema named only in
 * prose (every one of these files carries a long explanatory block) cannot be
 * mistaken for a real reference — and, more importantly, cannot mask one.
 */
function code(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ')
        .replace(/'(?:[^'\\]|\\.)*'/g, "''")
        .replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

interface Offender {
    readonly file: string;
    readonly schema: string;
}

/** Files outside the defining module that reference a full-tier schema. */
function embedOffenders(): Offender[] {
    const offenders: Offender[] = [];
    for (const file of allEntityFiles()) {
        if (file === DEFINING_FILE) continue;
        const source = code(readFileSync(file, 'utf8'));
        for (const schema of FORBIDDEN_IN_EMBEDS) {
            // `\b` on the right keeps `AccommodationPublicSchema` from matching
            // inside `AccommodationPublicCardSchema` — the very identifier that
            // makes a file compliant.
            if (new RegExp(`\\b${schema}\\b`).test(source)) {
                offenders.push({ file: file.slice(ENTITIES_DIR.length), schema });
            }
        }
    }
    return offenders;
}

describe('accommodation nested-embed guard (BETA-199)', () => {
    it('no schema outside the defining module embeds a full-tier accommodation', () => {
        const offenders = embedOffenders();

        expect(
            offenders.map((o) => `${o.file} → ${o.schema}`),
            'A nested accommodation is never reached by the rich-description gate: the helpers that enforce it all take a flat top-level object, and the owning service eager-loads every column. Embed AccommodationPublicCardSchema / AccommodationProtectedCardSchema instead — they omit the premium pair outright.'
        ).toEqual([]);
    });

    it('still sees the schemas that actually embed an accommodation', () => {
        // Non-vacuity. If discovery breaks — wrong directory, renamed entities
        // folder, a comment-stripper that eats the whole file — the assertion
        // above passes while checking nothing.
        const files = allEntityFiles().map((f) => f.slice(ENTITIES_DIR.length));
        for (const known of KNOWN_EMBEDDERS) {
            expect(files).toContain(known);
        }

        const embedding = KNOWN_EMBEDDERS.filter((known) => {
            const source = code(readFileSync(join(ENTITIES_DIR, known), 'utf8'));
            return /\bAccommodation(Public|Protected)CardSchema\b/.test(source);
        });
        expect(embedding).toEqual([...KNOWN_EMBEDDERS]);
    });

    it('the comment-stripper does not hide a real reference', () => {
        // `code()` is the load-bearing half of the guard: too greedy and every
        // offender disappears. Feed it a file shaped like the real ones — prose
        // naming the forbidden schema, plus an actual embed of it.
        const sample = `
            /**
             * Do not embed AccommodationProtectedSchema here.
             */
            // AccommodationPublicSchema is also forbidden.
            const message = 'AccommodationProtectedSchema';
            export const Foo = z.object({ accommodation: AccommodationProtectedSchema.optional() });
        `;
        const stripped = code(sample);
        expect(stripped).not.toContain('Do not embed');
        expect(/\bAccommodationPublicSchema\b/.test(stripped)).toBe(false);
        // One survivor: the real embed on the last line.
        expect(stripped.match(/\bAccommodationProtectedSchema\b/g)).toHaveLength(1);
    });
});
