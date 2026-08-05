/**
 * @file web-imports-web-tokens.test.ts
 * @description Guard: `apps/web` imports the web-only token artifact
 * (HOS-369 W3-5).
 *
 * `@repo/design-tokens` emits two stylesheets from the same source:
 *
 * - `tokens.css` — everything, including `[data-app="admin"]` and
 *   `[data-app="admin"][data-theme="dark"]`. This is what `apps/admin` imports.
 * - `tokens.web.css` — the same minus those two blocks, 6,544 B of 71,550 (9.1%).
 *
 * This app never sets `data-app="admin"` on `<html>`, so those rules can match
 * nothing here — they were measured shipping render-blocking on every public
 * page. Switching the import back to `tokens.css` is silent: every token still
 * resolves, every page still looks right, the bytes just come back.
 *
 * The `apps/admin` side is deliberately NOT asserted here. A guard in this
 * package cannot meaningfully police another app's imports, and admin needs
 * the full file — `packages/design-tokens/src/generators/generate-css.test.ts`
 * is what pins that the full artifact keeps both blocks.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const GLOBAL_CSS = path.resolve(__dirname, '../../src/styles/global.css');

describe('apps/web token stylesheet import', () => {
    const source = fs.readFileSync(GLOBAL_CSS, 'utf8');

    it('reads a global.css that actually imports design tokens', () => {
        // Guards the guard: if this file stopped importing tokens at all, the
        // assertions below would pass while the app lost its whole palette.
        expect(source).toMatch(/@import\s+["']@repo\/design-tokens\//);
    });

    it('imports the web-only artifact', () => {
        expect(source).toContain('@import "@repo/design-tokens/tokens.web.css"');
    });

    it('does not import the full artifact', () => {
        expect(
            source,
            'the full `tokens.css` carries the two [data-app="admin"] blocks — 6,544 B that can never match in this app. Import `tokens.web.css`.'
        ).not.toMatch(/@import\s+["']@repo\/design-tokens\/tokens\.css["']/);
    });
});
