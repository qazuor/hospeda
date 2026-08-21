/**
 * @fileoverview
 * Unit tests for the purge helpers shared by `0058-purge-seed-example-data` and
 * `0059-purge-test-and-commerce-example`.
 *
 * The infrastructure guard carries most of the weight here. It exists because of
 * a near miss found on 2026-08-19: `EXAMPLE_USER_EMAILS` listed
 * `guest@hospeda.com` while production has `guest@hospeda.com.ar` — the domains
 * moved in `0057-staff-email-domain-to-com-ar`. The `guest` account, which every
 * anonymous API request is built from, was surviving the purge because of a
 * stale domain rather than by design. These tests pin the behaviour so a future
 * domain move cannot quietly re-open that hole.
 *
 * @module test/data-migrations/purge-seed-example-data.helpers
 */
import { describe, expect, it } from 'vitest';
import {
    EXAMPLE_USER_EMAILS,
    isProtectedInfrastructureEmail,
    NEVER_DELETE_LOCAL_PARTS
} from '../../src/data-migrations/purge-seed-example-data.helpers.js';

describe('isProtectedInfrastructureEmail', () => {
    it('protects every declared local-part on the production domain', () => {
        for (const localPart of NEVER_DELETE_LOCAL_PARTS) {
            expect(isProtectedInfrastructureEmail({ email: `${localPart}@hospeda.com.ar` })).toBe(
                true
            );
        }
    });

    it('protects the same local-parts on ANY domain', () => {
        // This is the whole point of matching on the local-part: the guard has
        // to outlive the next domain move the way it did not outlive the last.
        expect(isProtectedInfrastructureEmail({ email: 'guest@hospeda.com' })).toBe(true);
        expect(isProtectedInfrastructureEmail({ email: 'guest@hospeda.com.ar' })).toBe(true);
        expect(isProtectedInfrastructureEmail({ email: 'guest@example.test' })).toBe(true);
    });

    it('is case-insensitive on the local-part', () => {
        expect(isProtectedInfrastructureEmail({ email: 'GUEST@hospeda.com.ar' })).toBe(true);
        expect(isProtectedInfrastructureEmail({ email: 'SuperAdmin@hospeda.com.ar' })).toBe(true);
    });

    it('does not protect an ordinary account', () => {
        expect(isProtectedInfrastructureEmail({ email: 'ana.rodriguez@hospeda.com.ar' })).toBe(
            false
        );
        expect(isProtectedInfrastructureEmail({ email: 'someone@gmail.com' })).toBe(false);
    });

    it('does not protect a local-part that merely CONTAINS a protected one', () => {
        // `guest-tester` is not `guest`; a substring match here would silently
        // spare rows the purge is supposed to remove.
        expect(isProtectedInfrastructureEmail({ email: 'guest-tester@hospeda.com.ar' })).toBe(
            false
        );
        expect(isProtectedInfrastructureEmail({ email: 'adminassistant@hospeda.com.ar' })).toBe(
            false
        );
    });

    it('handles a malformed address without throwing', () => {
        expect(isProtectedInfrastructureEmail({ email: '' })).toBe(false);
        expect(isProtectedInfrastructureEmail({ email: 'no-at-sign' })).toBe(false);
    });
});

describe('EXAMPLE_USER_EMAILS', () => {
    it('does not list any infrastructure account', () => {
        // The regression this pins: `guest@hospeda.com` used to be in here.
        const leaked = EXAMPLE_USER_EMAILS.filter((email) =>
            isProtectedInfrastructureEmail({ email })
        );
        expect(leaked).toEqual([]);
    });

    it('has no duplicates', () => {
        const seen = new Set(EXAMPLE_USER_EMAILS.map((email) => email.toLowerCase()));
        expect(seen.size).toBe(EXAMPLE_USER_EMAILS.length);
    });

    it('is a non-empty list of well-formed addresses', () => {
        expect(EXAMPLE_USER_EMAILS.length).toBeGreaterThan(0);
        for (const email of EXAMPLE_USER_EMAILS) {
            expect(email).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
        }
    });
});
