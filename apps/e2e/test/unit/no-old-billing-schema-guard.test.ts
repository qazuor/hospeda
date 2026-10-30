import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const E2E_ROOT = join(import.meta.dirname, '..', '..');
const SCAN_DIRS = ['fixtures', 'tests', 'support'] as const;
const FORBIDDEN = [
    `hasOld${'Billing'}Schema`,
    `ensure${'Billing'}Customer`,
    `create${'Subscription'}\\(`,
    `resolve${'PlanId'}BySlug`,
    `force${'Trial'}Expired`,
    `force${'Period'}EndPast`,
    `mp-${'webhook'}-helper`,
    ...[
        'plans',
        'customers',
        'subscriptions',
        'addons',
        'addon_purchases',
        'prices',
        'subscription_events'
    ].map((suffix) => `billing_${suffix}`)
].map((pattern) => new RegExp(pattern));

interface Hit {
    readonly file: string;
    readonly line: number;
    readonly text: string;
}

function scanSources(): { readonly files: number; readonly hits: Hit[] } {
    const files: string[] = [];
    const walk = (directory: string): void => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            if (entry.name === 'node_modules') continue;
            const absolute = join(directory, entry.name);
            if (entry.isDirectory()) walk(absolute);
            else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(absolute);
        }
    };

    for (const directory of SCAN_DIRS) walk(join(E2E_ROOT, directory));
    const guardPath = join(E2E_ROOT, 'test/unit/no-old-billing-schema-guard.test.ts');
    const scanned = files.filter((file) => file !== guardPath);
    const hits = scanned.flatMap((file) =>
        readFileSync(file, 'utf8')
            .split('\n')
            .flatMap((text, index) =>
                FORBIDDEN.some((pattern) => pattern.test(text))
                    ? [{ file: relative(E2E_ROOT, file), line: index + 1, text: text.trim() }]
                    : []
            )
    );
    return { files: scanned.length, hits };
}

describe('retired billing schema static guard', () => {
    it('scans the E2E TypeScript sources and reports no retired billing references', () => {
        // Arrange
        const result = scanSources();

        // Act
        const details = result.hits.map((hit) => `${hit.file}:${hit.line}: ${hit.text}`).join('\n');

        // Assert
        expect(result.files, 'guard must scan a meaningful set of source files').toBeGreaterThan(
            40
        );
        expect(result.hits.length, `Retired billing references found:\n${details}`).toBe(0);
    });
});
