/**
 * Billing Section Configuration
 *
 * Routes: /billing/*
 */

import { createSection, sidebar } from '@/lib/sections';
import {
    AddIcon,
    ClockIcon,
    CouponsIcon,
    CreditCardIcon,
    DollarSignIcon,
    FileTextIcon,
    ListIcon,
    MetricsIcon,
    OffersIcon,
    PriceIcon,
    PromotionsIcon,
    ReceiptIcon,
    SettingsIcon,
    TagsIcon
} from '@repo/icons';
import { PermissionEnum } from '@repo/schemas';

export const billingSection = createSection({
    id: 'billing',
    label: 'Facturación',
    labelKey: 'admin-menu.billing.title',
    icon: <CreditCardIcon className="h-5 w-5" />,
    routes: ['/billing', '/billing/**'],
    defaultRoute: '/billing/plans',
    sidebar: {
        title: 'Facturación',
        titleKey: 'admin-menu.billing.title',
        items: [
            sidebar.group(
                'subscription-management',
                'Gestión de Suscripciones',
                [
                    sidebar.link(
                        'plans',
                        'Planes',
                        '/billing/plans',
                        <ListIcon className="h-4 w-4" />,
                        [PermissionEnum.PRICING_PLAN_VIEW, PermissionEnum.PRICING_PLAN_CREATE]
                    ),
                    sidebar.link(
                        'subscriptions',
                        'Suscripciones',
                        '/billing/subscriptions',
                        <ReceiptIcon className="h-4 w-4" />,
                        [PermissionEnum.SUBSCRIPTION_VIEW, PermissionEnum.SUBSCRIPTION_CREATE]
                    ),
                    sidebar.link(
                        'addons',
                        'Add-ons',
                        '/billing/addons',
                        <AddIcon className="h-4 w-4" />,
                        [
                            PermissionEnum.SUBSCRIPTION_ITEM_VIEW,
                            PermissionEnum.SUBSCRIPTION_ITEM_CREATE
                        ]
                    )
                ],
                <CreditCardIcon className="h-4 w-4" />,
                true // expanded by default
            ),
            sidebar.separator(),
            sidebar.group(
                'payments',
                'Pagos y Facturación',
                [
                    sidebar.link(
                        'payments',
                        'Pagos',
                        '/billing/payments',
                        <PriceIcon className="h-4 w-4" />,
                        [PermissionEnum.PAYMENT_VIEW]
                    ),
                    sidebar.link(
                        'invoices',
                        'Facturas',
                        '/billing/invoices',
                        <FileTextIcon className="h-4 w-4" />,
                        [PermissionEnum.INVOICE_VIEW]
                    )
                ],
                <ReceiptIcon className="h-4 w-4" />
            ),
            sidebar.separator(),
            sidebar.group(
                'promotions',
                'Promociones',
                [
                    sidebar.link(
                        'promo-codes',
                        'Códigos Promocionales',
                        '/billing/promo-codes',
                        <CouponsIcon className="h-4 w-4" />,
                        [PermissionEnum.DISCOUNT_CODE_VIEW]
                    ),
                    sidebar.link(
                        'sponsorships',
                        'Patrocinios',
                        '/billing/sponsorships',
                        <PromotionsIcon className="h-4 w-4" />,
                        [PermissionEnum.SPONSORSHIP_VIEW, PermissionEnum.SPONSORSHIP_CREATE]
                    ),
                    sidebar.link(
                        'owner-promotions',
                        'Promociones de Propietarios',
                        '/billing/owner-promotions',
                        <OffersIcon className="h-4 w-4" />,
                        [PermissionEnum.OWNER_PROMOTION_VIEW, PermissionEnum.OWNER_PROMOTION_CREATE]
                    )
                ],
                <TagsIcon className="h-4 w-4" />
            ),
            sidebar.separator(),
            sidebar.link(
                'exchange-rates',
                'Tasas de Cambio',
                '/billing/exchange-rates',
                <DollarSignIcon className="h-4 w-4" />,
                [PermissionEnum.EXCHANGE_RATE_VIEW]
            ),
            sidebar.separator(),
            sidebar.link(
                'metrics',
                'Métricas',
                '/billing/metrics',
                <MetricsIcon className="h-4 w-4" />,
                [PermissionEnum.ANALYTICS_VIEW]
            ),
            sidebar.link(
                'settings',
                'Configuración',
                '/billing/settings',
                <SettingsIcon className="h-4 w-4" />,
                [PermissionEnum.ACCESS_PANEL_ADMIN]
            ),
            sidebar.link(
                'cron',
                'Tareas Programadas',
                '/billing/cron',
                <ClockIcon className="h-4 w-4" />,
                [PermissionEnum.ACCESS_PANEL_ADMIN]
            )
        ]
    }
});
