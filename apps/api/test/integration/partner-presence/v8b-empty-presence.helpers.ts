import { randomUUID } from 'node:crypto';
import { eq, getDb, partners, sql } from '@repo/db';
import { InMemoryImageProvider } from '@repo/media/test-utils';
import { type PermissionEnum, RoleEnum } from '@repo/schemas';
import { actorHeaders, createOwner } from '../listing-publication/publication-routes.helpers';
import { createdUserIds, seedPartner, seedPlan } from './partner-presence.helpers';

export const emptyingMocks: { provider: InMemoryImageProvider | null } = {
    provider: new InMemoryImageProvider({ cloudName: 'fake-cloud' })
};
export function inMemoryProvider(): InMemoryImageProvider {
    const provider = emptyingMocks.provider;
    if (provider === null) throw new Error('In-memory provider is unavailable');
    return provider;
}
export const emptyingAdminHeaders = (id: string, permissions: PermissionEnum[]) =>
    actorHeaders({ id, role: RoleEnum.ADMIN, permissions });

/** Seeds a populated partner and two owned remote assets for ACC:25 integration coverage. */
export async function seedEmptyablePartner() {
    const gold = await seedPlan('GOLD');
    const silver = await seedPlan('SILVER');
    const owner = await createOwner();
    createdUserIds.push(owner.id);
    const fixture = await seedPartner({ owner, gold, silver });
    const folder = `hospeda/test/partners/${randomUUID()}`;
    const provider = emptyingMocks.provider;
    if (provider === null) throw new Error('Expected the in-memory provider while seeding');
    const logo = await provider.upload({ file: Buffer.from('logo'), folder, publicId: 'logo' });
    const pendingLogo = await provider.upload({
        file: Buffer.from('pending'),
        folder,
        publicId: 'pending'
    });
    const [partner] = await getDb()
        .update(partners)
        .set({
            logoUrl: logo.url,
            pendingLogoUrl: pendingLogo.url,
            description: 'Presence description',
            websiteUrl: 'https://partner.example',
            contactInfo: { personalEmail: 'contact@example.com' },
            socialNetworks: { instagram: 'https://instagram.com/partner' },
            pendingDescription: 'Pending description',
            pendingWebsiteUrl: 'https://pending.example',
            contentReviewState: 'pending',
            contentReviewNote: 'Review note',
            contentApprovedAt: new Date('2026-01-01T00:00:00.000Z')
        })
        .where(eq(partners.id, fixture.partner.id))
        .returning();
    if (!partner) throw new Error('Expected populated Partner');
    const application = await getDb().execute(sql`
        INSERT INTO partner_application (email, status, resolved_at, partner_id, deadlines_version)
        VALUES (${`v8b-${randomUUID()}@example.test`}, 'APPROVED', now(), ${partner.id}::uuid,
            (SELECT max(version) FROM vertical_deadline_version)) RETURNING id`);
    return {
        ...fixture,
        partner,
        logoPublicId: logo.publicId,
        pendingPublicId: pendingLogo.publicId,
        applicationId: String(application.rows[0]?.id)
    };
}

export const CONTENT_FIELD_NAMES = [
    'logo_url',
    'website_url',
    'description',
    'contact_info',
    'social_networks',
    'pending_logo_url',
    'pending_description',
    'pending_website_url',
    'content_review_state',
    'content_review_note'
] as const;
