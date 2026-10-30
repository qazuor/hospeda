import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';

export const MIRROR_PAIR_IDS = [
    'RESUME_MIRROR',
    'PROVIDER_PAUSE_IS_ARREARS',
    'CANCELLED_ON_GRACE',
    'CANCELLED_ON_PAUSE',
    'CANCELLED_WHILE_PENDING',
    'LIVE_PREAPPROVAL_ON_CLOSED_ROW'
] as const;
export type MirrorPairId = (typeof MIRROR_PAIR_IDS)[number];

/**
 * Input of {@link MirrorDelegates.delegate} (HOS-1676 H-4).
 *
 * It carries instants and OUR columns only, never the provider status read as a string: a
 * decision receives the provider state through a read by id and nothing else (G17 (b)). The
 * pair already encodes which grid cell the re-read landed on.
 */
export interface MirrorDelegateInput {
    /** The grid cell the re-read landed on (`provider-notice-mirror.ts`). */
    readonly pair: MirrorPairId;
    /** The subscription row the provider link points at. */
    readonly subscriptionId: string;
    /** The instant of the read by id that produced the pair (`assertFreshForAct`'s `readAt`). */
    readonly readAt: Date;
    /**
     * `provider_link.cancelled_seen_at` as loaded BEFORE that read annotated or emptied it:
     * the re-read runs before the delegate, so the delegate can no longer read the previous
     * value from the database.
     */
    readonly cancelledSeenAt: Date | null;
}

/** The handlers of the grid cells that `B/03` §10.1 delegates (`DELEGATE` actions). */
export interface MirrorDelegates {
    delegate(input: MirrorDelegateInput): Promise<void>;
}

export const unregisteredMirrorDelegates: MirrorDelegates = {
    async delegate({ pair }) {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            `Mirror pair ${pair} is not registered`,
            undefined,
            'MIRROR_PAIR_NOT_REGISTERED'
        );
    }
};
