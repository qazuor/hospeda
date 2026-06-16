/**
 * Host Trade Category Enum
 * Categories of local tradespeople / service providers listed in the
 * admin-curated host trades directory (SPEC-241).
 *
 * Used to classify each `host_trades` entry so hosts can filter the directory
 * by the kind of service they need (e.g. an emergency locksmith or plumber).
 */
export enum HostTradeCategoryEnum {
    CERRAJERIA = 'CERRAJERIA',
    PLOMERIA = 'PLOMERIA',
    ELECTRICIDAD = 'ELECTRICIDAD',
    GAS = 'GAS',
    CLIMATIZACION = 'CLIMATIZACION',
    LIMPIEZA = 'LIMPIEZA',
    FLETES = 'FLETES',
    VIDRIERIA = 'VIDRIERIA',
    CARPINTERIA = 'CARPINTERIA',
    PILETA_JARDIN = 'PILETA_JARDIN',
    PLAGAS = 'PLAGAS',
    INTERNET = 'INTERNET',
    ALBANILERIA = 'ALBANILERIA'
}
