/** Closed MOT:1–MOT:24 reason enumeration (B3.md AC:B3:16), ordered by catalog number. */
export const RECONCILIATION_MARK_REASONS = [
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

/** One value of the closed MOT:1–MOT:24 catalog (B3.md AC:B3:16). */
export type ReconciliationMarkReason = (typeof RECONCILIATION_MARK_REASONS)[number];

/** Closed default proposals for MOT:1–MOT:24 (B3.md AC:B3:16). */
export const RECONCILIATION_MARK_DEFAULT_PROPOSALS = [
    'REFUND',
    'REFUND_DIFFERENCE',
    'NO_REFUND',
    'NONE'
] as const;

/** One default proposal in the closed MOT:1–MOT:24 catalog (B3.md AC:B3:16). */
export type ReconciliationMarkDefaultProposal =
    (typeof RECONCILIATION_MARK_DEFAULT_PROPOSALS)[number];

/** Closed per-reason metadata for MOT:1–MOT:24 (B3.md AC:B3:16). */
export const RECONCILIATION_MARK_REASON_CATALOG: Readonly<
    Record<
        ReconciliationMarkReason,
        {
            readonly number: number;
            readonly refundConfirmation: boolean;
            readonly defaultProposal: ReconciliationMarkDefaultProposal;
        }
    >
> = {
    REEMBOLSO_POR_CONFIRMAR: { number: 1, refundConfirmation: true, defaultProposal: 'REFUND' },
    COBRO_POSTERIOR_A_LA_BAJA: { number: 2, refundConfirmation: true, defaultProposal: 'REFUND' },
    COBRO_POSTERIOR_AL_GRANT: { number: 3, refundConfirmation: true, defaultProposal: 'REFUND' },
    PAGO_PENDIENTE_SIN_RAMA: { number: 4, refundConfirmation: false, defaultProposal: 'NONE' },
    DIVERGENCIA_DE_MONTO: { number: 5, refundConfirmation: false, defaultProposal: 'NONE' },
    TRANSICION_NO_DECLARADA: { number: 6, refundConfirmation: false, defaultProposal: 'NONE' },
    PAGO_TARDIO_RECHAZADO: { number: 7, refundConfirmation: true, defaultProposal: 'REFUND' },
    REANUDACION_NO_APLICADA: { number: 8, refundConfirmation: false, defaultProposal: 'NONE' },
    SUCESION_ABIERTA_SOBRE_FILA_MUERTA: {
        number: 9,
        refundConfirmation: false,
        defaultProposal: 'NONE'
    },
    FAN_OUT_DE_GRANT_INCOMPLETO: { number: 10, refundConfirmation: false, defaultProposal: 'NONE' },
    ADDON_SIN_APAGAR: { number: 11, refundConfirmation: false, defaultProposal: 'NONE' },
    COBRO_DURANTE_CORTESIA: { number: 12, refundConfirmation: true, defaultProposal: 'REFUND' },
    CORTESIA_SIN_RE_EMITIR: { number: 13, refundConfirmation: false, defaultProposal: 'NONE' },
    COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA: {
        number: 14,
        refundConfirmation: false,
        defaultProposal: 'NO_REFUND'
    },
    COMPLEMENTO_CON_PERIODO_COBRADO_POR_REVOCACION: {
        number: 15,
        refundConfirmation: true,
        defaultProposal: 'REFUND'
    },
    CANCELACION_SIN_CONFIRMAR: { number: 16, refundConfirmation: false, defaultProposal: 'NONE' },
    CONTRACARGO: { number: 17, refundConfirmation: false, defaultProposal: 'NONE' },
    REEMBOLSO_FUERA_DEL_FLUJO: { number: 18, refundConfirmation: false, defaultProposal: 'NONE' },
    COBRO_SIN_REGISTRAR: { number: 19, refundConfirmation: false, defaultProposal: 'NONE' },
    COBRO_DUPLICADO: { number: 20, refundConfirmation: true, defaultProposal: 'REFUND' },
    COBRO_DEL_PERIODO_SIN_RESOLVER: {
        number: 21,
        refundConfirmation: false,
        defaultProposal: 'NONE'
    },
    PAUSA_NO_APLICADA: { number: 22, refundConfirmation: false, defaultProposal: 'NONE' },
    ORDEN_PAGADA_SIN_INSTANCIA: { number: 23, refundConfirmation: true, defaultProposal: 'REFUND' },
    IMPORTE_COBRADO_DE_MAS: {
        number: 24,
        refundConfirmation: true,
        defaultProposal: 'REFUND_DIFFERENCE'
    }
};
