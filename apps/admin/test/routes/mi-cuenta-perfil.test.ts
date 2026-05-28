/**
 * @file mi-cuenta-perfil.test.ts
 * @description Source-based tests for the editable admin profile route.
 * Verifies that the profile page is wired to the right schema, mutation
 * hook, form library and toast helper for SPEC-096 / REQ-096-31 (T-055).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const profileSrc = readFileSync(
    resolve(__dirname, '../../src/routes/_authed/mi-cuenta/perfil.tsx'),
    'utf8'
);

const hookSrc = readFileSync(resolve(__dirname, '../../src/hooks/use-user-profile.ts'), 'utf8');

describe('mi-cuenta/perfil.tsx (editable profile, T-055)', () => {
    describe('imports + schema wiring', () => {
        it('imports ProfileEditSchema from @repo/schemas', () => {
            expect(profileSrc).toContain("from '@repo/schemas'");
            expect(profileSrc).toContain('ProfileEditSchema');
        });

        it('imports the ProfileEditInput type', () => {
            expect(profileSrc).toContain('type ProfileEditInput');
        });

        it('imports the new profile mutation hook', () => {
            expect(profileSrc).toContain('useUpdateUserProfile');
        });

        it('imports useForm from @tanstack/react-form', () => {
            expect(profileSrc).toContain("from '@tanstack/react-form'");
            expect(profileSrc).toContain('useForm');
        });

        it('imports the flashy toast helper', () => {
            expect(profileSrc).toContain("from '@/hooks/use-flashy-toast'");
            expect(profileSrc).toContain('useFlashyToast');
        });
    });

    describe('form fields', () => {
        const requiredFieldNames = [
            'displayName',
            'firstName',
            'lastName',
            'phone',
            'avatarUrl',
            'bio'
        ];

        for (const name of requiredFieldNames) {
            it(`renders a form.Field for ${name}`, () => {
                expect(profileSrc).toContain(`name="${name}"`);
            });
        }

        it('uses Input controls for short fields and Textarea for bio', () => {
            expect(profileSrc).toContain('<Input');
            expect(profileSrc).toContain('<Textarea');
        });
    });

    describe('submit + validation', () => {
        it('parses values with ProfileEditSchema before submitting', () => {
            expect(profileSrc).toContain('ProfileEditSchema.safeParse');
        });

        it('calls the update mutation in onSubmit', () => {
            expect(profileSrc).toContain('updateMutation.mutateAsync');
        });

        it('emits a success toast on success', () => {
            expect(profileSrc).toContain("toastSuccess(t('admin-pages.profile.saveSuccess'))");
        });

        it('emits an error toast on failure', () => {
            expect(profileSrc).toContain("toastError(t('admin-pages.profile.saveError'))");
        });
    });

    describe('per-field validators', () => {
        it('runs ProfileEditSchema.shape.<field>.safeParse on blur', () => {
            // Spot check that each field hooks into the schema's per-field
            // validator instead of a hand-rolled rule.
            for (const field of [
                'displayName',
                'firstName',
                'lastName',
                'phone',
                'avatarUrl',
                'bio'
            ]) {
                expect(profileSrc).toContain(`ProfileEditSchema.shape.${field}.safeParse`);
            }
        });
    });
});

describe('use-user-profile.ts mutation wiring (T-055)', () => {
    it('exports a useUpdateUserProfile hook', () => {
        expect(hookSrc).toContain('export function useUpdateUserProfile');
    });

    it('PATCHes /api/v1/admin/users/{id}', () => {
        expect(hookSrc).toMatch(/path:\s*`\/api\/v1\/admin\/users\/\$\{userId\}`/);
        expect(hookSrc).toContain("method: 'PATCH'");
    });

    it('maps bio and avatarUrl onto a nested profile object', () => {
        expect(hookSrc).toContain('profileNested.bio');
        // The flat ProfileEditSchema `avatarUrl` is stored under the nested
        // `profile.avatar` field of the User entity.
        expect(hookSrc).toContain('profileNested.avatar');
        expect(hookSrc).toContain('body.profile = profileNested');
    });

    it('keeps displayName / firstName / lastName / phone at the top level', () => {
        expect(hookSrc).toContain('displayName: profile.displayName');
        expect(hookSrc).toContain('firstName: profile.firstName');
        expect(hookSrc).toContain('lastName: profile.lastName');
        expect(hookSrc).toContain('body.phone =');
    });

    it('invalidates the user profile cache on success', () => {
        expect(hookSrc).toContain('queryClient.invalidateQueries');
        expect(hookSrc).toContain('userProfileQueryKeys.all');
    });
});
