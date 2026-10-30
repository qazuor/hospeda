import type { ReconciliationMarkReason } from '@repo/db';

/**
 * Read-time context of the reconciliation summary mail (HOS-1971).
 *
 * The stored payload stays a list of ids. Everything in this module is resolved
 * when the mail is rendered and is optional by design: a subject that could not
 * be resolved renders exactly as the bare payload line did before.
 */

/** Everything the mail can say about one subscription. */
export interface ReconciliationSubscriptionDetail {
    /** Holder's display name, or null when the account has none. */
    readonly holderName: string | null;
    /** Holder's email, or null when the account is gone. */
    readonly holderEmail: string | null;
    /** Vertical id (`VerticalEnum` value). */
    readonly vertical: string | null;
    /** Plan display name. */
    readonly planName: string | null;
    /** Billing cycle (`monthly`, `quarterly`, `semiannual`, `annual`). */
    readonly cycle: string | null;
    /** Amount of the pinned billing option, in integer centavos. */
    readonly amountMinor: number | null;
    /** ISO currency code of the amount. */
    readonly currency: string | null;
    /** Subscription status constant. */
    readonly status: string;
    /** Names of the listings the holder has in this vertical. */
    readonly listingNames: readonly string[];
}

/** Everything the mail can say about one add-on instance. */
export interface ReconciliationAddonDetail {
    readonly holderName: string | null;
    readonly holderEmail: string | null;
    /** Add-on display name. */
    readonly addonName: string | null;
    /** Add-on instance status constant. */
    readonly status: string;
}

/** The open mark behind a (subject, reason) line. */
export interface ReconciliationOpenMark {
    readonly markId: string;
    /** ISO instant the mark was placed. */
    readonly placedAt: string;
}

/** Resolved details keyed by id, plus the environment the mail comes from. */
export interface ReconciliationSummaryContext {
    /** Marker of a non-production environment, e.g. `STAGING`. Absent in production. */
    readonly environmentLabel?: string;
    /** Base URL of the admin panel, without a trailing slash. Absent: no links. */
    readonly adminUrl?: string;
    readonly subscriptions: ReadonlyMap<string, ReconciliationSubscriptionDetail>;
    readonly addonInstances: ReadonlyMap<string, ReconciliationAddonDetail>;
    /** Keyed by {@link openMarkKey}. */
    readonly openMarks: ReadonlyMap<string, ReconciliationOpenMark>;
}

/** What a reader must look up for a summary payload. */
export interface ReconciliationSubjectLookup {
    readonly subscriptionIds: readonly string[];
    readonly addonInstanceIds: readonly string[];
}

/**
 * Batched reader of the subjects named by one summary. One call per mail,
 * never one per line. It may throw: the renderer falls back to the bare lines.
 */
export type ReconciliationSubjectsReader = (
    input: ReconciliationSubjectLookup
) => Promise<Pick<ReconciliationSummaryContext, 'subscriptions' | 'addonInstances' | 'openMarks'>>;

/** Key of an open mark in {@link ReconciliationSummaryContext.openMarks}. */
export function openMarkKey(input: {
    readonly subjectId: string;
    readonly reason: string;
}): string {
    return `${input.subjectId}|${input.reason}`;
}

/** Reason in plain words and the one-line next step for staff. */
export interface ReconciliationReasonCopy {
    readonly label: string;
    readonly action: string;
}

/**
 * Human copy per closed reason. Notification templates do not use `@repo/i18n`
 * (owner decision, 2026-09-01), so the Spanish text lives here, typed over the
 * closed catalog: a new reason without copy fails the typecheck.
 */
export const RECONCILIATION_REASON_COPY: Readonly<
    Record<ReconciliationMarkReason, ReconciliationReasonCopy>
