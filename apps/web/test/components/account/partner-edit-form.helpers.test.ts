/**
 * @file partner-edit-form.helpers.test.ts
 * @description Unit tests for the partner owner-form snapshot + diff helpers
 * (HOS-278 D3).
 *
 * The three rules worth breaking things over:
 * - the CONTENT ATOM: any one of the trio dirty sends all three, or the
 *   service NULLs the two it did not receive;
 * - `contactInfo` sends only changed keys (merged column) and clears with null;
 * - `socialNetworks` sends the whole six-key object (replaced column) and
 *   clears by OMISSION.
 */

import { describe, expect, it } from 'vitest';
import {
    buildPartnerEditSnapshot,
    buildPartnerOwnerPatch,
    type PartnerEditSnapshot
} from '@/components/account/PartnerEditForm.helpers';
import type { MyPartner } from '@/lib/api/endpoints-protected';

const makePartner = (overrides: Partial<MyPartner> = {}): MyPartner =>
    ({
        id: 'p1',
        slug: 'acme',
        name: 'Acme',
        type: 'commerce',
        tier: 'silver',
        logoUrl: 'https://cdn.example.com/live.png',
        description: 'Texto vivo.',
        websiteUrl: 'https://acme.example.com',
        contactInfo: { workEmail: 'hola@acme.com', workPhone: '+543442111111', whatsapp: null },
        socialNetworks: { instagram: 'https://instagram.com/acme' },
        subscriptionStatus: 'pending',
        lifecycleState: 'DRAFT',
        startsAt: null,
        endsAt: null,
        pendingLogoUrl: null,
        pendingDescription: null,
        pendingWebsiteUrl: null,
        contentReviewState: null,
        contentReviewNote: null,
        contentApprovedAt: null,
        ...overrides
    }) as MyPartner;

const snapshotOf = (partner: MyPartner) => buildPartnerEditSnapshot(partner);

const withField = (
    base: PartnerEditSnapshot,
    key: keyof PartnerEditSnapshot,
    value: string
): PartnerEditSnapshot => ({ ...base, [key]: value });

describe('buildPartnerEditSnapshot', () => {
    it('seeds the content trio from the LIVE values when nothing is pending', () => {
        // Arrange + Act
        const snapshot = snapshotOf(makePartner());

        // Assert
        expect(snapshot.logoUrl).toBe('https://cdn.example.com/live.png');
        expect(snapshot.description).toBe('Texto vivo.');
    });

    it('seeds from the PENDING proposal when one is awaiting review', () => {
        // Arrange — re-opening the form must continue refining the submission,
        // not silently reset it back to the still-live content underneath.
        const partner = makePartner({
            contentReviewState: 'pending',
            pendingLogoUrl: 'https://cdn.example.com/pending.png',
            pendingDescription: 'Texto propuesto.'
        });

        // Act
        const snapshot = snapshotOf(partner);

        // Assert
        expect(snapshot.logoUrl).toBe('https://cdn.example.com/pending.png');
        expect(snapshot.description).toBe('Texto propuesto.');
    });

    it('does NOT seed from pending once the submission was rejected', () => {
        // Arrange — a rejected submission was discarded server-side, so the
        // pending columns are null and the live content is what remains.
        const partner = makePartner({
            contentReviewState: 'rejected',
            contentReviewNote: 'El logo está pixelado.'
        });

        // Act
        const snapshot = snapshotOf(partner);

        // Assert
        expect(snapshot.logoUrl).toBe('https://cdn.example.com/live.png');
    });

    it('flattens both JSONB groups to empty strings when absent', () => {
        // Arrange
        const partner = makePartner({ contactInfo: null, socialNetworks: null });

        // Act
        const snapshot = snapshotOf(partner);

        // Assert
        expect(snapshot.workEmail).toBe('');
        expect(snapshot.tiktok).toBe('');
    });
});

