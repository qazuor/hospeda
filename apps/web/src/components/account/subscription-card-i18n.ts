/**
 * Localization constants for SubscriptionCard component.
 */

type LocaleKey = 'es' | 'en' | 'pt';

/** Status label keys for subscription states */
type StatusKey = 'active' | 'trial' | 'cancelled' | 'expired' | 'pending' | 'free';

/** Full set of localized messages for SubscriptionCard */
export interface SubscriptionCardMessages {
    loading: string;
    loadError: string;
    retry: string;
    freePlanName: string;
    freePlanPrice: string;
    featuresHeading: string;
    features: readonly string[];
    upgradeHeading: string;
    upgradeDescription: string;
    upgradeButton: string;
    statusLabels: Readonly<Record<StatusKey, string>>;
    trialEndsIn: (n: number) => string;
    cancelNotice: (date: string) => string;
    renewsOn: (date: string) => string;
    billingSection: string;
    noBillingInfo: string;
    billingHint: string;
}

/**
 * Localized messages for the SubscriptionCard component across supported locales.
 * Covers loading states, plan info, status labels, parameterized notices, and billing section.
 */
export const SUBSCRIPTION_CARD_MESSAGES: Record<LocaleKey, SubscriptionCardMessages> = {
    es: {
        loading: 'Cargando suscripcion...',
        loadError: 'Error al cargar la suscripcion',
        retry: 'Reintentar',
        freePlanName: 'Plan Gratuito',
        freePlanPrice: 'Gratis para siempre',
        featuresHeading: 'Caracteristicas incluidas',
        features: [
            'Busqueda de alojamientos',
            'Guardar favoritos',
            'Ver destinos y eventos',
            'Contactar propietarios'
        ],
        upgradeHeading: 'Queres mas?',
        upgradeDescription: 'Accede a funciones premium con nuestros planes pagos',
        upgradeButton: 'Ver planes',
        statusLabels: {
            active: 'Activo',
            trial: 'En prueba',
            cancelled: 'Cancelado',
            expired: 'Expirado',
            pending: 'Pendiente',
            free: 'Gratuito'
        },
        trialEndsIn: (n: number) => `Prueba finaliza en ${n} dias`,
        cancelNotice: (date: string) => `Plan finaliza el ${date}`,
        renewsOn: (date: string) => `Se renueva el ${date}`,
        billingSection: 'Facturacion',
        noBillingInfo: 'No hay informacion de facturacion disponible',
        billingHint:
            'La informacion de facturacion se actualizara cuando realices tu primera suscripcion'
    },
    en: {
        loading: 'Loading subscription...',
        loadError: 'Error loading subscription',
        retry: 'Retry',
        freePlanName: 'Free Plan',
        freePlanPrice: 'Free forever',
        featuresHeading: 'Included features',
        features: [
            'Accommodation search',
            'Save favorites',
            'Browse destinations and events',
            'Contact owners'
        ],
        upgradeHeading: 'Want more?',
        upgradeDescription: 'Access premium features with our paid plans',
        upgradeButton: 'View plans',
        statusLabels: {
            active: 'Active',
            trial: 'Trial',
            cancelled: 'Cancelled',
            expired: 'Expired',
            pending: 'Pending',
            free: 'Free'
        },
        trialEndsIn: (n: number) => `Trial ends in ${n} days`,
        cancelNotice: (date: string) => `Plan ends on ${date}`,
        renewsOn: (date: string) => `Renews on ${date}`,
        billingSection: 'Billing',
        noBillingInfo: 'No billing information available',
        billingHint: 'Billing information will be updated when you make your first subscription'
    },
    pt: {
        loading: 'Carregando assinatura...',
        loadError: 'Erro ao carregar assinatura',
        retry: 'Tentar novamente',
        freePlanName: 'Plano Gratuito',
        freePlanPrice: 'Gratis para sempre',
        featuresHeading: 'Recursos incluidos',
        features: [
            'Busca de hospedagens',
            'Salvar favoritos',
            'Ver destinos e eventos',
            'Contatar proprietarios'
        ],
        upgradeHeading: 'Quer mais?',
        upgradeDescription: 'Acesse recursos premium com nossos planos pagos',
        upgradeButton: 'Ver planos',
        statusLabels: {
            active: 'Ativo',
            trial: 'Em avaliacao',
            cancelled: 'Cancelado',
            expired: 'Expirado',
            pending: 'Pendente',
            free: 'Gratuito'
        },
        trialEndsIn: (n: number) => `Avaliacao termina em ${n} dias`,
        cancelNotice: (date: string) => `Plano termina em ${date}`,
        renewsOn: (date: string) => `Renova em ${date}`,
        billingSection: 'Faturamento',
        noBillingInfo: 'Nenhuma informacao de faturamento disponivel',
        billingHint:
            'As informacoes de faturamento serao atualizadas quando voce fizer sua primeira assinatura'
    }
};
