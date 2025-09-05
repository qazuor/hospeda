// ✅ CONFIGURACIÓN CONSOLIDADA - EXPORTACIONES PRINCIPALES
export { createAccommodationConsolidatedConfig } from './accommodation-consolidated.config';

// ✅ SECCIONES INDIVIDUALES
export { createBasicInfoConsolidatedSection } from './sections/basic-info.consolidated';

// ✅ TIPOS CONSOLIDADOS
export type {
    ConfigMode,
    ConsolidatedEntityConfig,
    ConsolidatedFieldConfig,
    ConsolidatedSectionConfig,
    ModeSpecificFieldConfig,
    SectionFilterOptions
} from '../types/consolidated-config.types';

// ✅ UTILIDADES DE FILTRADO
export {
    filterFieldsByMode,
    filterSectionsByMode,
    getAvailableModes,
    validateConsolidatedConfig
} from '../utils/section-filter.utils';

// ✅ RE-EXPORTACIONES DE TIPOS COMUNES
export type { SelectOption } from '@/components/entity-form/types/field-config.types';
