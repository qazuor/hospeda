/**
 * @file theme-single-source.guard.test.ts
 * @description Static guards for the single theme source (HOS-1966 / HOS-1969).
 *
 * 1. HOS-1969: `--background` is NOT a token of the web design system (it is
 *    `--core-background`). `background-color: var(--background)` is an invalid
 *    value that computes to `transparent`, so the surface shows the browser
 *    canvas (always white, since no `color-scheme` is set) while a sibling
 *    painted with a real token (`--core-card`) goes dark. That is the
 *    "dark card on a light page" the owner saw on the login page.
 * 2. HOS-1966: nothing in `src` may write `localStorage.theme` or
 *    `data-theme` except `lib/theme.ts` and the inline FOUC script; islands
 *    must go through the module.
 * 3. The inline FOUC script must stay on the same key and semantics as the
 *    module (it cannot import it).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '../../src');

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.(astro|tsx?|css)$/.test(entry)) out.push(full);
    }
    return out;
}

const FILES = walk(SRC).map((f) => ({ rel: relative(SRC, f), text: readFileSync(f, 'utf8') }));

/** Files that legitimately define their own local `--background`. */
const OWN_BACKGROUND_TOKEN = new Set(['pages/[lang]/feedback/index.astro']);

describe('theme single source guards', () => {
    it('no stylesheet reads the undefined --background token', () => {
        const offenders = FILES.filter(
            (f) => !OWN_BACKGROUND_TOKEN.has(f.rel) && /var\(--background[,)]/.test(f.text)
        ).map((f) => f.rel);
        expect(offenders).toEqual([]);
    });

    it('only lib/theme.ts persists the theme or writes data-theme from TS', () => {
        const offenders = FILES.filter(
            (f) =>
                /\.tsx?$/.test(f.rel) &&
                f.rel !== 'lib/theme.ts' &&
                (/localStorage\.setItem\(\s*['"]theme['"]/.test(f.text) ||
                    /setAttribute\(\s*['"]data-theme['"]/.test(f.text))
        ).map((f) => f.rel);
        expect(offenders).toEqual([]);
    });

    it('the FOUC script and the module agree on key and semantics', () => {
        const fouc = FILES.find((f) => f.rel === 'components/shared/ThemeFoucScript.astro');
        const mod = FILES.find((f) => f.rel === 'lib/theme.ts');
        expect(fouc && mod).toBeTruthy();
        expect(mod?.text).toContain("THEME_STORAGE_KEY = 'theme'");
        expect(fouc?.text).toContain("localStorage.getItem('theme')");
        // Light = attribute absent, in both.
        expect(fouc?.text).toContain("removeAttribute('data-theme')");
        expect(mod?.text).toContain("removeAttribute('data-theme')");
        expect(mod?.text).not.toMatch(/setAttribute\(\s*'data-theme'\s*,\s*'light'/);
    });
});
