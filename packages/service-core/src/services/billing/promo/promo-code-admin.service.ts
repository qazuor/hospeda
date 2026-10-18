import type { Clock } from '@repo/billing-verticals-contract';
import type { SelectPromoCode } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { count, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Actor } from '../../../types/index.js';
import { ServiceError } from '../../../types/index.js';
import { type PromoCodeAvailability, resolvePromoCodeAvailability } from './promo-availability.js';
import {
    assertPromoCodeActionPermitted,
    mapPromoCodeWriteError,
    promoCodeAdminRejection
} from './promo-code-admin-authorization.js';

/** Input shape for a promotional code effect. */
export type PromoCodeEffectInput =
    | {
          readonly kind: 'DISCOUNT';
          readonly discountKind: 'PERCENTAGE' | 'FIXED';
          readonly value: number;
          readonly durationKind: 'FIRST_CHARGE' | 'N_CHARGES' | 'FOREVER';
          readonly durationCharges: number | null;
      }
    | { readonly kind: 'TRIAL_EXTENSION'; readonly extensionDays: number };

/** Data needed to create a promotional code. FIXED values use minor currency units. */
export interface PromoCodeCreateInput {
    readonly code: string;
    readonly effect: PromoCodeEffectInput;
    readonly allVerticals: boolean;
    readonly verticals: readonly string[] | null;
    readonly totalQuota: number | null;
    readonly validFrom?: Date;
    readonly validUntil: Date | null;
    readonly stackable: boolean;
    readonly usableWithAnotherActive: boolean;
}

/** Administrative view of a code and its computed availability. */
export interface PromoCodeAdminView {
    readonly id: string;
    readonly code: string;
    readonly effect: PromoCodeEffectInput;
    readonly allVerticals: boolean;
    readonly verticals: readonly string[] | null;
    readonly totalQuota: number | null;
    readonly validFrom: Date;
    readonly validUntil: Date | null;
    readonly stackable: boolean;
    readonly usableWithAnotherActive: boolean;
    readonly closedAt: Date | null;
    readonly closedBy: string | null;
    readonly createdAt: Date;
    readonly redemptionCount: number;
    readonly availability: PromoCodeAvailability;
}

/** Create one code after authorizing ACC_21. */
export async function createPromoCode(
    input: { readonly actor?: Actor; readonly input: PromoCodeCreateInput },
    ports: { readonly clock: Clock }
): Promise<PromoCodeAdminView> {
    assertPromoCodeActionPermitted({ actor: input.actor });
    const { getDb, promoCodes } = await import('@repo/db');
    const effect = input.input.effect;
    try {
        const [row] = await getDb()
            .insert(promoCodes)
            .values({
                code: input.input.code,
                effectKind: effect.kind,
                discountKind: effect.kind === 'DISCOUNT' ? effect.discountKind : null,
                value: effect.kind === 'DISCOUNT' ? effect.value : null,
                durationKind: effect.kind === 'DISCOUNT' ? effect.durationKind : null,
                durationCharges:
                    effect.kind === 'DISCOUNT' && effect.durationKind === 'N_CHARGES'
                        ? effect.durationCharges
                        : null,
                extensionDays: effect.kind === 'TRIAL_EXTENSION' ? effect.extensionDays : null,
                allVerticals: input.input.allVerticals,
                verticals: input.input.allVerticals ? null : [...(input.input.verticals ?? [])],
                totalQuota: input.input.totalQuota,
                validFrom: input.input.validFrom ?? ports.clock.now(),
                validUntil: input.input.validUntil,
                stackable: input.input.stackable,
                usableWithAnotherActive: input.input.usableWithAnotherActive
            })
            .returning();
        if (!row) throw new Error('Promo code insert returned no row');
        return toPromoCodeAdminView({ row, redemptionCount: 0, now: ports.clock.now() });
    } catch (error) {
        mapPromoCodeWriteError({ error });
    }
}

