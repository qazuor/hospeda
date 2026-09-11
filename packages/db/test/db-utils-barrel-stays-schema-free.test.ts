/**
 * Guard: `src/utils/` must not import a dbschema (HOS-1054).
 *
 * ## The invariant, and why it was invisible
 *
 * Every module reachable from `src/utils/index.ts` imports ZERO dbschemas.
 * Nothing declared that, nothing enforced it, and nothing in the type system
 * notices when it stops being true — which is exactly how it got broken: a
 * gastronomy clause builder was added to `utils/` because it is a helper, and
 * helpers live in `utils/`.
 *
 * ## What breaks when it is violated
 *
 * A dbschema calls `pgTable(...)` and `relations(...)` from `drizzle-orm` at
 * MODULE-LOAD time, not on first use. Dozens of suites across the repo mock
 * `drizzle-orm` wholesale, so any of them that reaches the utils barrel then
 * dies on import with:
 *
 *   `[vitest] No "relations" export is defined on the "drizzle-orm" mock`
 *
 * The failure is loud but points somewhere else entirely: the trace names
 * `packages/db/src/schemas/tag/tag.dbschema.ts` — a TAG schema, in another
 * package, with no connection to whatever the offending change touched. It
 * surfaced in CI as an unrelated billing route suite failing to load, in a
 * shard whose other red was a rate-limit test. Nothing in that picture points
 * back at a one-line barrel edit, which is why the invariant needs a guard
 * rather than a comment.
 *
 * ## What this asserts, and what it cannot
 *
 * It reads the source of every module in the utils barrel and fails on a
 * relative import of a `*.dbschema` module. It anchors on the import STATEMENT,
 * not on a substring of the whole file, so a doc-comment mentioning
 * `dbschema` (this one included, in spirit) cannot trip or satisfy it.
 *
 * It does NOT follow transitive imports: a utils module importing a plain
 * helper that itself imports a dbschema would slip through. That is the deeper
 * check, and it is deliberately not built here — every current utils module
 * imports only `drizzle-orm` and node builtins, so the direct check covers the
 * real surface, and a transitive walker would be more machinery than the
 * invariant has ever needed.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UTILS_DIR = join(__dirname, '../src/utils');

/**
 * Matches a real ES import/export-from statement naming a `.dbschema` module,
 * e.g. `import { gastronomies } from '../schemas/gastronomy/gastronomy.dbschema.ts';`
 * or `export * from './x.dbschema.ts';`. Prose is not a statement, so a comment
 * that merely says "dbschema" does not match.
 */
const DBSCHEMA_IMPORT = /^\s*(?:import|export)\b[^;]*?from\s+['"][^'"]*\.dbschema(?:\.[jt]s)?['"]/m;

const utilsModules = readdirSync(UTILS_DIR).filter(
    (f) => f.endsWith('.ts') && !f.endsWith('.test.ts')
);

describe('src/utils/ stays free of dbschema imports (HOS-1054)', () => {
    it('finds the utils modules at all — an empty sweep would be a vacuous pass', () => {
        // Without this, a renamed directory turns the whole guard into zero
        // assertions that report green.
        expect(utilsModules.length).toBeGreaterThan(5);
        expect(utilsModules).toContain('index.ts');
    });

    it.each(utilsModules)('%s imports no dbschema', (file) => {
        const source = readFileSync(join(UTILS_DIR, file), 'utf-8');
        const offending = source.match(DBSCHEMA_IMPORT)?.[0]?.trim();

        expect(
            offending,
            `${file} imports a dbschema. A dbschema runs pgTable()/relations() at module-load ` +
                'time, so every suite that mocks drizzle-orm wholesale will fail on IMPORT — ' +
                'pointing at tag.dbschema.ts, in another package, for reasons invisible from ' +
                'here. Put it under src/models/ instead, which already imports dbschemas.'
        ).toBeUndefined();
    });

    it('the regex it relies on actually catches a dbschema import', () => {
        // A guard whose predicate never fires is a guard that passes forever.
        expect(
            DBSCHEMA_IMPORT.test(
                "import { gastronomies } from '../../schemas/gastronomy/gastronomy.dbschema.ts';"
            )
        ).toBe(true);
        expect(DBSCHEMA_IMPORT.test("export * from './r_gastronomy_feature.dbschema.ts';")).toBe(
            true
        );
        // ...and does not fire on prose that merely names one.
        expect(DBSCHEMA_IMPORT.test(' * so the utils barrel never loads a dbschema module.')).toBe(
            false
        );
    });
});
