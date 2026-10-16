import type { DrizzleClient, SelectDomainEvent, SelectReconciliationSummaryWindow } from '@repo/db';

export const RECONCILIATION_SUMMARY_TEMPLATE = 'billing.reconciliation-summary';
export const RECONCILIATION_SUMMARY_EVENT_TYPES = [
    'reconciliation.mark_opened',
    'reconciliation.mark_escalated',
    'reconciliation.undercharge_detected',
    'reconciliation.pause_gift_detected'
] as const;
export const RECONCILIATION_SUMMARY_LINE_CAP = 200;
export type SummarySubjectType = 'subscription' | 'addon_instance';
export interface ReconciliationSummaryPayload {
    readonly windowId: string;
    readonly coversFrom: string;
    readonly closesAt: string;
    readonly windowMinutes: number;
    readonly totals: { readonly events: number };
    readonly marks: readonly {
        readonly reason: string;
        readonly subjectType: SummarySubjectType;
        readonly subjectId: string;
        readonly count: number;
    }[];
    readonly escalations: readonly {
        readonly reason: string;
        readonly subjectType: SummarySubjectType;
        readonly subjectId: string;
        readonly markId: string;
    }[];
    readonly underCharges: readonly {
        readonly subscriptionId: string;
        readonly paymentId: string;
        readonly currency: string;
        readonly expectedMinor: number;
        readonly chargedMinor: number;
        readonly differenceMinor: number;
    }[];
    readonly pauseGifts: readonly {
        readonly subscriptionId: string;
        readonly pauseId: string;
        readonly pauseStartedAt: string;
        readonly pauseEndedAt: string;
        readonly skippedChargeAt: string;
        readonly nextChargeAfterReturnAt: string;
        readonly giftDays: number;
    }[];
    readonly omitted: {
        readonly marks: number;
        readonly escalations: number;
        readonly underCharges: number;
        readonly pauseGifts: number;
    };
}
export interface SummaryRecipients {
    list(input?: {
        readonly tx?: DrizzleClient;
    }): Promise<readonly { userId: string; email: string }[]>;
}
export const defaultSummaryRecipients: SummaryRecipients = {
    // Lazy DB resolution keeps package barrel imports side-effect free, matching renewal-notice.ts.
    async list(input) {
        const { listSuperAdminRecipients } = await import('@repo/db');
        return listSuperAdminRecipients(input);
    }
};
export type SummaryTickOutcome = 'IDLE' | 'WINDOW_OPENED' | 'WAITING' | 'NO_RECIPIENTS' | 'SENT';
export type SummaryWindow = SelectReconciliationSummaryWindow;
export type SummaryEvent = SelectDomainEvent;
