import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('auth.ts Partner verification hook', () => {
    it('registers beforeEmailVerification and forwards the Better Auth user identity', async () => {
        const source = await readFile(new URL('../../src/lib/auth.ts', import.meta.url), 'utf8');
        expect(source).toMatch(
            /beforeEmailVerification:\s*async\s*\(user\)\s*=>\s*\{\s*await claimPartnerOnEmailVerification\(\{\s*userId:\s*user\.id,\s*email:\s*user\.email\s*\}\);/
        );
    });
});
