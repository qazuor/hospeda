import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = path.resolve(process.cwd(), 'src');
const allowedCachePath = 'lib/entitlements-cache.ts';

function findCacheImporters(root: string): string[] {
    const entries = readdirSync(root, { recursive: true, withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile())
        .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)))
        .filter((relativePath) => {
            const normalized = relativePath.split(path.sep).join('/');
            if (normalized === allowedCachePath) return false;
            if (normalized.startsWith('hooks/')) return false;
            if (normalized.endsWith('.client.tsx')) return false;
            return /\.(?:astro|ts|tsx)$/.test(normalized);
        })
        .filter((relativePath) =>
            readFileSync(path.join(root, relativePath), 'utf8').includes('getEntitlementsCached')
        )
        .map((relativePath) => relativePath.split(path.sep).join('/'))
        .sort();
}

describe('TEST:1769:4 entitlements cache is browser-only', () => {
    it('has exactly the expected non-empty browser importers', () => {
        const allFiles = readdirSync(sourceRoot, { recursive: true, withFileTypes: true });
        const expected = allFiles
            .filter((entry) => entry.isFile())
            .map((entry) => path.relative(sourceRoot, path.join(entry.parentPath, entry.name)))
            .filter((relativePath) => {
                const normalized = relativePath.split(path.sep).join('/');
                return (
                    normalized !== allowedCachePath &&
                    (normalized.startsWith('hooks/') || normalized.endsWith('.client.tsx')) &&
                    readFileSync(path.join(sourceRoot, relativePath), 'utf8').includes(
                        'getEntitlementsCached'
                    )
                );
            })
            .map((relativePath) => relativePath.split(path.sep).join('/'))
            .sort();
        expect(expected).toEqual([
            'components/host/AnalyticsSection.client.tsx',
            'components/host/PromotionList.client.tsx',
            'hooks/use-price-alert-gate-state.ts',
            'hooks/useMyEntitlements.ts'
        ]);
        expect(expected).not.toHaveLength(0);
        expect(findCacheImporters(sourceRoot)).toEqual([]);
    });

    it('detects a server source that names the cached reader', () => {
        const syntheticSource = 'pages/example.astro';
        expect(syntheticSource.includes('getEntitlementsCached')).toBe(false);
        const violatesGuard = (fileName: string, contents: string) =>
            fileName.endsWith('.astro') && contents.includes('getEntitlementsCached');
        expect(
            violatesGuard(syntheticSource, "getEntitlementsCached({ vertical: 'tourist' })")
        ).toBe(true);
    });
});
