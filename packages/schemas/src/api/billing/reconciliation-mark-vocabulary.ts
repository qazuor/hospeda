/**
 * Closed vocabularies translated by the admin reconciliation panel (HOS-1761).
 * @repo/db owns persisted values; the parity test keeps these copies aligned.
 */
export const RECONCILIATION_MARK_REASON_VALUES = [
    'REEMBOLSO_POR_CONFIRMAR',
    'COBRO_POSTERIOR_A_LA_BAJA',
    'COBRO_POSTERIOR_AL_GRANT',
    'PAGO_PENDIENTE_SIN_RAMA',
    'DIVERGENCIA_DE_MONTO',
    'TRANSICION_NO_DECLARADA',
    'PAGO_TARDIO_RECHAZADO',
    'REANUDACION_NO_APLICADA',
    'SUCESION_ABIERTA_SOBRE_FILA_MUERTA',
    'FAN_OUT_DE_GRANT_INCOMPLETO',
    'ADDON_SIN_APAGAR',
    'COBRO_DURANTE_CORTESIA',
    'CORTESIA_SIN_RE_EMITIR',
    'COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA',
    'COMPLEMENTO_CON_PERIODO_COBRADO_POR_REVOCACION',
    'CANCELACION_SIN_CONFIRMAR',
    'CONTRACARGO',
    'REEMBOLSO_FUERA_DEL_FLUJO',
    'COBRO_SIN_REGISTRAR',
    'COBRO_DUPLICADO',
    'COBRO_DEL_PERIODO_SIN_RESOLVER',
    'PAUSA_NO_APLICADA',
    'ORDEN_PAGADA_SIN_INSTANCIA',
    'IMPORTE_COBRADO_DE_MAS'
] as const;
/** One reconciliation mark reason (MOT:1-MOT:24). */
export type ReconciliationMarkReasonValue = (typeof RECONCILIATION_MARK_REASON_VALUES)[number];

/** Closed add-on instance statuses shown by reconciliation. */
export const RECONCILIATION_ADDON_INSTANCE_STATUS_VALUES = [
    'PENDING_AUTHORIZATION',
    'ACTIVE',
    'ABANDONED',
    'EXPIRED',
    'CANCELLED'
] as const;
/** One add-on instance status shown by reconciliation. */
export type ReconciliationAddonInstanceStatusValue =
    (typeof RECONCILIATION_ADDON_INSTANCE_STATUS_VALUES)[number];

/** Closed provider payment statuses shown by reconciliation. */
export const RECONCILIATION_PAYMENT_STATUS_VALUES = [
    'PENDING',
    'SUCCEEDED',
    'FAILED',
    'PARTIALLY_REFUNDED',
    'REFUNDED',
    'CHARGED_BACK'
] as const;
/** One provider payment status shown by reconciliation. */
export type ReconciliationPaymentStatusValue =
    (typeof RECONCILIATION_PAYMENT_STATUS_VALUES)[number];

/** Closed manual payment statuses shown by reconciliation. */
export const RECONCILIATION_MANUAL_PAYMENT_STATUS_VALUES = [
    'AWAITING',
    'REGISTERED',
    'DECLARED_UNPAID'
] as const;
/** One manual payment status shown by reconciliation. */
export type ReconciliationManualPaymentStatusValue =
    (typeof RECONCILIATION_MANUAL_PAYMENT_STATUS_VALUES)[number];

/** Closed actor types shown in reconciliation events. */
export const RECONCILIATION_EVENT_ACTOR_TYPE_VALUES = [
    'owner',
    'admin',
    'job',
    'provider'
] as const;
/** One actor type shown in reconciliation events. */
export type ReconciliationEventActorTypeValue =
    (typeof RECONCILIATION_EVENT_ACTOR_TYPE_VALUES)[number];

/** Outcomes produced when a reconciliation mark is opened. */
export const RECONCILIATION_MARK_OUTCOME_VALUES = ['OPENED', 'ACCUMULATED'] as const;
/** One reconciliation mark opening outcome. */
export type ReconciliationMarkOutcomeValue = (typeof RECONCILIATION_MARK_OUTCOME_VALUES)[number];
