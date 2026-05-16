/**
 * @file mi-cuenta-editar.astro.test.ts
 * @description Source-level assertions for the profile edit page (SPEC-113
 * polish). Verifies that the page fetches the full protected user from
 * the API and forwards every SPEC-113 field to the form.
 *
 * Astro pages cannot be rendered via Vitest, so we lean on string-level
 * assertions on the .astro source — same pattern used elsewhere in this
 * repo for Astro components.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/editar/index.astro'),
    'utf8'
);

describe('mi-cuenta/editar/index.astro (SPEC-113 polish)', () => {
    it('fetches the protected user endpoint server-side', () => {
        expect(source).toContain('/api/v1/protected/users/');
        expect(source).toMatch(/method:\s*['"]GET['"]/);
    });

    it("forwards the request's Cookie header so Better Auth sees the session", () => {
        expect(source).toMatch(/Astro\.request\.headers\.get\(\s*['"]cookie['"]\s*\)/);
    });

    it('parses the body as { success?, data? }', () => {
        expect(source).toContain('success?');
        expect(source).toContain('data?');
    });

    it('falls back to a session-derived shape when the fetch fails', () => {
        expect(source).toContain('fallbackUser');
        expect(source).toContain('initialUser = fallbackUser');
    });

    it('passes every SPEC-113 field through to the form', () => {
        // Required core fields
        expect(source).toContain('id:');
        expect(source).toContain('displayName:');
        expect(source).toContain('firstName:');
        expect(source).toContain('lastName:');
        expect(source).toContain('avatarUrl:');

        // SPEC-113 extended fields
        for (const field of [
            'birthDate',
            'website',
            'facebookUrl',
            'instagramUrl',
            'twitterUrl',
            'linkedinUrl',
            'youtubeUrl',
            'addressLine1',
            'city',
            'province',
            'country',
            'postalCode'
        ]) {
            expect(source).toContain(`${field}:`);
        }
    });

    it('normalizes birthDate to YYYY-MM-DD before forwarding', () => {
        expect(source).toMatch(/slice\(\s*0\s*,\s*10\s*\)/);
    });

    it('renders the ProfileEditForm island with client:load', () => {
        expect(source).toContain('<ProfileEditForm');
        expect(source).toContain('client:load');
    });
});
