import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import {
    and,
    billingOptions,
    domainEventModel,
    eq,
    getDb,
    inArray,
    PartnerModel,
    planCatalogModel,
    plans,
    planVersions,
    subscriptionModel,
    UserModel
} from '@repo/db';
import {
    acceptsPaymentMethod,
    PartnerBillingSetupOptionSchema,
    type PlanPaymentMethod,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import type { Actor, StartSubscriptionPorts } from '@repo/service-core';
import {
    isSystemActor,
    ServiceError,
    startManualSubscription,
    startTeamCardSubscription
} from '@repo/service-core';
import { isAdministrativeActionPermitted, resolveAdministrativeActionStep } from '@repo/verticals';
import { getRequestCorrelationId } from '../../lib/request-context';
import { readSignupWindow } from '../../routes/billing-subscription/read-signup-window';

const partnerModel = new PartnerModel();
const userModel = new UserModel();
const ACTION = 'ACC_6' as const;
const EFFECT =
    'Creates a subscription pending authorization: a manual one opens its first installment, a card one returns the Mercado Pago authorization link.';

/** A sellable Partner billing option exposed by the action 6 preview (AC:V7:17, ACC:6). */
export type PartnerBillingSetupOption = ReturnType<typeof PartnerBillingSetupOptionSchema.parse>;

/** Typed AC:V7:17 ACC:6 rejection reasons translated by the HTTP route. */
export type PartnerBillingSetupRejection =
    | 'NOT_FOUND'
    | 'PARTNER_WITHOUT_OWNER'
    | 'COMMITMENT_TAKEN'
    | 'PLAN_NOT_FOR_SALE'
    | 'MANUAL_PAYMENT_NOT_AVAILABLE'
    | 'PAYMENT_METHOD_NOT_ACCEPTED'
    | 'ADMINISTRATIVE_ACTION_FORBIDDEN';

/** Read-only action 6 preview for one Partner (AC:V7:17, ACC:6). */
export async function previewPartnerBillingSetup(input: {
    readonly actor: Actor;
    readonly partnerId: string;
}): Promise<{
    readonly partner: { readonly id: string; readonly name: string };
    readonly ownerUserId: string;
    readonly owner: { readonly name: string; readonly email: string };
    readonly options: readonly PartnerBillingSetupOption[];
    readonly effect: typeof EFFECT;
}> {
    assertActionPermission(input.actor);
    const partner = await partnerModel.findOne({ id: input.partnerId });
    if (!partner) throw rejection('NOT_FOUND', ServiceErrorCode.NOT_FOUND, 'Partner not found');
    if (!partner.ownerUserId)
        throw rejection(
            'PARTNER_WITHOUT_OWNER',
            ServiceErrorCode.ALREADY_EXISTS,
            'Partner has no owner'
        );

    const ownerUser = await userModel.findOne({ id: partner.ownerUserId });
    if (!ownerUser)
        throw rejection(
            'PARTNER_WITHOUT_OWNER',
            ServiceErrorCode.ALREADY_EXISTS,
            'Partner owner not found'
        );
    const fullName = [ownerUser.firstName, ownerUser.lastName].filter(Boolean).join(' ').trim();
    const ownerName = ownerUser.displayName?.trim() || fullName || ownerUser.email;
    const owner = { name: ownerName, email: ownerUser.email };

    const versions = await planCatalogModel.findSellableCurrentVersions({
        vertical: VerticalEnum.PARTNER
    });
    if (versions.length === 0)
        return {
            partner: { id: partner.id, name: partner.name },
            ownerUserId: partner.ownerUserId,
            owner,
            options: [],
            effect: EFFECT
        };
    const rows = await getDb()
        .select({
            billingOptionId: billingOptions.id,
            planVersionId: planVersions.id,
            planName: plans.name,
            planSlug: plans.slug,
            cycle: billingOptions.cycle,
            amountMinor: billingOptions.amount,
            currency: billingOptions.currency,
            paymentMethods: planVersions.paymentMethods
        })
        .from(billingOptions)
        .innerJoin(planVersions, eq(planVersions.id, billingOptions.planVersionId))
        .innerJoin(plans, eq(plans.id, planVersions.planId))
        .where(
            and(
                inArray(
                    planVersions.id,
                    versions.map((version) => version.id)
                ),
                eq(planVersions.vertical, VerticalEnum.PARTNER),
                eq(planVersions.current, true),
                eq(planVersions.sellable, true)
            )
        );
    const order = new Map(versions.map((version, index) => [version.id, index]));
    const options = rows
        .sort(
            (left, right) =>
                (order.get(left.planVersionId) ?? 0) - (order.get(right.planVersionId) ?? 0) ||
                left.cycle.localeCompare(right.cycle)
        )
        .map((row) => PartnerBillingSetupOptionSchema.parse(row));
    return {
        partner: { id: partner.id, name: partner.name },
        ownerUserId: partner.ownerUserId,
        owner,
        options,
        effect: EFFECT
    };
}

/** What action 6 created: a manual first installment, or a card authorization link (HOS-2196). */
export type PartnerBillingSetupResult = {
    readonly paymentMethod: PlanPaymentMethod;
    readonly subscriptionId: string;
    readonly manualPaymentId: string | null;
    readonly periodStart: Date | null;
    /** Mercado Pago authorization link of a card subscription; `null` for a manual one. */
    readonly checkoutUrl: string | null;
    readonly authorizationWindowEndsAt: Date;
    readonly created: boolean;
};

type Locked = {
    readonly ownerUserId: string;
    readonly partnerId: string;
    readonly planVersionId: string;
    readonly paymentMethods: readonly string[];
    /** The owner's account email, declared (never confirmed) as the card payer, like the public S1. */
    readonly ownerEmail: string;
};

/** Authorizes the act, locks the Partner and reads the chosen option, inside the caller's tx. */
async function lockPartnerAndChoice(input: {
    readonly tx: DrizzleClient;
    readonly actor: Actor;
    readonly partnerId: string;
    readonly billingOptionId: string;
}): Promise<Locked> {
    const { tx } = input;
    const partner = await partnerModel.lockById({ tx, partnerId: input.partnerId });
    if (!partner) throw rejection('NOT_FOUND', ServiceErrorCode.NOT_FOUND, 'Partner not found');
    if (!partner.ownerUserId)
        throw rejection(
            'PARTNER_WITHOUT_OWNER',
            ServiceErrorCode.ALREADY_EXISTS,
            'Partner has no owner'
        );
    const step = resolveAdministrativeActionStep({
        action: ACTION,
        actorId: input.actor.id,
        subjectId: partner.ownerUserId,
        permitted: isAdministrativeActionPermitted({
            action: ACTION,
            actorPermissions: input.actor.permissions
        }),
        isSystemActor: isSystemActor(input.actor)
    });
    if (!step.allowed)
        throw rejection('ADMINISTRATIVE_ACTION_FORBIDDEN', ServiceErrorCode.FORBIDDEN, 'Forbidden');
    const [choice] = await tx
        .select({
            planVersionId: billingOptions.planVersionId,
            vertical: planVersions.vertical,
            paymentMethods: planVersions.paymentMethods
        })
        .from(billingOptions)
        .innerJoin(planVersions, eq(planVersions.id, billingOptions.planVersionId))
        .where(eq(billingOptions.id, input.billingOptionId))
        .limit(1);
    if (!choice || choice.vertical !== VerticalEnum.PARTNER)
        throw rejection(
            'MANUAL_PAYMENT_NOT_AVAILABLE',
            ServiceErrorCode.VALIDATION_ERROR,
            'Billing option is unavailable'
        );
    const ownerUser = await userModel.findOne({ id: partner.ownerUserId });
    if (!ownerUser)
        throw rejection(
            'PARTNER_WITHOUT_OWNER',
            ServiceErrorCode.ALREADY_EXISTS,
            'Partner owner not found'
        );
    return {
        ownerEmail: ownerUser.email,
        ownerUserId: partner.ownerUserId,
        partnerId: partner.id,
        planVersionId: choice.planVersionId,
        paymentMethods: choice.paymentMethods
    };
}

/** Records the durable action 6 event inside the caller's transaction. */
async function recordBillingConfigured(input: {
    readonly tx: DrizzleClient;
    readonly actor: Actor;
    readonly locked: Locked;
    readonly paymentMethod: PlanPaymentMethod;
    readonly billingOptionId: string;
    readonly subscriptionId: string;
    readonly reason: string;
    readonly occurredAt: Date;
}): Promise<void> {
    await domainEventModel.insert({
        tx: input.tx,
        eventType: 'partner.billing_configured',
        entityType: 'partner',
        entityId: input.locked.partnerId,
        actorType: 'admin',
        actorId: input.actor.id,
        reason: input.reason,
        changes: [
            { field: 'payment_method', old: null, new: input.paymentMethod },
            { field: 'plan_version_id', old: null, new: input.locked.planVersionId },
            { field: 'billing_option_id', old: null, new: input.billingOptionId },
            { field: 'subscription_id', old: null, new: input.subscriptionId },
            { field: 'owner_user_id', old: null, new: input.locked.ownerUserId }
        ],
        correlationId: getRequestCorrelationId() ?? randomUUID(),
        occurredAt: input.occurredAt
    });
}

/**
 * Action 6 act (AC:V7:17, ACC:6, HOS-2196): the team picks the payment method the plan accepts and
 * creates the Partner owner's pending subscription. Manual opens the first installment; card returns
 * the Mercado Pago authorization link of that one subscription (no first-charge date, EX-38).
 */
export async function configurePartnerBilling(
    input: {
        readonly actor: Actor;
        readonly partnerId: string;
        readonly billingOptionId: string;
        readonly paymentMethod: PlanPaymentMethod;
        readonly reason: string;
        /** Site origin the payer returns to after authorizing; only a card subscription uses it. */
        readonly returnUrl: string;
    },
    ports: StartSubscriptionPorts
): Promise<PartnerBillingSetupResult> {
    const reason = input.reason.trim();
    if (reason.length < 1 || reason.length > 500)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Reason must contain 1 to 500 characters'
        );
    if (input.paymentMethod === 'CARD') return configureWithCard({ ...input, reason }, ports);
    return getDb().transaction(async (tx) => {
        const locked = await lockPartnerAndChoice({ ...input, tx: tx as DrizzleClient });
        assertAccepts({ locked, method: 'MANUAL' });
        const result = await startManualSubscription(
            {
                userId: locked.ownerUserId,
                billingOptionId: input.billingOptionId,
                tx: tx as DrizzleClient
            },
            ports
        );
        if (result.created) {
            await recordBillingConfigured({
                tx: tx as DrizzleClient,
                actor: input.actor,
                locked,
                paymentMethod: 'MANUAL',
                billingOptionId: input.billingOptionId,
                subscriptionId: result.subscriptionId,
                reason,
                occurredAt: ports.clock.now()
            });
        }
        return {
            paymentMethod: 'MANUAL',
            subscriptionId: result.subscriptionId,
            manualPaymentId: result.manualPaymentId,
            periodStart: result.periodStart,
            checkoutUrl: null,
            authorizationWindowEndsAt: result.authorizationWindowEndsAt,
            created: result.created
        };
    });
}

