/**
 * @file ProfileEditForm.spec113.test.tsx
 * @description SPEC-113 polish — assertions for the extended profile edit
 * form: birthDate, website, occupation, social URLs, and postal address
 * fields. Complements the original ProfileEditForm.test.tsx by exercising
 * the new sections introduced when the form was split into subcomponents.
 *
 * These tests use the FULL `ProfileEditSchema` from `@repo/schemas` (no
 * mock) so the extended schema fields exercise the real validation logic.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ProfileEditForm,
    type ProfileEditUser
} from '../../../src/components/account/ProfileEditForm.client';

// ─── Module mocks (styles + i18n + avatar helper + toast only) ───────────────

vi.mock('../../../src/components/account/ProfileEditForm.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string): string => fallback ?? key;
    return { createTranslations: () => ({ t }) };
});

vi.mock('../../../src/lib/avatar-utils', () => ({
    getInitials: ({ name }: { name?: string | null }) =>
        name ? (name[0]?.toUpperCase() ?? '?') : '?'
}));

vi.mock('../../../src/store/toast-store', () => ({ addToast: vi.fn() }));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FULL_USER: ProfileEditUser = {
    id: 'user-spec113',
    displayName: 'Juan Pérez',
    firstName: 'Juan',
    lastName: 'Pérez',
    avatarUrl: 'https://cdn.test/juan.png',
    phone: '+541134567890',
    birthDate: '1990-04-22',
    profile: {
        bio: 'Hola mundo',
        website: 'https://juanprofile.com',
        occupation: 'Developer'
    },
    website: 'https://juan.com',
    facebookUrl: 'https://facebook.com/juan',
    instagramUrl: 'https://instagram.com/juan',
    twitterUrl: 'https://x.com/juan',
    linkedinUrl: 'https://linkedin.com/in/juan',
    youtubeUrl: 'https://youtube.com/@juan',
    addressLine1: 'Av. Corrientes 1234',
    city: 'Buenos Aires',
    province: 'CABA',
    country: 'Argentina',
    postalCode: 'C1043'
};

function renderForm(user: ProfileEditUser = FULL_USER) {
    return render(
        <ProfileEditForm
            initialUser={user}
            locale="es"
            apiUrl="http://localhost:3001"
        />
    );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProfileEditForm (SPEC-113 polish)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.fetch = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ success: true, data: {} }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        );
    });

    describe('pre-population from the server-fetched user', () => {
        it('pre-fills the birth date from initialUser.birthDate', () => {
            renderForm();
            expect((document.getElementById('birthDate') as HTMLInputElement).value).toBe(
                '1990-04-22'
            );
        });

        it('pre-fills the website from initialUser.website', () => {
            renderForm();
            expect((document.getElementById('website') as HTMLInputElement).value).toBe(
                'https://juan.com'
            );
        });

        it('pre-fills occupation from initialUser.profile.occupation', () => {
            renderForm();
            expect((document.getElementById('occupation') as HTMLInputElement).value).toBe(
                'Developer'
            );
        });

        it('pre-fills all 5 social network URLs', () => {
            renderForm();
            expect((document.getElementById('facebookUrl') as HTMLInputElement).value).toBe(
                'https://facebook.com/juan'
            );
            expect((document.getElementById('instagramUrl') as HTMLInputElement).value).toBe(
                'https://instagram.com/juan'
            );
            expect((document.getElementById('twitterUrl') as HTMLInputElement).value).toBe(
                'https://x.com/juan'
            );
            expect((document.getElementById('linkedinUrl') as HTMLInputElement).value).toBe(
                'https://linkedin.com/in/juan'
            );
            expect((document.getElementById('youtubeUrl') as HTMLInputElement).value).toBe(
                'https://youtube.com/@juan'
            );
        });

        it('pre-fills the 5 postal address fields', () => {
            renderForm();
            expect((document.getElementById('country') as HTMLInputElement).value).toBe(
                'Argentina'
            );
            expect((document.getElementById('province') as HTMLInputElement).value).toBe('CABA');
            expect((document.getElementById('city') as HTMLInputElement).value).toBe(
                'Buenos Aires'
            );
            expect((document.getElementById('addressLine1') as HTMLInputElement).value).toBe(
                'Av. Corrientes 1234'
            );
            expect((document.getElementById('postalCode') as HTMLInputElement).value).toBe('C1043');
        });

        it('uses the correct firstName from initialUser (not split from displayName)', () => {
            // Regression: the page used to do `user.name.split(' ')[0]`,
            // which produced wrong values for "Juan Carlos Pérez" style
            // names. Now the form trusts the real firstName from the API.
            const user: ProfileEditUser = {
                ...FULL_USER,
                displayName: 'Juan Carlos Pérez',
                firstName: 'Juan Carlos',
                lastName: 'Pérez'
            };
            renderForm(user);
            expect((document.getElementById('firstName') as HTMLInputElement).value).toBe(
                'Juan Carlos'
            );
            expect((document.getElementById('lastName') as HTMLInputElement).value).toBe('Pérez');
        });
    });

    describe('rendering when nothing is pre-filled', () => {
        it('renders empty inputs for the new sections', () => {
            renderForm({
                id: 'empty-user',
                displayName: 'Empty',
                firstName: 'E',
                lastName: 'U',
                avatarUrl: null,
                phone: null,
                profile: null
            });
            expect((document.getElementById('birthDate') as HTMLInputElement).value).toBe('');
            expect((document.getElementById('website') as HTMLInputElement).value).toBe('');
            expect((document.getElementById('country') as HTMLInputElement).value).toBe('');
            expect((document.getElementById('facebookUrl') as HTMLInputElement).value).toBe('');
        });
    });

    describe('submit payload (JSONB shape)', () => {
        it('includes birthDate as a top-level field when populated', async () => {
            renderForm();
            fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
            await waitFor(() => {
                expect(globalThis.fetch).toHaveBeenCalledTimes(1);
            });
            const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
                string,
                RequestInit
            ];
            const body = JSON.parse(String(call[1].body)) as Record<string, unknown>;
            expect(body.birthDate).toBe('1990-04-22');
        });

        it('omits social and location keys when nothing changed', async () => {
            renderForm();
            fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
            await waitFor(() => {
                expect(globalThis.fetch).toHaveBeenCalledTimes(1);
            });
            const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
                string,
                RequestInit
            ];
            const body = JSON.parse(String(call[1].body)) as Record<string, unknown>;
            expect(body.socialNetworks).toBeUndefined();
            expect(body.location).toBeUndefined();
            expect(body.contactInfo).toBeUndefined();
        });

        it('nests city change inside the location JSONB key', async () => {
            renderForm();
            const cityInput = document.getElementById('city') as HTMLInputElement;
            fireEvent.change(cityInput, { target: { value: 'Rosario' } });
            fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
            await waitFor(() => {
                expect(globalThis.fetch).toHaveBeenCalledTimes(1);
            });
            const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
                string,
                RequestInit
            ];
            const body = JSON.parse(String(call[1].body)) as Record<string, unknown>;
            const location = body.location as Record<string, string>;
            expect(location).toBeDefined();
            expect(location.city).toBe('Rosario');
            // The other location fields are still sent because the
            // payload rebuilds the full JSONB block on any change.
            expect(location.country).toBe('Argentina');
        });

        it('maps province ↔ region when the location block is rebuilt', async () => {
            renderForm();
            const provinceInput = document.getElementById('province') as HTMLInputElement;
            fireEvent.change(provinceInput, { target: { value: 'Santa Fe' } });
            fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
            await waitFor(() => {
                expect(globalThis.fetch).toHaveBeenCalledTimes(1);
            });
            const body = JSON.parse(
                String(
                    (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1].body as string
                )
            ) as Record<string, unknown>;
            const location = body.location as Record<string, string>;
            expect(location.region).toBe('Santa Fe');
            expect(location).not.toHaveProperty('province');
        });

        it('nests social URL change inside the socialNetworks JSONB key', async () => {
            renderForm();
            const fb = document.getElementById('facebookUrl') as HTMLInputElement;
            fireEvent.change(fb, { target: { value: 'https://facebook.com/changed' } });
            fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
            await waitFor(() => {
                expect(globalThis.fetch).toHaveBeenCalledTimes(1);
            });
            const body = JSON.parse(
                String(
                    (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1].body as string
                )
            ) as Record<string, unknown>;
            const social = body.socialNetworks as Record<string, string>;
            expect(social).toBeDefined();
            expect(social.facebook).toBe('https://facebook.com/changed');
            expect(social.instagram).toBe('https://instagram.com/juan');
            // Schema key is `linkedIn`, not `linkedinUrl`.
            expect(social.linkedIn).toBe('https://linkedin.com/in/juan');
        });

        it('puts phone changes inside contactInfo.mobilePhone', async () => {
            renderForm();
            const phoneInput = document.getElementById('phone') as HTMLInputElement;
            fireEvent.change(phoneInput, { target: { value: '+5491100000000' } });
            fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
            await waitFor(() => {
                expect(globalThis.fetch).toHaveBeenCalledTimes(1);
            });
            const body = JSON.parse(
                String(
                    (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1].body as string
                )
            ) as Record<string, unknown>;
            expect(body.phone).toBeUndefined();
            expect(body.contactInfo).toEqual({ mobilePhone: '+5491100000000' });
        });

        it('puts bio/website/occupation inside the profile JSONB key on change', async () => {
            renderForm();
            const occupation = document.getElementById('occupation') as HTMLInputElement;
            fireEvent.change(occupation, { target: { value: 'Senior Engineer' } });
            fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
            await waitFor(() => {
                expect(globalThis.fetch).toHaveBeenCalledTimes(1);
            });
            const body = JSON.parse(
                String(
                    (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1].body as string
                )
            ) as Record<string, unknown>;
            const profile = body.profile as Record<string, string>;
            expect(profile.occupation).toBe('Senior Engineer');
        });
    });

    describe('validation', () => {
        it('shows an inline error for an invalid social URL', async () => {
            renderForm();
            const fb = document.getElementById('facebookUrl') as HTMLInputElement;
            fireEvent.change(fb, { target: { value: 'not-a-url' } });
            fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
            await waitFor(() => {
                expect(document.getElementById('facebookUrl-error')).toBeInTheDocument();
            });
            // fetch should NOT have been called — validation failed.
            expect(globalThis.fetch).not.toHaveBeenCalled();
        });

        // Note: birthDate regex validation is covered at the schema level
        // (`packages/schemas/test/user/profile.schema.test.ts`). We don't
        // re-test it here because jsdom's <input type="date"> normalizes
        // invalid date strings to '' before the change reaches React,
        // making the "bad date typed by user" path unreachable from a
        // unit test environment.

        it('clears a field error when the user starts typing again', async () => {
            renderForm();
            const fb = document.getElementById('facebookUrl') as HTMLInputElement;
            fireEvent.change(fb, { target: { value: 'not-a-url' } });
            fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
            await waitFor(() => {
                expect(document.getElementById('facebookUrl-error')).toBeInTheDocument();
            });
            fireEvent.change(fb, { target: { value: 'https://facebook.com/juan' } });
            await waitFor(() => {
                expect(document.getElementById('facebookUrl-error')).toBeNull();
            });
        });
    });
});
