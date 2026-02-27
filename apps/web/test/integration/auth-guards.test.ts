/**
 * Integration test: verifies all mi-cuenta pages have proper auth guards.
 * Each page must check Astro.locals.user and redirect to signin if unauthenticated.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const miCuentaDir = resolve(__dirname, '../../src/pages/[lang]/mi-cuenta');

const pages = [
    'index.astro',
    'editar.astro',
    'favoritos.astro',
    'resenas.astro',
    'preferencias.astro',
    'suscripcion.astro'
] as const;

describe('Auth guards for mi-cuenta pages', () => {
    for (const page of pages) {
        describe(`mi-cuenta/${page}`, () => {
            const content = readFileSync(resolve(miCuentaDir, page), 'utf8');

            it('should read user from Astro.locals', () => {
                expect(content).toContain('Astro.locals.user');
            });

            it('should check if user is authenticated', () => {
                expect(content).toContain('if (!user)');
            });

            it('should redirect to signin page when not authenticated', () => {
                expect(content).toContain('Astro.redirect(');
                expect(content).toContain('/auth/signin');
            });

            it('should validate locale parameter', () => {
                expect(content).toContain('getLocaleFromParams(Astro.params)');
            });

            it('should redirect invalid locales to /es/', () => {
                expect(content).toContain("Astro.redirect('/es/')");
            });
        });
    }
});
