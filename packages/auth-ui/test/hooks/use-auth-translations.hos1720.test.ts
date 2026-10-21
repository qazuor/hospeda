import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('HOS-1720 auth-ui fallback translations', () => {
    it('does not advertise the old closed special-character list in the fallback map', () => {
        const source = readFileSync('src/hooks/use-auth-translations.ts', 'utf8');
        const fallbackMap = source.match(
            /const fallbacks: Record<string, string> = \{([\s\S]*?)\n {4}\};/
        )?.[1];

        expect(fallbackMap).toBeDefined();
        expect(fallbackMap).not.toContain('@$!%*?&');
    });
});
