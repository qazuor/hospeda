/**
 * @file env-required-in-prod.guard.test.ts
 * @description Guard (HOS-2119): every variable the API refuses to boot without
 * in production (`requiredInProd` in `apps/api/src/utils/env.ts`) must be
 * declared `requiredScope: 'production'` in the registry, so the registry, the
 * generated examples and the boot check cannot drift apart again.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENV_REGISTRY } from '../env-registry.js';

const API_ENV_PATH = resolve(__dirname, '../../../../apps/api/src/utils/env.ts');

/**
 * Extract the variable names listed in the API's `requiredInProd` array.
 */
function readRequiredInProdNames(): string[] {
    const source = readFileSync(API_ENV_PATH, 'utf8');
    const match = /const requiredInProd[^=]*=\s*\[([\s\S]*?)\];/.exec(source);
    const body = match?.[1] ?? '';
    return [...body.matchAll(/\[\s*'([A-Z0-9_]+)'/g)].map((m) => m[1] as string);
}

describe('requiredInProd <-> registry requiredScope', () => {
    const names = readRequiredInProdNames();

    it('should find the requiredInProd list in the API env schema', () => {
        expect(names.length).toBeGreaterThan(0);
        expect(names).toContain('HOSPEDA_UMAMI_URL');
        expect(names).toContain('HOSPEDA_UMAMI_WEBSITE_ID_WEB');
    });

    it.each(names)('should declare %s as requiredScope production in the registry', (name) => {
        const entry = ENV_REGISTRY.find((v) => v.name === name);
        expect(entry, `${name} missing from registry`).toBeDefined();
        expect(entry?.requiredScope).toBe('production');
    });
});