describe('buildPartnerOwnerPatch — the CONTENT ATOM rule', () => {
    it('sends ALL THREE content fields when only the description changed', () => {
        // Arrange — the service overwrites all three pending columns from what
        // it receives. Sending the description alone would NULL the pending
        // logo and website nobody touched.
        const baseline = snapshotOf(makePartner());
        const current = withField(baseline, 'description', 'Texto nuevo.');

        // Act
        const payload = buildPartnerOwnerPatch({ current, baseline });

        // Assert
        expect(payload.description).toBe('Texto nuevo.');
        expect(payload.logoUrl).toBe('https://cdn.example.com/live.png');
        expect(payload.websiteUrl).toBe('https://acme.example.com');
    });

    it('sends no content keys at all when only a contact field changed', () => {
        // Arrange — the inverse guard: an untouched content trio must NOT be
        // resubmitted, or every phone edit would park the listing in review.
        const baseline = snapshotOf(makePartner());
        const current = withField(baseline, 'workPhone', '+543442999999');

        // Act
        const payload = buildPartnerOwnerPatch({ current, baseline });

        // Assert
        expect(payload).not.toHaveProperty('logoUrl');
        expect(payload).not.toHaveProperty('description');
        expect(payload).not.toHaveProperty('websiteUrl');
    });

    it('sends null, not an empty string, for a cleared content field', () => {
        // Arrange — `''` fails the schema's `.url()`, so clearing would 400.
        const baseline = snapshotOf(makePartner());
        const current = withField(baseline, 'logoUrl', '');

        // Act
        const payload = buildPartnerOwnerPatch({ current, baseline });

        // Assert
        expect(payload.logoUrl).toBeNull();
    });
});

describe('buildPartnerOwnerPatch — contactInfo (merged column)', () => {
    it('sends ONLY the changed key, so the merge preserves the rest', () => {
        // Arrange
        const baseline = snapshotOf(makePartner());
        const current = withField(baseline, 'workPhone', '+543442999999');

        // Act
        const payload = buildPartnerOwnerPatch({ current, baseline });

        // Assert — sending `workEmail` too would be harmless here, but sending
        // the SIX keys the form does not model would delete them.
        expect(payload.contactInfo).toEqual({ workPhone: '+543442999999' });
    });

    it('clears a contact field with an explicit null', () => {
        // Arrange — under a merge, omission means "keep it", so null is the
        // only way to say "delete it". Every ContactInfoSchema field is
        // `.nullish()` precisely so this works.
        const baseline = snapshotOf(makePartner());
        const current = withField(baseline, 'workEmail', '');

        // Act
        const payload = buildPartnerOwnerPatch({ current, baseline });

        // Assert
        expect(payload.contactInfo).toEqual({ workEmail: null });
    });
});

describe('buildPartnerOwnerPatch — socialNetworks (replaced column)', () => {
    it('sends the WHOLE object, including links that did not change', () => {
        // Arrange — the column is replaced wholesale, so an unchanged link left
        // out of the payload would be deleted.
        const baseline = snapshotOf(
            makePartner({
                socialNetworks: {
                    instagram: 'https://instagram.com/acme',
                    facebook: 'https://facebook.com/acme'
                }
            })
        );
        const current = withField(baseline, 'youtube', 'https://youtube.com/@acme');

        // Act
        const payload = buildPartnerOwnerPatch({ current, baseline });

        // Assert
        expect(payload.socialNetworks).toEqual({
            instagram: 'https://instagram.com/acme',
            facebook: 'https://facebook.com/acme',
            youtube: 'https://youtube.com/@acme'
        });
    });

    it('deletes a link by OMITTING it, never by nulling it', () => {
        // Arrange — `SocialNetworkSchema` fields are `.optional()` but not
        // `.nullable()`, so a null would be rejected outright.
        const baseline = snapshotOf(
            makePartner({ socialNetworks: { instagram: 'https://instagram.com/acme' } })
        );
        const current = withField(baseline, 'instagram', '');

        // Act
        const payload = buildPartnerOwnerPatch({ current, baseline });

        // Assert
        expect(payload.socialNetworks).toEqual({});
        expect(payload.socialNetworks).not.toHaveProperty('instagram');
    });

    it('leaves socialNetworks out entirely when no link changed', () => {
        // Arrange
        const baseline = snapshotOf(makePartner());
        const current = withField(baseline, 'workPhone', '+543442999999');

        // Act
        const payload = buildPartnerOwnerPatch({ current, baseline });

        // Assert
        expect(payload).not.toHaveProperty('socialNetworks');
    });
});

describe('buildPartnerOwnerPatch — nothing to save', () => {
    it('returns an empty payload when nothing changed', () => {
        // Arrange
        const baseline = snapshotOf(makePartner());

        // Act
        const payload = buildPartnerOwnerPatch({ current: baseline, baseline });

        // Assert
        expect(Object.keys(payload)).toHaveLength(0);
    });

    it('ignores a change that is only surrounding whitespace', () => {
        // Arrange
        const baseline = snapshotOf(makePartner());
        const current = withField(baseline, 'description', '  Texto vivo.  ');

        // Act
        const payload = buildPartnerOwnerPatch({ current, baseline });

        // Assert
        expect(Object.keys(payload)).toHaveLength(0);
    });
});
