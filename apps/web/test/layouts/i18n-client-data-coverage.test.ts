/**
 * @file i18n-client-data-coverage.test.ts
 * @description Guard for HOS-160 lever A: every standalone HTML shell must emit
 * the `<I18nClientData>` element. Client islands read their translations from
 * that inlined `#hospeda-i18n` dictionary (instead of importing the full
 * catalog), so a shell that hosts a `client:*` island but forgets the element
 * would render raw keys / wrong-language fallbacks in production. The global
 * test seed in `test/setup.ts` masks a missing element at runtime, so this
 * source-level assertion is the only thing that can catch the regression.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SHELL_LAYOUTS = [
    'BaseLayout.astro',
    'AuthLayout.astro',
    'ErrorLayout.astro',
    'StandaloneLayout.astro'
] as const;

describe('I18nClientData coverage across HTML shells (HOS-160 lever A)', () => {
    for (const layout of SHELL_LAYOUTS) {
        it(`${layout} imports and renders <I18nClientData>`, () => {
            const src = readFileSync(resolve(__dirname, `../../src/layouts/${layout}`), 'utf8');
            expect(src).toContain(
                "import I18nClientData from '@/components/shared/I18nClientData.astro'"
            );
            expect(src).toContain('<I18nClientData locale={locale} />');
        });
    }
});
