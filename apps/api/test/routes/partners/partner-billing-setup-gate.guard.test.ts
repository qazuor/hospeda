import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const ROUTE = path.join(ROOT, 'apps/api/src/routes/partners/admin/billing-setup.ts');
const code = readFileSync(ROUTE, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/** AC:V7:17 ACC:6 requires both action 6 routes to share the own permission at the factory. */
describe('AC:V7:17 ACC:6 Partner billing setup permission gate', () => {
    it('requires partner.configureBilling on preview and act routes', () => {
        for (const route of [
            'adminPreviewPartnerBillingSetupRoute',
            'adminConfigurePartnerBillingRoute'
        ]) {
            const start = code.indexOf(`export const ${route} =`);
            const next = code.indexOf('\nexport ', start + 1);
            const block = next < 0 ? code.slice(start) : code.slice(start, next);
            expect(start).toBeGreaterThanOrEqual(0);
            expect(block).toMatch(
                /requiredPermissions:\s*\[PermissionEnum\.PARTNER_CONFIGURE_BILLING\]/
            );
        }
    });

    it('does not read the broad Partner management permission', () => {
        expect(code).not.toContain('PARTNER_MANAGE');
    });
});
