import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../../../..');
const ALLOWLIST: Readonly<Record<string, string>> = {
    'apps/api/src/app.ts': 'interactive (trafficClassMiddleware)',
    'apps/api/src/services/cutover-b9a/step-3b.compose.ts': 'background (cutover-b9a-step-3b.ts)',
    'apps/api/src/utils/payment-provider.ts': 'definition site'
};

function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            if (['node_modules', 'dist', 'test', '__tests__'].includes(entry.name)) return [];
            return sourceFiles(path);
        }
        return /\.(?:ts|tsx|js|mjs)$/.test(entry.name) ? [path] : [];
    });
}

function providerCalls(source: string): number {
    const aliases = new Set(['defaultPaymentProvider', 'MercadoPagoPaymentProvider']);
    for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/g)) {
        for (const named of (match[1] ?? '').split(',')) {
            const parts = named.trim().split(/\s+as\s+/);
            if (parts[0] === 'defaultPaymentProvider' || parts[0] === 'MercadoPagoPaymentProvider')
                aliases.add(parts[1] ?? parts[0]);
        }
    }
    let count = 0;
    for (const alias of aliases) {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const call = new RegExp(`\\b${escaped}\\s*\\(`, 'g');
        for (const match of source.matchAll(call)) {
            const prefix = source.slice(Math.max(0, match.index - 4), match.index);
            if (alias === 'MercadoPagoPaymentProvider' && /new\s+$/.test(prefix)) count += 1;
            else if (alias !== 'MercadoPagoPaymentProvider') count += 1;
        }
    }
    return count;
}

describe('payment provider traffic class guard', () => {
    it('allowlists every production composition point and verifies both class declarations (kills unclassified provider construction)', () => {
        const roots = ['apps', 'packages'].flatMap((path) => sourceFiles(join(ROOT, path)));
        for (const file of roots) {
            const source = readFileSync(file, 'utf8');
            if (providerCalls(source) === 0) continue;
            const repoPath = relative(ROOT, file).replaceAll('\\', '/');
            expect(
                ALLOWLIST[repoPath],
                `Unlisted provider composition in ${repoPath}`
            ).toBeDefined();
        }
        const createApp = readFileSync(join(ROOT, 'apps/api/src/utils/create-app.ts'), 'utf8');
        const script = readFileSync(join(ROOT, 'apps/api/scripts/cutover-b9a-step-3b.ts'), 'utf8');
        const compose = readFileSync(
            join(ROOT, 'apps/api/src/services/cutover-b9a/step-3b.compose.ts'),
            'utf8'
        );
        expect(createApp).toMatch(/trafficClassMiddleware\(\)/);
        // The script imports @repo/payments only lazily (scripts-tsx-load), so the
        // background class is declared in compose and called from the script.
        expect(compose).toMatch(
            /export function runStep3bAsBackgroundTraffic[\s\S]*?runWithTrafficClass\(\{\s*context:\s*\{\s*trafficClass:\s*'background'/
        );
        expect(script).toMatch(/\brunStep3bAsBackgroundTraffic\(\{\s*fn:[\s\S]*?\brunStep3b\(/);
    });
});
