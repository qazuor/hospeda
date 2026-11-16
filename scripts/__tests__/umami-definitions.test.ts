import { describe, expect, it } from 'vitest';
import { AnalyticsEventSchemas } from '../../packages/analytics/src/catalog.js';
import {
    assertCatalogEvent,
    buildBoardDefinition,
    buildFunnelReport,
    buildGoalReport,
    buildReportDefinitions,
    DEFAULT_FUNNEL_WINDOW_MINUTES,
    DEFAULT_LOOKBACK_DAYS,
    HOSPEDA_FUNNELS,
    HOSPEDA_GOALS,
    resolveDateRange,
    UmamiDefinitionError
} from '../umami/definitions.js';

function catchError(fn: () => unknown): UmamiDefinitionError {
    try {
        fn();
    } catch (error) {
        if (error instanceof UmamiDefinitionError) return error;
        throw error;
    }
    throw new Error('expected the call to throw');
}

describe('assertCatalogEvent', () => {
    it('should return the name when it is a catalog event', () => {
        expect(assertCatalogEvent('sign_up_completed')).toBe('sign_up_completed');
    });

    it('should throw UNKNOWN_EVENT when the name is not a catalog key', () => {
        const error = catchError(() => assertCatalogEvent('not_an_event'));
        expect(error.code).toBe('UNKNOWN_EVENT');
        expect(error.detail).toBe('not_an_event');
    });

    it('should reject inherited object keys', () => {
        expect(catchError(() => assertCatalogEvent('toString')).code).toBe('UNKNOWN_EVENT');
    });
});

describe('buildFunnelReport', () => {
    const steps = [
        { type: 'event', event: 'billing_checkout_started' },
        { type: 'event', event: 'billing_subscription_activated' },
        { type: 'event', event: 'billing_charge_succeeded' }
    ] as const;

    it('should keep the step order and use the measured parameter shape', () => {
        const report = buildFunnelReport({ name: 'f', description: 'd', steps });
        expect(report.type).toBe('funnel');
        expect(report.parameters).toEqual({
            window: DEFAULT_FUNNEL_WINDOW_MINUTES,
            steps: [
                { type: 'event', value: 'billing_checkout_started' },
                { type: 'event', value: 'billing_subscription_activated' },
                { type: 'event', value: 'billing_charge_succeeded' }
            ]
        });
    });

    it('should accept path steps and an explicit window', () => {
        const report = buildFunnelReport({
            name: 'f',
            description: 'd',
            windowMinutes: 60,
            steps: [
                { type: 'path', path: '/' },
                { type: 'event', event: 'sign_up_completed' }
            ]
        });
        expect(report.parameters).toEqual({
            window: 60,
            steps: [
                { type: 'path', value: '/' },
                { type: 'event', value: 'sign_up_completed' }
            ]
        });
    });

    it('should throw UNKNOWN_EVENT for an event outside the catalog', () => {
        const error = catchError(() =>
            buildFunnelReport({
                name: 'f',
                description: 'd',
                steps: [
                    { type: 'event', event: 'sign_up_completed' },
                    { type: 'event', event: 'subscription_created' }
                ]
            })
        );
        expect(error.code).toBe('UNKNOWN_EVENT');
    });

    it('should throw INVALID_FUNNEL with fewer than two steps', () => {
        const error = catchError(() =>
            buildFunnelReport({
                name: 'f',
                description: 'd',
                steps: [{ type: 'event', event: 'sign_up_completed' }]
            })
        );
        expect(error.code).toBe('INVALID_FUNNEL');
    });

    it('should throw INVALID_PATH when a path does not start with a slash', () => {
        const error = catchError(() =>
            buildFunnelReport({
                name: 'f',
                description: 'd',
                steps: [
                    { type: 'path', path: 'home' },
                    { type: 'event', event: 'sign_up_completed' }
                ]
            })
        );
        expect(error.code).toBe('INVALID_PATH');
    });

    it.each([0, -5, 1.5, Number.NaN])('should throw INVALID_WINDOW for %s', (windowMinutes) => {
        const error = catchError(() =>
            buildFunnelReport({ name: 'f', description: 'd', steps, windowMinutes })
        );
        expect(error.code).toBe('INVALID_WINDOW');
    });
});

