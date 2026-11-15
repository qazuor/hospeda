import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sidebars } from '../src/config/ia/sidebars';

describe('AC:1704:13 TEST:1704:12 billing deadlines route guard', () => {
    it('protects and renders the deadlines screen', () => {
        const source = readFileSync(resolve('src/routes/_authed/billing/deadlines.tsx'), 'utf8');
        expect(source).toContain(
            'requireAdminPermission(context, PermissionEnum.MAINTENANCE_MODE_WRITE)'
        );
        expect(source).toContain('<DeadlinesScreen');
    });

    it('adds the permission-gated menu link and avoids importing domain internals', () => {
        const comercialSidebar = sidebars.comercialSidebar;
        const item = comercialSidebar.items
            .flatMap((entry) => (entry.type === 'group' ? entry.items : [entry]))
            .find((entry) => entry.type === 'link' && entry.id === 'deadlines');
        expect(item).toBeDefined();
        expect(item).toMatchObject({
            route: '/billing/deadlines',
            permissions: ['MAINTENANCE_MODE_WRITE']
        });
        const root = resolve('src/features/billing-deadlines');
        const files = collectTypeScriptFiles(root);
        expect(files.length).toBeGreaterThan(0);
        for (const file of files) {
            const source = readFileSync(resolve(root, file), 'utf8');
            expect(source).not.toMatch(/@repo\/(verticals|payments|service-core)/);
        }
    });
});

function collectTypeScriptFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) return collectTypeScriptFiles(path);
        return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
    });
}
