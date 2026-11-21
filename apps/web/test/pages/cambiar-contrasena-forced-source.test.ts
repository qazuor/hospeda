/**
 * @file cambiar-contrasena-forced-source.test.ts
 * @description Source-reading regression for HOS-2431. The page decided
 * forced-vs-voluntary from `user.mustChangePassword`, a property the `locals.user`
 * type did not declare, so `astro check` failed (ts 2339). The flag is real: the
 * middleware gate redirects on it. These tests pin the chain end to end so the
 * page cannot silently read a field nothing provides.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(resolve(__dirname, '../../src', rel), 'utf8');

const page = read('pages/[lang]/mi-cuenta/cambiar-contrasena/index.astro');
const envTypes = read('env.d.ts');
const middleware = read('middleware.ts');

describe('cambiar-contrasena forced flag source (HOS-2431)', () => {
    it('declares mustChangePassword on Astro.locals.user', () => {
        expect(envTypes).toMatch(/readonly mustChangePassword: boolean;/);
    });

    it('stores the parsed session user, flag included, on locals', () => {
        expect(middleware).toMatch(/const user = await parseSessionUser\(/);
        expect(middleware).toMatch(/\(context\.locals as \{ user: typeof user \}\)\.user = user;/);
    });

    it('is the same flag the middleware gate redirects on', () => {
        expect(middleware).toMatch(/user\.mustChangePassword === true/);
        expect(page).toMatch(/const forced = user\.mustChangePassword === true;/);
    });

    it('passes the flag to the form so the copy follows it', () => {
        expect(page).toMatch(/forced=\{forced\}/);
    });

    it('sends a voluntary visit by a password-less account to the add-password flow', () => {
        expect(page).toContain('parseProfileStatus');
        expect(page).toMatch(/if \(!forced\)/);
        expect(page).toMatch(/!profileStatus\.hasCredentialAccount/);
        expect(page).toContain('SET_PASSWORD_SEGMENT');
        // A forced account is provisioned with a password: never redirect it away.
        const redirectBlock = page.slice(page.indexOf('if (!forced)'));
        expect(redirectBlock.indexOf('Astro.redirect')).toBeGreaterThan(-1);
    });
});
