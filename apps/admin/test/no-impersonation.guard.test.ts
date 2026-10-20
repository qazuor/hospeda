/**
 * Guard: the admin panel offers no impersonation (HOS-1352 V5, AC:V5:10).
 *
 * TEST:V5:12 (static half). The browser half is
 * `apps/e2e/tests/admin/adm-05-no-impersonate.spec.ts`, which runs in the e2e
 * suite; this half runs with every admin unit run, so a button wired back in
 * goes red in the ordinary CI job.
 *
 * Impersonation left the product entirely (DEC-AUTH-003 point 4): the Better
 * Auth `impersonate` action, the `USER_IMPERSONATE` permission and the panel
 * button with its banner. Any admin source that calls the plugin's
 * impersonation client, renders the button or the banner, or gates on the
 * retired permission brings the second path back.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = join(__dirname, '../src');

/** Identifiers that only exist to impersonate someone. */
const FORBIDDEN = [
    /\bimpersonateUser\b/,
    /\bstopImpersonating\b/,
    /\bImpersonateButton\b/,
    /\bImpersonationBanner\b/,
    /\bUSER_IMPERSONATE\b/,
    /\bimpersonatedBy\b/
] as const;

function listSourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) return listSourceFiles(path);
        return /\.(ts|tsx)$/.test(entry) ? [path] : [];
    });
}

describe('TEST:V5:12 — no impersonation affordance in the admin source', () => {
    const files = listSourceFiles(SRC_DIR);

    it('scans the admin source tree (the walker is not vacuous)', () => {
        expect(files.length).toBeGreaterThan(100);
        expect(files.some((file) => file.endsWith('routes/_authed/access/users/$id.tsx'))).toBe(
            true
        );
    });

    it('no admin source references an impersonation identifier', () => {
        const offenders = files.flatMap((file) => {
            const source = readFileSync(file, 'utf8');
            return FORBIDDEN.filter((pattern) => pattern.test(source)).map(
                (pattern) => `${relative(SRC_DIR, file)} matches ${pattern}`
            );
        });

        expect(
            offenders,
            `Impersonation was retired by HOS-1352 V5 (DEC-AUTH-003 point 4); these files bring it back: ${offenders.join(', ')}`
        ).toEqual([]);
    });
});
