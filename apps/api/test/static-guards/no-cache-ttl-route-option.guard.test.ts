/**
 * @file no-cache-ttl-route-option.guard.test.ts
 * @description Keeps the removed `cacheTTL` route option from coming back (HOS-1901).
 *
 * `RouteOptions.cacheTTL` was declared and passed by ~170 routes, but nothing ever
 * read it: the in-process TTL is global (cache middleware config) and edge caching
 * is decided by Cloudflare's cache rule. A per-route TTL that does nothing is worse
 * than none, because it reads as a working knob. TypeScript's excess-property check
 * already rejects it in object literals; this guard also covers options passed via
 * a variable and mentions in comments that would re-advertise the knob.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = join(__dirname, '../../src');

/** Lists every `.ts`/`.tsx` file under a directory. */
function listSourceFiles({ dir }: { readonly dir: string }): readonly string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return listSourceFiles({ dir: full });
        return /\.tsx?$/.test(entry) ? [full] : [];
    });
}

describe('removed cacheTTL route option (HOS-1901)', () => {
    it('is not mentioned anywhere in apps/api/src', () => {
        // Arrange
        const files = listSourceFiles({ dir: SRC_DIR });

        // Act
        const offenders = files.filter((file) => readFileSync(file, 'utf-8').includes('cacheTTL'));

        // Assert
        expect(offenders).toEqual([]);
    });
});
