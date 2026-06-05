/**
 * What's New image-origin allowlist guard (SPEC-175 T-018 / §9).
 *
 * Asserts that every entry in `whatsNewEntries` that carries an `image` URL
 * has an origin in {@link APPROVED_IMAGE_ORIGINS}. This test is the CI gate
 * that prevents accidentally publishing image-bearing entries before the CDN
 * origin is approved and the admin CSP `img-src` directive has been updated.
 *
 * ## Three cases tested
 *
 * 1. **Current empty catalog passes** — `whatsNewEntries` is currently empty,
 *    so the guard vacuously passes. This is the expected baseline state while
 *    TBD-2 (CDN origin decision) is pending.
 *
 * 2. **Entry without `image` passes** — an entry that has no `image` field is
 *    safe regardless of the allowlist. The guard must NOT block image-free entries.
 *
 * 3. **Entry with unapproved image origin fails** — an entry whose `image` URL
 *    has an origin NOT in {@link APPROVED_IMAGE_ORIGINS} must fail the check.
 *    This is the protection against typos, staging URLs leaking to production, or
 *    new CDNs being used without going through the ops approval process.
 *
 * (A fourth case — approved origin passes — is implicitly verified by case 1
 *  when the allowlist grows.)
 *
 * @see apps/api/src/data/whats-new/whats-new.ts — catalog + allowlist
 * @see SPEC-175 §9 (TBD-2)
 */

import { describe, expect, it } from 'vitest';
import { APPROVED_IMAGE_ORIGINS, whatsNewEntries } from '../whats-new';

// ============================================================================
// HELPER — same logic as the guard assertion below, extracted for reuse
// ============================================================================

/**
 * Checks whether every image URL in `entries` has an origin in `allowlist`.
 *
 * Returns an array of violation messages (empty = all OK). Entries without
 * an `image` field are silently skipped.
 *
 * @param entries   - Array of What's New entries to validate.
 * @param allowlist - Set of approved origin strings (e.g. `'https://cdn.x.com'`).
 */
function findImageOriginViolations(
    entries: ReadonlyArray<{ id: string; image?: string }>,
    allowlist: ReadonlySet<string>
): string[] {
    const violations: string[] = [];

    for (const entry of entries) {
        if (!entry.image) continue;

        let origin: string;
        try {
            origin = new URL(entry.image).origin;
        } catch {
            violations.push(`entry '${entry.id}': image URL '${entry.image}' is not a valid URL`);
            continue;
        }

        if (!allowlist.has(origin)) {
            violations.push(
                `entry '${entry.id}': image origin '${origin}' is NOT in APPROVED_IMAGE_ORIGINS. Add the origin to the allowlist and update the CSP img-src directive before publishing.`
            );
        }
    }

    return violations;
}

// ============================================================================
// TESTS
// ============================================================================

describe("What's New image-origin allowlist guard (SPEC-175 T-018)", () => {
    // ── Case 1: current catalog ───────────────────────────────────────────────

    it('current whatsNewEntries catalog passes the image-origin check', () => {
        const violations = findImageOriginViolations(whatsNewEntries, APPROVED_IMAGE_ORIGINS);
        expect(violations, `Image origin violations found:\n${violations.join('\n')}`).toHaveLength(
            0
        );
    });

    // ── Case 2: entry without image ───────────────────────────────────────────

    it('an entry without an image field passes regardless of the allowlist', () => {
        const entriesWithoutImage = [
            {
                id: 'test-no-image',
                publishedAt: '2026-06-01T00:00:00Z',
                highlight: false as const,
                title: { es: 'Sin imagen' },
                body: { es: 'Esta entrada no tiene imagen.' }
                // No `image` field
            }
        ];

        const violations = findImageOriginViolations(entriesWithoutImage, APPROVED_IMAGE_ORIGINS);
        expect(violations).toHaveLength(0);
    });

    // ── Case 3: unapproved image origin fails ─────────────────────────────────

    it('an entry with an unapproved image origin fails the check', () => {
        const unapprovedOrigin = 'https://unapproved-cdn.example.com';
        const entriesWithUnapprovedImage = [
            {
                id: 'test-unapproved-image',
                image: `${unapprovedOrigin}/screenshot.png`
            }
        ];

        const violations = findImageOriginViolations(
            entriesWithUnapprovedImage,
            APPROVED_IMAGE_ORIGINS
        );

        expect(violations).toHaveLength(1);
        expect(violations[0]).toContain(unapprovedOrigin);
        expect(violations[0]).toContain('NOT in APPROVED_IMAGE_ORIGINS');
    });

    // ── Case 4: approved origin passes ───────────────────────────────────────

    it('an entry with an approved image origin passes the check', () => {
        const approvedOrigin = 'https://approved-cdn.example.com';
        const localAllowlist = new Set([approvedOrigin]);
        const entriesWithApprovedImage = [
            {
                id: 'test-approved-image',
                image: `${approvedOrigin}/screenshot.png`
            }
        ];

        const violations = findImageOriginViolations(entriesWithApprovedImage, localAllowlist);
        expect(violations).toHaveLength(0);
    });

    // ── Case 5: invalid URL triggers a violation (not a crash) ───────────────

    it('an entry with a malformed image URL reports a violation (not a crash)', () => {
        const entriesWithBadUrl = [
            {
                id: 'test-bad-url',
                image: 'not-a-valid-url'
            }
        ];

        const violations = findImageOriginViolations(entriesWithBadUrl, APPROVED_IMAGE_ORIGINS);
        expect(violations).toHaveLength(1);
        expect(violations[0]).toContain('not a valid URL');
    });

    // ── Guard: APPROVED_IMAGE_ORIGINS is exported ─────────────────────────────

    it('APPROVED_IMAGE_ORIGINS is exported from whats-new.ts', () => {
        // This assertion ensures the export remains in place (regression guard).
        expect(APPROVED_IMAGE_ORIGINS).toBeDefined();
        expect(APPROVED_IMAGE_ORIGINS instanceof Set).toBe(true);
    });
});
