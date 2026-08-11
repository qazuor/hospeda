/**
 * HOS-431: guards the single-Playwright-project invariant.
 *
 * The suite runs under ONE project. It used to run under two (`chromium-web`
 * and `chromium-admin`) that differed only in `baseURL`, which meant Playwright
 * executed every spec twice against the same e2e database, concurrently. Specs
 * that read a row in `beforeAll`, mutate it, and restore it in `afterAll` then
 * raced themselves: the second copy read the first copy's mutation as "the
 * original", tried to write a value already present, and — with no actual value
 * change — never triggered React's `onChange`, so the form never went dirty and
 * Save stayed disabled. See the comment on `projects` in playwright.config.ts.
 *
 * Two assertions, because the fix rests on two separate facts:
 *
 *  1. There is exactly one project. Adding a second re-creates the duplication.
 *  2. No spec navigates relative to `baseURL`. This is what makes a single
 *     project CORRECT rather than merely cheaper — with every spec building an
 *     absolute URL from `WEB_URL` / `ADMIN_URL`, the project's `baseURL` is
 *     never consumed, so collapsing to one loses no coverage. Introduce a
 *     relative `page.goto('/…')` and that stops being true: it would silently
 *     resolve against the web URL, sending an admin spec to the wrong app.
 *
 * Known blind spot, stated rather than implied: this reads source text for
 * assertion 2, so a navigation built at runtime (`page.goto(someVar)` where
 * `someVar` holds a relative path) is invisible to it. The guard proves no spec
 * *literally writes* a relative goto — not that none can produce one.
 *
 * @see HOS-431
 * @see apps/e2e/playwright.config.ts
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import playwrightConfig from '../../playwright.config.ts';

const E2E_ROOT = join(import.meta.dirname, '..', '..');
const TESTS_DIR = join(E2E_ROOT, 'tests');

/** Matches a `goto()` whose first argument is a string literal starting with `/`. */
const RELATIVE_GOTO = /goto\(\s*['"`]\//;

/** Matches the `baseURL` fixture as a whole word (not `apiBaseUrl` / `webBaseUrl`). */
const BASE_URL_FIXTURE = /\bbaseURL\b/;

/**
 * Every `.spec.ts` under `tests/`, as `{ relPath, source }`.
 *
 * Uses a recursive directory walk rather than a glob dependency — the suite has
 * no glob helper and this keeps the guard dependency-free.
 */
function readSpecFiles(): ReadonlyArray<{ readonly relPath: string; readonly source: string }> {
    const out: Array<{ relPath: string; source: string }> = [];

    const walk = (dir: string): void => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.name.endsWith('.spec.ts')) {
                out.push({
                    relPath: full.slice(E2E_ROOT.length + 1),
                    source: readFileSync(full, 'utf-8')
                });
            }
        }
    };

    walk(TESTS_DIR);
    return out;
}

describe('HOS-431: single Playwright project', () => {
    it('declares exactly one project', () => {
        const projects = playwrightConfig.projects ?? [];

        expect(
            projects.map((p) => p.name),
            'Playwright must declare exactly ONE project. A second project with a ' +
                'different baseURL does not add coverage (no spec navigates relative to ' +
                'it) — it re-runs the whole suite against the same e2e database, so ' +
                'specs race themselves on shared rows. If you need disjoint project ' +
                'runs, give each one a testMatch first. See HOS-431.'
        ).toHaveLength(1);
    });

    it('no spec navigates relative to baseURL', () => {
        const offenders = readSpecFiles()
            .filter(({ source }) => RELATIVE_GOTO.test(source))
            .map(({ relPath }) => relPath);

        expect(
            offenders,
            `These specs call goto() with a relative path: ${offenders.join(', ')}. ` +
                'The suite runs under a single project whose baseURL points at the WEB ' +
                'app, so a relative navigation in an admin-facing spec silently hits the ' +
                'wrong server. Build the URL from WEB_URL / ADMIN_URL instead. See HOS-431.'
        ).toHaveLength(0);
    });

    it('no spec consumes the baseURL fixture', () => {
        const offenders = readSpecFiles()
            .filter(({ source }) => BASE_URL_FIXTURE.test(source))
            .map(({ relPath }) => relPath);

        expect(
            offenders,
            `These specs reference the baseURL fixture: ${offenders.join(', ')}. ` +
                'Same reason as the relative-goto guard: with one project, baseURL is a ' +
                'single fixed value, so depending on it reintroduces the assumption that ' +
                'a spec knows which app it is pointed at. See HOS-431.'
        ).toHaveLength(0);
    });
});