/** Close a code under the same row lock used by redemption. */
export async function closePromoCode(
    input: { readonly actor?: Actor; readonly promoCodeId: string },
    ports: { readonly clock: Clock }
): Promise<{
    readonly promoCodeId: string;
    readonly closedAt: Date;
    readonly closedBy: string;
    readonly redemptionCount: number;
}> {
    assertPromoCodeActionPermitted({ actor: input.actor });
    const { getDb, promoCodes, promoRedemptions } = await import('@repo/db');
    const actor = input.actor;
    if (!actor)
        throw promoCodeAdminRejection({
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN',
            message: 'Forbidden'
        });
    return getDb().transaction(async (tx) => {
        const [row] = await tx
            .select()
            .from(promoCodes)
            .where(eq(promoCodes.id, input.promoCodeId))
            .limit(1)
            .for('update');
        if (!row)
            throw promoCodeAdminRejection({
                reason: 'PROMO_CODE_NOT_FOUND',
                message: 'Promotional code not found'
            });
        if (row.closedAt !== null)
            throw promoCodeAdminRejection({
                reason: 'PROMO_CODE_ALREADY_CLOSED',
                message: 'Promotional code is already closed'
            });
        const closedAt = ports.clock.now();
        await tx
            .update(promoCodes)
            .set({ closedAt, closedBy: actor.id })
            .where(eq(promoCodes.id, row.id));
        const [redemptions] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(promoRedemptions)
            .where(eq(promoRedemptions.promoCodeId, row.id));
        return {
            promoCodeId: row.id,
            closedAt,
            closedBy: actor.id,
            redemptionCount: redemptions?.count ?? 0
        };
    });
}

/** List codes by creation time with one redemption-count query for the page. */
export async function listPromoCodes(
    input: { readonly actor?: Actor; readonly page: number; readonly pageSize: number },
    ports: { readonly clock: Clock }
): Promise<{ readonly items: readonly PromoCodeAdminView[]; readonly total: number }> {
    assertPromoCodeActionPermitted({ actor: input.actor });
    const { getDb, promoCodes, promoRedemptions } = await import('@repo/db');
    const db = getDb();
    const [totalRow] = await db.select({ total: count() }).from(promoCodes);
    const rows = await db
        .select()
        .from(promoCodes)
        .orderBy(desc(promoCodes.createdAt), promoCodes.id)
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
    const ids = rows.map((row) => row.id);
    const counts =
        ids.length === 0
            ? []
            : await db
                  .select({
                      promoCodeId: promoRedemptions.promoCodeId,
                      count: sql<number>`count(*)::int`
                  })
                  .from(promoRedemptions)
                  .where(inArray(promoRedemptions.promoCodeId, ids))
                  .groupBy(promoRedemptions.promoCodeId);
    const countById = new Map(counts.map((entry) => [entry.promoCodeId, entry.count]));
    return {
        items: rows.map((row) =>
            toPromoCodeAdminView({
                row,
                redemptionCount: countById.get(row.id) ?? 0,
                now: ports.clock.now()
            })
        ),
        total: totalRow?.total ?? 0
    };
}

function toPromoCodeAdminView(input: {
    readonly row: SelectPromoCode;
    readonly redemptionCount: number;
    readonly now: Date;
}): PromoCodeAdminView {
    const row = input.row;
    let effect: PromoCodeEffectInput;
    if (
        row.effectKind === 'DISCOUNT' &&
        row.discountKind !== null &&
        row.value !== null &&
        row.durationKind !== null &&
        row.extensionDays === null &&
        (row.durationKind !== 'N_CHARGES' || row.durationCharges !== null)
    ) {
        effect = {
            kind: 'DISCOUNT',
            discountKind: row.discountKind as 'PERCENTAGE' | 'FIXED',
            value: row.value,
            durationKind: row.durationKind as 'FIRST_CHARGE' | 'N_CHARGES' | 'FOREVER',
            durationCharges: row.durationKind === 'N_CHARGES' ? row.durationCharges : null
        };
    } else if (
        row.effectKind === 'TRIAL_EXTENSION' &&
        row.extensionDays !== null &&
        row.discountKind === null &&
        row.value === null &&
        row.durationKind === null &&
        row.durationCharges === null
    ) {
        effect = { kind: 'TRIAL_EXTENSION', extensionDays: row.extensionDays };
    } else {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Promotional code row has an invalid effect shape'
        );
    }
    return {
        id: row.id,
        code: row.code,
        effect,
        allVerticals: row.allVerticals,
        verticals: row.verticals,
        totalQuota: row.totalQuota,
        validFrom: row.validFrom,
        validUntil: row.validUntil,
        stackable: row.stackable,
        usableWithAnotherActive: row.usableWithAnotherActive,
        closedAt: row.closedAt,
        closedBy: row.closedBy,
        createdAt: row.createdAt,
        redemptionCount: input.redemptionCount,
        availability: resolvePromoCodeAvailability({
            promo: row,
            redemptionCount: input.redemptionCount,
            now: input.now
        })
    };
}