> = {
    REEMBOLSO_POR_CONFIRMAR: {
        label: 'Reembolso pendiente de confirmar',
        action: 'Confirmá en el panel si la plata ya se devolvió al cliente.'
    },
    COBRO_POSTERIOR_A_LA_BAJA: {
        label: 'Se cobró después de la baja',
        action: 'Revisá el cobro y devolvelo si corresponde.'
    },
    COBRO_POSTERIOR_AL_GRANT: {
        label: 'Se cobró sobre un beneficio permanente',
        action: 'Revisá el cobro y devolvelo si corresponde.'
    },
    PAGO_PENDIENTE_SIN_RAMA: {
        label: 'Pago pendiente que no sigue ningún camino',
        action: 'Mirá el pago en el proveedor y resolvelo a mano.'
    },
    DIVERGENCIA_DE_MONTO: {
        label: 'El monto cobrado no coincide con el esperado',
        action: 'Compará lo cobrado con el plan y devolvé o corregí la diferencia.'
    },
    TRANSICION_NO_DECLARADA: {
        label: 'Cambio de estado que el sistema no esperaba',
        action: 'Revisá los eventos de la marca para ver qué pasó.'
    },
    PAGO_TARDIO_RECHAZADO: {
        label: 'Pago tardío rechazado',
        action: 'Verificá si el cliente sigue con acceso y contactalo si hace falta.'
    },
    REANUDACION_NO_APLICADA: {
        label: 'La reanudación de la pausa no se aplicó',
        action: 'Reanudá la suscripción a mano desde el panel.'
    },
    SUCESION_ABIERTA_SOBRE_FILA_MUERTA: {
        label: 'Cambio de plan abierto sobre una suscripción ya cerrada',
        action: 'Revisá el cambio de plan y cerralo o rehacelo.'
    },
    FAN_OUT_DE_GRANT_INCOMPLETO: {
        label: 'El beneficio permanente no llegó a todas las fichas',
        action: 'Revisá qué fichas quedaron sin el beneficio y reintentá.'
    },
    ADDON_SIN_APAGAR: {
        label: 'Un complemento quedó encendido sin corresponder',
        action: 'Apagá el complemento desde el panel.'
    },
    COBRO_DURANTE_CORTESIA: {
        label: 'Se cobró durante una cortesía',
        action: 'Devolvé el cobro al cliente.'
    },
    CORTESIA_SIN_RE_EMITIR: {
        label: 'Una cortesía no se volvió a emitir',
        action: 'Volvé a emitir la cortesía desde el panel.'
    },
    COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA: {
        label: 'Complemento con un período ya cobrado por otra causa',
        action: 'Decidí en el panel si se devuelve el período duplicado.'
    },
    COMPLEMENTO_CON_PERIODO_COBRADO_POR_REVOCACION: {
        label: 'Complemento con un período ya cobrado antes de una revocación',
        action: 'Decidí en el panel si se devuelve el período.'
    },
    CANCELACION_SIN_CONFIRMAR: {
        label: 'Cancelación que el proveedor no confirmó',
        action: 'Verificá en el proveedor que la suscripción esté cancelada.'
    },
    CONTRACARGO: {
        label: 'Contracargo recibido',
        action: 'Respondé el contracargo en el panel del proveedor dentro del plazo.'
    },
    REEMBOLSO_FUERA_DEL_FLUJO: {
        label: 'Reembolso hecho por fuera de Hospeda',
        action: 'Asentalo en el panel para que los números cierren.'
    },
    COBRO_SIN_REGISTRAR: {
        label: 'Cobro del proveedor que Hospeda no registró',
        action: 'Buscá el cobro en el proveedor y registralo o devolvelo.'
    },
    COBRO_DUPLICADO: {
        label: 'Cobro duplicado',
        action: 'Devolvé el segundo cobro al cliente.'
    },
    COBRO_DEL_PERIODO_SIN_RESOLVER: {
        label: 'Cobro del período sin resolver',
        action: 'Revisá si el período quedó cubierto y resolvelo a mano.'
    },
    PAUSA_NO_APLICADA: {
        label: 'La pausa no se aplicó',
        action: 'Aplicá la pausa a mano o avisá al cliente.'
    },
    ORDEN_PAGADA_SIN_INSTANCIA: {
        label: 'Orden pagada sin complemento creado',
        action: 'Creá el complemento a mano o devolvé la orden.'
    },
    IMPORTE_COBRADO_DE_MAS: {
        label: 'Se cobró de más',
        action: 'Devolvé la diferencia al cliente.'
    }
};

/**
 * Plain-words copy of a reason, or null when the constant is not in the closed
 * catalog (the caller then prints the constant as it did before).
 */
export function reconciliationReasonCopy(reason: string): ReconciliationReasonCopy | null {
    return Object.hasOwn(RECONCILIATION_REASON_COPY, reason)
        ? RECONCILIATION_REASON_COPY[reason as ReconciliationMarkReason]
        : null;
}

/** First 8 characters of an id, for support reference. */
export function shortId(id: string): string {
    return id.slice(0, 8);
}
