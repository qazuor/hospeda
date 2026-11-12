import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sidebars } from '../src/config/ia/sidebars';

describe('HOS-1749 billing settings route guard', () => {
    it('requires billing settings view permission and renders the signup freeze card', () => {
        const source = readFileSync(resolve('src/routes/_authed/billing/settings.tsx'), 'utf8');
        expect(source).toContain(
            'requireAdminPermission(context, PermissionEnum.BILLING_SETTINGS_VIEW)'
        );
        expect(source).toContain('<SignupFreezeCard');
    });

    it('adds the permission-gated billing settings menu link', () => {
        const item = sidebars.comercialSidebar.items
            .flatMap((entry) => (entry.type === 'group' ? entry.items : [entry]))
            .find((entry) => entry.type === 'link' && entry.id === 'billing-settings');
        expect(item).toBeDefined();
        expect(item).toMatchObject({
            route: '/billing/settings',
            permissions: ['BILLING_SETTINGS_VIEW']
        });
    });

    it('keeps the freeze feature independent of billing domain internals', () => {
        const source = readFileSync(
            resolve('src/features/billing-signup-freeze/components/SignupFreezeCard.tsx'),
            'utf8'
        );
        expect(source).not.toMatch(/@repo\/(verticals|payments|service-core)/);
    });
});
