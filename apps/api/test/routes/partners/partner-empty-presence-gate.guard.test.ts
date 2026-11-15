import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const route = readFileSync(
    path.join(ROOT, 'apps/api/src/routes/partners/admin/empty-presence.ts'),
    'utf8'
)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
const service = readFileSync(
    path.join(ROOT, 'apps/api/src/services/partner-presence/partner-presence-emptying.service.ts'),
    'utf8'
)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/** ACC:25 is gated by its dedicated capability throughout the route and service. */
describe('ACC:25 Partner empty presence permission gate', () => {
    it('declares the dedicated permission at the route factory', () => {
        expect(route).toMatch(/requiredPermissions:\s*\[PermissionEnum\.PARTNER_EMPTY_PRESENCE\]/);
    });

    it('does not depend on broad Partner management permission', () => {
        expect(route).not.toContain('PARTNER_MANAGE');
        expect(service).not.toContain('PARTNER_MANAGE');
    });
});
