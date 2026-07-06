/**
 * @file PlatformBreakdownChart.tsx
 * @description Per-platform target-count bar chart for the social dashboard (HOS-66 T-010).
 *
 * Renders `platformBreakdown` (HOS-66 T-006/T-007, `{ platform, count }[]`) as a
 * single-series bar chart, one bar per platform, colored from a fixed
 * per-platform palette (validated via the dataviz skill's palette validator).
 * A plain accessible list of counts renders alongside the chart so the data
 * is available without relying on the (mocked-in-tests, SVG-only) chart marks.
 *
 * Charting approach mirrors `AiUsageFeatureModelChart`: raw recharts
 * primitives, no `ChartContainer` wrapper.
 */

import type { SocialDashboardPlatformBreakdownItem } from '@repo/schemas';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';

/** Props for {@link PlatformBreakdownChart}. */
export interface PlatformBreakdownChartProps {
    readonly data: readonly SocialDashboardPlatformBreakdownItem[];
}

/**
 * Fixed color per platform (validated: `node scripts/validate_palette.js
 * "#2563eb,#16a34a,#d97706" --mode light` — all checks pass). Colors are
 * keyed by platform name, not array position, so identity never shifts
 * if the backend's platform order changes.
 */
const PLATFORM_COLORS: Record<string, string> = {
    INSTAGRAM: '#2563eb', // blue-600
    FACEBOOK: '#16a34a', // green-600
    X: '#d97706' // amber-600
};

const FALLBACK_COLOR = '#64748b'; // slate-500, for any future platform not yet in the map

/**
 * Per-platform target-count bar chart.
 *
 * @param props - {@link PlatformBreakdownChartProps}
 */
export function PlatformBreakdownChart({ data }: PlatformBreakdownChartProps) {
    const { t } = useTranslations();

    return (
        <Card data-testid="platform-breakdown-chart">
            <CardHeader>
                <CardTitle>{t('social.dashboard.platformBreakdown.title')}</CardTitle>
            </CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    <p
                        className="text-muted-foreground text-sm"
                        data-testid="platform-breakdown-empty"
                    >
                        {t('social.dashboard.platformBreakdown.empty')}
                    </p>
                ) : (
                    <>
                        <div
                            role="img"
                            aria-label={t('social.dashboard.platformBreakdown.title')}
                        >
                            <ResponsiveContainer
                                width="100%"
                                height={220}
                            >
                                <BarChart
                                    data={[...data]}
                                    margin={{ top: 8, right: 16, left: 8, bottom: 4 }}
                                >
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        vertical={false}
                                    />
                                    <XAxis
                                        dataKey="platform"
                                        tick={{ fontSize: 11 }}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        allowDecimals={false}
                                        tick={{ fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={false}
                                        width={32}
                                    />
                                    <Tooltip labelStyle={{ fontWeight: 600 }} />
                                    <Bar
                                        dataKey="count"
                                        radius={[2, 2, 0, 0]}
                                    >
                                        {data.map((item) => (
                                            <Cell
                                                key={item.platform}
                                                fill={
                                                    PLATFORM_COLORS[item.platform] ?? FALLBACK_COLOR
                                                }
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        {/* Accessible plain-text counts — the "table view" the dataviz
                            accessibility pass requires alongside any chart. */}
                        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                            {data.map((item) => (
                                <li
                                    key={item.platform}
                                    data-testid={`platform-breakdown-item-${item.platform}`}
                                    className="flex items-center gap-1.5"
                                >
                                    <span
                                        aria-hidden="true"
                                        className="inline-block h-2.5 w-2.5 rounded-full"
                                        style={{
                                            backgroundColor:
                                                PLATFORM_COLORS[item.platform] ?? FALLBACK_COLOR
                                        }}
                                    />
                                    <span className="text-muted-foreground">{item.platform}</span>
                                    <span className="font-medium">{item.count}</span>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
