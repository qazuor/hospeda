import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sidebars } from '../src/config/ia/sidebars';

const routeSource = readFileSync(
    join(import.meta.dirname, '../src/routes/_authed/billing/addon-catalog.tsx'),
    'utf8'
);
const featurePath = join(import.meta.dirname, '../src/features/billing-addon-catalog');

function sourceFiles({ path }: { path: string }): string[] {
    return readdirSync(path).flatMap((name) => {
        const target = join(path, name);
        return statSync(target).isDirectory() ? sourceFiles({ path: target }) : [target];
    });
}

describe('TEST:B13b:3 AC:B13b:3 the action 20 editor route requires publication permission', () => {
    it('requires the existing permission and mounts the single screen', () => {
        expect(routeSource).toContain(
            'requireAdminPermission(context, PermissionEnum.BILLING_PUBLISH_ADDON_VERSION)'
        );
        expect(routeSource).toContain('<AddonCatalogScreen');
    });

    it('registers a hidden-when-missing commercial link', () => {
        const link = sidebars.comercialSidebar.items
            .flatMap((item) => (item.type === 'group' ? item.items : [item]))
            .find((item) => item.type === 'link' && item.id === 'addon-catalog');
        expect(link).toMatchObject({
            route: '/billing/addon-catalog',
            permissions: ['BILLING_PUBLISH_ADDON_VERSION'],
            onMissing: 'hide'
        });
    });

    it('uses only admin API paths', () => {
        const paths = sourceFiles({ path: featurePath }).flatMap((file) =>
            [...readFileSync(file, 'utf8').matchAll(/\/api\/v1\/[^`'"\s]+/g)].map((match) =>
                match[0].replace(/\$\{[^}]+\}/g, ':id')
            )
        );
        expect(paths.length).toBeGreaterThan(0);
        expect(paths.every((path) => path.startsWith('/api/v1/admin/'))).toBe(true);
    });
});
