/**
 * @file platform-cache-revalidation.test.ts
 * @description Source-based tests for the revalidation page relocated from
 * /revalidation to /platform/cache/revalidation as part of SPEC-156 PR-2
 * (T-021). Verifies the route registration and that the 3-tab structure
 * (Config, Logs, Manual) is preserved at the new path.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const revalidationSrc = readFileSync(
    resolve(__dirname, '../../src/routes/_authed/platform/cache/revalidation/index.tsx'),
    'utf8'
);

describe('platform/cache/revalidation/index.tsx (T-021)', () => {
    it('registers the new route path', () => {
        expect(revalidationSrc).toContain(
            "createFileRoute('/_authed/platform/cache/revalidation/')"
        );
    });

    it('still wires the three tabs (config, logs, manual)', () => {
        expect(revalidationSrc).toMatch(/config/i);
        expect(revalidationSrc).toMatch(/logs/i);
        expect(revalidationSrc).toMatch(/manual/i);
    });
});
