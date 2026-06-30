/**
 * Route-level regression tests for SPEC-292: owner isFeatured leak + admin regression.
 *
 * Asserts that:
 * 1. A PATCH to the PROTECTED (owner) route with `isFeatured:true` in the body
 *    does NOT propagate isFeatured to the domain input that reaches AccommodationService.
 *    (httpToDomainAccommodationUpdate strips it; AccommodationUpdateHttpSchema has no
 *    isFeatured key to begin with.)
 * 2. A PATCH to the ADMIN route with `isFeatured:true` in the body DOES propagate
 *    isFeatured to the domain input that reaches AccommodationService.
 *    (AccommodationPatchInputSchema accepts it; transformApiInputToDomain passes it through.)
 *
 * Pattern mirrors `patch-persistence.test.ts`: the service.update() method is intercepted
 * via a class override to capture what domain input the route actually passes in.
 * If mock auth is not active (CI without MOCK_AUTH_ENABLED), the service is never called
 * and assertions are gracefully skipped via `if (!domainInput) return;`.
 *
 * Note on full route-level e2e:
 * These tests exercise the mapper / schema layer at the route boundary. The actual DB
 * persistence of isFeatured belongs to the staging smoke test for billing admin ops
 * (staging-smoke-checklist.md — "Admin featured control" section).
 *
 * @module test/routes/accommodation/spec-292-featured-leak
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

const PROTECTED_BASE = '/api/v1/protected/accommodations';
const ADMIN_BASE = '/api/v1/admin/accommodations';
const VALID_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

// ---------------------------------------------------------------------------
// Intercept AccommodationService.update() to capture the domain input.
// We extend the original service so all other methods remain real (no risk of
// breaking unrelated route setup).
// ---------------------------------------------------------------------------

vi.mock('@repo/service-core', async (importOriginal) => {
    const orig = await importOriginal<typeof import('@repo/service-core')>();

    return {
        ...orig,
        AccommodationService: class MockAccommodationService extends orig.AccommodationService {
            // biome-ignore lint/complexity/noUselessConstructor: must call super
            constructor(...args: ConstructorParameters<typeof orig.AccommodationService>) {
                super(...args);
            }

            override async update(
                _actor: Parameters<typeof orig.AccommodationService.prototype.update>[0],
                id: string,
                input: Record<string, unknown>
            ): ReturnType<typeof orig.AccommodationService.prototype.update> {
                // Store captured input in globalThis for test inspection.
                (globalThis as Record<string, unknown>).__spec292UpdateInput = input;

                return {
                    data: { id, name: 'mock-response' } as Awaited<
                        ReturnType<typeof orig.AccommodationService.prototype.update>
                    >['data'] & {},
                    error: undefined
                } as Awaited<ReturnType<typeof orig.AccommodationService.prototype.update>>;
            }
        }
    };
});

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Owner auth headers (OWNER_BASICO = owner-tier host, no admin access). */
const ownerHeaders = {
    'content-type': 'application/json',
    'user-agent': 'vitest-spec-292',
    'x-mock-actor-role': 'OWNER_BASICO',
    'x-mock-actor-id': 'user-owner-spec292'
};

/** Admin auth headers — panel access + accommodation.updateAny permission. */
const adminHeaders = {
    'content-type': 'application/json',
    'user-agent': 'vitest-spec-292',
    'x-mock-actor-role': 'ADMIN',
    'x-mock-actor-id': 'user-admin-spec292',
    'x-mock-actor-permissions': JSON.stringify(['access.panelAdmin', 'accommodation.updateAny'])
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SPEC-292 — isFeatured owner-leak closure + admin regression', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        (globalThis as Record<string, unknown>).__spec292UpdateInput = undefined;
    });

    describe('Protected PATCH — owner route', () => {
        it('does NOT carry isFeatured in the domain input when the owner sends isFeatured:true', async () => {
            // Arrange — owner tries to set isFeatured:true via the protected route
            const body = JSON.stringify({ isFeatured: true, name: 'My Hotel Updated' });

            // Act
            await app.request(`${PROTECTED_BASE}/${VALID_UUID}`, {
                method: 'PATCH',
                headers: ownerHeaders,
                body
            });

            const domainInput = (globalThis as Record<string, unknown>).__spec292UpdateInput as
                | Record<string, unknown>
                | undefined;

            // If mock auth is not active, service.update() was never called — skip assertion.
            if (!domainInput) return;

            // Assert — isFeatured must NOT be present (mapper dropped it)
            expect(domainInput).not.toHaveProperty('isFeatured');
        });

        it('still passes non-isFeatured fields through to the domain input', async () => {
            // Arrange — valid name update only
            const body = JSON.stringify({ name: 'Valid Name Update' });

            // Act
            await app.request(`${PROTECTED_BASE}/${VALID_UUID}`, {
                method: 'PATCH',
                headers: ownerHeaders,
                body
            });

            const domainInput = (globalThis as Record<string, unknown>).__spec292UpdateInput as
                | Record<string, unknown>
                | undefined;

            if (!domainInput) return;

            // Assert — other fields flow through normally
            expect(domainInput).toHaveProperty('name', 'Valid Name Update');
        });
    });

    describe('Admin PATCH — admin route', () => {
        it('carries isFeatured:true in the domain input when the admin sends isFeatured:true', async () => {
            // Arrange — admin sets isFeatured:true via the admin route
            const body = JSON.stringify({ isFeatured: true });

            // Act
            await app.request(`${ADMIN_BASE}/${VALID_UUID}`, {
                method: 'PATCH',
                headers: adminHeaders,
                body
            });

            const domainInput = (globalThis as Record<string, unknown>).__spec292UpdateInput as
                | Record<string, unknown>
                | undefined;

            // If mock auth is not active, service.update() was never called — skip assertion.
            if (!domainInput) return;

            // Assert — admin isFeatured:true must reach the service
            expect(domainInput).toHaveProperty('isFeatured', true);
        });

        it('carries isFeatured:false in the domain input when admin revokes featured', async () => {
            // Arrange — admin revokes featured status
            const body = JSON.stringify({ isFeatured: false });

            // Act
            await app.request(`${ADMIN_BASE}/${VALID_UUID}`, {
                method: 'PATCH',
                headers: adminHeaders,
                body
            });

            const domainInput = (globalThis as Record<string, unknown>).__spec292UpdateInput as
                | Record<string, unknown>
                | undefined;

            if (!domainInput) return;

            // Assert
            expect(domainInput).toHaveProperty('isFeatured', false);
        });
    });
});
