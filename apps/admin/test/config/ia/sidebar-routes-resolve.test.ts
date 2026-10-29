import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sidebars } from '../../../src/config/ia/sidebars';

const ROUTES_DIR = resolve(__dirname, '../../../src/routes');
function collectFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const file = join(dir, entry);
        return statSync(file).isDirectory() ? collectFiles(file) : [file];
    });
}
function collectRoutes(value: unknown): string[] {
    if (!value || typeof value !== 'object') return [];
    if (Array.isArray(value)) return value.flatMap(collectRoutes);
    const record = value as Record<string, unknown>;
    return [
        ...(typeof record.route === 'string' ? [record.route] : []),
        ...Object.entries(record)
            .filter(([key]) => key !== 'route')
            .flatMap(([, child]) => collectRoutes(child))
    ];
}
describe('IA sidebar routes', () => {
    it('resolves every nested sidebar route to a TanStack route file', () => {
        const files = collectFiles(ROUTES_DIR).map((file) => file.slice(ROUTES_DIR.length + 1));
        const routes = collectRoutes(sidebars);
        expect(routes.length).toBeGreaterThan(0);
        for (const route of routes) {
            const relative = route.replace(/^\//, '').replace(/\$([\w]+)/g, '$$$1');
            const exists = files.some((file) => {
                const path = file
                    .replace(/^_authed\//, '')
                    .replace(/\.(tsx|ts)$/, '')
                    .replace(/\/index$/, '');
                return (
                    path === relative ||
                    path === `_authed/${relative}` ||
                    path === `${relative}/index`
                );
            });
            expect(exists, `${route} has no route file`).toBe(true);
        }
    });
});
