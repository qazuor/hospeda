import { z } from 'zod';
import { HostTradeBenefitTypeEnum } from './host-trade-benefit-type.enum.js';

export const HostTradeBenefitTypeEnumSchema = z.nativeEnum(HostTradeBenefitTypeEnum, {
    error: () => ({ message: 'zodError.enums.hostTradeBenefitType.invalid' })
});
