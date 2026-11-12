/** AI access policy: routes enforce monthly quotas inline after validation. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// `usageFile`: where the route's metering call lives. HOS-2100 moved the chat's
// post-stream metering into `chat.finalize.ts`, which only `chat.ts` imports.
const routes = [
    { name: 'chat', usage: 'recordAiUsage', usageFile: 'chat.finalize' },
    { name: 'search-chat', usage: 'meterAiUsage', usageFile: 'search-chat' },
    { name: 'text-improve', usage: 'meterAiUsage', usageFile: 'text-improve' },
    { name: 'translate', usage: 'meterAiUsage', usageFile: 'translate' }
] as const;

function routeSource(name: string): string {
    return readFileSync(
        fileURLToPath(new URL(`../../../src/routes/ai/protected/${name}.ts`, import.meta.url)),
        'utf8'
    );
}

describe('temporary AI access policy', () => {
    for (const { name, usage, usageFile } of routes) {
        it(`${name} enforces monthly quota outside middleware`, () => {
            expect(routeSource(name)).not.toMatch(/\bcreateAiQuotaMiddleware\s*\(/);
        });

        it(`${name} retains burst rate limits and usage metering`, () => {
            const source = routeSource(name);
            expect(source).toMatch(/\bcreateAiRateLimitMiddlewares\s*\(/);
            expect(routeSource(usageFile)).toContain(`${usage}(`);
            if (usageFile !== name) expect(source).toContain(`from './${usageFile}.js'`);
        });
    }
});
