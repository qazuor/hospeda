/**
 * AI Usage Dashboard Page (SPEC-260 T-014)
 *
 * Entry point for the AI usage reporting surface. Displays consumption
 * metrics across models, providers, features, and time — all driven by
 * the four SPEC-260 API endpoints:
 *   GET /api/v1/admin/ai/usage/by-model
 *   GET /api/v1/admin/ai/usage/by-provider
 *   GET /api/v1/admin/ai/usage/by-feature-model
 *   GET /api/v1/admin/ai/usage/daily
 *
 * This file owns the route definition, guard, search-param validation, and
 * filter top-bar. Placeholder sections mark where T-015/T-016/T-017 will
 * insert totals cards, tables, and charts.
 *
 * Route: /ai/usage
 * Guard: AI_SETTINGS_MANAGE permission (SUPER_ADMIN only in practice)
 * Search params: AiUsageDailySearchSchema (superset of all four endpoint filters)
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    AiUsageByFeatureModelTable,
    AiUsageByFeatureTable,
    AiUsageByModelTable,
    AiUsageByProviderTable,
    AiUsageDailySearchSchema,
    AiUsageFeatureModelChart,
    AiUsageTotalsCard
} from '@/features/ai-usage';
import type { AiUsageDailySearch } from '@/features/ai-usage';
import { requireAiAccess } from '@/lib/ai-access';
import { FilterIcon, RotateCcwIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/_authed/ai/usage')({
    beforeLoad: ({ context }) => requireAiAccess(context),
    validateSearch: AiUsageDailySearchSchema,
    component: AiUsagePage
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** AI feature options for the filter dropdown. */
const AI_FEATURES = [
    { value: 'text_improve', label: 'Text Improve' },
    { value: 'chat', label: 'Chat' },
    { value: 'search', label: 'Search' },
    { value: 'support', label: 'Support' },
    { value: 'translate', label: 'Translate' },
    { value: 'accommodation_import', label: 'Accommodation Import' },
    { value: 'post_generate', label: 'Post Generate' }
] as const;

/** Well-known AI provider options. New providers auto-appear once data flows in. */
const KNOWN_PROVIDERS = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'stub', label: 'Stub (test)' }
] as const;

/** Current UTC year — used as the default year for the month picker. */
const CURRENT_YEAR = new Date().getUTCFullYear();

/** Month options 1–12 for the month picker. */
const MONTHS = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
] as const;

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

/**
 * AI Usage Dashboard page.
 *
 * Renders the filter top-bar (month/date-range window + feature / provider /
 * model selects + reset) and placeholder sections for T-015..T-017.
 *
 * Filter state lives exclusively in URL search params via TanStack Router's
 * `validateSearch` + `useSearch()` + `navigate({ search: ... })` so every
 * filter combination produces a shareable, bookmarkable URL.
 */
