import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sidebars } from '../src/config/ia/sidebars';
import { breadcrumbLabels } from '../src/lib/breadcrumb-labels';

const route = readFileSync(
    join(__dirname, '../src/routes/_authed/platform/partner-applications/index.tsx'),
    'utf8'
);

describe('partner application panel route and navigation', () => {
    it('requires PARTNER_RESOLVE_APPLICATION and renders the screen', () => {
        expect(route).toContain(
            'requireAdminPermission(context, PermissionEnum.PARTNER_RESOLVE_APPLICATION)'
        );
        expect(route).toContain('<PartnerApplicationPanelScreen');
    });

    it('exposes the sidebar entry and breadcrumb', () => {
        const items = sidebars.catalogoSidebar.items.flatMap((item) =>
            item.type === 'group' ? item.items : [item]
        );
        const entry = items.find((item) => item.id === 'partner-applications');
        expect(entry).toBeDefined();
        expect(entry).toMatchObject({
            route: '/platform/partner-applications',
            permissions: ['PARTNER_RESOLVE_APPLICATION'],
            onMissing: 'hide'
        });
        expect(breadcrumbLabels['/platform/partner-applications']).toBe(
            'admin-menu.platform.partnerApplications'
        );
    });
});
