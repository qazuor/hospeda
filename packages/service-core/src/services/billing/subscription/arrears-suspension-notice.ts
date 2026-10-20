import type { SelectSubscription } from '@repo/db';
import {
    addonInstances,
    addonProducts,
    addons,
    and,
    asc,
    eq,
    getDb,
    gt,
    isNull,
    or,
    planCatalogModel,
    promoRedemptions,
    sql,
    touristVipModel
} from '@repo/db';
import { z } from 'zod';

const DAY_MS = 86_400_000;

/**
 * What the arrears suspension notice says (AC:B7:30, `B/19` §4 row 10): the
 * vertical, how to come back (by payment method), whether the person loses the
 * Tourist VIP benefits their plan gave them, the one-time addons whose days run
 * out while suspended, and whether a promo is lost on the way back. Plain JSON
 * (no `Date`): it travels in the outbox `payload`.
 */
export const ArrearsSuspensionNoticeContentSchema = z.strictObject({
    vertical: z.string().min(1),
    paymentMethod: z.enum(['CARD', 'MANUAL']),
    touristVipLost: z.boolean(),
    oneTimeAddons: z.array(
        z.strictObject({
            name: z.string().min(1),
            remainingDays: z.number().int().positive()
        })
    ),
    promoLost: z.boolean()
});

/** The content of the arrears suspension notice; see {@link ArrearsSuspensionNoticeContentSchema}. */
export interface ArrearsSuspensionNoticeContent {
    readonly vertical: string;
    readonly paymentMethod: 'CARD' | 'MANUAL';
    readonly touristVipLost: boolean;
    readonly oneTimeAddons: readonly {
        readonly name: string;
        readonly remainingDays: number;
    }[];
    readonly promoLost: boolean;
}

/** The facts the notice is built from, as read for one suspended row. */
export interface ArrearsSuspensionNoticeFacts {
    readonly vertical: string;
    readonly paymentMethod: 'CARD' | 'MANUAL';
    /** The suspended row's plan version declares `inheritsTouristVip`. */
    readonly versionInheritsTouristVip: boolean;
    /** Another title-emitting row of the same user still inherits Tourist VIP. */
    readonly anotherTitleInheritsTouristVip: boolean;
    /** Live one-time addons of the user compatible with the row's vertical. */
    readonly oneTimeAddons: readonly { readonly name: string; readonly endsAt: Date }[];
    /** A redemption on this subscription still has charges left (or is forever). */
    readonly hasLivePromo: boolean;
    readonly now: Date;
}

/**
 * Pure part of the notice: turns the read facts into its content. A manual
 * payer never loses a promo (there is no amount promo on manual, `B/14` §2.5);
 * an addon's remaining days round up, in epoch milliseconds.
 *
 * @param input - The facts read for the suspended row
 * @returns The notice content
 */
export function buildArrearsSuspensionNoticeContent(
    input: ArrearsSuspensionNoticeFacts
): ArrearsSuspensionNoticeContent {
    const nowMs = input.now.getTime();
    const oneTimeAddons = input.oneTimeAddons
        .filter((addon) => addon.endsAt.getTime() > nowMs)
        .map((addon) => ({
            name: addon.name,
            remainingDays: Math.ceil((addon.endsAt.getTime() - nowMs) / DAY_MS)
        }));
    return {
        vertical: input.vertical,
        paymentMethod: input.paymentMethod,
        touristVipLost: input.versionInheritsTouristVip && !input.anotherTitleInheritsTouristVip,
        oneTimeAddons,
        promoLost: promoLostFor({
            paymentMethod: input.paymentMethod,
            hasLivePromo: input.hasLivePromo
        })
    };
}

function promoLostFor(input: {
    readonly paymentMethod: 'CARD' | 'MANUAL';
    readonly hasLivePromo: boolean;
}): boolean {
    switch (input.paymentMethod) {
        case 'CARD':
            return input.hasLivePromo;
        case 'MANUAL':
            return false;
        default: {
            const unreachable: never = input.paymentMethod;
            return unreachable;
        }
    }
}

const paymentMethodSchema = z.enum(['CARD', 'MANUAL']);

async function versionInheritsTouristVip(planVersionId: string | null): Promise<boolean> {
    if (!planVersionId) return false;
    const version = await planCatalogModel.findPlanVersion({ id: planVersionId });
    return version?.inheritsTouristVip === true;
}

/**
 * Reads the facts of the arrears suspension notice for one row and builds its
 * content. Everything read belongs to the row's user and to this subscription.
 * The read decides nothing about S6: it is only what the notice says. If it
 * throws, the caller sends no half notice.
 *
 * @param input.subscription - The row being suspended (still in its origin status)
 * @param input.now - The instant the remaining addon days are counted from
 * @returns The notice content
 */
export async function readArrearsSuspensionNoticeContent(input: {
    readonly subscription: SelectSubscription;
    readonly now: Date;
}): Promise<ArrearsSuspensionNoticeContent> {
    const { subscription, now } = input;
    if (!subscription.userId || !subscription.vertical)
        throw new Error('The suspended subscription has no user or vertical');
    const userId = subscription.userId;
    const vertical = subscription.vertical;
    const paymentMethod = paymentMethodSchema.parse(subscription.paymentMethod);

    const inherits = await versionInheritsTouristVip(subscription.planVersionId);
    let anotherTitleInheritsTouristVip = false;
    if (inherits) {
        const titles = await touristVipModel.findTitleRows({ userId });
        for (const title of titles) {
            if (title.id === subscription.id) continue;
            if (await versionInheritsTouristVip(title.planVersionId)) {
                anotherTitleInheritsTouristVip = true;
                break;
            }
        }
    }

    const db = getDb();
    const oneTimeAddons = await db
        .select({ name: addons.name, endsAt: addonInstances.endsAt })
        .from(addonInstances)
        .innerJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
        .innerJoin(addons, eq(addons.id, addonProducts.addonId))
        .where(
            and(
                eq(addonInstances.ownerId, userId),
                eq(addonInstances.status, 'ACTIVE'),
                eq(addonProducts.chargeKind, 'UNA_VEZ'),
                gt(addonInstances.endsAt, now),
                sql`${vertical} = ANY(${addonProducts.compatibleVerticals})`
            )
        )
        .orderBy(asc(addonInstances.endsAt), asc(addons.name));

    const [promo] = await db
        .select({ id: promoRedemptions.id })
        .from(promoRedemptions)
        .where(
            and(
                eq(promoRedemptions.subscriptionId, subscription.id),
                or(
                    isNull(promoRedemptions.remainingCharges),
                    gt(promoRedemptions.remainingCharges, 0)
                )
            )
        )
        .limit(1);

    return buildArrearsSuspensionNoticeContent({
        vertical,
        paymentMethod,
        versionInheritsTouristVip: inherits,
        anotherTitleInheritsTouristVip,
        oneTimeAddons: oneTimeAddons.flatMap((row) =>
            row.endsAt ? [{ name: row.name, endsAt: row.endsAt }] : []
        ),
        hasLivePromo: promo !== undefined,
        now
    });
}
