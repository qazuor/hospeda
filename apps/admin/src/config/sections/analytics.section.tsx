/**
 * Analytics Section Configuration
 *
 * Routes: /analytics/*
 */

import { createSection, sidebar } from '@/lib/sections';
import { AnalyticsIcon, DebugIcon, MetricsIcon, StatisticsIcon } from '@repo/icons';
import { PermissionEnum } from '@repo/schemas';

export const analyticsSection = createSection({
    id: 'analytics',
    label: 'Analíticas',
    labelKey: 'admin-menu.analytics.title',
    icon: <AnalyticsIcon className="h-5 w-5" />,
    permissions: [PermissionEnum.ANALYTICS_VIEW, PermissionEnum.DEBUG_TOOLS_ACCESS],
    routes: ['/analytics', '/analytics/**'],
    defaultRoute: '/analytics/usage',
    sidebar: {
        title: 'Analíticas',
        titleKey: 'admin-menu.analytics.title',
        items: [
            sidebar.link('usage', 'Uso', '/analytics/usage', <MetricsIcon className="h-4 w-4" />, [
                PermissionEnum.ANALYTICS_VIEW
            ]),
            sidebar.link(
                'business',
                'Negocio',
                '/analytics/business',
                <StatisticsIcon className="h-4 w-4" />,
                [PermissionEnum.ANALYTICS_VIEW]
            ),
            sidebar.separator(),
            sidebar.link('debug', 'Debug', '/analytics/debug', <DebugIcon className="h-4 w-4" />, [
                PermissionEnum.DEBUG_TOOLS_ACCESS
            ])
        ]
    }
});
