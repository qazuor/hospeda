/**
 * @file ProfileCompletion.client.test.tsx
 * @description Regression tests for ProfileCompletion's HOS-190 slice 3
 * migration from the hand-rolled `validateProfileCompletionFields` to the
 * shared `useZodForm` primitive validating the real API payload against
 * `CompleteProfileBodySchema`. The old validator never checked
 * `socialNetworks.*` (the server requires `.url()` per platform) or
 * `displayName` length bounds — both are exercised below since they were
 * the actual gap this migration closed.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ProfileCompletion } from '../../../src/components/account/ProfileCompletion.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/ProfileCompletion.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string): string => fallback ?? key;
    return { createTranslations: () => ({ t }) };
});

vi.mock('../../../src/lib/auth-client', () => ({
    refreshBetterAuthSession: vi.fn().mockResolvedValue(undefined)
}));

// Mirrors CompleteProfileBodySchema's shape/bounds (HOS-190 slice 3) without
// pulling in the full `@repo/schemas` package for a component test.
vi.mock('@repo/schemas', () => {
    const SUPPORTED_LOCALES = ['es', 'en', 'pt'] as const;
    const CompleteProfileBodySchema = z
        .object({
            firstName: z.string().min(1).max(50),
            lastName: z.string().min(1).max(50),
            displayName: z.string().min(2).max(50).optional(),
            birthDate: z.string().date().optional(),
            imageUrl: z.string().url().optional(),
            phone: z
                .string()
                .regex(/^\+[1-9]\d{1,14}(?:\s\d{1,15})*$/)
                .optional(),
            locale: z.enum(SUPPORTED_LOCALES).optional(),
            newsletterOptIn: z.boolean().optional(),
            bio: z.string().min(10).max(300).optional(),
            website: z.string().url().optional(),
            occupation: z.string().min(2).max(100).optional(),
            socialNetworks: z
                .object({
                    facebook: z.string().url().optional(),
                    instagram: z.string().url().optional(),
                    twitter: z.string().url().optional(),
                    linkedIn: z.string().url().optional(),
                    tiktok: z.string().url().optional(),
                    youtube: z.string().url().optional()
                })
                .optional(),
            location: z
                .object({
                    country: z.string().min(2).max(100),
                    region: z.string().min(1).max(100).optional(),
                    city: z.string().min(1).max(100).optional()
                })
                .optional(),
            acceptedTerms: z.literal(true)
        })
        .strict();
    return { CompleteProfileBodySchema };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderForm() {
    return render(
        <ProfileCompletion
            locale="es"
            apiUrl="http://localhost:3001"
        />
    );
}

function fillRequiredFields(): void {
    fireEvent.change(document.getElementById('pc-firstName') as HTMLInputElement, {
        target: { value: 'Maria' }
    });
    fireEvent.change(document.getElementById('pc-lastName') as HTMLInputElement, {
        target: { value: 'Fernanda' }
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /acepto los/i }));
}

function submit(): void {
    fireEvent.click(screen.getByRole('button', { name: /completar perfil/i }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProfileCompletion (HOS-190 slice 3 — useZodForm migration)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.fetch = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    data: { profileCompleted: true, requiresSetPassword: false }
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        );
    });

    it('blocks submission and shows a field error when firstName is empty', () => {
        renderForm();
        fireEvent.click(screen.getByRole('checkbox', { name: /acepto los/i }));

        submit();

        expect(document.getElementById('pc-firstName-error')?.textContent).toBeTruthy();
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('rejects an invalid social network URL and blocks submit (closes the socialNetworks.* gap)', async () => {
        renderForm();
        fillRequiredFields();

        fireEvent.click(screen.getByRole('button', { name: /más detalles/i }));

        const facebookInput = document.getElementById('pc-social-facebook') as HTMLInputElement;
        fireEvent.change(facebookInput, { target: { value: 'not-a-url' } });

        submit();

        await waitFor(() => {
            expect(document.getElementById('pc-social-facebook-error')?.textContent).toBeTruthy();
        });
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('accepts a valid social network URL', async () => {
        renderForm();
        fillRequiredFields();

        fireEvent.click(screen.getByRole('button', { name: /más detalles/i }));

        const facebookInput = document.getElementById('pc-social-facebook') as HTMLInputElement;
        fireEvent.change(facebookInput, { target: { value: 'https://facebook.com/maria' } });

        submit();

        await waitFor(() => {
            expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        });
        expect(document.getElementById('pc-social-facebook-error')?.textContent).toBeFalsy();
    });

    it('rejects a too-short displayName override (closes the displayName length gap)', () => {
        renderForm();
        fillRequiredFields();

        fireEvent.change(document.getElementById('pc-displayName') as HTMLInputElement, {
            target: { value: 'A' }
        });

        submit();

        expect(document.getElementById('pc-displayName-error')?.textContent).toBeTruthy();
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('shows a terms error when the checkbox is left unchecked', () => {
        renderForm();
        fireEvent.change(document.getElementById('pc-firstName') as HTMLInputElement, {
            target: { value: 'Maria' }
        });
        fireEvent.change(document.getElementById('pc-lastName') as HTMLInputElement, {
            target: { value: 'Fernanda' }
        });

        submit();

        expect(document.getElementById('pc-terms-error')?.textContent).toBeTruthy();
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('submits the schema-validated payload and redirects on success', async () => {
        const hrefAssignSpy = vi.fn();
        const originalLocation = window.location;
        // jsdom's window.location is non-configurable for assignment; redefine
        // it with a setter so the component's `window.location.href = ...` is
        // observable without triggering a real jsdom navigation.
        Object.defineProperty(window, 'location', {
            configurable: true,
            writable: true,
            value: {
                ...originalLocation,
                set href(v: string) {
                    hrefAssignSpy(v);
                }
            } as Location
        });

        renderForm();
        fillRequiredFields();

        submit();

        await waitFor(() => {
            expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        });

        const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
            .calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('http://localhost:3001/api/v1/protected/profile/complete');
        const body = JSON.parse(init.body as string);
        expect(body.firstName).toBe('Maria');
        expect(body.lastName).toBe('Fernanda');
        expect(body.acceptedTerms).toBe(true);
        // The `.strict()` mocked schema would have thrown/failed safeParse if
        // an unexpected key leaked in — asserting the exact key set catches
        // payload drift (e.g. a leftover `terms` key from the old validator).
        expect(Object.keys(body).sort()).toEqual(
            [
                'acceptedTerms',
                'displayName',
                'firstName',
                'lastName',
                'locale',
                'newsletterOptIn'
            ].sort()
        );

        await waitFor(() => {
            expect(hrefAssignSpy).toHaveBeenCalledWith('/es/mi-cuenta/');
        });

        window.location = originalLocation;
    });
});
