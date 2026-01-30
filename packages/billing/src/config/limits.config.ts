import { LimitKey } from '../types/plan.types.js';

/**
 * All limit definitions for the Hospeda billing system.
 * Values are defined per plan in plans.config.ts.
 * This file defines the metadata for each limit key.
 */
export const LIMIT_METADATA: Record<LimitKey, { name: string; description: string }> = {
    [LimitKey.MAX_ACCOMMODATIONS]: {
        name: 'Alojamientos maximos',
        description: 'Numero maximo de alojamientos que se pueden publicar'
    },
    [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: {
        name: 'Fotos por alojamiento',
        description: 'Numero maximo de fotos por alojamiento'
    },
    [LimitKey.MAX_ACTIVE_PROMOTIONS]: {
        name: 'Promociones activas',
        description: 'Numero maximo de promociones activas simultaneamente'
    },
    [LimitKey.MAX_FAVORITES]: {
        name: 'Favoritos',
        description: 'Numero maximo de alojamientos guardados como favoritos'
    },
    [LimitKey.MAX_PROPERTIES]: {
        name: 'Propiedades',
        description: 'Numero maximo de propiedades en un complejo'
    },
    [LimitKey.MAX_STAFF_ACCOUNTS]: {
        name: 'Cuentas de personal',
        description: 'Numero maximo de cuentas de personal por complejo'
    }
};
