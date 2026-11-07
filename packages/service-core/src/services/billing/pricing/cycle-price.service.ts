/**
 * Administrative action 19 (ACC:19): set one cycle price on a plan version.
 * AC:B2:4, AC:B2:5, AC:B2:10 and DEC-MP-002 📌2 govern this act.
 * Use before cut moment 5 is an operational rule, not a code gate.
 */
import { and, billingOptions, domainEventModel, eq, getDb, planVersions } from '@repo/db';
import {
    type CyclePriceConfirmation,
    CyclePriceConfirmationSchema,
    CyclePricePreviewRequestSchema,
    type CyclePriceSetResponse,
    CyclePriceSetResponseSchema,
    SetCyclePriceRequestSchema
} from '@repo/schemas';
import type { Actor } from '../../../types/index.js';
import { CYCLE_MINIMUM_DAYS } from '../../plan-catalog/plan-publication.service.js';
import {
    PROVIDER_AMOUNT_CEILING_MINOR,
    PROVIDER_AMOUNT_FLOOR_MINOR
} from '../promo/provider-amount-floor.js';
import {
    assertCyclePriceActionPermitted,
    cyclePriceRejection,
    mapCyclePriceWriteError
} from './cycle-price-authorization.js';
import { countPlanVersionCustomers } from './cycle-price-customers.js';

/** Validate the provider floor and version grace before reading the option. */
function assertPriceRules(args: {
    readonly amount: number;
    readonly cycle: keyof typeof CYCLE_MINIMUM_DAYS;
    readonly graceDays: number;
}): void {
    if (args.amount < PROVIDER_AMOUNT_FLOOR_MINOR) {
        throw cyclePriceRejection({
            reason: 'CYCLE_PRICE_BELOW_PROVIDER_MINIMUM',
            message: `El monto mínimo que acepta Mercado Pago es ARS ${PROVIDER_AMOUNT_FLOOR_MINOR / 100}.`
        });
    }
    if (args.amount > PROVIDER_AMOUNT_CEILING_MINOR) {
        throw cyclePriceRejection({
            reason: 'CYCLE_PRICE_ABOVE_PROVIDER_MAXIMUM',
            message: `El monto máximo que acepta Mercado Pago es ARS ${PROVIDER_AMOUNT_CEILING_MINOR / 100}.`
        });
    }
    const cycleDays = CYCLE_MINIMUM_DAYS[args.cycle];
    if (cycleDays <= args.graceDays) {
        throw cyclePriceRejection({
            reason: 'CYCLE_NOT_LONGER_THAN_GRACE',
            message: `La gracia de ${args.graceDays} días debe ser menor que el ciclo de ${cycleDays} días.`
        });
    }
}

/** Preview a cycle price without taking a lock or writing to the database. */
export async function previewCyclePrice(args: {
    readonly actor?: Actor;
    readonly input: unknown;
}): Promise<CyclePriceConfirmation> {
    assertCyclePriceActionPermitted({ actor: args.actor });
    const parsed = CyclePricePreviewRequestSchema.safeParse(args.input);
    if (!parsed.success)
        throw cyclePriceRejection({
            reason: 'INVALID_CYCLE_PRICE_INPUT',
            message: 'Datos inválidos para fijar el precio del ciclo.'
        });
    const { planVersionId, cycle, amount } = parsed.data;
    const db = getDb();
    const [version] = await db
        .select()
        .from(planVersions)
        .where(eq(planVersions.id, planVersionId))
        .limit(1);
    if (!version)
        throw cyclePriceRejection({
            reason: 'PLAN_VERSION_NOT_FOUND',
            message: 'Versión de plan no encontrada.'
        });
    if (!version.sellable)
        throw cyclePriceRejection({
            reason: 'PLAN_VERSION_NOT_SELLABLE',
            message: 'No se puede fijar el precio de una versión no vendible.'
        });
    assertPriceRules({ amount, cycle, graceDays: version.graceDays });
    const [option] = await db
        .select()
        .from(billingOptions)
        .where(
            and(eq(billingOptions.planVersionId, planVersionId), eq(billingOptions.cycle, cycle))
        )
        .limit(1);
    if ((await countPlanVersionCustomers({ tx: db, planVersionId })) > 0)
        throw cyclePriceRejection({
            reason: 'PLAN_VERSION_HAS_CUSTOMERS',
            message:
                'Esta versión ya tiene clientes: el precio nuevo va en una versión nueva, que rige sólo para las altas nuevas.'
        });
    const previousAmount = option?.amount ?? null;
    if (previousAmount === amount)
        throw cyclePriceRejection({
            reason: 'CYCLE_PRICE_UNCHANGED',
            message: 'El precio del ciclo no cambia.'
        });
    return CyclePriceConfirmationSchema.parse({
        planVersionId,
        cycle,
        currency: 'ARS',
        previousAmount,
        newAmount: amount,
        graceDays: version.graceDays,
        customersReached: 0,
        effectiveFrom: 'ON_CONFIRMATION',
        message: `Cambia el precio del ciclo ${cycle} de ${previousAmount ?? 'sin precio'} a ${amount}. No alcanza a ningún cliente: rige desde la confirmación, para las altas nuevas de esta versión.`
    });
}

