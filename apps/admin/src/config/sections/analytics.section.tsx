/**
 * Analytics Section Configuration
 *
 * Routes: /analytics/*
 */

import { createSection, sidebar } from '@/lib/sections';
import { AnalyticsIcon, DebugIcon, MetricsIcon, StatisticsIcon } from '@repo/icons';

export const analyticsSection = createSection({
    id: 'analytics',
    label: 'Analíticas',
    labelKey: 'admin-menu.analytics.title',
    icon: <AnalyticsIcon className="h-5 w-5" />,
    routes: ['/analytics', '/analytics/**'],
    defaultRoute: '/analytics/usage',
    sidebar: {
        title: 'Analíticas',
        titleKey: 'admin-menu.analytics.title',
        items: [
            sidebar.link('usage', 'Uso', '/analytics/usage', <MetricsIcon className="h-4 w-4" />),
            sidebar.link(
                'business',
                'Negocio',
                '/analytics/business',
                <StatisticsIcon className="h-4 w-4" />
            ),
            sidebar.separator(),
            sidebar.link('debug', 'Debug', '/analytics/debug', <DebugIcon className="h-4 w-4" />)
        ]
    }
});
