import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { PlatformSettingsService } from '../../platformSettings/platform-settings.service';

/** Answers whether new self-service paid signups are paused (HOS-1749). */
export interface PaidSignupsFreezePort {
    isFrozen(): Promise<boolean>;
}

/** The production port reads the global setting on every call. */
export const platformPaidSignupsFreeze: PaidSignupsFreezePort = {
    isFrozen: () => new PlatformSettingsService({}).isNewPaidSignupsFrozen()
};

/**
 * Refuses a new self-service paid signup while the freeze is on (HOS-1749,
 * owner PM-581). Callers run it before any side effect.
 *
 * @param input.freeze - The port to ask.
 * @throws {ServiceError} `NEW_PAID_SIGNUPS_FROZEN` (409) while frozen.
 */
export async function assertNewPaidSignupsOpen(input: {
    readonly freeze: PaidSignupsFreezePort;
}): Promise<void> {
    if (await input.freeze.isFrozen()) {
        throw new ServiceError(
            ServiceErrorCode.NEW_PAID_SIGNUPS_FROZEN,
            'New paid signups are paused'
        );
    }
}
