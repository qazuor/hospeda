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

export interface MirrorDelegates {
    delegate(input: {
        readonly pair: MirrorPairId;
        readonly subscriptionId: string;
    }): Promise<void>;
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
