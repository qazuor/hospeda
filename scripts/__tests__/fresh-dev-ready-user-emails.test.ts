/**
 * @fileoverview
 * Guard for the root `db:fresh-dev` script: every account it marks ready with
 * `db:seed:ready-user <email>` must be one the required seed actually creates.
 *
 * Regression: the staff accounts moved to `@hospeda.com.ar` while the script
 * still named `superadmin@hospeda.com` / `admin@hospeda.com`, so the last step
 * of `db:fresh-dev` failed with `user not found` after the whole database had
 * already been rebuilt.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');
const REQUIRED_USERS_DIR = join(ROOT, 'packages/seed/src/data/user/required');

function readFreshDevReadyUserEmails(): readonly string[] {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
        readonly scripts: Readonly<Record<string, string>>;
    };
    const script = pkg.scripts['db:fresh-dev'] ?? '';
    return [...script.matchAll(/db:seed:ready-user\s+(\S+)/g)].map((match) => match[1] ?? '');
}

function readRequiredSeedEmails(): ReadonlySet<string> {
    const emails = readdirSync(REQUIRED_USERS_DIR)
        .filter((file) => file.endsWith('.json'))
        .map((file) => {
            const user = JSON.parse(readFileSync(join(REQUIRED_USERS_DIR, file), 'utf8')) as {
                readonly email?: string;
            };
            return user.email ?? '';
        });
    return new Set(emails);
}

describe('db:fresh-dev ready-user targets', () => {
    it('marks at least one account ready', () => {
        // Arrange / Act
        const emails = readFreshDevReadyUserEmails();

        // Assert
        expect(emails.length).toBeGreaterThan(0);
    });

    it('only names accounts the required seed creates', () => {
        // Arrange
        const seeded = readRequiredSeedEmails();

        // Act
        const missing = readFreshDevReadyUserEmails().filter((email) => !seeded.has(email));

        // Assert
        expect(missing).toEqual([]);
    });
});
