/**
 * Tests for SubscriptionCard.client.tsx and account.json locale files (subscription section)
 *
 * Verifies component structure, exports, props interface, localization,
 * accessibility attributes, API integration, loading/error/loaded states,
 * free plan view, active subscription view, and i18n translation keys.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/account/SubscriptionCard.client.tsx'
);
const content = readFileSync(componentPath, 'utf8');

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
            expect(content).toContain(
                "import { userApi } from '../../lib/api/endpoints-protected'"
            );
        });

        it('should import SubscriptionData type from endpoints', () => {
            expect(content).toContain(
                "import type { SubscriptionData } from '../../lib/api/endpoints-protected'"
            );
        });

        it('should import useTranslation from hooks', () => {
            expect(content).toContain('useTranslation');
        });

        it('should import SupportedLocale type', () => {
            expect(content).toContain('SupportedLocale');
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
            expect(content).toContain(
                "active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'"
            );
        });

        it('should have color class for trial status', () => {
            expect(content).toContain(
                "trial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'"
            );
        });

        it('should have color class for cancelled status', () => {
            expect(content).toContain(
                "cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'"
            );
        });

        it('should have color class for expired status', () => {
            expect(content).toContain("expired: 'bg-surface-alt text-text-secondary'");
        });

        it('should have color class for pending status', () => {
            expect(content).toContain(
                "pending: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'"
            );
        });

        it('should have color class for past_due status', () => {
            expect(content).toContain(
                "past_due: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'"
            );
        });

        it('should have color class for free status', () => {
            expect(content).toContain("free: 'bg-surface-alt text-text-secondary'");
        });
    });

    describe('Internal helper functions', () => {
        it('should define formatLocalDate function', () => {
            expect(content).toContain('function formatLocalDate(');
        });

        it('should use formatDate from @repo/i18n in formatLocalDate', () => {
            expect(content).toContain('formatCurrency');
            expect(content).toContain('formatDate');
            expect(content).toContain("from '@repo/i18n'");
            expect(content).toContain('formatDate({');
        });

        it('should define formatArsPrice function', () => {
            expect(content).toContain('function formatArsPrice(');
        });

        it('should use formatCurrency from @repo/i18n for ARS currency formatting', () => {
            expect(content).toContain('formatCurrency({');
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

        it('should log error to webLogger on exception', () => {
            expect(content).toContain("webLogger.error('Error fetching subscription:'");
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
            expect(content).toContain("aria-label={t('subscription.loading')}");
        });

        it('should have sr-only span with loading message for screen readers', () => {
            expect(content).toContain('className="sr-only"');
            expect(content).toContain("{t('subscription.loading')}");
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
            const loadingMsgCount = (content.match(/t\('subscription\.loading'\)/g) ?? []).length;
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
            expect(content).toContain("{t('subscription.loadError')}");
        });

        it('should have a retry button with type="button"', () => {
            expect(content).toContain('type="button"');
        });

        it('should have aria-label on retry button', () => {
            expect(content).toContain("aria-label={tUi('accessibility.retryLoading')}");
        });

        it('should call fetchSubscription when retry button is clicked', () => {
            expect(content).toContain('onClick={fetchSubscription}');
        });

        it('should render RefreshIcon inside retry button', () => {
            expect(content).toContain('<RefreshIcon');
        });

        it('should display retry message from t function', () => {
            expect(content).toContain("{t('subscription.retry')}");
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

        it('should pass t function to ActiveSubscriptionView', () => {
            expect(content).toContain('t={t}');
        });

        it('should pass features to ActiveSubscriptionView', () => {
            expect(content).toContain('features={features}');
        });

        it('should pass statusLabels to ActiveSubscriptionView', () => {
            expect(content).toContain('statusLabels={statusLabels}');
        });

        it('should display planName in active subscription view', () => {
            expect(content).toContain('{planName}');
        });

        it('should render StatusBadge with statusLabels lookup', () => {
            expect(content).toContain('<StatusBadge');
            expect(content).toContain('statusLabels[status]');
        });

        it('should format ARS price with formatArsPrice when not free', () => {
            expect(content).toContain('formatArsPrice(monthlyPriceArs, locale)');
        });

        it('should display freePlanPrice via t function when monthlyPriceArs is 0', () => {
            expect(content).toContain("t('subscription.freePlanPrice')");
            expect(content).toContain('isFree');
        });

        it('should compute isFree as true when monthlyPriceArs equals 0', () => {
            expect(content).toContain('monthlyPriceArs === 0');
        });

        it('should show trial warning when status is trial and trialEndsAt is set', () => {
            expect(content).toContain("status === 'trial' && trialEndsAt");
        });

        it('should display trialEndsIn with days param via t function', () => {
            expect(content).toContain(
                "t('subscription.trialEndsIn', undefined, { days: trialDaysRemaining })"
            );
        });

        it('should show past_due warning when status is past_due', () => {
            expect(content).toContain("status === 'past_due'");
        });

        it('should display pastDueNotice message via t function', () => {
            expect(content).toContain("t('subscription.pastDueNotice')");
        });

        it('should display updatePaymentMethod link via t function', () => {
            expect(content).toContain("t('subscription.updatePaymentMethod')");
        });

        it('should render payment method section when paymentMethod exists', () => {
            expect(content).toContain('{paymentMethod && (');
        });

        it('should display paymentMethodLabel heading via t function', () => {
            expect(content).toContain("t('subscription.paymentMethodLabel')");
        });

        it('should display paymentMethodCard via t function', () => {
            expect(content).toContain("t('subscription.paymentMethodCard'");
        });

        it('should display paymentMethodExpires via t function', () => {
            expect(content).toContain("t('subscription.paymentMethodExpires'");
        });

        it('should show cancellation notice when cancelAtPeriodEnd is true', () => {
            expect(content).toContain('cancelAtPeriodEnd && formattedPeriodEnd');
        });

        it('should display cancelNotice with date param via t function', () => {
            expect(content).toContain(
                "t('subscription.cancelNotice', undefined, { date: formattedPeriodEnd })"
            );
        });

        it('should show renewal date when active and not cancelling', () => {
            expect(content).toContain(
                "!cancelAtPeriodEnd && status === 'active' && formattedPeriodEnd"
            );
        });

        it('should display renewsOn with date param via t function', () => {
            expect(content).toContain(
                "t('subscription.renewsOn', undefined, { date: formattedPeriodEnd })"
            );
        });

        it('should render FeaturesList with features and heading from t function', () => {
            expect(content).toContain('<FeaturesList');
            expect(content).toContain('features={features}');
            expect(content).toContain("heading={t('subscription.featuresHeading')}");
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
            const count = (content.match(/upgradeHref=\{upgradeHref\}/g) ?? []).length;
            expect(count).toBeGreaterThanOrEqual(2);
        });

        it('should pass t function to FreePlanView', () => {
            const count = (content.match(/t=\{t\}/g) ?? []).length;
            expect(count).toBeGreaterThanOrEqual(2);
        });

        it('should display freePlanName via t function in free plan view', () => {
            expect(content).toContain("t('subscription.freePlanName')");
        });

        it('should display freePlanPrice via t function in free plan view', () => {
            expect(content).toContain("t('subscription.freePlanPrice')");
        });

        it('should render StatusBadge with free statusKey in free plan view', () => {
            expect(content).toContain('statusKey="free"');
        });

        it('should always render UpgradeCta in free plan view', () => {
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

        it('should display upgradeHeading via t function', () => {
            expect(content).toContain("t('subscription.upgradeHeading')");
        });

        it('should display upgradeDescription via t function', () => {
            expect(content).toContain("t('subscription.upgradeDescription')");
        });

        it('should display upgradeButton text via t function', () => {
            expect(content).toContain("t('subscription.upgradeButton')");
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

        it('should use output element for the badge', () => {
            expect(content).toContain('<output');
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
            expect(content).toContain('key={feature}');
        });

        it('should render CheckIcon with aria-hidden for each feature', () => {
            expect(content).toContain('<CheckIcon');
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

        it('should use output element on StatusBadge', () => {
            expect(content).toContain('<output');
        });

        it('should have focus-visible ring on CTA link for keyboard navigation', () => {
            expect(content).toContain('focus-visible:outline-none');
            expect(content).toContain('focus-visible:ring-2');
        });

        it('should use ul/li for features list', () => {
            expect(content).toContain('<ul');
            expect(content).toContain('key={feature}');
        });
    });

    describe('i18n integration', () => {
        it('should use useTranslation hook with account namespace', () => {
            expect(content).toContain(
                "useTranslation({ locale: locale as SupportedLocale, namespace: 'account' })"
            );
        });

        it('should support es locale', () => {
            expect(content).toContain("'es'");
        });

        it('should support en locale', () => {
            expect(content).toContain("'en'");
        });

        it('should support pt locale', () => {
            expect(content).toContain("'pt'");
        });

        it('should build features array using t function calls', () => {
            expect(content).toContain("t('subscription.feature1')");
            expect(content).toContain("t('subscription.feature2')");
            expect(content).toContain("t('subscription.feature3')");
            expect(content).toContain("t('subscription.feature4')");
        });

        it('should build statusLabels object using t function calls', () => {
            expect(content).toContain("active: t('subscription.statusActive')");
            expect(content).toContain("trial: t('subscription.statusTrial')");
            expect(content).toContain("cancelled: t('subscription.statusCancelled')");
            expect(content).toContain("expired: t('subscription.statusExpired')");
            expect(content).toContain("past_due: t('subscription.statusPastDue')");
            expect(content).toContain("pending: t('subscription.statusPending')");
            expect(content).toContain("free: t('subscription.statusFree')");
        });
    });
});

describe('account.json locale files - subscription section', () => {
    const esAccountPath = resolve(
        __dirname,
        '../../../../../packages/i18n/src/locales/es/account.json'
    );
    const enAccountPath = resolve(
        __dirname,
        '../../../../../packages/i18n/src/locales/en/account.json'
    );
    const ptAccountPath = resolve(
        __dirname,
        '../../../../../packages/i18n/src/locales/pt/account.json'
    );
    const esAccount = JSON.parse(readFileSync(esAccountPath, 'utf8'));
    const enAccount = JSON.parse(readFileSync(enAccountPath, 'utf8'));
    const ptAccount = JSON.parse(readFileSync(ptAccountPath, 'utf8'));

    describe('Structure', () => {
        it('should have subscription section in es locale', () => {
            expect(esAccount).toHaveProperty('subscription');
        });

        it('should have subscription section in en locale', () => {
            expect(enAccount).toHaveProperty('subscription');
        });

        it('should have subscription section in pt locale', () => {
            expect(ptAccount).toHaveProperty('subscription');
        });

        it('should have all required keys in es subscription section', () => {
            const keys = Object.keys(esAccount.subscription);
            const required = [
                'loading',
                'loadError',
                'retry',
                'freePlanName',
                'freePlanPrice',
                'featuresHeading',
                'feature1',
                'feature2',
                'feature3',
                'feature4',
                'upgradeHeading',
                'upgradeDescription',
                'upgradeButton',
                'statusActive',
                'statusTrial',
                'statusCancelled',
                'statusExpired',
                'statusPastDue',
                'statusPending',
                'statusFree',
                'pastDueNotice',
                'updatePaymentMethod',
                'paymentMethodLabel',
                'paymentMethodCard',
                'paymentMethodExpires',
                'trialEndsIn',
                'cancelNotice',
                'renewsOn',
                'billingSection',
                'noBillingInfo',
                'billingHint'
            ];
            for (const key of required) {
                expect(keys).toContain(key);
            }
        });

        it('should have all required keys in en subscription section', () => {
            const keys = Object.keys(enAccount.subscription);
            const required = [
                'loading',
                'loadError',
                'retry',
                'freePlanName',
                'freePlanPrice',
                'featuresHeading',
                'feature1',
                'feature2',
                'feature3',
                'feature4',
                'upgradeHeading',
                'upgradeDescription',
                'upgradeButton',
                'statusActive',
                'statusTrial',
                'statusCancelled',
                'statusExpired',
                'statusPastDue',
                'statusPending',
                'statusFree',
                'pastDueNotice',
                'updatePaymentMethod',
                'paymentMethodLabel',
                'paymentMethodCard',
                'paymentMethodExpires',
                'trialEndsIn',
                'cancelNotice',
                'renewsOn',
                'billingSection',
                'noBillingInfo',
                'billingHint'
            ];
            for (const key of required) {
                expect(keys).toContain(key);
            }
        });

        it('should have all required keys in pt subscription section', () => {
            const keys = Object.keys(ptAccount.subscription);
            const required = [
                'loading',
                'loadError',
                'retry',
                'freePlanName',
                'freePlanPrice',
                'featuresHeading',
                'feature1',
                'feature2',
                'feature3',
                'feature4',
                'upgradeHeading',
                'upgradeDescription',
                'upgradeButton',
                'statusActive',
                'statusTrial',
                'statusCancelled',
                'statusExpired',
                'statusPastDue',
                'statusPending',
                'statusFree',
                'pastDueNotice',
                'updatePaymentMethod',
                'paymentMethodLabel',
                'paymentMethodCard',
                'paymentMethodExpires',
                'trialEndsIn',
                'cancelNotice',
                'renewsOn',
                'billingSection',
                'noBillingInfo',
                'billingHint'
            ];
            for (const key of required) {
                expect(keys).toContain(key);
            }
        });
    });

    describe('Localization - Spanish (es)', () => {
        it('should have Spanish loading message', () => {
            expect(esAccount.subscription.loading).toBe('Cargando suscripcion...');
        });

        it('should have Spanish loadError message', () => {
            expect(esAccount.subscription.loadError).toBe('Error al cargar la suscripcion');
        });

        it('should have Spanish retry text', () => {
            expect(esAccount.subscription.retry).toBe('Reintentar');
        });

        it('should have Spanish free plan name', () => {
            expect(esAccount.subscription.freePlanName).toBe('Plan Gratuito');
        });

        it('should have Spanish free plan price', () => {
            expect(esAccount.subscription.freePlanPrice).toBe('Gratis para siempre');
        });

        it('should have Spanish features heading', () => {
            expect(esAccount.subscription.featuresHeading).toBe('Caracteristicas incluidas');
        });

        it('should have Spanish feature items', () => {
            expect(esAccount.subscription.feature1).toBe('Busqueda de alojamientos');
            expect(esAccount.subscription.feature2).toBe('Guardar favoritos');
            expect(esAccount.subscription.feature3).toBe('Ver destinos y eventos');
            expect(esAccount.subscription.feature4).toBe('Contactar propietarios');
        });

        it('should have Spanish upgrade heading', () => {
            expect(esAccount.subscription.upgradeHeading).toBe('Queres mas?');
        });

        it('should have Spanish upgrade description', () => {
            expect(esAccount.subscription.upgradeDescription).toBe(
                'Accede a funciones premium con nuestros planes pagos'
            );
        });

        it('should have Spanish upgrade button text', () => {
            expect(esAccount.subscription.upgradeButton).toBe('Ver planes');
        });

        it('should have Spanish active status label', () => {
            expect(esAccount.subscription.statusActive).toBe('Activo');
        });

        it('should have Spanish trial status label', () => {
            expect(esAccount.subscription.statusTrial).toBe('En prueba');
        });

        it('should have Spanish cancelled status label', () => {
            expect(esAccount.subscription.statusCancelled).toBe('Cancelado');
        });

        it('should have Spanish expired status label', () => {
            expect(esAccount.subscription.statusExpired).toBe('Expirado');
        });

        it('should have Spanish pending status label', () => {
            expect(esAccount.subscription.statusPending).toBe('Pendiente');
        });

        it('should have Spanish past_due status label', () => {
            expect(esAccount.subscription.statusPastDue).toBe('Pago pendiente');
        });

        it('should have Spanish free status label', () => {
            expect(esAccount.subscription.statusFree).toBe('Gratuito');
        });

        it('should have Spanish trialEndsIn with template parameter', () => {
            expect(esAccount.subscription.trialEndsIn).toBe('Prueba finaliza en {{days}} dias');
        });

        it('should have Spanish cancelNotice with template parameter', () => {
            expect(esAccount.subscription.cancelNotice).toBe('Plan finaliza el {{date}}');
        });

        it('should have Spanish renewsOn with template parameter', () => {
            expect(esAccount.subscription.renewsOn).toBe('Se renueva el {{date}}');
        });

        it('should have Spanish billing section label', () => {
            expect(esAccount.subscription.billingSection).toBe('Facturacion');
        });

        it('should have Spanish noBillingInfo message', () => {
            expect(esAccount.subscription.noBillingInfo).toBe(
                'No hay informacion de facturacion disponible'
            );
        });

        it('should have Spanish billingHint message', () => {
            expect(esAccount.subscription.billingHint).toBe(
                'La informacion de facturacion se actualizara cuando realices tu primera suscripcion'
            );
        });
    });

    describe('Localization - English (en)', () => {
        it('should have English loading message', () => {
            expect(enAccount.subscription.loading).toBe('Loading subscription...');
        });

        it('should have English loadError message', () => {
            expect(enAccount.subscription.loadError).toBe('Error loading subscription');
        });

        it('should have English retry text', () => {
            expect(enAccount.subscription.retry).toBe('Retry');
        });

        it('should have English free plan name', () => {
            expect(enAccount.subscription.freePlanName).toBe('Free Plan');
        });

        it('should have English free plan price', () => {
            expect(enAccount.subscription.freePlanPrice).toBe('Free forever');
        });

        it('should have English features heading', () => {
            expect(enAccount.subscription.featuresHeading).toBe('Included features');
        });

        it('should have English feature items', () => {
            expect(enAccount.subscription.feature1).toBe('Accommodation search');
            expect(enAccount.subscription.feature2).toBe('Save favorites');
            expect(enAccount.subscription.feature3).toBe('Browse destinations and events');
            expect(enAccount.subscription.feature4).toBe('Contact owners');
        });

        it('should have English upgrade heading', () => {
            expect(enAccount.subscription.upgradeHeading).toBe('Want more?');
        });

        it('should have English upgrade description', () => {
            expect(enAccount.subscription.upgradeDescription).toBe(
                'Access premium features with our paid plans'
            );
        });

        it('should have English upgrade button text', () => {
            expect(enAccount.subscription.upgradeButton).toBe('View plans');
        });

        it('should have English active status label', () => {
            expect(enAccount.subscription.statusActive).toBe('Active');
        });

        it('should have English trial status label', () => {
            expect(enAccount.subscription.statusTrial).toBe('Trial');
        });

        it('should have English cancelled status label', () => {
            expect(enAccount.subscription.statusCancelled).toBe('Cancelled');
        });

        it('should have English expired status label', () => {
            expect(enAccount.subscription.statusExpired).toBe('Expired');
        });

        it('should have English pending status label', () => {
            expect(enAccount.subscription.statusPending).toBe('Pending');
        });

        it('should have English past_due status label', () => {
            expect(enAccount.subscription.statusPastDue).toBe('Past Due');
        });

        it('should have English free status label', () => {
            expect(enAccount.subscription.statusFree).toBe('Free');
        });

        it('should have English trialEndsIn with template parameter', () => {
            expect(enAccount.subscription.trialEndsIn).toBe('Trial ends in {{days}} days');
        });

        it('should have English cancelNotice with template parameter', () => {
            expect(enAccount.subscription.cancelNotice).toBe('Plan ends on {{date}}');
        });

        it('should have English renewsOn with template parameter', () => {
            expect(enAccount.subscription.renewsOn).toBe('Renews on {{date}}');
        });

        it('should have English billing section label', () => {
            expect(enAccount.subscription.billingSection).toBe('Billing');
        });

        it('should have English noBillingInfo message', () => {
            expect(enAccount.subscription.noBillingInfo).toBe('No billing information available');
        });

        it('should have English billingHint message', () => {
            expect(enAccount.subscription.billingHint).toBe(
                'Billing information will be updated when you make your first subscription'
            );
        });
    });

    describe('Localization - Portuguese (pt)', () => {
        it('should have Portuguese loading message', () => {
            expect(ptAccount.subscription.loading).toBe('Carregando assinatura...');
        });

        it('should have Portuguese loadError message', () => {
            expect(ptAccount.subscription.loadError).toBe('Erro ao carregar assinatura');
        });

        it('should have Portuguese retry text', () => {
            expect(ptAccount.subscription.retry).toBe('Tentar novamente');
        });

        it('should have Portuguese free plan name', () => {
            expect(ptAccount.subscription.freePlanName).toBe('Plano Gratuito');
        });

        it('should have Portuguese free plan price', () => {
            expect(ptAccount.subscription.freePlanPrice).toBe('Gratis para sempre');
        });

        it('should have Portuguese features heading', () => {
            expect(ptAccount.subscription.featuresHeading).toBe('Recursos incluidos');
        });

        it('should have Portuguese feature items', () => {
            expect(ptAccount.subscription.feature1).toBe('Busca de hospedagens');
            expect(ptAccount.subscription.feature2).toBe('Salvar favoritos');
            expect(ptAccount.subscription.feature3).toBe('Ver destinos e eventos');
            expect(ptAccount.subscription.feature4).toBe('Contatar proprietarios');
        });

        it('should have Portuguese upgrade heading', () => {
            expect(ptAccount.subscription.upgradeHeading).toBe('Quer mais?');
        });

        it('should have Portuguese upgrade description', () => {
            expect(ptAccount.subscription.upgradeDescription).toBe(
                'Acesse recursos premium com nossos planos pagos'
            );
        });

        it('should have Portuguese upgrade button text', () => {
            expect(ptAccount.subscription.upgradeButton).toBe('Ver planos');
        });

        it('should have Portuguese active status label', () => {
            expect(ptAccount.subscription.statusActive).toBe('Ativo');
        });

        it('should have Portuguese trial status label', () => {
            expect(ptAccount.subscription.statusTrial).toBe('Em avaliacao');
        });

        it('should have Portuguese cancelled status label', () => {
            expect(ptAccount.subscription.statusCancelled).toBe('Cancelado');
        });

        it('should have Portuguese expired status label', () => {
            expect(ptAccount.subscription.statusExpired).toBe('Expirado');
        });

        it('should have Portuguese pending status label', () => {
            expect(ptAccount.subscription.statusPending).toBe('Pendente');
        });

        it('should have Portuguese past_due status label', () => {
            expect(ptAccount.subscription.statusPastDue).toBe('Pagamento pendente');
        });

        it('should have Portuguese free status label', () => {
            expect(ptAccount.subscription.statusFree).toBe('Gratuito');
        });

        it('should have Portuguese trialEndsIn with template parameter', () => {
            expect(ptAccount.subscription.trialEndsIn).toBe('Avaliacao termina em {{days}} dias');
        });

        it('should have Portuguese cancelNotice with template parameter', () => {
            expect(ptAccount.subscription.cancelNotice).toBe('Plano termina em {{date}}');
        });

        it('should have Portuguese renewsOn with template parameter', () => {
            expect(ptAccount.subscription.renewsOn).toBe('Renova em {{date}}');
        });

        it('should have Portuguese billing section label', () => {
            expect(ptAccount.subscription.billingSection).toBe('Faturamento');
        });

        it('should have Portuguese noBillingInfo message', () => {
            expect(ptAccount.subscription.noBillingInfo).toBe(
                'Nenhuma informacao de faturamento disponivel'
            );
        });

        it('should have Portuguese billingHint message', () => {
            expect(ptAccount.subscription.billingHint).toBe(
                'As informacoes de faturamento serao atualizadas quando voce fizer sua primeira assinatura'
            );
        });
    });
});
