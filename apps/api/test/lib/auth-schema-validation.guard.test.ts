/**
 * CI guard: Better Auth's runtime schema validation stays ON, and the
 * `users.role` placeholder it requires is never read (HOS-1932).
 *
 * Better Auth 1.7 compares the Drizzle schema with the fields its plugins
 * declare and fails every auth request when they differ. The admin plugin
 * declares `user.role`; HOS-296 had dropped `users.role` (roles live in
 * `user_role`), so sign-up answered 500 `Drizzle schema mismatch: Missing
 * columns user.role`. PR #3938 silenced that with
 * `advanced.database.validateSchema: false`; HOS-1932 instead restored the
 * column as a nullable, always-NULL placeholder and turned validation back on,
 * so a future schema drift is reported instead of hidden.
 *
 * The wiring is asserted over source because instantiating Better Auth needs a
 * live DB; the E2E P0 sign-up flow in CI is the behavioural gate.
 *
 * The second half pins the other side of the deal: the column is NOT a role
 * store. Authorization is `PermissionEnum` resolved from `user_role`, so no
 * production code may read `user.role` / `session.user.role`. This scan only
 * sees those literal receivers; the broader "role never decides" guard is
 * `scripts/check-role-never-decides.ts`.
 *
 * @module test/lib/auth-schema-validation.guard.test
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '../../../..');
const AUTH_SOURCE = readFileSync(join(__dirname, '../../src/lib/auth.ts'), 'utf8');
const USERS_SCHEMA = readFileSync(
    join(REPO_ROOT, 'packages/db/src/schemas/user/user.dbschema.ts'),
    'utf8'
);

const SOURCE_FILE = /\.(?:ts|tsx|astro)$/;
const TEST_OR_TYPES =
    /(?:\.(?:test|spec)\.[cm]?[jt]sx?$)|\.d\.ts$|(?:^|\/)(?:test|tests|__tests__|e2e)\//;
/** Seed fixtures are JSON-shaped data with their own `role` key, not Better Auth users. */
const SEED_PACKAGE = 'packages/seed/';
const SKIPPED_DIRS = new Set(['node_modules', 'dist', '.astro', '.turbo', '.output']);
const COMMENT_LINE = /^\s*(?:\*|\/\/|\/\*)/;
/** A property read of `role` on the receivers a Better Auth user can arrive as. */
const USER_ROLE_READ = /\b(?:session\??\.user|sessionUser|authUser|currentUser|user)\??\.role\b/;

function isDirectory(path: string): boolean {
    try {
        return statSync(path).isDirectory();
    } catch {
        return false;
    }
}

/** Collects source files under every `apps/*` and `packages/*` `src` directory. */
function collectSources(): readonly string[] {
    const found: string[] = [];
    const walk = (dir: string): void => {
        for (const entry of readdirSync(dir)) {
            if (SKIPPED_DIRS.has(entry)) continue;
            const full = join(dir, entry);
            if (isDirectory(full)) walk(full);
            else if (SOURCE_FILE.test(entry)) found.push(full);
        }
    };
    for (const group of ['apps', 'packages']) {
        for (const pkg of readdirSync(join(REPO_ROOT, group))) {
            const src = join(REPO_ROOT, group, pkg, 'src');
            if (isDirectory(src)) walk(src);
        }
    }
    return found;
}

describe('Better Auth schema validation (HOS-1932)', () => {
    it('does not disable advanced.database.validateSchema', () => {
        // Arrange
        const code = AUTH_SOURCE.split('\n')
            .filter((line) => !COMMENT_LINE.test(line))
            .join('\n');

        // Act / Assert
        expect(code).not.toMatch(/validateSchema\s*:/);
    });

    it('declares users.role as a nullable column with no default', () => {
        // Arrange
        const declaration = USERS_SCHEMA.match(/^\s*role:\s*(.+),\s*$/m);

        // Act / Assert
        expect(declaration?.[1]).toBe("text('role')");
    });
});

describe('users.role is a placeholder, never an authorization input (HOS-1932)', () => {
    it('no production source reads user.role / session.user.role', () => {
        // Arrange
        const files = collectSources().filter(
            (file) =>
                !TEST_OR_TYPES.test(relative(REPO_ROOT, file)) &&
                !relative(REPO_ROOT, file).startsWith(SEED_PACKAGE)
        );

        // Act
        const offenders = files.flatMap((file) =>
            readFileSync(file, 'utf8')
                .split('\n')
                .map((text, index) => ({ text, line: index + 1 }))
                .filter(({ text }) => !COMMENT_LINE.test(text) && USER_ROLE_READ.test(text))
                .map(({ line }) => `${relative(REPO_ROOT, file)}:${line}`)
        );

        // Assert
        expect(files.length).toBeGreaterThan(1000);
        expect(offenders).toEqual([]);
    });
});
