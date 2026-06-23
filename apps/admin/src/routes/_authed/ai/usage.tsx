/**
 * AI Usage Dashboard Page (SPEC-260 T-014/T-018)
 *
 * Entry point for the AI usage reporting surface. Displays consumption
 * metrics across models, providers, features, and time — all driven by
 * the four SPEC-260 API endpoints:
 *   GET /api/v1/admin/ai/usage/by-model
 *   GET /api/v1/admin/ai/usage/by-provider
 *   GET /api/v1/admin/ai/usage/by-feature-model
 *   GET /api/v1/admin/ai/usage/daily
 *
 * Route: /ai/usage
 * Guard: AI_SETTINGS_MANAGE permission (SUPER_ADMIN only in practice)
 * Search params: AiUsageDailySearchSchema (superset of all four endpoint filters)
 * i18n: all user-facing strings via admin-pages.ai.usage.* (T-018)
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
    AiUsageDailyChart,
    AiUsageDailySearchSchema,
    AiUsageFeatureModelChart,
    AiUsageTotalsCard
} from '@/features/ai-usage';
import type { AiUsageDailySearch } from '@/features/ai-usage';
import { useTranslations } from '@/hooks/use-translations';
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
// Static data (values are identifiers, not translated; labels come from t())
// ---------------------------------------------------------------------------

/** AI feature filter options — values are enum identifiers, labels via t(). */
const AI_FEATURE_VALUES = [
    'text_improve',
    'chat',
    'search',
    'support',
    'translate',
    'accommodation_import',
    'post_generate'
] as const;

/** Well-known AI provider filter options — values are identifiers, labels via t(). */
const KNOWN_PROVIDER_VALUES = ['openai', 'anthropic', 'stub'] as const;

/** Current UTC year — used as the default year for the month picker. */
const CURRENT_YEAR = new Date().getUTCFullYear();

/** Month number options 1–12 — labels come from t(). */
const MONTH_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

/**
 * AI Usage Dashboard page (SPEC-260 T-014/T-018).
 *
 * Renders the filter top-bar (month/date-range window + feature / provider /
 * model selects + reset) and the T-015/T-016/T-017 sections.
 *
 * Filter state lives exclusively in URL search params via TanStack Router's
 * `validateSearch` + `useSearch()` + `navigate({ search: ... })` so every
 * filter combination produces a shareable, bookmarkable URL.
 *
 * All user-facing strings are resolved via `useTranslations()` under the
 * `admin-pages.ai.usage.*` namespace.
 */
