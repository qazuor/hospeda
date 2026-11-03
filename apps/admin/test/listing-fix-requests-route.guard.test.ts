import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sidebars } from '../src/config/ia/sidebars';
import { breadcrumbLabels } from '../src/lib/breadcrumb-labels';

const route = readFileSync(
    join(__dirname, '../src/routes/_authed/content/fix-requests/index.tsx'),
    'utf8'
);

describe('TEST:1704:8 AC:1704:9 pending fix requests route and navigation', () => {
    it('requires LISTING_MODERATE and renders the screen', () => {
        expect(route).toContain('requireAdminPermission(context, PermissionEnum.LISTING_MODERATE)');
        expect(route).toContain('<FixRequestsScreen');
    });

    it('exposes the catalog entry with its required route and permission', () => {
        const items = sidebars.catalogoSidebar.items.flatMap((item) =>
            item.type === 'group' ? item.items : [item]
        );
        const entry = items.find((item) => item.id === 'fix-requests');
        expect(entry).toBeDefined();
        expect(entry).toMatchObject({
            route: '/content/fix-requests',
            permissions: ['LISTING_MODERATE'],
            onMissing: 'hide'
        });
        expect(breadcrumbLabels['/content/fix-requests']).toBe('admin-menu.content.fixRequests');
    });
});
