/**
 * @file auth-return-url-absolute-href.guard.test.ts
 * @description HOS-1185 — no source file may feed an absolute `.href` into a
 * post-auth return-path prop.
 *
 * ## The recurring mistake, in two spellings
 *
 * `resolveSafeReturnPath` (the open-redirect guard added by HOS-1170) only
 * accepts a same-origin RELATIVE path — it rejects any absolute URL outright,
 * same-origin or not, because the check is purely syntactic (`startsWith('/')`
 * and friends). An absolute value therefore always falls back silently to
 * `/{locale}/mi-cuenta/` instead of the page the visitor actually came from.
 *
 * The same mistake recurs in TWO forms, one per rendering side:
 * - Client islands: `window.location.href`
 * - Astro server pages: `Astro.url.href`
 *
 * HOS-1185 fixed two client sites (`FavoriteButton`, `CompareModeToggle`) by
 * composing `pathname + search (+ hash)` instead. A first pass swept only for
 * the client spelling and missed FOUR server-side sites feeding the identical
 * bug into `returnUrl`/`currentUrl` — `CommentThread.astro`'s two callers and
 * `AiSearchEntry`'s two callers — because the bug's server spelling is
 * `Astro.url.href`, not `window.location.href`. This guard watches the
 * CONSUMER side (a value landing in a `returnUrl`/`currentUrl`/`redirect`
 * prop) rather than the producer spelling, so a third recurrence — in either
 * spelling, or a new one — fails here instead of shipping silently.
 *
 * ## Anchoring
 *
 * The regex requires the prop name and the `.href` accessor to be adjacent
 * (prop name, then `:` or `=`, then optional `{`/template-literal opener,
 * then the accessor). This is deliberate: a looser "prop name ... anywhere
 * later ... .href" pattern would false-positive on the very doc comments
 * this fix added, which explain the anti-pattern in prose (see the "safe"
 * tests below) — a guard anchored on one syntactic form is exactly as
 * dangerous as no guard once someone writes the same bug differently, but a
 * guard that fires on prose explaining the bug is worse: it punishes the fix
 * for documenting itself.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = resolve(__dirname, '../../src');

/** Every prop/param name this bug has shown up under so far. */
const RETURN_PATH_PROP_NAMES = ['returnUrl', 'currentUrl', 'redirect', 'returnTo'] as const;

/**
 * Matches `<propName>` immediately followed by `:` or `=`, then an optional
 * `{` (JSX/Astro attribute) and an optional `` `${ `` (template-literal
 * opener), then directly `Astro.url.href` or `window.location.href`.
 *
 * Anchored to be adjacent on purpose — see the file doc for why a looser
 * "mentions both, anywhere" match is unsafe here.
 */
const ABSOLUTE_HREF_INTO_RETURN_PROP = new RegExp(
    `\\b(?:${RETURN_PATH_PROP_NAMES.join('|')})\\s*[:=]\\s*\\{?\\s*(?:\`\\$\\{)?\\s*` +
        '(Astro\\.url\\.href|window\\.location\\.href)\\b',
    'g'
);

/** Every source file the guard walks. */
function sourceFiles(dir: string): readonly string[] {
    const found: string[] = [];

    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            found.push(...sourceFiles(full));
            continue;
        }
        if (/\.(ts|tsx|astro)$/.test(entry)) {
            found.push(full);
        }
    }

    return found;
}

describe('HOS-1185 — no absolute .href feeds a returnUrl/currentUrl prop', () => {
    const files = sourceFiles(SRC_DIR);

    it('walks a realistic number of files', () => {
        // Non-vacuity: a broken walk would report a clean bill of health over
        // an empty set, which is the failure mode this whole class of guard has.
        expect(files.length).toBeGreaterThan(300);
    });

    it('no file passes Astro.url.href or window.location.href straight into a return-path prop', () => {
        const offenders: string[] = [];

        for (const file of files) {
            const source = readFileSync(file, 'utf8');
            if (ABSOLUTE_HREF_INTO_RETURN_PROP.test(source)) {
                offenders.push(relative(SRC_DIR, file));
            }
            // `test` on a global regex is stateful (lastIndex) — reset between files.
            ABSOLUTE_HREF_INTO_RETURN_PROP.lastIndex = 0;
        }

        expect(
            offenders,
            'file(s) feed an absolute .href straight into a returnUrl/currentUrl/redirect prop. ' +
                'resolveSafeReturnPath rejects any absolute value outright (same-origin or not) and ' +
                'silently falls back to /mi-cuenta/ (HOS-1185). Compose `pathname + search` ' +
                '(Astro pages) or `pathname + search + hash` (client islands) instead.'
        ).toEqual([]);
    });

    it('detects a violation when one is introduced (Astro spelling)', () => {
        const violating = 'currentUrl={Astro.url.href}';
        expect(ABSOLUTE_HREF_INTO_RETURN_PROP.test(violating)).toBe(true);
        ABSOLUTE_HREF_INTO_RETURN_PROP.lastIndex = 0;
    });

    it('detects a violation when one is introduced (window spelling, object-literal form)', () => {
        const violating = 'buildLoginRedirect({ locale, currentUrl: window.location.href })';
        expect(ABSOLUTE_HREF_INTO_RETURN_PROP.test(violating)).toBe(true);
        ABSOLUTE_HREF_INTO_RETURN_PROP.lastIndex = 0;
    });

    it('does not fire on the fixed, composed patterns', () => {
        // These strings are source-code fixtures under test, not real template
        // literals — the `${...}` inside them must stay literal text.
        const safePatterns = [
            // biome-ignore lint/suspicious/noTemplateCurlyInString: fixture string representing source code, not actual interpolation
            'currentUrl={`${Astro.url.pathname}${Astro.url.search}`}',
            // biome-ignore lint/suspicious/noTemplateCurlyInString: fixture string representing source code, not actual interpolation
            'const returnUrl = typeof window === "undefined" ? "" : `${window.location.pathname}${window.location.search}${window.location.hash}`;'
        ];
        for (const safe of safePatterns) {
            expect(ABSOLUTE_HREF_INTO_RETURN_PROP.test(safe)).toBe(false);
            ABSOLUTE_HREF_INTO_RETURN_PROP.lastIndex = 0;
        }
    });

    it('does not fire on prose that merely explains the anti-pattern (this fix doc comments)', () => {
        // Regression-proofs the guard against the exact doc comments this fix
        // added to AiSearchEntry/LoginCta/SearchChatPanel/CommentThread/
        // AuthRequiredPopover, which mention BOTH a return-path prop name AND
        // the absolute accessor in the same sentence — but never adjacent.
        const prose =
            // biome-ignore lint/suspicious/noTemplateCurlyInString: fixture string representing doc-comment prose, not actual interpolation
            'Pass `${Astro.url.pathname}${Astro.url.search}` from the host page — NOT ' +
            "`Astro.url.href`, which the signin page's open-redirect guard " +
            '(`resolveSafeReturnPath`, HOS-1170) rejects outright, absolute URL or not (HOS-1185). ' +
            'returnUrl and currentUrl both feed the same guard.';
        expect(ABSOLUTE_HREF_INTO_RETURN_PROP.test(prose)).toBe(false);
        ABSOLUTE_HREF_INTO_RETURN_PROP.lastIndex = 0;
    });
});
