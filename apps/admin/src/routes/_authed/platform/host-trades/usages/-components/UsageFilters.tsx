/**
 * @file UsageFilters.tsx
 * @description Filter controls for the benefit-usage audit (HOS-376 T-056).
 *
 * Native `<select>` / `<input>` elements, following `CommentsFilters.tsx`.
 *
 * The channel filter is the one built for triage rather than for browsing: the
 * email fallback is the only channel a provider can drive without the host
 * being present (§6.2 R-5), so isolating `EMAIL_LOOKUP` is how a suspected
 * pattern gets read.
 */

import type {
    UsageChannelFilter,
    UsageDeclaredByFilter,
    UsageStatusFilter
} from '@/hooks/use-host-trade-usages';
import { useTranslations } from '@/hooks/use-translations';

/** Shape of the filter state managed by the parent page. */
export interface UsageFiltersValue {
    readonly status: UsageStatusFilter | '';
    readonly declaredBy: UsageDeclaredByFilter | '';
    readonly creationChannel: UsageChannelFilter | '';
    readonly hostTradeId: string;
    readonly hostUserId: string;
    readonly createdAfter: string;
    readonly createdBefore: string;
}

/** Every filter unset — also the "nothing is filtered" comparison value. */
export const EMPTY_USAGE_FILTERS: UsageFiltersValue = {
    status: '',
    declaredBy: '',
    creationChannel: '',
    hostTradeId: '',
    hostUserId: '',
    createdAfter: '',
    createdBefore: ''
};

/** Props for {@link UsageFilters}. */
export interface UsageFiltersProps {
    readonly value: UsageFiltersValue;
    readonly onChange: (next: UsageFiltersValue) => void;
}

const STATUSES: readonly UsageStatusFilter[] = ['PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED'];
const DECLARED_BY: readonly UsageDeclaredByFilter[] = ['HOST', 'PROVIDER'];
const CHANNELS: readonly UsageChannelFilter[] = ['QR', 'LINKED_SELECTOR', 'EMAIL_LOOKUP'];

const CONTROL_CLASS = 'rounded-md border bg-background px-3 py-1.5 text-sm';
const LABEL_CLASS = 'text-muted-foreground text-xs';

/**
 * Filter bar for the usage audit.
 *
 * @param props - {@link UsageFiltersProps}
 */
export function UsageFilters({ value, onChange }: UsageFiltersProps) {
    const { t } = useTranslations();

    return (
        <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
                <label
                    htmlFor="usage-filter-status"
                    className={LABEL_CLASS}
                >
                    {t('admin-pages.hostTradeUsages.usages.filters.status')}
                </label>
                <select
                    id="usage-filter-status"
                    className={CONTROL_CLASS}
                    value={value.status}
                    onChange={(e) =>
                        onChange({ ...value, status: e.target.value as UsageStatusFilter | '' })
                    }
                >
                    <option value="">{t('admin-pages.hostTradeUsages.usages.filters.any')}</option>
                    {STATUSES.map((status) => (
                        <option
                            key={status}
                            value={status}
                        >
                            {t(`host-trades.usages.status.${status}`)}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex flex-col gap-1">
                <label
                    htmlFor="usage-filter-declared-by"
                    className={LABEL_CLASS}
                >
                    {t('admin-pages.hostTradeUsages.usages.filters.declaredBy')}
                </label>
                <select
                    id="usage-filter-declared-by"
                    className={CONTROL_CLASS}
                    value={value.declaredBy}
                    onChange={(e) =>
                        onChange({
                            ...value,
                            declaredBy: e.target.value as UsageDeclaredByFilter | ''
                        })
                    }
                >
                    <option value="">{t('admin-pages.hostTradeUsages.usages.filters.any')}</option>
                    {DECLARED_BY.map((side) => (
                        <option
                            key={side}
                            value={side}
                        >
                            {t(`admin-pages.hostTradeUsages.usages.declaredBy.${side}`)}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex flex-col gap-1">
                <label
                    htmlFor="usage-filter-channel"
                    className={LABEL_CLASS}
                >
                    {t('admin-pages.hostTradeUsages.usages.filters.channel')}
                </label>
                <select
                    id="usage-filter-channel"
                    className={CONTROL_CLASS}
                    value={value.creationChannel}
                    onChange={(e) =>
                        onChange({
                            ...value,
                            creationChannel: e.target.value as UsageChannelFilter | ''
                        })
                    }
                >
                    <option value="">{t('admin-pages.hostTradeUsages.usages.filters.any')}</option>
                    {CHANNELS.map((channel) => (
                        <option
                            key={channel}
                            value={channel}
                        >
                            {t(`admin-pages.hostTradeUsages.usages.channel.${channel}`)}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex flex-col gap-1">
                <label
                    htmlFor="usage-filter-provider"
                    className={LABEL_CLASS}
                >
                    {t('admin-pages.hostTradeUsages.usages.filters.provider')}
                </label>
                <input
                    id="usage-filter-provider"
                    type="search"
                    className={CONTROL_CLASS}
                    placeholder={t(
                        'admin-pages.hostTradeUsages.usages.filters.providerPlaceholder'
                    )}
                    value={value.hostTradeId}
                    onChange={(e) => onChange({ ...value, hostTradeId: e.target.value })}
                />
            </div>

            <div className="flex flex-col gap-1">
                <label
                    htmlFor="usage-filter-host"
                    className={LABEL_CLASS}
                >
                    {t('admin-pages.hostTradeUsages.usages.filters.host')}
                </label>
                <input
                    id="usage-filter-host"
                    type="search"
                    className={CONTROL_CLASS}
                    placeholder={t('admin-pages.hostTradeUsages.usages.filters.hostPlaceholder')}
                    value={value.hostUserId}
                    onChange={(e) => onChange({ ...value, hostUserId: e.target.value })}
                />
            </div>

            <div className="flex flex-col gap-1">
                <label
                    htmlFor="usage-filter-from"
                    className={LABEL_CLASS}
                >
                    {t('admin-pages.hostTradeUsages.usages.filters.from')}
                </label>
                <input
                    id="usage-filter-from"
                    type="date"
                    className={CONTROL_CLASS}
                    value={value.createdAfter}
                    onChange={(e) => onChange({ ...value, createdAfter: e.target.value })}
                />
            </div>

            <div className="flex flex-col gap-1">
                <label
                    htmlFor="usage-filter-to"
                    className={LABEL_CLASS}
                >
                    {t('admin-pages.hostTradeUsages.usages.filters.to')}
                </label>
                <input
                    id="usage-filter-to"
                    type="date"
                    className={CONTROL_CLASS}
                    value={value.createdBefore}
                    onChange={(e) => onChange({ ...value, createdBefore: e.target.value })}
                />
            </div>
        </div>
    );
}
