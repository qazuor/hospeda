/** AI access policy: routes enforce monthly quotas inline after validation. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const routes = [
    { name: 'chat', usage: 'recordAiUsage' },
    { name: 'search-chat', usage: 'meterAiUsage' },
    { name: 'text-improve', usage: 'meterAiUsage' },
    { name: 'translate', usage: 'meterAiUsage' }
] as const;

function routeSource(name: string): string {
    return readFileSync(
        fileURLToPath(new URL(`../../../src/routes/ai/protected/${name}.ts`, import.meta.url)),
        'utf8'
    );
}

describe('temporary AI access policy', () => {
    for (const { name, usage } of routes) {
        it(`${name} enforces monthly quota outside middleware`, () => {
            expect(routeSource(name)).not.toMatch(/\bcreateAiQuotaMiddleware\s*\(/);
        });

        it(`${name} retains burst rate limits and usage metering`, () => {
            const source = routeSource(name);
            expect(source).toMatch(/\bcreateAiRateLimitMiddlewares\s*\(/);
            expect(source).toContain(`${usage}(`);
        });
    }
});
