import { eq, getDb, inArray, promoCodes, promoRedemptions, users } from '@repo/db';
import { PermissionEnum, VerticalEnum } from '@repo/schemas';
import { initApp } from '../../../src/app';

export const adminPromoClock = { now: () => new Date('2026-10-18T12:00:00.000Z') };
export const adminPromoPath = '/api/v1/admin/billing-promo-codes';
export const adminPromoPermissions = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.BILLING_MANAGE_PROMO_CODES
];

const promoCodeIds: string[] = [];
const userIds: string[] = [];

export function createAdminPromoApp() {
    return initApp({ clock: adminPromoClock });
}

export function adminPromoHeaders(input?: {
    readonly id: string;
    readonly role: string;
    readonly permissions: readonly PermissionEnum[];
}) {
    const base = { 'content-type': 'application/json', 'user-agent': 'vitest' };
    if (!input) return base;
    return {
        ...base,
        'x-mock-actor-id': input.id,
        'x-mock-actor-role': input.role,
        'x-mock-actor-permissions': JSON.stringify(input.permissions)
    };
}

export async function seedPromoAdminUser(label: string) {
    const [user] = await getDb()
        .insert(users)
        .values({
            email: `promo-admin-${label}-${crypto.randomUUID()}@example.test`,
            displayName: `Promo admin ${label}`,
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!user) throw new Error('Expected promo admin user');
    userIds.push(user.id);
    return user.id;
}

export function promoCreateBody(code: string) {
    return {
        code,
        effect: {
            kind: 'DISCOUNT',
            discountKind: 'FIXED',
            value: 500,
            durationKind: 'N_CHARGES',
            durationCharges: 3
        },
        allVerticals: false,
        verticals: [VerticalEnum.ACCOMMODATION],
        totalQuota: 20,
        validFrom: '2026-10-01T00:00:00.000Z',
        validUntil: '2026-12-01T00:00:00.000Z',
        stackable: false,
        usableWithAnotherActive: false
    };
}

export async function seedOpenPromoCode(code: string) {
    const [row] = await getDb()
        .insert(promoCodes)
        .values({
            code,
            discountKind: 'FIXED',
            value: 500,
            durationKind: 'N_CHARGES',
            durationCharges: 3,
            allVerticals: true,
            verticals: null,
            totalQuota: 20,
            validFrom: new Date('2026-10-01T00:00:00.000Z'),
            validUntil: new Date('2026-12-01T00:00:00.000Z'),
            stackable: false,
            usableWithAnotherActive: false
        })
        .returning({ id: promoCodes.id });
    if (!row) throw new Error('Expected seeded promo code');
    promoCodeIds.push(row.id);
    return row.id;
}

export function trackPromoCode(id: string) {
    promoCodeIds.push(id);
}

export async function cleanupAdminPromoFixtures() {
    const ids = promoCodeIds.splice(0);
    if (ids.length > 0) {
        await getDb().delete(promoRedemptions).where(inArray(promoRedemptions.promoCodeId, ids));
        await getDb().delete(promoCodes).where(inArray(promoCodes.id, ids));
    }
    const actors = userIds.splice(0);
    if (actors.length > 0) {
        await getDb().delete(users).where(inArray(users.id, actors));
    }
}

export async function promoRowsByCode(code: string) {
    return getDb().select().from(promoCodes).where(eq(promoCodes.code, code));
}
