/**
 * HOS-992 guard: the authed layout must wrap the panel in `AdminLocaleProvider`.
 *
 * Without it every argument-less `useTranslations()` silently falls back to the
 * default locale and the saved admin language stops being applied, with no other
 * test noticing.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, '../src/routes/_authed.tsx'), 'utf8');

describe('_authed layout locale wiring', () => {
    it('renders <AppLayout> inside <AdminLocaleProvider>', () => {
        expect(source).toMatch(
            /<AdminLocaleProvider\b[^>]*>\s*<AppLayout>[\s\S]*?<\/AppLayout>\s*<\/AdminLocaleProvider>/
        );
    });

    it('feeds the provider the user id and the server-read admin language', () => {
        expect(source).toMatch(/userId=\{authState\.userId/);
        expect(source).toMatch(/initialLanguage=\{authState\.languageAdmin\}/);
    });
});