export function AiUsagePage() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();

    // -----------------------------------------------------------------------
    // Derived UI state
    // -----------------------------------------------------------------------

    /**
     * Whether the user has selected explicit date-range mode (since/until)
     * vs. calendar-month mode (year+month). We detect this by checking whether
     * either `since` or `until` is defined in the current search params.
     */
    const isDateRangeMode = Boolean(search.since ?? search.until);

    // -----------------------------------------------------------------------
    // Filter change handlers
    // -----------------------------------------------------------------------

    /**
     * Updates a single search-param key while preserving all others.
     * Always resets `page` to 1 on any filter change.
     */
    const setFilter = (key: keyof AiUsageDailySearch, value: string | number | undefined) => {
        void navigate({
            search: (prev: AiUsageDailySearch) => ({ ...prev, [key]: value, page: 1 })
        });
    };

    /**
     * Switches the time-window mode.
     * - Month mode: clears `since`/`until`, keeps `year`/`month`.
     * - Date-range mode: clears `year`/`month`, keeps `since`/`until`.
     */
    const setWindowMode = (mode: 'month' | 'dateRange') => {
        if (mode === 'month') {
            void navigate({
                search: (prev: AiUsageDailySearch) => ({
                    ...prev,
                    since: undefined,
                    until: undefined,
                    page: 1
                })
            });
        } else {
            void navigate({
                search: (prev: AiUsageDailySearch) => ({
                    ...prev,
                    year: undefined,
                    month: undefined,
                    page: 1
                })
            });
        }
    };

    /** Resets all filters to defaults (no window, no narrow filters). */
    const resetFilters = () => {
        void navigate({
            search: {
                page: 1,
                pageSize: search.pageSize
            }
        });
    };

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-semibold text-2xl tracking-tight">AI Usage Dashboard</h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Monitor AI consumption by feature, model, and provider. All costs in µUSD (1
                        USD = 1,000,000 µUSD).
                    </p>
                </div>
            </div>

            {/* ----------------------------------------------------------------
             * FILTER TOP-BAR
             * Manages: time window (month OR date-range), feature, provider,
             * model, and reset. Every change navigates with new search params.
             * --------------------------------------------------------------- */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <FilterIcon className="h-4 w-4" />
                        Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4">
                        {/* Time-window mode toggle */}
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs">Window mode</Label>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={isDateRangeMode ? 'outline' : 'default'}
                                    onClick={() => setWindowMode('month')}
                                >
                                    Month
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={isDateRangeMode ? 'default' : 'outline'}
                                    onClick={() => setWindowMode('dateRange')}
                                >
                                    Date range
                                </Button>
                            </div>
                        </div>

                        {/* Month mode: year + month pickers */}
                        {!isDateRangeMode && (
                            <>
                                <div className="flex flex-col gap-1.5">
                                    <Label
                                        htmlFor="year-input"
                                        className="text-xs"
                                    >
                                        Year
                                    </Label>
                                    <Input
                                        id="year-input"
                                        type="number"
                                        min={2024}
                                        max={2100}
                                        className="w-24"
                                        placeholder={String(CURRENT_YEAR)}
                                        value={search.year ?? ''}
                                        onChange={(e) => {
                                            const val = e.target.value
                                                ? Number(e.target.value)
                                                : undefined;
                                            setFilter('year', val);
                                        }}
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-xs">Month</Label>
                                    <Select
                                        value={search.month ? String(search.month) : ''}
                                        onValueChange={(v) =>
                                            setFilter('month', v ? Number(v) : undefined)
                                        }
                                    >
                                        <SelectTrigger className="w-36">
                                            <SelectValue placeholder="All months" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {MONTHS.map((m) => (
                                                <SelectItem
                                                    key={m.value}
                                                    value={String(m.value)}
                                                >
                                                    {m.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        )}

                        {/* Date-range mode: since + until */}
                        {isDateRangeMode && (
                            <>
                                <div className="flex flex-col gap-1.5">
                                    <Label
                                        htmlFor="since-input"
                                        className="text-xs"
                                    >
                                        From (YYYY-MM-DD)
                                    </Label>
                                    <Input
                                        id="since-input"
                                        type="date"
                                        className="w-44"
                                        value={search.since ?? ''}
                                        onChange={(e) =>
                                            setFilter('since', e.target.value || undefined)
                                        }
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <Label
                                        htmlFor="until-input"
                                        className="text-xs"
                                    >
                                        To (YYYY-MM-DD)
                                    </Label>
                                    <Input
                                        id="until-input"
                                        type="date"
                                        className="w-44"
                                        value={search.until ?? ''}
                                        onChange={(e) =>
                                            setFilter('until', e.target.value || undefined)
                                        }
                                    />
                                </div>
                            </>
                        )}

                        {/* Feature filter */}
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs">Feature</Label>
                            <Select
                                value={search.feature ?? ''}
                                onValueChange={(v) => setFilter('feature', v || undefined)}
                            >
                                <SelectTrigger className="w-48">
                                    <SelectValue placeholder="All features" />
                                </SelectTrigger>
                                <SelectContent>
                                    {AI_FEATURES.map((f) => (
                                        <SelectItem
                                            key={f.value}
                                            value={f.value}
                                        >
                                            {f.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Provider filter */}
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs">Provider</Label>
                            <Select
                                value={search.provider ?? ''}
                                onValueChange={(v) => setFilter('provider', v || undefined)}
                            >
                                <SelectTrigger className="w-36">
                                    <SelectValue placeholder="All providers" />
                                </SelectTrigger>
                                <SelectContent>
                                    {KNOWN_PROVIDERS.map((p) => (
                                        <SelectItem
                                            key={p.value}
                                            value={p.value}
                                        >
                                            {p.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Model filter (free text — model identifiers vary by provider) */}
                        <div className="flex flex-col gap-1.5">
                            <Label
                                htmlFor="model-input"
                                className="text-xs"
                            >
                                Model
                            </Label>
                            <Input
                                id="model-input"
                                type="text"
                                className="w-48"
                                placeholder="e.g. gpt-4o-mini"
                                value={search.model ?? ''}
                                onChange={(e) => setFilter('model', e.target.value || undefined)}
                            />
                        </div>

                        {/* Reset */}
                        <div className="flex flex-col justify-end gap-1.5">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={resetFilters}
                                className="gap-1.5"
                            >
                                <RotateCcwIcon className="h-3.5 w-3.5" />
                                Reset
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ----------------------------------------------------------------
             * T-015: Totals summary cards
             * Aggregated calls / tokens-in / tokens-out / cost across the
             * selected window and filters. Derived from the by-model endpoint.
             * --------------------------------------------------------------- */}
            <section aria-label="Usage totals">
                <AiUsageTotalsCard search={search} />
            </section>

            {/* ----------------------------------------------------------------
             * T-015: By-model breakdown table
             * Per-model rollup: model | calls | tokensIn | tokensOut |
             * costMicroUsd | cost/1k tokens — ordered by cost DESC.
             * --------------------------------------------------------------- */}
            <section aria-label="Usage by model">
                <AiUsageByModelTable search={search} />
            </section>

            {/* ----------------------------------------------------------------
             * T-015: By-provider breakdown table
             * Per-provider rollup: provider | calls | tokensIn | tokensOut |
             * cost — ordered by cost DESC.
             * --------------------------------------------------------------- */}
            <section aria-label="Usage by provider">
                <AiUsageByProviderTable search={search} />
            </section>

            {/* ----------------------------------------------------------------
             * T-015: By-feature breakdown table
             * Per-feature rollup derived client-side from the by-feature-model
             * endpoint (no standalone /by-feature endpoint exists in SPEC-260).
             * Groups rows by feature, sums metrics, orders by cost DESC.
             * --------------------------------------------------------------- */}
            <section aria-label="Usage by feature">
                <AiUsageByFeatureTable search={search} />
            </section>

            {/* ----------------------------------------------------------------
             * T-016: Feature × model cost chart
             * Grouped bar chart: X = feature, bars = one per model, value =
             * estimated cost in USD. Pivoted from the by-feature-model endpoint.
             * --------------------------------------------------------------- */}
            <section aria-label="Cost by feature and model chart">
                <AiUsageFeatureModelChart search={search} />
            </section>

            {/* ----------------------------------------------------------------
             * T-016: Feature × model cross table
             * One row per (feature, model) pair ordered by cost DESC.
             * Shares the TanStack Query cache entry with the chart above.
             * --------------------------------------------------------------- */}
            <section aria-label="Usage by feature and model">
                <AiUsageByFeatureModelTable search={search} />
            </section>

            {/* ----------------------------------------------------------------
             * PLACEHOLDER: Daily time-series chart (T-017)
             * Will render a line/area chart of calls, cost, and tokens
             * per UTC calendar day over the selected window.
             * --------------------------------------------------------------- */}
            <section
                aria-label="Daily usage chart"
                data-placeholder="T-017-daily-chart"
            >
                <div className="flex items-center justify-center rounded-lg border border-muted-foreground/30 border-dashed py-8 text-muted-foreground text-sm">
                    {/* T-017: Insert <AiUsageDailyChart search={search} /> here */}
                    Daily time-series chart (T-017)
                </div>
            </section>
        </div>
    );
}
