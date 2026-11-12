import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { PlatformSettingsService } from '../../platformSettings/platform-settings.service';

export interface AddonPurchasesFreezePort {
    isFrozen(): Promise<boolean>;
}

export const platformAddonPurchasesFreeze: AddonPurchasesFreezePort = {
    isFrozen: () => new PlatformSettingsService({}).isAddonPurchasesFrozen()
};

/** Refuses only new addon purchases while the independent A1 freeze is on. */
export async function assertAddonPurchasesOpen(input: {
    readonly freeze: AddonPurchasesFreezePort;
}): Promise<void> {
    if (await input.freeze.isFrozen())
        throw new ServiceError(
            ServiceErrorCode.ADDON_PURCHASES_FROZEN,
            'Addon purchases are paused'
        );
}
