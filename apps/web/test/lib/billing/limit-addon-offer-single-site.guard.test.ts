/**
 * @file limit-addon-offer-single-site.guard.test.ts
 * @description HOS-723 — the limit → add-on resolution has exactly ONE
 * composition site in the app.
 *
 * ## The drift this exists to stop
 *
 * Turning a limit key into an add-ons link is two steps: `addonSlugForLimit`
 * (which limit has something to sell) and `buildAddonFocusUrl` (what the URL
 * looks like). Composing those two inline is easy, correct-looking, and
 * invisible to review — and it grew to THREE copies across the app before
 * anyone noticed: the plan-usage row, the publish precheck, and the limit
 * toast, each written independently.
 *
 * That is this repo's recurring failure mode: a canonical helper is created,
 * the existing call sites are never migrated, and the next fix lands in one of
 * them while the others keep the old behaviour. Billing has shipped that exact
 * bug more than once. `resolveLimitAddonOffer` is the canonical composition,
 * and this guard is what keeps a fourth copy from being written.
 *
 * ## Why a static scan and not more behavioural tests
 *
 * A duplicated composition is not wrong on its own — each copy passes its own
 * tests, which is precisely why the drift survives. What is wrong is that
 * there is MORE THAN ONE, and no test of any single surface can observe that.
 * The property is about the set of files, so the assertion is too.
 *
 * The scan walks the real source tree instead of a hand-kept list, so a file
 * added tomorrow is covered without anyone remembering to register it, and it
 * carries no allowlist beyond the canonical module itself — an exemption list
 * is where this kind of guard quietly turns fail-open.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = resolve(__dirname, '../../../src');

/** The one module allowed to compose the two halves. */
const CANONICAL_MODULE = join('lib', 'billing', 'limit-addon-offer.ts');

/**
 * The surfaces that turn a limit into an add-on offer. Asserted positively:
 * rule 1 below only forbids re-composing the pair, so a surface that dropped
 * the resolver and hand-built the URL some OTHER way would slip past it.
 */
const LIMIT_DRIVEN_SURFACES = [
    join('lib', 'billing-limit-error.ts'),
    join('lib', 'host', 'publish-precheck-panel-content.ts'),
    join('components', 'account', 'PlanUsageSection.client.tsx')
] as const;

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.astro'];

/** Every production source file under `apps/web/src`, as repo-relative paths. */
function listSourceFiles(): readonly string[] {
    return readdirSync(SRC_DIR, { recursive: true, withFileTypes: true })
        .filter(
            (entry) => entry.isFile() && SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))
        )
        .map((entry) => relative(SRC_DIR, join(entry.parentPath, entry.name)));
}

/**
 * Source with comments removed.
 *
 * Load-bearing, and found the hard way: the first version of this guard matched
 * raw text and immediately flagged `PlanUsageSection.client.tsx` — for a COMMENT
 * saying it used to compose those two symbols. A guard a comment can trip is one
 * whose first failure gets "fixed" with an allowlist entry, and an allowlist is
 * how this kind of check quietly turns fail-open. The rule is about code, so the
 * predicate reads code.
 *
 * `//` preceded by `:` is left alone so a `https://` inside a string is not
 * mistaken for the start of a comment.
 */
function readCode(relativePath: string): string {
    return readFileSync(join(SRC_DIR, relativePath), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('HOS-723 guard — one limit → add-on resolution, not one per surface', () => {
    const files = listSourceFiles();

    it('the scan actually walked the source tree', () => {
        // Without this, a broken path would make every rule below iterate an
        // empty list and pass while proving nothing.
        expect(files.length).toBeGreaterThan(200);
        expect(files).toContain(CANONICAL_MODULE);
        expect(files.map((file) => file.split(sep).join('/'))).toContain(
            'components/account/PlanUsageSection.client.tsx'
        );
    });

    it('the canonical module really does compose both halves', () => {
        // The satisfiable half of rule 1: if `limit-addon-offer.ts` stopped
        // referencing these, rule 1 would hold trivially across the whole repo
        // and would be asserting nothing at all.
        const source = readCode(CANONICAL_MODULE);

        expect(source).toContain('addonSlugForLimit');
        expect(source).toContain('buildAddonFocusUrl');
    });

    it('no other file composes addonSlugForLimit with buildAddonFocusUrl', () => {
        const offenders = files.filter((file) => {
            if (file === CANONICAL_MODULE) {
                return false;
            }

            const source = readCode(file);

            return source.includes('addonSlugForLimit') && source.includes('buildAddonFocusUrl');
        });

        expect(
            offenders,
            'These files compose the limit → add-on URL themselves instead of calling ' +
                '`resolveLimitAddonOffer` from `@/lib/billing/limit-addon-offer`. Three ' +
                'independent copies of that pair already existed once; the next change to ' +
                'the rule would reach some of them and not the others.'
        ).toEqual([]);
    });

    for (const surface of LIMIT_DRIVEN_SURFACES) {
        it(`${surface.split(sep).join('/')} resolves its offer through the resolver`, () => {
            const source = readCode(surface);

            expect(
                source,
                `${surface} builds a limit-driven add-on offer, so it must call ` +
                    '`resolveLimitAddonOffer` rather than deriving the slug or the URL itself.'
            ).toContain('resolveLimitAddonOffer');
        });
    }
});
