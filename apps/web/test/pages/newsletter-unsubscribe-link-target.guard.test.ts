/**
 * @file newsletter-unsubscribe-link-target.guard.test.ts
 * @description Guard (HOS-2617): the newsletter "darse de baja" link must point
 * at a web route that exists, and nobody may hand-build that URL.
 *
 * The campaign mail linked `/{locale}/newsletter/unsubscribe`, a page that did
 * not exist, so nobody could unsubscribe from the mail. Every caller now goes
 * through `buildNewsletterUnsubscribePageUrl`; this guard checks the page that
 * builder targets exists and that no source file builds the URL by hand.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildNewsletterUnsubscribePageUrl } from '@repo/utils';
import { describe, expect, it } from 'vitest';

const WEB_ROOT = resolve(__dirname, '../..');
const REPO_ROOT = resolve(WEB_ROOT, '../..');
const PAGES_DIR = join(WEB_ROOT, 'src/pages/[lang]');

const SCANNED_ROOTS = [
    'apps/api/src',
    'packages/service-core/src',
    'packages/notifications/src',
    'packages/email/src'
] as const;

const pageExists = (relativePath: string): boolean =>
    ['.astro', '.ts', '.js', '/index.astro'].some((ext) =>
        existsSync(join(PAGES_DIR, `${relativePath}${ext}`))
    );

const walk = (dir: string): readonly string[] =>
    readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return walk(full);
        return /\.(ts|tsx)$/.test(full) && !/\.test\./.test(full) ? [full] : [];
    });

describe('newsletter unsubscribe link target', () => {
    it.each(['es', 'en', 'pt'])('builder URL for %s targets an existing web page', (locale) => {
        // Arrange
        const url = new URL(
            buildNewsletterUnsubscribePageUrl({
                siteUrl: 'https://hospeda.test',
                locale,
                token: 'tok'
            })
        );

        // Act
        const [lang, ...rest] = url.pathname.split('/').filter(Boolean);

        // Assert
        expect(lang).toBe(locale);
        expect(pageExists(rest.join('/'))).toBe(true);
    });

    it('no source file builds the web unsubscribe URL by hand', () => {
        // Arrange
        const handBuilt = /\$\{[^}]*\}\/(?:\$\{[^}]*\}\/)?newsletter\/unsubscribe/;

        // Act
        const offenders = SCANNED_ROOTS.map((r) => join(REPO_ROOT, r))
            .filter((r) => existsSync(r))
            .flatMap(walk)
            .filter((file) => handBuilt.test(readFileSync(file, 'utf8')));

        // Assert
        expect(offenders).toEqual([]);
    });
});
