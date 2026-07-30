export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export interface PostHogDashboard {
    readonly id: number;
    readonly name: string;
    readonly description?: string | null;
    readonly tags?: readonly string[];
}

export interface PostHogCohort {
    readonly id: number;
    readonly name: string;
    readonly description?: string | null;
    readonly filters?: Json;
}

export interface PostHogInsight {
    readonly dashboards?: readonly number[];
    readonly id: number;
    readonly name?: string | null;
    readonly derived_name?: string | null;
}

export interface PostHogAnnotation {
    readonly id: number;
    readonly content: string;
    readonly date_marker?: string | null;
}

export interface SetupResourceDefinition {
    readonly description: string;
    readonly name: string;
    readonly tags?: readonly string[];
}

export interface InsightDefinition {
    readonly dashboardName: string;
    readonly description: string;
    readonly legacyNames?: readonly string[];
    readonly name: string;
    readonly query: Json;
    readonly tags?: readonly string[];
}

function prodOnlyWhere(extra: readonly string[] = []): string {
    return [
        "event = '$pageview'",
        "coalesce(nullIf(JSONExtractString(properties, 'environment'), ''), 'unknown') = 'production'",
        ...extra
    ].join(' AND ');
}

export function sqlInsight(input: { name: string; query: string }): Json {
    return {
        kind: 'InsightVizNode',
        source: {
            kind: 'HogQLQuery',
            query: input.query,
            name: input.name
        }
    };
}

export function trendInsight(input: {
    breakdown?: {
        readonly property: string;
        readonly type: 'event' | 'person';
    };
    event: string;
    interval?: 'day' | 'week' | 'month';
    math?: 'total';
    dateFrom?: string;
}): Json {
    return {
        kind: 'InsightVizNode',
        source: {
            kind: 'TrendsQuery',
            series: [
                {
                    kind: 'EventsNode',
                    name: input.event,
                    event: input.event,
                    math: input.math ?? 'total'
                }
            ],
            interval: input.interval ?? 'day',
            dateRange: {
                date_from: input.dateFrom ?? '-30d'
            },
            breakdownFilter: input.breakdown
                ? {
                      breakdown: input.breakdown.property,
                      breakdown_type: input.breakdown.type
                  }
                : null,
            trendsFilter: {},
            filterTestAccounts: false,
            version: 2
        }
    };
}

export function funnelInsight(input: {
    dateFrom?: string;
    steps: readonly { event: string; name: string }[];
}): Json {
    return {
        kind: 'InsightVizNode',
        source: {
            kind: 'FunnelsQuery',
            series: input.steps.map((step) => ({
                kind: 'EventsNode',
                event: step.event,
                name: step.name
            })),
            dateRange: {
                date_from: input.dateFrom ?? '-30d'
            },
            funnelsFilter: {
                funnelOrderType: 'ordered',
                funnelVizType: 'steps'
            },
            filterTestAccounts: false,
            version: 2
        }
    };
}

export function pageviewWhere(extra: readonly string[] = []): string {
    return prodOnlyWhere(extra);
}

export function buildPlaceholderCohortFilters(name: string): Json {
    switch (name) {
        case 'Owners registrados':
            return {
                properties: {
                    type: 'AND',
                    values: [
                        { key: 'user_type', type: 'person', value: 'owner', operator: 'exact' }
                    ]
                }
            };
        case 'Owners con alojamiento publicado':
            return {
                properties: {
                    type: 'AND',
                    values: [
                        { key: 'user_type', type: 'person', value: 'owner', operator: 'exact' },
                        {
                            key: 'has_published_accommodation',
                            type: 'person',
                            value: true,
                            operator: 'exact'
                        }
                    ]
                }
            };
        case 'Owners sin alojamiento publicado':
            return {
                properties: {
                    type: 'AND',
                    values: [
                        { key: 'user_type', type: 'person', value: 'owner', operator: 'exact' },
                        {
                            key: 'has_published_accommodation',
                            type: 'person',
                            value: true,
                            operator: 'exact',
                            negation: true
                        }
                    ]
                }
            };
        case 'Usuarios con suscripción activa':
            return {
                properties: {
                    type: 'AND',
                    values: [
                        { key: 'plan_status', type: 'person', value: 'active', operator: 'exact' }
                    ]
                }
            };
        case 'Plan básico':
            return {
                properties: {
                    type: 'AND',
                    values: [
                        { key: 'plan', type: 'person', value: 'owner-basico', operator: 'exact' }
                    ]
                }
            };
        case 'Plan pro':
            return {
                properties: {
                    type: 'AND',
                    values: [{ key: 'plan', type: 'person', value: 'owner-pro', operator: 'exact' }]
                }
            };
        case 'Plan premium':
            return {
                properties: {
                    type: 'AND',
                    values: [
                        { key: 'plan', type: 'person', value: 'owner-premium', operator: 'exact' }
                    ]
                }
            };
        case 'Usuarios en trial':
            return {
                properties: {
                    type: 'AND',
                    values: [
                        {
                            key: 'last_checkout_outcome',
                            type: 'person',
                            value: 'trial',
                            operator: 'exact'
                        }
                    ]
                }
            };
        default:
            return {
                properties: {
                    type: 'AND',
                    values: []
                }
            };
    }
}
