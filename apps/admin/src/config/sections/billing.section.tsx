/**
 * Billing Section Configuration
 *
 * Routes: /billing/*
 */

import { createSection, sidebar } from '@/lib/sections';
import {
    AddIcon,
    CouponsIcon,
    ListIcon,
    MetricsIcon,
    OffersIcon,
    PriceIcon,
    PromotionsIcon,
    SettingsIcon
} from '@repo/icons';
import { CreditCard, FileText, Receipt, Tags } from 'lucide-react';

export const billingSection = createSection({
    id: 'billing',
    label: 'Facturación',
    labelKey: 'admin-menu.billing.title',
    icon: <CreditCard className="h-5 w-5" />,
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
                        <ListIcon className="h-4 w-4" />
                    ),
                    sidebar.link(
                        'subscriptions',
                        'Suscripciones',
                        '/billing/subscriptions',
                        <Receipt className="h-4 w-4" />
                    ),
                    sidebar.link(
                        'addons',
                        'Add-ons',
                        '/billing/addons',
                        <AddIcon className="h-4 w-4" />
                    )
                ],
                <CreditCard className="h-4 w-4" />,
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
                        <PriceIcon className="h-4 w-4" />
                    ),
                    sidebar.link(
                        'invoices',
                        'Facturas',
                        '/billing/invoices',
                        <FileText className="h-4 w-4" />
                    )
                ],
                <Receipt className="h-4 w-4" />
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
                        <CouponsIcon className="h-4 w-4" />
                    ),
                    sidebar.link(
                        'sponsorships',
                        'Patrocinios',
                        '/billing/sponsorships',
                        <PromotionsIcon className="h-4 w-4" />
                    ),
                    sidebar.link(
                        'owner-promotions',
                        'Promociones de Propietarios',
                        '/billing/owner-promotions',
                        <OffersIcon className="h-4 w-4" />
                    )
                ],
                <Tags className="h-4 w-4" />
            ),
            sidebar.separator(),
            sidebar.link(
                'metrics',
                'Métricas',
                '/billing/metrics',
                <MetricsIcon className="h-4 w-4" />
            ),
            sidebar.link(
                'settings',
                'Configuración',
                '/billing/settings',
                <SettingsIcon className="h-4 w-4" />
            )
        ]
    }
});
