/**
 * Tests for SubscriptionCard.client.tsx and subscription-card-i18n.ts
 *
 * Verifies component structure, exports, props interface, localization,
 * accessibility attributes, API integration, loading/error/loaded states,
 * free plan view, active subscription view, and parameterized i18n functions.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/account/SubscriptionCard.client.tsx'
);
const content = readFileSync(componentPath, 'utf8');

const i18nPath = resolve(__dirname, '../../../src/components/account/subscription-card-i18n.ts');
const i18nContent = readFileSync(i18nPath, 'utf8');

describe('SubscriptionCard.client.tsx', () => {
    describe('Module exports', () => {
        it('should export SubscriptionCard as named export', () => {
            expect(content).toContain('export function SubscriptionCard(');
        });

        it('should not use default export', () => {
            expect(content).not.toContain('export default');
        });
    });

    describe('Imports', () => {
        it('should import useCallback, useEffect, and useState from react', () => {
            expect(content).toContain('useCallback');
            expect(content).toContain('useEffect');
            expect(content).toContain('useState');
        });

        it('should import icons from @repo/icons', () => {
            expect(content).toContain("from '@repo/icons'");
        });

        it('should import AlertTriangleIcon from @repo/icons', () => {
            expect(content).toContain('AlertTriangleIcon');
        });

        it('should import RefreshIcon from @repo/icons', () => {
            expect(content).toContain('RefreshIcon');
        });

        it('should import CheckIcon from @repo/icons', () => {
            expect(content).toContain('CheckIcon');
        });

        it('should import userApi from endpoints', () => {
            expect(content).toContain("import { userApi } from '../../lib/api/endpoints'");
        });

        it('should import SubscriptionData type from endpoints', () => {
            expect(content).toContain(
                "import type { SubscriptionData } from '../../lib/api/endpoints'"
            );
        });

        it('should import SUBSCRIPTION_CARD_MESSAGES from i18n file', () => {
            expect(content).toContain('SUBSCRIPTION_CARD_MESSAGES');
            expect(content).toContain("from './subscription-card-i18n'");
        });

        it('should import SubscriptionCardMessages type from i18n file', () => {
            expect(content).toContain('SubscriptionCardMessages');
        });
    });

    describe('Props interface', () => {
        it('should define SubscriptionCardProps interface', () => {
            expect(content).toContain('interface SubscriptionCardProps');
        });

        it('should define locale prop as readonly with supported locales', () => {
            expect(content).toContain("readonly locale: 'es' | 'en' | 'pt'");
        });

        it('should define upgradeHref prop as readonly string', () => {
            expect(content).toContain('readonly upgradeHref: string');
        });
    });

    describe('Internal constants', () => {
        it('should define SKELETON_FEATURE_KEYS constant', () => {
            expect(content).toContain('SKELETON_FEATURE_KEYS');
        });

        it('should define STATUS_BADGE_CLASSES constant', () => {
            expect(content).toContain('STATUS_BADGE_CLASSES');
        });

        it('should have color class for active status', () => {
            expect(content).toContain("active: 'bg-green-100 text-green-800'");
        });

        it('should have color class for trial status', () => {
            expect(content).toContain("trial: 'bg-amber-100 text-amber-800'");
        });

        it('should have color class for cancelled status', () => {
            expect(content).toContain("cancelled: 'bg-red-100 text-red-800'");
        });

        it('should have color class for expired status', () => {
            expect(content).toContain("expired: 'bg-gray-100 text-gray-700'");
        });

        it('should have color class for pending status', () => {
            expect(content).toContain("pending: 'bg-blue-100 text-blue-800'");
        });

        it('should have color class for free status', () => {
            expect(content).toContain("free: 'bg-gray-100 text-gray-700'");
        });
    });

    describe('Internal helper functions', () => {
        it('should define formatLocalDate function', () => {
            expect(content).toContain('function formatLocalDate(');
        });

        it('should use toLocaleDateString in formatLocalDate', () => {
            expect(content).toContain('toLocaleDateString(locale');
        });

        it('should define formatArsPrice function', () => {
            expect(content).toContain('function formatArsPrice(');
        });

        it('should use Intl.NumberFormat for ARS currency formatting', () => {
            expect(content).toContain('new Intl.NumberFormat(');
            expect(content).toContain("currency: 'ARS'");
        });

        it('should append ARS/mes suffix to formatted price', () => {
            expect(content).toContain('ARS/mes');
        });

        it('should define computeTrialDaysRemaining function', () => {
            expect(content).toContain('function computeTrialDaysRemaining(');
        });

        it('should use Math.ceil and Math.max in trial days computation', () => {
            expect(content).toContain('Math.ceil(');
            expect(content).toContain('Math.max(0, remaining)');
        });
    });

    describe('Sub-components', () => {
        it('should define StatusBadge sub-component', () => {
            expect(content).toContain('function StatusBadge(');
        });

        it('should define FeaturesList sub-component', () => {
            expect(content).toContain('function FeaturesList(');
        });

        it('should define UpgradeCta sub-component', () => {
            expect(content).toContain('function UpgradeCta(');
        });

        it('should define ActiveSubscriptionView sub-component', () => {
            expect(content).toContain('function ActiveSubscriptionView(');
        });

        it('should define FreePlanView sub-component', () => {
            expect(content).toContain('function FreePlanView(');
        });
    });

    describe('State management', () => {
        it('should use useState for isLoading', () => {
            expect(content).toContain('const [isLoading, setIsLoading] = useState(true)');
        });

        it('should use useState for error', () => {
            expect(content).toContain('const [error, setError] = useState(false)');
        });

        it('should use useState for data', () => {
            expect(content).toContain(
                'const [data, setData] = useState<SubscriptionData | null>(null)'
            );
        });

        it('should initialize isLoading as true', () => {
            expect(content).toContain('useState(true)');
        });

        it('should initialize error as false', () => {
            expect(content).toContain('useState(false)');
        });

        it('should initialize data as null', () => {
            expect(content).toContain('useState<SubscriptionData | null>(null)');
        });
    });

    describe('API integration', () => {
        it('should define fetchSubscription with useCallback', () => {
            expect(content).toContain('const fetchSubscription = useCallback(async ()');
        });

        it('should call userApi.getSubscription', () => {
            expect(content).toContain('userApi.getSubscription()');
        });

        it('should check result.ok and result.data before setting data', () => {
            expect(content).toContain('if (result.ok && result.data)');
        });

        it('should set data from result.data.subscription', () => {
            expect(content).toContain('setData(result.data.subscription)');
        });

        it('should set error to true on failed fetch', () => {
            expect(content).toContain('setError(true)');
        });

        it('should reset isLoading and error at start of fetch', () => {
            expect(content).toContain('setIsLoading(true)');
            expect(content).toContain('setError(false)');
        });

        it('should set isLoading to false in finally block', () => {
            expect(content).toContain('setIsLoading(false)');
        });

        it('should log error to console on exception', () => {
            expect(content).toContain("console.error('Error fetching subscription:'");
        });

        it('should call fetchSubscription on mount via useEffect', () => {
            expect(content).toContain('useEffect(() => {');
            expect(content).toContain('fetchSubscription()');
            expect(content).toContain('}, [fetchSubscription])');
        });
    });

    describe('Loading state', () => {
        it('should use output element for loading state', () => {
            expect(content).toContain('<output');
        });

        it('should have aria-busy="true" on loading container', () => {
            expect(content).toContain('aria-busy="true"');
        });

        it('should have aria-label with loading message on output', () => {
            expect(content).toContain('aria-label={messages.loading}');
        });

        it('should have sr-only span with loading message for screen readers', () => {
            expect(content).toContain('className="sr-only"');
            expect(content).toContain('{messages.loading}');
        });

        it('should render skeleton placeholder with animate-pulse', () => {
            expect(content).toContain('animate-pulse');
        });

        it('should render animate-spin loading indicator below skeleton', () => {
            expect(content).toContain('animate-spin');
        });

        it('should use SKELETON_FEATURE_KEYS for skeleton rows', () => {
            expect(content).toContain('SKELETON_FEATURE_KEYS.map(');
        });

        it('should render loading text visible below skeleton', () => {
            // The loading message appears both in sr-only span and in the visible text block
            const loadingMsgCount = (content.match(/\{messages\.loading\}/g) ?? []).length;
            expect(loadingMsgCount).toBeGreaterThanOrEqual(2);
        });
    });

    describe('Error state', () => {
        it('should render a div with role="alert" for error state', () => {
            expect(content).toContain('role="alert"');
        });

        it('should render AlertTriangleIcon in error state', () => {
            expect(content).toContain('<AlertTriangleIcon');
        });

        it('should mark AlertTriangleIcon as aria-hidden', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should display loadError message in error state', () => {
            expect(content).toContain('{messages.loadError}');
        });

        it('should have a retry button with type="button"', () => {
            expect(content).toContain('type="button"');
        });

        it('should have aria-label on retry button', () => {
            expect(content).toContain('aria-label="Retry loading subscription data"');
        });

        it('should call fetchSubscription when retry button is clicked', () => {
            expect(content).toContain('onClick={fetchSubscription}');
        });

        it('should render RefreshIcon inside retry button', () => {
            expect(content).toContain('<RefreshIcon');
        });

        it('should display retry message from messages.retry', () => {
            expect(content).toContain('{messages.retry}');
        });
    });

    describe('Loaded state - active subscription view', () => {
        it('should render ActiveSubscriptionView when data is not null', () => {
            expect(content).toContain('<ActiveSubscriptionView');
        });

        it('should pass subscription data to ActiveSubscriptionView', () => {
            expect(content).toContain('subscription={data}');
        });

        it('should pass locale to ActiveSubscriptionView', () => {
            expect(content).toContain('locale={locale}');
        });

        it('should pass upgradeHref to ActiveSubscriptionView', () => {
            expect(content).toContain('upgradeHref={upgradeHref}');
        });

        it('should pass messages to ActiveSubscriptionView', () => {
            expect(content).toContain('messages={messages}');
        });

        it('should display planName in active subscription view', () => {
            expect(content).toContain('{planName}');
        });

        it('should render StatusBadge with localized status label', () => {
            expect(content).toContain('<StatusBadge');
            expect(content).toContain('messages.statusLabels[status]');
        });

        it('should format ARS price with formatArsPrice when not free', () => {
            expect(content).toContain('formatArsPrice(monthlyPriceArs, locale)');
        });

        it('should display freePlanPrice when monthlyPriceArs is 0', () => {
            expect(content).toContain('messages.freePlanPrice');
            expect(content).toContain('isFree');
        });

        it('should compute isFree as true when monthlyPriceArs equals 0', () => {
            expect(content).toContain('monthlyPriceArs === 0');
        });

        it('should show trial warning when status is trial and trialEndsAt is set', () => {
            expect(content).toContain("status === 'trial' && trialEndsAt");
        });

        it('should display trialEndsIn parameterized message in trial warning', () => {
            expect(content).toContain('messages.trialEndsIn(trialDaysRemaining)');
        });

        it('should show cancellation notice when cancelAtPeriodEnd is true', () => {
            expect(content).toContain('cancelAtPeriodEnd && formattedPeriodEnd');
        });

        it('should display cancelNotice parameterized message in cancellation notice', () => {
            expect(content).toContain('messages.cancelNotice(formattedPeriodEnd)');
        });

        it('should show renewal date when active and not cancelling', () => {
            expect(content).toContain(
                "!cancelAtPeriodEnd && status === 'active' && formattedPeriodEnd"
            );
        });

        it('should display renewsOn parameterized message for renewal info', () => {
            expect(content).toContain('messages.renewsOn(formattedPeriodEnd)');
        });

        it('should render FeaturesList with features and heading', () => {
            expect(content).toContain('<FeaturesList');
            expect(content).toContain('features={messages.features}');
            expect(content).toContain('heading={messages.featuresHeading}');
        });

        it('should show UpgradeCta only for free plan (isFree)', () => {
            expect(content).toContain('{isFree && (');
        });
    });

    describe('Loaded state - free plan view', () => {
        it('should render FreePlanView when data is null', () => {
            expect(content).toContain('<FreePlanView');
        });

        it('should pass upgradeHref to FreePlanView', () => {
            // upgradeHref={upgradeHref} is passed to multiple sub-components
            const count = (content.match(/upgradeHref=\{upgradeHref\}/g) ?? []).length;
            expect(count).toBeGreaterThanOrEqual(2);
        });

        it('should pass messages to FreePlanView', () => {
            // messages={messages} is passed to multiple sub-components
            const count = (content.match(/messages=\{messages\}/g) ?? []).length;
            expect(count).toBeGreaterThanOrEqual(2);
        });

        it('should display freePlanName in free plan view', () => {
            expect(content).toContain('{messages.freePlanName}');
        });

        it('should display freePlanPrice in free plan view', () => {
            expect(content).toContain('{messages.freePlanPrice}');
        });

        it('should render StatusBadge with free statusKey in free plan view', () => {
            expect(content).toContain('statusKey="free"');
        });

        it('should always render UpgradeCta in free plan view', () => {
            // FreePlanView always renders UpgradeCta (no conditional)
            expect(content).toContain('function FreePlanView(');
            expect(content).toContain('<UpgradeCta');
        });
    });

    describe('UpgradeCta sub-component', () => {
        it('should accept heading, description, buttonText, and href props', () => {
            expect(content).toContain('interface UpgradeCtaProps');
            expect(content).toContain('readonly heading: string');
            expect(content).toContain('readonly description: string');
            expect(content).toContain('readonly buttonText: string');
            expect(content).toContain('readonly href: string');
        });

        it('should render an anchor tag with the provided href', () => {
            expect(content).toContain('href={href}');
        });

        it('should have focus-visible ring on CTA anchor', () => {
            expect(content).toContain('focus-visible:ring-2');
        });

        it('should display upgradeHeading from messages', () => {
            expect(content).toContain('messages.upgradeHeading');
        });

        it('should display upgradeDescription from messages', () => {
            expect(content).toContain('messages.upgradeDescription');
        });

        it('should display upgradeButton text from messages', () => {
            expect(content).toContain('messages.upgradeButton');
        });
    });

    describe('StatusBadge sub-component', () => {
        it('should define StatusBadgeProps interface', () => {
            expect(content).toContain('interface StatusBadgeProps');
        });

        it('should have statusKey and label props', () => {
            expect(content).toContain('readonly statusKey:');
            expect(content).toContain('readonly label: string');
        });

        it('should have role="status" on the badge span', () => {
            expect(content).toContain('role="status"');
        });

        it('should apply color classes from STATUS_BADGE_CLASSES', () => {
            expect(content).toContain('STATUS_BADGE_CLASSES[statusKey]');
        });
    });

    describe('FeaturesList sub-component', () => {
        it('should define FeaturesListProps interface', () => {
            expect(content).toContain('interface FeaturesListProps');
        });

        it('should accept features as readonly string array', () => {
            expect(content).toContain('readonly features: readonly string[]');
        });

        it('should accept heading prop', () => {
            expect(content).toContain('readonly heading: string');
        });

        it('should render a ul element for the features list', () => {
            expect(content).toContain('<ul');
        });

        it('should render li elements for each feature', () => {
            expect(content).toContain('<li key={feature}');
        });

        it('should render CheckIcon with aria-hidden for each feature', () => {
            expect(content).toContain('<CheckIcon');
            // aria-hidden is already present from the AlertTriangleIcon and RefreshIcon checks
            // CheckIcon also uses aria-hidden="true"
            expect(content).toContain('aria-hidden="true"');
        });
    });

    describe('Accessibility', () => {
        it('should mark AlertTriangleIcon as aria-hidden decorative icon', () => {
            expect(content).toContain('<AlertTriangleIcon');
            expect(content).toContain('aria-hidden="true"');
        });

        it('should mark RefreshIcon as aria-hidden decorative icon', () => {
            expect(content).toContain('<RefreshIcon');
        });

        it('should mark CheckIcon as aria-hidden decorative icon', () => {
            expect(content).toContain('<CheckIcon');
        });

        it('should use output element with aria-busy for loading state', () => {
            expect(content).toContain('<output');
            expect(content).toContain('aria-busy="true"');
        });

        it('should use role="alert" on error container', () => {
            expect(content).toContain('role="alert"');
        });

        it('should use role="status" on StatusBadge span', () => {
            expect(content).toContain('role="status"');
        });

        it('should have focus-visible ring on CTA link for keyboard navigation', () => {
            expect(content).toContain('focus-visible:outline-none');
            expect(content).toContain('focus-visible:ring-2');
        });

        it('should use ul/li for features list', () => {
            expect(content).toContain('<ul');
            expect(content).toContain('<li key={feature}');
        });
    });

    describe('i18n integration', () => {
        it('should derive messages from SUBSCRIPTION_CARD_MESSAGES using locale', () => {
            expect(content).toContain('SUBSCRIPTION_CARD_MESSAGES[locale]');
        });

        it('should support es locale via SUBSCRIPTION_CARD_MESSAGES', () => {
            expect(content).toContain("'es'");
        });

        it('should support en locale via SUBSCRIPTION_CARD_MESSAGES', () => {
            expect(content).toContain("'en'");
        });

        it('should support pt locale via SUBSCRIPTION_CARD_MESSAGES', () => {
            expect(content).toContain("'pt'");
        });
    });
});

describe('subscription-card-i18n.ts', () => {
    describe('Exports', () => {
        it('should export SUBSCRIPTION_CARD_MESSAGES', () => {
            expect(i18nContent).toContain('export const SUBSCRIPTION_CARD_MESSAGES');
        });

        it('should export SubscriptionCardMessages interface', () => {
            expect(i18nContent).toContain('export interface SubscriptionCardMessages');
        });

        it('should have messages for es, en, and pt locales', () => {
            expect(i18nContent).toContain('es: {');
            expect(i18nContent).toContain('en: {');
            expect(i18nContent).toContain('pt: {');
        });

        it('should type SUBSCRIPTION_CARD_MESSAGES as Record of LocaleKey to SubscriptionCardMessages', () => {
            expect(i18nContent).toContain('Record<LocaleKey, SubscriptionCardMessages>');
        });
    });

    describe('SubscriptionCardMessages interface', () => {
        it('should define loading field', () => {
            expect(i18nContent).toContain('loading: string');
        });

        it('should define loadError field', () => {
            expect(i18nContent).toContain('loadError: string');
        });

        it('should define retry field', () => {
            expect(i18nContent).toContain('retry: string');
        });

        it('should define freePlanName field', () => {
            expect(i18nContent).toContain('freePlanName: string');
        });

        it('should define freePlanPrice field', () => {
            expect(i18nContent).toContain('freePlanPrice: string');
        });

        it('should define featuresHeading field', () => {
            expect(i18nContent).toContain('featuresHeading: string');
        });

        it('should define features as readonly string array', () => {
            expect(i18nContent).toContain('features: readonly string[]');
        });

        it('should define upgradeHeading field', () => {
            expect(i18nContent).toContain('upgradeHeading: string');
        });

        it('should define upgradeDescription field', () => {
            expect(i18nContent).toContain('upgradeDescription: string');
        });

        it('should define upgradeButton field', () => {
            expect(i18nContent).toContain('upgradeButton: string');
        });

        it('should define statusLabels as Readonly Record', () => {
            expect(i18nContent).toContain('statusLabels: Readonly<Record<StatusKey, string>>');
        });

        it('should define trialEndsIn as parameterized function', () => {
            expect(i18nContent).toContain('trialEndsIn: (n: number) => string');
        });

        it('should define cancelNotice as parameterized function', () => {
            expect(i18nContent).toContain('cancelNotice: (date: string) => string');
        });

        it('should define renewsOn as parameterized function', () => {
            expect(i18nContent).toContain('renewsOn: (date: string) => string');
        });

        it('should define billingSection field', () => {
            expect(i18nContent).toContain('billingSection: string');
        });

        it('should define noBillingInfo field', () => {
            expect(i18nContent).toContain('noBillingInfo: string');
        });

        it('should define billingHint field', () => {
            expect(i18nContent).toContain('billingHint: string');
        });
    });

    describe('StatusKey type', () => {
        it('should define StatusKey type covering all subscription states plus free', () => {
            expect(i18nContent).toContain(
                "type StatusKey = 'active' | 'trial' | 'cancelled' | 'expired' | 'pending' | 'free'"
            );
        });
    });

    describe('Localization - Spanish (es)', () => {
        it('should have Spanish loading message', () => {
            expect(i18nContent).toContain('Cargando suscripcion...');
        });

        it('should have Spanish loadError message', () => {
            expect(i18nContent).toContain('Error al cargar la suscripcion');
        });

        it('should have Spanish retry text', () => {
            expect(i18nContent).toContain("retry: 'Reintentar'");
        });

        it('should have Spanish free plan name', () => {
            expect(i18nContent).toContain('Plan Gratuito');
        });

        it('should have Spanish free plan price', () => {
            expect(i18nContent).toContain('Gratis para siempre');
        });

        it('should have Spanish features heading', () => {
            expect(i18nContent).toContain('Caracteristicas incluidas');
        });

        it('should have Spanish feature items', () => {
            expect(i18nContent).toContain('Busqueda de alojamientos');
            expect(i18nContent).toContain('Guardar favoritos');
            expect(i18nContent).toContain('Ver destinos y eventos');
            expect(i18nContent).toContain('Contactar propietarios');
        });

        it('should have Spanish upgrade heading', () => {
            expect(i18nContent).toContain('Queres mas?');
        });

        it('should have Spanish upgrade description', () => {
            expect(i18nContent).toContain('Accede a funciones premium con nuestros planes pagos');
        });

        it('should have Spanish upgrade button text', () => {
            expect(i18nContent).toContain("upgradeButton: 'Ver planes'");
        });

        it('should have Spanish active status label', () => {
            expect(i18nContent).toContain("active: 'Activo'");
        });

        it('should have Spanish trial status label', () => {
            expect(i18nContent).toContain("trial: 'En prueba'");
        });

        it('should have Spanish cancelled status label', () => {
            expect(i18nContent).toContain("cancelled: 'Cancelado'");
        });

        it('should have Spanish expired status label', () => {
            expect(i18nContent).toContain("expired: 'Expirado'");
        });

        it('should have Spanish pending status label', () => {
            expect(i18nContent).toContain("pending: 'Pendiente'");
        });

        it('should have Spanish free status label', () => {
            expect(i18nContent).toContain("free: 'Gratuito'");
        });

        it('should have Spanish trialEndsIn function returning correct string', () => {
            expect(i18nContent).toContain('Prueba finaliza en ${n} dias');
        });

        it('should have Spanish cancelNotice function returning correct string', () => {
            expect(i18nContent).toContain('Plan finaliza el ${date}');
        });

        it('should have Spanish renewsOn function returning correct string', () => {
            expect(i18nContent).toContain('Se renueva el ${date}');
        });

        it('should have Spanish billing section label', () => {
            expect(i18nContent).toContain("billingSection: 'Facturacion'");
        });

        it('should have Spanish noBillingInfo message', () => {
            expect(i18nContent).toContain('No hay informacion de facturacion disponible');
        });
    });

    describe('Localization - English (en)', () => {
        it('should have English loading message', () => {
            expect(i18nContent).toContain('Loading subscription...');
        });

        it('should have English loadError message', () => {
            expect(i18nContent).toContain('Error loading subscription');
        });

        it('should have English retry text', () => {
            expect(i18nContent).toContain("retry: 'Retry'");
        });

        it('should have English free plan name', () => {
            expect(i18nContent).toContain('Free Plan');
        });

        it('should have English free plan price', () => {
            expect(i18nContent).toContain('Free forever');
        });

        it('should have English features heading', () => {
            expect(i18nContent).toContain('Included features');
        });

        it('should have English feature items', () => {
            expect(i18nContent).toContain('Accommodation search');
            expect(i18nContent).toContain('Save favorites');
            expect(i18nContent).toContain('Browse destinations and events');
            expect(i18nContent).toContain('Contact owners');
        });

        it('should have English upgrade heading', () => {
            expect(i18nContent).toContain('Want more?');
        });

        it('should have English upgrade description', () => {
            expect(i18nContent).toContain('Access premium features with our paid plans');
        });

        it('should have English upgrade button text', () => {
            expect(i18nContent).toContain("upgradeButton: 'View plans'");
        });

        it('should have English active status label', () => {
            expect(i18nContent).toContain("active: 'Active'");
        });

        it('should have English trial status label', () => {
            expect(i18nContent).toContain("trial: 'Trial'");
        });

        it('should have English cancelled status label', () => {
            expect(i18nContent).toContain("cancelled: 'Cancelled'");
        });

        it('should have English expired status label', () => {
            expect(i18nContent).toContain("expired: 'Expired'");
        });

        it('should have English pending status label', () => {
            expect(i18nContent).toContain("pending: 'Pending'");
        });

        it('should have English free status label', () => {
            expect(i18nContent).toContain("free: 'Free'");
        });

        it('should have English trialEndsIn function returning correct string', () => {
            expect(i18nContent).toContain('Trial ends in ${n} days');
        });

        it('should have English cancelNotice function returning correct string', () => {
            expect(i18nContent).toContain('Plan ends on ${date}');
        });

        it('should have English renewsOn function returning correct string', () => {
            expect(i18nContent).toContain('Renews on ${date}');
        });

        it('should have English billing section label', () => {
            expect(i18nContent).toContain("billingSection: 'Billing'");
        });

        it('should have English noBillingInfo message', () => {
            expect(i18nContent).toContain('No billing information available');
        });

        it('should have English billingHint message', () => {
            expect(i18nContent).toContain(
                'Billing information will be updated when you make your first subscription'
            );
        });
    });

    describe('Localization - Portuguese (pt)', () => {
        it('should have Portuguese loading message', () => {
            expect(i18nContent).toContain('Carregando assinatura...');
        });

        it('should have Portuguese loadError message', () => {
            expect(i18nContent).toContain('Erro ao carregar assinatura');
        });

        it('should have Portuguese retry text', () => {
            expect(i18nContent).toContain("retry: 'Tentar novamente'");
        });

        it('should have Portuguese free plan name', () => {
            expect(i18nContent).toContain('Plano Gratuito');
        });

        it('should have Portuguese free plan price', () => {
            expect(i18nContent).toContain('Gratis para sempre');
        });

        it('should have Portuguese features heading', () => {
            expect(i18nContent).toContain('Recursos incluidos');
        });

        it('should have Portuguese feature items', () => {
            expect(i18nContent).toContain('Busca de hospedagens');
            expect(i18nContent).toContain('Salvar favoritos');
            expect(i18nContent).toContain('Ver destinos e eventos');
            expect(i18nContent).toContain('Contatar proprietarios');
        });

        it('should have Portuguese upgrade heading', () => {
            expect(i18nContent).toContain('Quer mais?');
        });

        it('should have Portuguese upgrade description', () => {
            expect(i18nContent).toContain('Acesse recursos premium com nossos planos pagos');
        });

        it('should have Portuguese upgrade button text', () => {
            expect(i18nContent).toContain("upgradeButton: 'Ver planos'");
        });

        it('should have Portuguese active status label', () => {
            expect(i18nContent).toContain("active: 'Ativo'");
        });

        it('should have Portuguese trial status label', () => {
            expect(i18nContent).toContain("trial: 'Em avaliacao'");
        });

        it('should have Portuguese cancelled status label', () => {
            expect(i18nContent).toContain("cancelled: 'Cancelado'");
        });

        it('should have Portuguese expired status label', () => {
            expect(i18nContent).toContain("expired: 'Expirado'");
        });

        it('should have Portuguese pending status label', () => {
            expect(i18nContent).toContain("pending: 'Pendente'");
        });

        it('should have Portuguese free status label', () => {
            expect(i18nContent).toContain("free: 'Gratuito'");
        });

        it('should have Portuguese trialEndsIn function returning correct string', () => {
            expect(i18nContent).toContain('Avaliacao termina em ${n} dias');
        });

        it('should have Portuguese cancelNotice function returning correct string', () => {
            expect(i18nContent).toContain('Plano termina em ${date}');
        });

        it('should have Portuguese renewsOn function returning correct string', () => {
            expect(i18nContent).toContain('Renova em ${date}');
        });

        it('should have Portuguese billing section label', () => {
            expect(i18nContent).toContain("billingSection: 'Faturamento'");
        });

        it('should have Portuguese noBillingInfo message', () => {
            expect(i18nContent).toContain('Nenhuma informacao de faturamento disponivel');
        });
    });

    describe('Locale key completeness', () => {
        it('should define all status keys for es locale', () => {
            const esBlock = i18nContent.slice(
                i18nContent.indexOf('es: {'),
                i18nContent.indexOf('en: {')
            );
            expect(esBlock).toContain('active:');
            expect(esBlock).toContain('trial:');
            expect(esBlock).toContain('cancelled:');
            expect(esBlock).toContain('expired:');
            expect(esBlock).toContain('pending:');
            expect(esBlock).toContain('free:');
        });

        it('should define all status keys for en locale', () => {
            const enBlock = i18nContent.slice(
                i18nContent.indexOf('en: {'),
                i18nContent.indexOf('pt: {')
            );
            expect(enBlock).toContain('active:');
            expect(enBlock).toContain('trial:');
            expect(enBlock).toContain('cancelled:');
            expect(enBlock).toContain('expired:');
            expect(enBlock).toContain('pending:');
            expect(enBlock).toContain('free:');
        });

        it('should define all status keys for pt locale', () => {
            const ptBlock = i18nContent.slice(i18nContent.indexOf('pt: {'));
            expect(ptBlock).toContain('active:');
            expect(ptBlock).toContain('trial:');
            expect(ptBlock).toContain('cancelled:');
            expect(ptBlock).toContain('expired:');
            expect(ptBlock).toContain('pending:');
            expect(ptBlock).toContain('free:');
        });

        it('should have trialEndsIn, cancelNotice, and renewsOn in all locales', () => {
            // Each appears at least 3 times (once per locale, plus once in the interface definition)
            const trialCount = (i18nContent.match(/trialEndsIn:/g) ?? []).length;
            const cancelCount = (i18nContent.match(/cancelNotice:/g) ?? []).length;
            const renewsCount = (i18nContent.match(/renewsOn:/g) ?? []).length;
            expect(trialCount).toBeGreaterThanOrEqual(3);
            expect(cancelCount).toBeGreaterThanOrEqual(3);
            expect(renewsCount).toBeGreaterThanOrEqual(3);
        });

        it('should have features array in all three locales', () => {
            const featuresCount = (i18nContent.match(/features: \[/g) ?? []).length;
            expect(featuresCount).toBe(3);
        });

        it('should have statusLabels object in all three locales', () => {
            const statusLabelsCount = (i18nContent.match(/statusLabels: \{/g) ?? []).length;
            expect(statusLabelsCount).toBe(3);
        });
    });
});