describe('buildGoalReport', () => {
    it('should build an event goal', () => {
        const report = buildGoalReport({ name: 'g', description: 'd', event: 'sign_up_completed' });
        expect(report).toEqual({
            name: 'g',
            type: 'goal',
            description: 'd',
            parameters: { type: 'event', value: 'sign_up_completed' }
        });
    });

    it('should throw UNKNOWN_EVENT for a non-catalog event', () => {
        const error = catchError(() =>
            buildGoalReport({ name: 'g', description: 'd', event: 'nope' })
        );
        expect(error.code).toBe('UNKNOWN_EVENT');
    });
});

describe('resolveDateRange', () => {
    it('should default to the 30 day look-back of the PostHog insights', () => {
        const range = resolveDateRange({ now: 1_700_000_000_000 });
        expect(DEFAULT_LOOKBACK_DAYS).toBe(30);
        expect(range).toEqual({
            startAt: 1_700_000_000_000 - 30 * 86_400_000,
            endAt: 1_700_000_000_000
        });
    });

    it('should honour an explicit number of days', () => {
        expect(resolveDateRange({ now: 10 * 86_400_000, days: 7 }).startAt).toBe(3 * 86_400_000);
    });
});

describe('buildReportDefinitions', () => {
    it('should be deterministic and JSON-stable across builds', () => {
        const first = buildReportDefinitions();
        const second = buildReportDefinitions();
        expect(first).toEqual(second);
        expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    it('should list funnels before goals with unique names', () => {
        const reports = buildReportDefinitions();
        expect(reports.map((report) => report.type)).toEqual([
            ...HOSPEDA_FUNNELS.map(() => 'funnel'),
            ...HOSPEDA_GOALS.map(() => 'goal')
        ]);
        const names = reports.map((report) => report.name);
        expect(new Set(names).size).toBe(names.length);
    });

    it('should only reference events that exist in AnalyticsEventSchemas', () => {
        const catalog = new Set(Object.keys(AnalyticsEventSchemas));
        const referenced = buildReportDefinitions().flatMap((report) => {
            if (report.type === 'goal') return [String(report.parameters['value'])];
            const steps = report.parameters['steps'] as readonly { type: string; value: string }[];
            return steps.filter((step) => step.type === 'event').map((step) => step.value);
        });
        expect(referenced.length).toBeGreaterThan(0);
        for (const eventName of referenced) {
            expect(catalog.has(eventName)).toBe(true);
        }
    });
});

describe('buildBoardDefinition', () => {
    const reportIds = { 'Funnel · Suscripción': 'report-id-1' };

    it('should build positional ids and resolve report ids deterministically', () => {
        const input = {
            name: 'b',
            description: 'd',
            websiteId: 'site-1',
            reportIds,
            rows: [
                [
                    { kind: 'metricsBar', title: 'Resumen' },
                    { kind: 'funnel', title: 'Suscripción', reportName: 'Funnel · Suscripción' }
                ],
                [{ kind: 'metricsTable', title: 'Referrers', dimension: 'referrer' }]
            ]
        } as const;
        const board = buildBoardDefinition(input);
        expect(board.type).toBe('website');
        expect(board.parameters).toEqual({
            websiteId: 'site-1',
            rows: [
                {
                    id: 'row-1',
                    columns: [
                        {
                            id: 'col-1-1',
                            component: {
                                type: 'WebsiteMetricsBar',
                                title: 'Resumen',
                                description: ''
                            }
                        },
                        {
                            id: 'col-1-2',
                            component: {
                                type: 'Funnel',
                                title: 'Suscripción',
                                description: '',
                                props: { reportId: 'report-id-1' }
                            }
                        }
                    ]
                },
                {
                    id: 'row-2',
                    columns: [
                        {
                            id: 'col-2-1',
                            component: {
                                type: 'MetricsTable',
                                title: 'Referrers',
                                description: '',
                                props: { type: 'referrer', limit: 10 }
                            }
                        }
                    ]
                }
            ]
        });
        expect(JSON.stringify(buildBoardDefinition(input))).toBe(JSON.stringify(board));
    });

    it('should throw UNRESOLVED_REPORT when a goal names an unknown report', () => {
        const error = catchError(() =>
            buildBoardDefinition({
                name: 'b',
                description: 'd',
                websiteId: 'site-1',
                reportIds: {},
                rows: [[{ kind: 'goal', title: 'g', reportName: 'missing' }]]
            })
        );
        expect(error.code).toBe('UNRESOLVED_REPORT');
        expect(error.detail).toBe('missing');
    });
});
