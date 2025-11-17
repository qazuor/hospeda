import { z } from 'zod';
import { BenefitCategoryEnum } from './benefit-category.enum';

export const BenefitCategorySchema = z.nativeEnum(BenefitCategoryEnum, {
    message: 'zodError.enums.benefitCategory.invalid'
});
