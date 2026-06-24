/**
 * @file tours.ts
 * @description Web welcome tour configurations for hosts and commerce owners.
 *
 * These are the web-specific equivalents of the admin's tour configs
 * (apps/admin/src/config/ia/tours.ts). They define different DOM selectors
 * because the web layout is different from the admin panel.
 */

export interface TourStepConfig {
    readonly id: string;
    readonly target: string;
    readonly title: string;
    readonly body: string;
    readonly side?: 'top' | 'right' | 'bottom' | 'left';
    readonly align?: 'start' | 'center' | 'end';
}

export interface TourConfig {
    readonly id: string;
    readonly version: number;
    readonly roles: ReadonlyArray<string>;
    readonly trigger: 'auto-first-visit';
    readonly steps: ReadonlyArray<TourStepConfig>;
}

export const WEB_TOURS: ReadonlyArray<TourConfig> = [
    {
        id: 'host.welcome',
        version: 1,
        roles: ['HOST', 'ADMIN', 'SUPER_ADMIN', 'CLIENT_MANAGER', 'EDITOR'],
        trigger: 'auto-first-visit',
        steps: [
            {
                id: 'greeting',
                target: 'center',
                title: 'account.welcomeTour.greetingHost.title',
                body: 'account.welcomeTour.greetingHost.body',
                side: 'bottom',
                align: 'center'
            },
            {
                id: 'properties',
                target: '[data-tour="properties"]',
                title: 'account.welcomeTour.properties.title',
                body: 'account.welcomeTour.properties.body',
                side: 'right',
                align: 'start'
            },
            {
                id: 'host-dashboard',
                target: '[data-tour="host-dashboard"]',
                title: 'account.welcomeTour.hostDashboard.title',
                body: 'account.welcomeTour.hostDashboard.body',
                side: 'right',
                align: 'start'
            },
            {
                id: 'messages',
                target: '[data-tour="messages"]',
                title: 'account.welcomeTour.messages.title',
                body: 'account.welcomeTour.messages.body',
                side: 'right',
                align: 'start'
            },
            {
                id: 'promotions',
                target: '[data-tour="promotions"]',
                title: 'account.welcomeTour.promotions.title',
                body: 'account.welcomeTour.promotions.body',
                side: 'right',
                align: 'start'
            },
            {
                id: 'profile',
                target: '[data-tour="profile"]',
                title: 'account.welcomeTour.profile.title',
                body: 'account.welcomeTour.profile.body',
                side: 'right',
                align: 'start'
            }
        ]
    },
    {
        id: 'commerce.welcome',
        version: 1,
        roles: ['COMMERCE_OWNER'],
        trigger: 'auto-first-visit',
        steps: [
            {
                id: 'greeting',
                target: 'center',
                title: 'account.welcomeTour.greetingCommerce.title',
                body: 'account.welcomeTour.greetingCommerce.body',
                side: 'bottom',
                align: 'center'
            },
            {
                id: 'commerce',
                target: '[data-tour="commerce"]',
                title: 'account.welcomeTour.commerce.title',
                body: 'account.welcomeTour.commerce.body',
                side: 'right',
                align: 'start'
            },
            {
                id: 'messages',
                target: '[data-tour="messages"]',
                title: 'account.welcomeTour.messages.title',
                body: 'account.welcomeTour.messages.body',
                side: 'right',
                align: 'start'
            },
            {
                id: 'profile',
                target: '[data-tour="profile"]',
                title: 'account.welcomeTour.profile.title',
                body: 'account.welcomeTour.profile.body',
                side: 'right',
                align: 'start'
            }
        ]
    }
];

export function getWelcomeTourForRole(role: string | null): TourConfig | undefined {
    if (!role) return undefined;
    return WEB_TOURS.find(
        (tour) => tour.trigger === 'auto-first-visit' && tour.roles.includes(role)
    );
}
