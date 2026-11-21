/**
 * @file recorder-placement.guard.test.ts
 * @description Guard: the Umami recorder is loaded only by the client-side
 * loader, never by markup, and never by the admin (HOS-2347 AC-W10, AC-ADM1).
 *
 * ## What it checks
 *
 * 1. In `apps/web/src`, the string `recorder.js` appears only in
 *    `lib/analytics/umami-recorder.ts`. No page, layout or component names it,
 *    so the HTML stays the same for every visitor (session-blind) and the
 *    decision stays client-side.
 * 2. No file under `apps/admin/src` names `recorder.js` or the loader module
 *    (`umami-recorder`). The admin is never recorded (NG-1).
 *
 * ## What it does NOT see
 *
 * - A URL assembled at runtime from fragments (`'recorder' + '.js'`).
 * - A recorder loaded through a third-party tag manager.
 * It reads source text, like the other guards.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_SRC = resolve(import.meta.dirname, '../../../src');
const ADMIN_SRC = resolve(import.meta.dirname, '../../../../admin/src');

function listSourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return listSourceFiles(full);
        return /\.(astro|ts|tsx|js|mjs|html)$/.test(name) ? [full] : [];
    });
}

describe('recorder placement guard (HOS-2347)', () => {
    it('AC-W10: only the loader names recorder.js inside apps/web/src', () => {
        // Arrange
        const files = listSourceFiles(WEB_SRC);

        // Act
        const naming = files
            .filter((file) => readFileSync(file, 'utf8').includes('recorder.js'))
            .map((file) => relative(WEB_SRC, file))
            .sort();

        // Assert
        expect(files.length).toBeGreaterThan(100);
        expect(naming).toEqual(['lib/analytics/umami-recorder.ts']);
    });

    it('AC-ADM1: nothing under apps/admin/src references the recorder or its loader', () => {
        const files = listSourceFiles(ADMIN_SRC);

        const offenders = files
            .filter((file) => /recorder\.js|umami-recorder/.test(readFileSync(file, 'utf8')))
            .map((file) => relative(ADMIN_SRC, file));

        expect(files.length).toBeGreaterThan(100);
        expect(offenders).toEqual([]);
    });
});
