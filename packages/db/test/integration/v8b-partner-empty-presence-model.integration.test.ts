/** Integration coverage for the ACC:25 Partner content clearing write. */
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import {
    type PartnerPresenceContentRow,
    partnerPresenceHasContent
} from '../../src/models/account-closure/account-closure.pure.ts';
import { PartnerModel } from '../../src/models/partner/partner.model.ts';
import { partners } from '../../src/schemas/partner/partner.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

const model = new PartnerModel();
const clearedKeys = [
    'logoUrl',
    'websiteUrl',
    'description',
    'contactInfo',
    'socialNetworks',
    'pendingLogoUrl',
    'pendingDescription',
    'pendingWebsiteUrl',
    'contentReviewState',
    'contentReviewNote'
] as const;
const nonEmptyPresence = {
    logoUrl: 'https://assets.test/logo.png',
    description: 'Description',
    websiteUrl: 'https://partner.test',
    pendingLogoUrl: 'https://assets.test/pending.png',
    pendingDescription: 'Pending description',
    pendingWebsiteUrl: 'https://pending.test',
    socialNetworks: { instagram: 'https://www.instagram.com/partner/' },
    contactInfo: { workEmail: 'owner@example.test' }
} satisfies Record<keyof PartnerPresenceContentRow, string | Readonly<Record<string, unknown>>>;

/** Creates an isolated minimal Partner row. */
function fixture() {
    const id = randomUUID();
    return { id, slug: `v8b-empty-${id}`, name: 'Presence fixture', type: 'business' as const };
}
/** Reads a Partner row and fails clearly if it disappeared. */
async function readPartner(tx: DrizzleClient, id: string) {
    const row = await tx.query.partners.findFirst({ where: (table, { eq }) => eq(table.id, id) });
    expect(row).toBeDefined();
    return row!;
}

afterAll(async () => closeTestPool());

describe('AC:V8b:6 ACC:25 PartnerModel.emptyPresenceContent', () => {
    it('clears every predicate field independently, with a positive predicate control first', async () => {
        await withTestTransaction(async (tx) => {
            for (const [field, value] of Object.entries(nonEmptyPresence) as Array<
                [keyof PartnerPresenceContentRow, unknown]
            >) {
                const partner = { ...fixture(), [field]: value } as typeof partners.$inferInsert;
                await tx.insert(partners).values(partner);
                const before = await readPartner(tx, partner.id!);
                expect(partnerPresenceHasContent(before)).toBe(true);
                await model.emptyPresenceContent({ tx, partnerId: partner.id! });
                const after = await readPartner(tx, partner.id!);
                expect(partnerPresenceHasContent(after)).toBe(false);
                expect(after[field]).toBeNull();
            }
        });
    });

    it('clears only the ten declared columns and preserves the rest of its row and sibling', async () => {
        await withTestTransaction(async (tx) => {
            const owner = await tx.insert(users).values(testData.user()).returning();
            const beforeFixture = {
                ...fixture(),
                logoUrl: nonEmptyPresence.logoUrl,
                websiteUrl: nonEmptyPresence.websiteUrl,
                description: nonEmptyPresence.description,
                contactInfo: nonEmptyPresence.contactInfo,
                socialNetworks: nonEmptyPresence.socialNetworks,
                pendingLogoUrl: nonEmptyPresence.pendingLogoUrl,
                pendingDescription: nonEmptyPresence.pendingDescription,
                pendingWebsiteUrl: nonEmptyPresence.pendingWebsiteUrl,
                contentReviewState: 'pending' as const,
                contentReviewNote: 'Review note',
                contentApprovedAt: new Date('2026-01-01T00:00:00.000Z'),
                contentApprovedById: owner[0]!.id,
                presenceModerated: true,
                ownerUserId: owner[0]!.id,
                lifecycleState: 'INACTIVE' as const,
                analytics: { impressions: 9, clicks: 2 },
                claimSecretHash: 'claim-hash',
                revokedAt: new Date('2026-01-02T00:00:00.000Z'),
                revokedById: owner[0]!.id,
                revokeReason: 'reason'
            } satisfies typeof partners.$inferInsert;
            const siblingFixture = fixture();
            await tx.insert(partners).values([beforeFixture, siblingFixture]);
            const before = await readPartner(tx, beforeFixture.id);
            const siblingBefore = await readPartner(tx, siblingFixture.id);
            expect(partnerPresenceHasContent(before)).toBe(true);
            await model.emptyPresenceContent({ tx, partnerId: beforeFixture.id });
            const after = await readPartner(tx, beforeFixture.id);
            const siblingAfter = await readPartner(tx, siblingFixture.id);
            for (const key of clearedKeys) expect(after[key]).toBeNull();
            const {
                logoUrl: _logoUrl,
                websiteUrl: _websiteUrl,
                description: _description,
                contactInfo: _contactInfo,
                socialNetworks: _socialNetworks,
                pendingLogoUrl: _pendingLogoUrl,
                pendingDescription: _pendingDescription,
                pendingWebsiteUrl: _pendingWebsiteUrl,
                contentReviewState: _contentReviewState,
                contentReviewNote: _contentReviewNote,
                updatedAt: _updatedAt,
                ...beforeRest
            } = before;
            const {
                logoUrl: _afterLogoUrl,
                websiteUrl: _afterWebsiteUrl,
                description: _afterDescription,
                contactInfo: _afterContactInfo,
                socialNetworks: _afterSocialNetworks,
                pendingLogoUrl: _afterPendingLogoUrl,
                pendingDescription: _afterPendingDescription,
                pendingWebsiteUrl: _afterPendingWebsiteUrl,
                contentReviewState: _afterContentReviewState,
                contentReviewNote: _afterContentReviewNote,
                updatedAt: _afterUpdatedAt,
                ...afterRest
            } = after;
            expect(afterRest).toEqual(beforeRest);
            expect(siblingAfter).toEqual(siblingBefore);
        });
    });

    it('leaves a soft-deleted Partner intact', async () => {
        await withTestTransaction(async (tx) => {
            const partner = {
                ...fixture(),
                ...nonEmptyPresence,
                deletedAt: new Date()
            } satisfies typeof partners.$inferInsert;
            await tx.insert(partners).values(partner);
            const before = await readPartner(tx, partner.id);
            expect(partnerPresenceHasContent(before)).toBe(true);
            await model.emptyPresenceContent({ tx, partnerId: partner.id });
            expect(await readPartner(tx, partner.id)).toEqual(before);
        });
    });
});
