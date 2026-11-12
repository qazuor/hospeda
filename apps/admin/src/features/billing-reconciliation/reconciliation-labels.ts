import type { TranslationKey } from '@repo/i18n';
import type {
    AdminSubscriptionStatusSchema,
    ReconciliationAddonInstanceStatusValue,
    ReconciliationEventActorTypeValue,
    ReconciliationManualPaymentStatusValue,
    ReconciliationMarkOutcomeValue,
    ReconciliationMarkReasonValue,
    ReconciliationPaymentStatusValue
} from '@repo/schemas';

/** Translation keys for reconciliation mark reasons. */
export const RECONCILIATION_REASON_KEYS: Readonly<
    Record<ReconciliationMarkReasonValue, TranslationKey>
> = {
    REEMBOLSO_POR_CONFIRMAR: 'admin-billing.reconciliationMarks.reasons.REEMBOLSO_POR_CONFIRMAR',
    COBRO_POSTERIOR_A_LA_BAJA:
        'admin-billing.reconciliationMarks.reasons.COBRO_POSTERIOR_A_LA_BAJA',
    COBRO_POSTERIOR_AL_GRANT: 'admin-billing.reconciliationMarks.reasons.COBRO_POSTERIOR_AL_GRANT',
    PAGO_PENDIENTE_SIN_RAMA: 'admin-billing.reconciliationMarks.reasons.PAGO_PENDIENTE_SIN_RAMA',
    DIVERGENCIA_DE_MONTO: 'admin-billing.reconciliationMarks.reasons.DIVERGENCIA_DE_MONTO',
    TRANSICION_NO_DECLARADA: 'admin-billing.reconciliationMarks.reasons.TRANSICION_NO_DECLARADA',
    PAGO_TARDIO_RECHAZADO: 'admin-billing.reconciliationMarks.reasons.PAGO_TARDIO_RECHAZADO',
    REANUDACION_NO_APLICADA: 'admin-billing.reconciliationMarks.reasons.REANUDACION_NO_APLICADA',
    SUCESION_ABIERTA_SOBRE_FILA_MUERTA:
        'admin-billing.reconciliationMarks.reasons.SUCESION_ABIERTA_SOBRE_FILA_MUERTA',
    FAN_OUT_DE_GRANT_INCOMPLETO:
        'admin-billing.reconciliationMarks.reasons.FAN_OUT_DE_GRANT_INCOMPLETO',
    ADDON_SIN_APAGAR: 'admin-billing.reconciliationMarks.reasons.ADDON_SIN_APAGAR',
    COBRO_DURANTE_CORTESIA: 'admin-billing.reconciliationMarks.reasons.COBRO_DURANTE_CORTESIA',
    CORTESIA_SIN_RE_EMITIR: 'admin-billing.reconciliationMarks.reasons.CORTESIA_SIN_RE_EMITIR',
    COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA:
        'admin-billing.reconciliationMarks.reasons.COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA',
    COMPLEMENTO_CON_PERIODO_COBRADO_POR_REVOCACION:
        'admin-billing.reconciliationMarks.reasons.COMPLEMENTO_CON_PERIODO_COBRADO_POR_REVOCACION',
    CANCELACION_SIN_CONFIRMAR:
        'admin-billing.reconciliationMarks.reasons.CANCELACION_SIN_CONFIRMAR',
    CONTRACARGO: 'admin-billing.reconciliationMarks.reasons.CONTRACARGO',
    REEMBOLSO_FUERA_DEL_FLUJO:
        'admin-billing.reconciliationMarks.reasons.REEMBOLSO_FUERA_DEL_FLUJO',
    COBRO_SIN_REGISTRAR: 'admin-billing.reconciliationMarks.reasons.COBRO_SIN_REGISTRAR',
    COBRO_DUPLICADO: 'admin-billing.reconciliationMarks.reasons.COBRO_DUPLICADO',
    COBRO_DEL_PERIODO_SIN_RESOLVER:
        'admin-billing.reconciliationMarks.reasons.COBRO_DEL_PERIODO_SIN_RESOLVER',
    PAUSA_NO_APLICADA: 'admin-billing.reconciliationMarks.reasons.PAUSA_NO_APLICADA',
    ORDEN_PAGADA_SIN_INSTANCIA:
        'admin-billing.reconciliationMarks.reasons.ORDEN_PAGADA_SIN_INSTANCIA',
    IMPORTE_COBRADO_DE_MAS: 'admin-billing.reconciliationMarks.reasons.IMPORTE_COBRADO_DE_MAS'
};

type SubscriptionStatus = (typeof AdminSubscriptionStatusSchema)['options'][number];
/** Translation keys for subscription statuses. */
export const RECONCILIATION_SUBSCRIPTION_STATUS_KEYS: Readonly<
    Record<SubscriptionStatus, TranslationKey>
> = {
    PENDING_AUTHORIZATION: 'admin-billing.subscriptionAdmin.statuses.PENDING_AUTHORIZATION',
    ABANDONED: 'admin-billing.subscriptionAdmin.statuses.ABANDONED',
    ACTIVE: 'admin-billing.subscriptionAdmin.statuses.ACTIVE',
    GRACE_PERIOD: 'admin-billing.subscriptionAdmin.statuses.GRACE_PERIOD',
    PAUSED: 'admin-billing.subscriptionAdmin.statuses.PAUSED',
    SUSPENDED: 'admin-billing.subscriptionAdmin.statuses.SUSPENDED',
    CANCEL_SCHEDULED: 'admin-billing.subscriptionAdmin.statuses.CANCEL_SCHEDULED',
    CANCELLED: 'admin-billing.subscriptionAdmin.statuses.CANCELLED',
    CHARGE_DECLINED: 'admin-billing.subscriptionAdmin.statuses.CHARGE_DECLINED'
};
/** Translation keys for add-on statuses. */
export const RECONCILIATION_ADDON_STATUS_KEYS: Readonly<
    Record<ReconciliationAddonInstanceStatusValue, TranslationKey>