export function AiUsagePage() {
    const { t } = useTranslations();
    const search = Route.useSearch();
    const navigate = Route.useNavigate();

    // -----------------------------------------------------------------------
    // Derived UI state
    // -----------------------------------------------------------------------

    /**
     * Whether the user has selected explicit date-range mode (since/until)
     * vs. calendar-month mode (year+month).
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
                    <h1 className="font-semibold text-2xl tracking-tight">
                        {t('admin-pages.ai.usage.title')}
                    </h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        {t('admin-pages.ai.usage.subtitle')}
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
                        {t('admin-pages.ai.usage.filter.title')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4">
                        {/* Time-window mode toggle */}
                        <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
                            <legend className="sr-only">
                                {t('admin-pages.ai.usage.filter.windowMode')}
                            </legend>
                            <span
                                className="font-medium text-xs"
                                aria-hidden="true"
                            >
                                {t('admin-pages.ai.usage.filter.windowMode')}
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={isDateRangeMode ? 'outline' : 'default'}
                                    aria-pressed={!isDateRangeMode}
                                    onClick={() => setWindowMode('month')}
                                >
                                    {t('admin-pages.ai.usage.filter.month')}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={isDateRangeMode ? 'default' : 'outline'}
                                    aria-pressed={isDateRangeMode}
                                    onClick={() => setWindowMode('dateRange')}
                                >
                                    {t('admin-pages.ai.usage.filter.dateRange')}
                                </Button>
                            </div>
                        </fieldset>

                        {/* Month mode: year + month pickers */}
                        {!isDateRangeMode && (
                            <>
                                <div className="flex flex-col gap-1.5">
                                    <Label
                                        htmlFor="year-input"
                                        className="text-xs"
                                    >
                                        {t('admin-pages.ai.usage.filter.year')}
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
                                    <Label
                                        htmlFor="month-select"
                                        className="text-xs"
                                    >
                                        {t('admin-pages.ai.usage.filter.monthLabel')}
                                    </Label>
                                    <Select
                                        value={search.month ? String(search.month) : ''}
                                        onValueChange={(v) =>
                                            setFilter('month', v ? Number(v) : undefined)
                                        }
                                    >
                                        <SelectTrigger
                                            id="month-select"
                                            className="w-36"
                                            aria-label={t('admin-pages.ai.usage.filter.monthLabel')}
                                        >
                                            <SelectValue
                                                placeholder={t(
                                                    'admin-pages.ai.usage.filter.allMonths'
                                                )}
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {MONTH_VALUES.map((m) => (
                                                <SelectItem
                                                    key={m}
                                                    value={String(m)}
                                                >
                                                    {t(
                                                        `admin-pages.ai.usage.months.${m}` as `admin-pages.ai.usage.months.${typeof m}`
                                                    )}
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
                                        {t('admin-pages.ai.usage.filter.from')}
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
                                        {t('admin-pages.ai.usage.filter.to')}
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
                            <Label
                                htmlFor="feature-select"
                                className="text-xs"
                            >
                                {t('admin-pages.ai.usage.filter.feature')}
                            </Label>
                            <Select
                                value={search.feature ?? ''}
                                onValueChange={(v) => setFilter('feature', v || undefined)}
                            >
                                <SelectTrigger
                                    id="feature-select"
                                    className="w-48"
                                    aria-label={t('admin-pages.ai.usage.filter.feature')}
                                >
                                    <SelectValue
                                        placeholder={t('admin-pages.ai.usage.filter.allFeatures')}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {AI_FEATURE_VALUES.map((featureValue) => (
                                        <SelectItem
                                            key={featureValue}
                                            value={featureValue}
                                        >
                                            {t(
                                                `admin-pages.ai.usage.features.${featureValue}` as `admin-pages.ai.usage.features.${typeof featureValue}`
                                            )}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Provider filter */}
                        <div className="flex flex-col gap-1.5">
                            <Label
                                htmlFor="provider-select"
                                className="text-xs"
                            >
                                {t('admin-pages.ai.usage.filter.provider')}
                            </Label>
                            <Select
                                value={search.provider ?? ''}
                                onValueChange={(v) => setFilter('provider', v || undefined)}
                            >
                                <SelectTrigger
                                    id="provider-select"
                                    className="w-36"
                                    aria-label={t('admin-pages.ai.usage.filter.provider')}
                                >
                                    <SelectValue
                                        placeholder={t('admin-pages.ai.usage.filter.allProviders')}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {KNOWN_PROVIDER_VALUES.map((providerValue) => (
                                        <SelectItem
                                            key={providerValue}
                                            value={providerValue}
                                        >
                                            {t(
                                                `admin-pages.ai.usage.providers.${providerValue}` as `admin-pages.ai.usage.providers.${typeof providerValue}`
                                            )}
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
                                {t('admin-pages.ai.usage.filter.model')}
                            </Label>
                            <Input
                                id="model-input"
                                type="text"
                                className="w-48"
                                placeholder={t('admin-pages.ai.usage.filter.modelPlaceholder')}
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
                                {t('admin-pages.ai.usage.filter.reset')}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* T-015: Totals summary cards */}
            <section aria-label={t('admin-pages.ai.usage.a11y.sectionTotals')}>
                <AiUsageTotalsCard search={search} />
            </section>

            {/* T-015: By-model breakdown table */}
            <section aria-label={t('admin-pages.ai.usage.a11y.sectionByModel')}>
                <AiUsageByModelTable search={search} />
            </section>

            {/* T-015: By-provider breakdown table */}
            <section aria-label={t('admin-pages.ai.usage.a11y.sectionByProvider')}>
                <AiUsageByProviderTable search={search} />
            </section>

            {/* T-015: By-feature breakdown table */}
            <section aria-label={t('admin-pages.ai.usage.a11y.sectionByFeature')}>
                <AiUsageByFeatureTable search={search} />
            </section>

            {/* T-016: Feature × model cost chart */}
            <section aria-label={t('admin-pages.ai.usage.a11y.sectionFeatureModelChart')}>
                <AiUsageFeatureModelChart search={search} />
            </section>

            {/* T-016: Feature × model cross table */}
            <section aria-label={t('admin-pages.ai.usage.a11y.sectionFeatureModelTable')}>
                <AiUsageByFeatureModelTable search={search} />
            </section>

            {/* T-017: Daily cost time-series chart */}
            <section aria-label={t('admin-pages.ai.usage.a11y.sectionDailyChart')}>
                <AiUsageDailyChart search={search} />
            </section>
        </div>
    );
}