/**
 * Card branch. The provider call cannot sit inside a database transaction, so the act is split:
 * a short transaction authorizes and validates (and holds the Partner lock), then the S1 card start
 * runs on its own durable lock, then the audit event is written. A repeat click reuses the pending
 * subscription and its link (`created: false`, no second event).
 */
async function configureWithCard(
    input: {
        readonly actor: Actor;
        readonly partnerId: string;
        readonly billingOptionId: string;
        readonly reason: string;
        readonly returnUrl: string;
    },
    ports: StartSubscriptionPorts
): Promise<PartnerBillingSetupResult> {
    const locked = await getDb().transaction(async (tx) => {
        const found = await lockPartnerAndChoice({ ...input, tx: tx as DrizzleClient });
        assertAccepts({ locked: found, method: 'CARD' });
        return found;
    });
    const before = await subscriptionModel.findLiveCommitment({
        userId: locked.ownerUserId,
        vertical: VerticalEnum.PARTNER
    });
    const started = await startTeamCardSubscription(
        {
            userId: locked.ownerUserId,
            billingOptionId: input.billingOptionId,
            returnUrl: input.returnUrl,
            // Same as the public S1: the preapproval carries a declared payer email, and the
            // creations sweep looks an orphan up by it (the owner's account email).
            payerEmail: locked.ownerEmail
        },
        ports
    );
    const window = await readSignupWindow({
        subscriptionId: started.subscriptionId,
        userId: locked.ownerUserId
    });
    if (!window?.authorizationWindowEndsAt)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Authorization window missing after the card start'
        );
    const created = before?.subscription.id !== started.subscriptionId;
    if (created) {
        await getDb().transaction((tx) =>
            recordBillingConfigured({
                tx: tx as DrizzleClient,
                actor: input.actor,
                locked,
                paymentMethod: 'CARD',
                billingOptionId: input.billingOptionId,
                subscriptionId: started.subscriptionId,
                reason: input.reason,
                occurredAt: ports.clock.now()
            })
        );
    }
    return {
        paymentMethod: 'CARD',
        subscriptionId: started.subscriptionId,
        manualPaymentId: null,
        periodStart: null,
        checkoutUrl: started.checkoutUrl,
        authorizationWindowEndsAt: window.authorizationWindowEndsAt,
        created
    };
}

function assertAccepts(input: { readonly locked: Locked; readonly method: PlanPaymentMethod }) {
    if (acceptsPaymentMethod({ paymentMethods: input.locked.paymentMethods, method: input.method }))
        return;
    throw rejection(
        'PAYMENT_METHOD_NOT_ACCEPTED',
        ServiceErrorCode.VALIDATION_ERROR,
        `This plan does not accept ${input.method} payment`
    );
}

function assertActionPermission(actor: Actor): void {
    if (!isAdministrativeActionPermitted({ action: ACTION, actorPermissions: actor.permissions }))
        throw rejection('ADMINISTRATIVE_ACTION_FORBIDDEN', ServiceErrorCode.FORBIDDEN, 'Forbidden');
    if (isSystemActor(actor))
        throw rejection('ADMINISTRATIVE_ACTION_FORBIDDEN', ServiceErrorCode.FORBIDDEN, 'Forbidden');
}

function rejection(
    reason: PartnerBillingSetupRejection,
    code: ServiceErrorCode,
    message: string
): ServiceError {
    return new ServiceError(code, message, undefined, reason);
}
