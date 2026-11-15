/**
 * Static guard for AC:V7:12 and V/17 §4.1 (D-9). G4 covers subscription and
 * trial machines; these censuses protect other role writers. Any new file that
 * removes roles must enter the census in the same PR with its reason.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const API_SRC = path.join(ROOT, 'apps/api/src');
const PACKAGES_DIR = path.join(ROOT, 'packages');
const ROLE_SERVICE = path.join(
    ROOT,
    'packages/service-core/src/services/user-role/user-role.service.ts'
);
const SUPER_ADMIN_SERVICE = path.join(
    ROOT,
    'packages/service-core/src/services/user-role/super-admin-role.service.ts'
);
const EXPECTED_REVOKERS = [
    'apps/api/src/routes/user/admin/roles.ts',
    'packages/service-core/src/services/user-role/super-admin-role.service.ts',
    'packages/service-core/src/services/user-role/user-role.service.ts'
].sort();
const EXPECTED_DELETERS = [
    'packages/service-core/src/services/user-role/user-role.service.ts'
].sort();

/** Reads code without comments so documentation cannot satisfy or defeat an assertion. */
function readCode(file: string): string {
    return readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
}

/** Lists source files from the API and shared packages while excluding generated and test code. */
function sourceFiles(): readonly string[] {
    const roots = [
        API_SRC,
        ...readdirSync(PACKAGES_DIR, { withFileTypes: true })
            .filter((entry) => entry.isDirectory() && entry.name !== 'seed')
            .map((entry) => path.join(PACKAGES_DIR, entry.name, 'src'))
            .filter((directory) => {
                try {
                    return readdirSync(directory).length > 0;
                } catch {
                    return false;
                }
            })
    ];
    const files: string[] = [];
    const visit = (directory: string): void => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const file = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'migrations') visit(file);
                continue;
            }
            if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
                files.push(file);
            }
        }
    };
    for (const directory of roots) visit(directory);
    return files;
}

function relativeFiles(files: readonly string[]): string[] {
    return files.map((file) => path.relative(ROOT, file).split(path.sep).join('/')).sort();
}

describe('AC:V7:12 — loss of coverage never revokes PARTNER_OWNER', () => {
    const files = sourceFiles();

    it('keeps the measured revokeRole call and definition census frozen', () => {
        const revokeFiles = files.filter((file) => {
            const code = readCode(file);
            return /\brevokeRole\s*\(/.test(code) || /\bexport\s+const\s+revokeRole\s*=/.test(code);
        });
        expect(relativeFiles(revokeFiles)).toEqual(EXPECTED_REVOKERS);
    });

    it('keeps the measured direct user_role deletion census frozen', () => {
        const deleteFiles = files.filter((file) => {
            const code = readCode(file);
            return (
                /\bDELETE\s+FROM\s+["']?user_role\b/i.test(code) ||
                /\.delete\s*\(\s*userRole\b/.test(code)
            );
        });
        expect(relativeFiles(deleteFiles)).toEqual(EXPECTED_DELETERS);
    });

    it('allows the super-admin role service to revoke only SUPER_ADMIN', () => {
        const code = readCode(SUPER_ADMIN_SERVICE);
        const calls = [...code.matchAll(/\brevokeRole\s*\(\s*\{([\s\S]*?)\}\s*\)/g)];
        expect(calls.length).toBeGreaterThan(0);
        expect(
            calls.map((call) => call[1]?.match(/\brole\s*:\s*RoleEnum\.([A-Z_]+)/)?.[1])
        ).toEqual(Array.from({ length: calls.length }, () => 'SUPER_ADMIN'));
        expect(readCode(ROLE_SERVICE)).toMatch(/\bexport\s+const\s+revokeRole\s*=/);
    });
});
