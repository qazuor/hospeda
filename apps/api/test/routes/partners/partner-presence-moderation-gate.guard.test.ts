import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'glob';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_SRC = path.resolve(__dirname, '../../../src');
const REPO_ROOT = path.resolve(API_SRC, '../../..');
const ROUTE = path.join(API_SRC, 'routes/partners/admin/presence-moderation.ts');
const EXPECTED_WRITERS = new Set([
    'apps/api/src/services/partner-presence/partner-presence-moderation.service.ts',
    'packages/db/src/models/partner/partner.model.ts'
]);

/** Reads source with comments stripped, so documentation cannot satisfy a gate. */
const readCode = (file: string): string =>
    readFileSync(file, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

describe('AC:V7:14 — Partner presence moderation is gated by ACC:12 (sources: action 13), V7 §1.6', () => {
    it('requires LISTING_MODERATE on the presence-first route', () => {
        const code = readCode(ROUTE);
        expect(code).toMatch(/requiredPermissions:\s*\[PermissionEnum\.LISTING_MODERATE\]/);
    });

    it('does not name PARTNER_MANAGE in a presence moderation writer or route', () => {
        const candidates = globSync(
            [
                'apps/api/src/routes/partners/**/*.{ts,tsx}',
                'apps/api/src/services/partner-presence/**/*.{ts,tsx}'
            ],
            { cwd: REPO_ROOT, absolute: true }
        ).filter((file) => {
            const code = readCode(file);
            return code.includes('setPresenceModerated') || code.includes('presence-moderation');
        });
        expect(candidates.length).toBeGreaterThan(0);
        for (const file of candidates) expect(readCode(file)).not.toContain('PARTNER_MANAGE');
    });

    it('keeps setPresenceModerated exclusive to this action service and its model definition', () => {
        const productionFiles = globSync(
            ['apps/api/src/**/*.{ts,tsx}', 'packages/*/src/**/*.{ts,tsx}'],
            { cwd: REPO_ROOT, absolute: true }
        );
        const callers = productionFiles.filter((file) =>
            /\.setPresenceModerated\s*\(/.test(readCode(file))
        );
        const definitions = productionFiles.filter((file) =>
            /\bsetPresenceModerated\s*\(/.test(readCode(file))
        );
        const relativeCallers = callers.map((file) => path.relative(REPO_ROOT, file));
        const relativeDefinitions = definitions.map((file) => path.relative(REPO_ROOT, file));
        expect(new Set(relativeCallers)).toEqual(
            new Set([
                'apps/api/src/services/partner-presence/partner-presence-moderation.service.ts'
            ])
        );
        expect(new Set(relativeDefinitions)).toEqual(EXPECTED_WRITERS);
    });
});
