import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sidebars } from '../src/config/ia/sidebars';

const routePath = 'src/routes/_authed/billing/plan-catalog.tsx';
const featurePath = 'src/features/billing-plan-catalog';
const routeSource = readFileSync(join(import.meta.dirname, '..', routePath), 'utf8');

function sourceFiles(path: string): string[] {
    return readdirSync(path).flatMap((name) => {
        const target = join(path, name);
        return statSync(target).isDirectory() ? sourceFiles(target) : [target];
    });
}

describe('billing plan catalog route guard', () => {
    it('requires maintenance permission and renders the feature screen', () => {
        expect(routeSource).toContain(
            'requireAdminPermission(context, PermissionEnum.MAINTENANCE_MODE_WRITE)'
        );
        expect(routeSource).toContain('<PlanCatalogScreen');
    });

    it('registers a permission gated commercial menu link', () => {
        const link = sidebars.comercialSidebar.items
            .flatMap((item) => (item.type === 'group' ? item.items : [item]))
            .find((item) => item.type === 'link' && item.id === 'plan-catalog');
        expect(link).toBeDefined();
        expect(link).toMatchObject({
            route: '/billing/plan-catalog',
            permissions: ['MAINTENANCE_MODE_WRITE']
        });
    });

    it('uses only admin API paths in the feature source', () => {
        const files = sourceFiles(join(import.meta.dirname, '..', featurePath));
        expect(files.length).toBeGreaterThan(0);
        for (const file of files)
            expect(readFileSync(file, 'utf8')).not.toContain('/api/v1/public/');
    });
});
