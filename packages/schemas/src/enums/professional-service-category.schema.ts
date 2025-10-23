import { z } from 'zod';
import { ProfessionalServiceCategoryEnum } from './professional-service-category.enum';

export const ProfessionalServiceCategorySchema = z.nativeEnum(ProfessionalServiceCategoryEnum, {
    message: 'zodError.enums.professionalServiceCategory.invalid'
});
