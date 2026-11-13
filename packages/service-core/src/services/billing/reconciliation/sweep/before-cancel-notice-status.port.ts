import type { CancelOurAuthorizationNoticeKind } from '../cancel-our-authorization.js';

/** State of the deciding transition's notice, read without enqueueing; outbox `failed` is UNDELIVERABLE. */
export type BeforeCancelNoticeState = 'SENT' | 'UNDELIVERABLE' | 'PENDING' | 'ABSENT';

/** Status of one before-cancel notice. */
export interface BeforeCancelNoticeStatus {
    readonly state: BeforeCancelNoticeState;
    /** Milliseconds since settlement, measured by the database clock; null when absent. */
    readonly settledAgeMs: number | null;
}

/** Reads the notice with its default retry occurrence (the subscription id), without enqueueing. */
export interface BeforeCancelNoticeStatusReader {
    read(input: {
        readonly subscriptionId: string;
        readonly userId: string;
        readonly kind: CancelOurAuthorizationNoticeKind;
    }): Promise<BeforeCancelNoticeStatus>;
}