> = {
    PENDING_AUTHORIZATION: 'admin-billing.reconciliationMarks.addonStatuses.PENDING_AUTHORIZATION',
    ACTIVE: 'admin-billing.reconciliationMarks.addonStatuses.ACTIVE',
    ABANDONED: 'admin-billing.reconciliationMarks.addonStatuses.ABANDONED',
    EXPIRED: 'admin-billing.reconciliationMarks.addonStatuses.EXPIRED',
    CANCELLED: 'admin-billing.reconciliationMarks.addonStatuses.CANCELLED'
};
/** Translation keys for provider payment statuses. */
export const RECONCILIATION_PAYMENT_STATUS_KEYS: Readonly<
    Record<ReconciliationPaymentStatusValue, TranslationKey>
> = {
    PENDING: 'admin-billing.reconciliationMarks.paymentStatuses.PENDING',
    SUCCEEDED: 'admin-billing.reconciliationMarks.paymentStatuses.SUCCEEDED',
    FAILED: 'admin-billing.reconciliationMarks.paymentStatuses.FAILED',
    PARTIALLY_REFUNDED: 'admin-billing.reconciliationMarks.paymentStatuses.PARTIALLY_REFUNDED',
    REFUNDED: 'admin-billing.reconciliationMarks.paymentStatuses.REFUNDED',
    CHARGED_BACK: 'admin-billing.reconciliationMarks.paymentStatuses.CHARGED_BACK'
};
/** Translation keys for manual payment statuses. */
export const RECONCILIATION_MANUAL_PAYMENT_STATUS_KEYS: Readonly<
    Record<ReconciliationManualPaymentStatusValue, TranslationKey>
> = {
    AWAITING: 'admin-billing.reconciliationMarks.manualPaymentStatuses.AWAITING',
    REGISTERED: 'admin-billing.reconciliationMarks.manualPaymentStatuses.REGISTERED',
    DECLARED_UNPAID: 'admin-billing.reconciliationMarks.manualPaymentStatuses.DECLARED_UNPAID'
};
type SubjectKind = 'SUBSCRIPTION' | 'ADDON_INSTANCE';
/** Translation keys for reconciliation subject kinds. */
export const RECONCILIATION_SUBJECT_KIND_KEYS: Readonly<Record<SubjectKind, TranslationKey>> = {
    SUBSCRIPTION: 'admin-billing.reconciliationMarks.subjectKinds.SUBSCRIPTION',
    ADDON_INSTANCE: 'admin-billing.reconciliationMarks.subjectKinds.ADDON_INSTANCE'
};
/** Translation keys for event actor types. */
export const RECONCILIATION_ACTOR_TYPE_KEYS: Readonly<
    Record<ReconciliationEventActorTypeValue, TranslationKey>
> = {
    owner: 'admin-billing.reconciliationMarks.actorTypes.owner',
    admin: 'admin-billing.reconciliationMarks.actorTypes.admin',
    job: 'admin-billing.reconciliationMarks.actorTypes.job',
    provider: 'admin-billing.reconciliationMarks.actorTypes.provider'
};
/** Translation keys for mark opening outcomes. */
export const RECONCILIATION_OUTCOME_KEYS: Readonly<
    Record<ReconciliationMarkOutcomeValue, TranslationKey>
> = {
    OPENED: 'admin-billing.reconciliationMarks.outcomes.OPENED',
    ACCUMULATED: 'admin-billing.reconciliationMarks.outcomes.ACCUMULATED'
};

type Translate = (key: TranslationKey) => string;
function hasKey<K extends string>(
    map: Readonly<Record<K, TranslationKey>>,
    value: string
): value is K {
    return Object.hasOwn(map, value);
}

/** Human label for a closed value; unknown API strings remain visible. */
export function reconciliationLabel<K extends string>(input: {
    readonly map: Readonly<Record<K, TranslationKey>>;
    readonly value: string;
    readonly t: Translate;
}): string {
    return hasKey(input.map, input.value) ? input.t(input.map[input.value]) : input.value;
}

/** Human label for a subject status, including unresolved subjects. */
export function reconciliationSubjectStatusLabel(input: {
    readonly kind: SubjectKind;
    readonly status: string | null;
    readonly t: Translate;
}): string {
    if (input.status === null)
        return input.t('admin-billing.reconciliationMarks.subjectUnresolved');
    if (input.kind === 'SUBSCRIPTION')
        return reconciliationLabel({
            map: RECONCILIATION_SUBSCRIPTION_STATUS_KEYS,
            value: input.status,
            t: input.t
        });
    return reconciliationLabel({
        map: RECONCILIATION_ADDON_STATUS_KEYS,
        value: input.status,
        t: input.t
    });
}

/** Human label for the payment status selected by its ledger source. */
export function reconciliationPaymentStatusLabel(input: {
    readonly source: 'PAYMENT' | 'MANUAL_PAYMENT';
    readonly status: string;
    readonly t: Translate;
}): string {
    if (input.source === 'PAYMENT')
        return reconciliationLabel({
            map: RECONCILIATION_PAYMENT_STATUS_KEYS,
            value: input.status,
            t: input.t
        });
    return reconciliationLabel({
        map: RECONCILIATION_MANUAL_PAYMENT_STATUS_KEYS,
        value: input.status,
        t: input.t
    });
}