/** Set a cycle price and record its previous amount in one database transaction. */
export async function setCyclePrice(args: {
    readonly actor?: Actor;
    readonly input: unknown;
    readonly correlationId: string;
}): Promise<CyclePriceSetResponse> {
    assertCyclePriceActionPermitted({ actor: args.actor });
    const parsed = SetCyclePriceRequestSchema.safeParse(args.input);
    if (!parsed.success)
        throw cyclePriceRejection({
            reason: 'INVALID_CYCLE_PRICE_INPUT',
            message: 'Datos inválidos para fijar el precio del ciclo.'
        });
    const { planVersionId, cycle, amount, expectedPreviousAmount } = parsed.data;
    const actor = args.actor;
    if (!actor)
        throw cyclePriceRejection({
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN',
            message: 'Forbidden'
        });
    try {
        return await getDb().transaction(async (tx) => {
            const [version] = await tx
                .select()
                .from(planVersions)
                .where(eq(planVersions.id, planVersionId))
                .limit(1)
                .for('update');
            if (!version)
                throw cyclePriceRejection({
                    reason: 'PLAN_VERSION_NOT_FOUND',
                    message: 'Versión de plan no encontrada.'
                });
            if (!version.sellable)
                throw cyclePriceRejection({
                    reason: 'PLAN_VERSION_NOT_SELLABLE',
                    message: 'No se puede fijar el precio de una versión no vendible.'
                });
            assertPriceRules({ amount, cycle, graceDays: version.graceDays });
            const [option] = await tx
                .select()
                .from(billingOptions)
                .where(
                    and(
                        eq(billingOptions.planVersionId, planVersionId),
                        eq(billingOptions.cycle, cycle)
                    )
                )
                .limit(1)
                .for('update');
            if ((await countPlanVersionCustomers({ tx, planVersionId })) > 0)
                throw cyclePriceRejection({
                    reason: 'PLAN_VERSION_HAS_CUSTOMERS',
                    message:
                        'Esta versión ya tiene clientes: el precio nuevo va en una versión nueva, que rige sólo para las altas nuevas.'
                });
            const previousAmount = option?.amount ?? null;
            if (expectedPreviousAmount !== previousAmount)
                throw cyclePriceRejection({
                    reason: 'CYCLE_PRICE_CHANGED_SINCE_PREVIEW',
                    message: 'El precio cambió desde la confirmación previa.'
                });
            if (previousAmount === amount)
                throw cyclePriceRejection({
                    reason: 'CYCLE_PRICE_UNCHANGED',
                    message: 'El precio del ciclo no cambia.'
                });
            const [written] = option
                ? await tx
                      .update(billingOptions)
                      .set({ amount })
                      .where(eq(billingOptions.id, option.id))
                      .returning()
                : await tx
                      .insert(billingOptions)
                      .values({ planVersionId, cycle, amount, currency: 'ARS' })
                      .returning();
            if (!written) throw new Error('Cycle price write returned no row');
            const event = await domainEventModel.insert({
                eventType: 'billing_option.price_set',
                entityType: 'billing_option',
                entityId: written.id,
                actorType: 'admin',
                actorId: actor.id,
                correlationId: args.correlationId,
                changes: [
                    { field: 'billing_option.amount', old: previousAmount, new: amount },
                    { field: 'billing_option.cycle', new: cycle },
                    { field: 'billing_option.plan_version_id', new: planVersionId },
                    { field: 'billing_option.currency', new: 'ARS' }
                ],
                reason: null,
                tx
            });
            return CyclePriceSetResponseSchema.parse({
                billingOption: written,
                previousAmount,
                newAmount: amount,
                domainEventId: event.id
            });
        });
    } catch (error) {
        mapCyclePriceWriteError({ error });
    }
}
