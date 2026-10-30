export interface QuotaWindow {
    readonly id: string;
    readonly opensAt: Date;
    readonly closesAt: Date;
    readonly consumed: number;
}

export interface QuotaWindowOperations {
    findLatest(): Promise<QuotaWindow | null>;
    insertWindow(input: { readonly opensAt: Date; readonly closesAt: Date }): Promise<QuotaWindow>;
    addConsumed(input: { readonly id: string; readonly amount: number }): Promise<QuotaWindow>;
}

/** Structural port: production receives quotaWindowModel without importing DB here. */
export interface QuotaWindowStore {
    withWindowLock<T>(input: {
        readonly userId: string;
        readonly vertical: string;
        readonly key: string;
        readonly run: (operations: QuotaWindowOperations) => Promise<T>;
    }): Promise<T>;
}

export type ConsumeQuotaResult =
    | { readonly status: 'NOT_METERED' }
    | { readonly status: 'EXHAUSTED'; readonly remaining: number }
    | { readonly status: 'CONSUMED'; readonly remaining: number; readonly window: QuotaWindow };
