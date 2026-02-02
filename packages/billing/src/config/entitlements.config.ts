import { type EntitlementDefinition, EntitlementKey } from '../types/entitlement.types.js';

/**
 * All entitlement definitions for the Hospeda billing system
 */
export const ENTITLEMENT_DEFINITIONS: EntitlementDefinition[] = [
    // Owner entitlements
    {
        key: EntitlementKey.PUBLISH_ACCOMMODATIONS,
        name: 'Publicar alojamientos',
        description: 'Permite publicar alojamientos en la plataforma'
    },
    {
        key: EntitlementKey.EDIT_ACCOMMODATION_INFO,
        name: 'Editar informacion de alojamiento',
        description: 'Permite editar la informacion de alojamientos propios'
    },
    {
        key: EntitlementKey.VIEW_BASIC_STATS,
        name: 'Estadisticas basicas',
        description: 'Acceso a estadisticas basicas de visitas y reservas'
    },
    {
        key: EntitlementKey.VIEW_ADVANCED_STATS,
        name: 'Estadisticas avanzadas',
        description: 'Acceso a estadisticas avanzadas con graficos y tendencias'
    },
    {
        key: EntitlementKey.RESPOND_REVIEWS,
        name: 'Responder resenas',
        description: 'Permite responder a las resenas de huespedes'
    },
    {
        key: EntitlementKey.PRIORITY_SUPPORT,
        name: 'Soporte prioritario',
        description: 'Acceso a soporte prioritario con tiempos de respuesta reducidos'
    },
    {
        key: EntitlementKey.FEATURED_LISTING,
        name: 'Listado destacado',
        description: 'El alojamiento aparece destacado en los resultados de busqueda'
    },
    {
        key: EntitlementKey.CUSTOM_BRANDING,
        name: 'Marca personalizada',
        description: 'Permite personalizar la apariencia del listado con marca propia'
    },
    {
        key: EntitlementKey.API_ACCESS,
        name: 'Acceso API',
        description: 'Acceso a la API para integraciones con sistemas externos'
    },
    {
        key: EntitlementKey.DEDICATED_MANAGER,
        name: 'Gestor dedicado',
        description: 'Un gestor de cuenta dedicado para asistencia personalizada'
    },
    {
        key: EntitlementKey.CREATE_PROMOTIONS,
        name: 'Crear promociones',
        description: 'Permite crear promociones exclusivas para turistas VIP'
    },
    {
        key: EntitlementKey.SOCIAL_MEDIA_INTEGRATION,
        name: 'Integracion redes sociales',
        description: 'Publicacion automatica en redes sociales'
    },
    // Complex entitlements
    {
        key: EntitlementKey.MULTI_PROPERTY_MANAGEMENT,
        name: 'Gestion multi-propiedad',
        description: 'Permite gestionar multiples propiedades desde una sola cuenta'
    },
    {
        key: EntitlementKey.CONSOLIDATED_ANALYTICS,
        name: 'Analiticas consolidadas',
        description: 'Panel de analiticas unificado para todas las propiedades'
    },
    {
        key: EntitlementKey.CENTRALIZED_BOOKING,
        name: 'Reservas centralizadas',
        description: 'Sistema centralizado de reservas para todas las propiedades'
    },
    {
        key: EntitlementKey.STAFF_MANAGEMENT,
        name: 'Gestion de personal',
        description: 'Permite crear y gestionar cuentas de personal'
    },
    {
        key: EntitlementKey.WHITE_LABEL,
        name: 'Marca blanca',
        description: 'Experiencia de marca blanca completa'
    },
    {
        key: EntitlementKey.MULTI_CHANNEL_INTEGRATION,
        name: 'Integracion multi-canal',
        description: 'Sincronizacion con OTAs y canales de venta externos'
    },
    // Tourist entitlements
    {
        key: EntitlementKey.SAVE_FAVORITES,
        name: 'Guardar favoritos',
        description: 'Permite guardar alojamientos como favoritos'
    },
    {
        key: EntitlementKey.WRITE_REVIEWS,
        name: 'Escribir resenas',
        description: 'Permite escribir resenas de alojamientos'
    },
    {
        key: EntitlementKey.READ_REVIEWS,
        name: 'Leer resenas',
        description: 'Acceso a leer resenas de otros huespedes'
    },
    {
        key: EntitlementKey.AD_FREE,
        name: 'Sin publicidad',
        description: 'Experiencia sin anuncios publicitarios'
    },
    {
        key: EntitlementKey.PRICE_ALERTS,
        name: 'Alertas de precio',
        description: 'Notificaciones cuando bajan los precios de alojamientos favoritos'
    },
    {
        key: EntitlementKey.EARLY_ACCESS_EVENTS,
        name: 'Acceso anticipado a eventos',
        description: 'Acceso prioritario a entradas para eventos'
    },
    {
        key: EntitlementKey.EXCLUSIVE_DEALS,
        name: 'Ofertas exclusivas',
        description: 'Acceso a ofertas y descuentos exclusivos'
    },
    {
        key: EntitlementKey.VIP_SUPPORT,
        name: 'Soporte VIP',
        description: 'Canal de soporte VIP dedicado'
    },
    {
        key: EntitlementKey.CONCIERGE_SERVICE,
        name: 'Servicio de conserje',
        description: 'Servicio de conserje personalizado para planificar viajes'
    },
    {
        key: EntitlementKey.AIRPORT_TRANSFERS,
        name: 'Transfers aeropuerto',
        description: 'Coordinacion de transfers al aeropuerto incluida'
    },
    {
        key: EntitlementKey.VIP_PROMOTIONS_ACCESS,
        name: 'Acceso a promociones VIP',
        description: 'Acceso a promociones exclusivas creadas por alojamientos'
    },
    {
        key: EntitlementKey.CAN_COMPARE_ACCOMMODATIONS,
        name: 'Comparar alojamientos',
        description: 'Permite comparar multiples alojamientos lado a lado'
    },
    {
        key: EntitlementKey.CAN_ATTACH_REVIEW_PHOTOS,
        name: 'Adjuntar fotos a resenas',
        description: 'Permite agregar fotografias a las resenas de alojamientos'
    },
    {
        key: EntitlementKey.CAN_VIEW_SEARCH_HISTORY,
        name: 'Ver historial de busqueda',
        description: 'Acceso al historial de busquedas realizadas'
    },
    {
        key: EntitlementKey.CAN_VIEW_RECOMMENDATIONS,
        name: 'Ver recomendaciones personalizadas',
        description:
            'Acceso a recomendaciones de alojamientos personalizadas basadas en preferencias'
    }
];
