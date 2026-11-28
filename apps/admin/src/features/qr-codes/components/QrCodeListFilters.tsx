import { EntityTypeEnum, QrCodePurposeEnum, QrCodeSourceEnum } from '@repo/schemas';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { QrCampaignUmamiFilterLink } from '@/features/qr-codes/components/QrCodeCampaignsDialog';
import { useQrCodeCampaigns } from '@/features/qr-codes/hooks/useQrCodeTags';
import { useTranslations } from '@/hooks/use-translations';
import { QrCodeTagPicker } from './QrCodeTagPicker';

/**
 * The filter bar of the admin QR list (HOS-2679).
 *
 * Every filter combines with the free-text search and with each other. The
 * source defaults to MANUAL — the codes an operator prints by hand are the ones
 * this list is for; the GENERATED ones live with their entity — but `ALL` is one
 * click away. That default lives HERE only: the API's own default is unchanged.
 */

/** The value a Select uses for "no filter". Radix refuses an empty-string item. */
export const QR_FILTER_ALL = 'ALL';

/**
 * Campaigns are free text, so a campaign could literally be called `ALL`. The
 * campaign Select therefore prefixes every campaign value with this, and its
 * "no filter" item is the only unprefixed value — the two cannot collide.
 */
export const QR_CAMPAIGN_VALUE_PREFIX = 'c:';

/** The entity types a QR code is generated for (see `qr-attribution.ts`). */
export const QR_FILTER_ENTITY_TYPES = [
    EntityTypeEnum.ACCOMMODATION,
    EntityTypeEnum.VENUE,
    EntityTypeEnum.EXPERIENCE,
    EntityTypeEnum.HOST_TRADE
] as const;

/** The filter state of the list. `ALL` means "not filtered". */
export type QrCodeListFilterState = {
    readonly source: QrCodeSourceEnum | typeof QR_FILTER_ALL;
    readonly entityType: EntityTypeEnum | typeof QR_FILTER_ALL;
    readonly purpose: QrCodePurposeEnum | typeof QR_FILTER_ALL;
    readonly isActive: 'true' | 'false' | typeof QR_FILTER_ALL;
    /** The decoded campaign, verbatim; `null` means "not filtered". */
    readonly utmCampaign: string | null;
    readonly tagIds: readonly string[];
};

/** The state the list opens with. */
export const DEFAULT_QR_CODE_LIST_FILTERS: QrCodeListFilterState = {
    source: QrCodeSourceEnum.MANUAL,
    entityType: QR_FILTER_ALL,
    purpose: QR_FILTER_ALL,
    isActive: QR_FILTER_ALL,
    utmCampaign: null,
    tagIds: []
};

/**
 * Turns the filter state into the list's query params. `ALL` and empty values
 * are left out, so the API sees only real filters.
 *
 * @param input.filters - The bar's state.
 * @returns Query params for `useQrCodesList({ filters })`.
 */
export function toQrCodeListQueryFilters(input: {
    readonly filters: QrCodeListFilterState;
}): Record<string, string> {
    const { filters } = input;
    const out: Record<string, string> = {};
    if (filters.source !== QR_FILTER_ALL) out.source = filters.source;
    if (filters.entityType !== QR_FILTER_ALL) out.entityType = filters.entityType;
    if (filters.purpose !== QR_FILTER_ALL) out.purpose = filters.purpose;
    if (filters.isActive !== QR_FILTER_ALL) out.isActive = filters.isActive;
    if (filters.utmCampaign !== null && filters.utmCampaign.trim() !== '') {
        out.utmCampaign = filters.utmCampaign;
    }
    if (filters.tagIds.length > 0) out.tagIds = filters.tagIds.join(',');
    return out;
}

/**
 * Applies one filter change, keeping the combination meaningful.
 *
 * Picking a `purpose` while the bar shows only MANUAL codes switches the source
 * to "all": a purpose is a GENERATED code's identity and a MANUAL code never
 * carries one, so MANUAL + purpose is always an empty list that looks like "no
 * such codes". `entityType` does NOT switch it: a hand-made code may point at a
 * subject too (several can coexist for one), so MANUAL + entityType is a real
 * question with real answers.
 *
 * @param input.current - The bar's state.
 * @param input.key - The filter being changed.
 * @param input.next - Its new value.
 * @returns The next state.
 */
export function applyQrCodeFilterChange<K extends keyof QrCodeListFilterState>(input: {
    readonly current: QrCodeListFilterState;
    readonly key: K;
    readonly next: QrCodeListFilterState[K];
}): QrCodeListFilterState {
    const updated = { ...input.current, [input.key]: input.next };
    if (
        input.key === 'purpose' &&
        input.next !== QR_FILTER_ALL &&
        updated.source === QrCodeSourceEnum.MANUAL
    ) {
        return { ...updated, source: QR_FILTER_ALL };
    }
    return updated;
}

/** Props for {@link QrCodeListFilters}. */
export type QrCodeListFiltersProps = {
    readonly value: QrCodeListFilterState;
    readonly onChange: (next: QrCodeListFilterState) => void;
};

/** One labelled Select of the bar. */
function FilterSelect({
    id,
    label,
    value,
    options,
    onChange
}: {
    readonly id: string;
    readonly label: string;
    readonly value: string;
    readonly options: readonly { readonly value: string; readonly label: string }[];
    readonly onChange: (value: string) => void;
}) {
    return (
        <div className="space-y-1">
            <Label
                htmlFor={id}
                className="text-xs"
            >
                {label}
            </Label>
            <Select
                value={value}
                onValueChange={onChange}
            >
                <SelectTrigger
                    id={id}
                    className="h-9 w-44"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem
                            key={option.value}
                            value={option.value}
                        >
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

/**
 * Renders the filter bar.
 *
 * @param props - {@link QrCodeListFiltersProps}
 * @returns The bar.
 */
export function QrCodeListFilters({ value, onChange }: QrCodeListFiltersProps) {
    const { t } = useTranslations();
    const { data: campaigns = [] } = useQrCodeCampaigns();
    const all = { value: QR_FILTER_ALL, label: t('admin-qr-codes.filters.all') };

    // A campaign picked before a retarget may no longer be in the list; keep it
    // selectable so the Select never shows a blank trigger for a live filter.
    const campaignOptions =
        value.utmCampaign !== null && !campaigns.includes(value.utmCampaign)
            ? [value.utmCampaign, ...campaigns]
            : campaigns;

    const set = <K extends keyof QrCodeListFilterState>(key: K, next: QrCodeListFilterState[K]) =>
        onChange(applyQrCodeFilterChange({ current: value, key, next }));

    return (
        <div className="flex flex-wrap items-end gap-3">
            <FilterSelect
                id="qr-filter-source"
                label={t('admin-qr-codes.filters.source')}
                value={value.source}
                options={[
                    all,
                    ...Object.values(QrCodeSourceEnum).map((source) => ({
                        value: source,
                        label: t(`admin-qr-codes.source.${source}`)
                    }))
                ]}
                onChange={(next) => set('source', next as QrCodeListFilterState['source'])}
            />
            <FilterSelect
                id="qr-filter-entity-type"
                label={t('admin-qr-codes.filters.entityType')}
                value={value.entityType}
                options={[
                    all,
                    ...QR_FILTER_ENTITY_TYPES.map((entityType) => ({
                        value: entityType,
                        label: t(`admin-qr-codes.filters.entityTypes.${entityType}`)
                    }))
                ]}
                onChange={(next) => set('entityType', next as QrCodeListFilterState['entityType'])}
            />
            <FilterSelect
                id="qr-filter-purpose"
                label={t('admin-qr-codes.filters.purpose')}
                value={value.purpose}
                options={[
                    all,
                    ...Object.values(QrCodePurposeEnum).map((purpose) => ({
                        value: purpose,
                        label: t(`admin-qr-codes.filters.purposes.${purpose}`)
                    }))
                ]}
                onChange={(next) => set('purpose', next as QrCodeListFilterState['purpose'])}
            />
            <FilterSelect
                id="qr-filter-active"
                label={t('admin-qr-codes.filters.isActive')}
                value={value.isActive}
                options={[
                    all,
                    { value: 'true', label: t('admin-qr-codes.status.active') },
                    { value: 'false', label: t('admin-qr-codes.status.inactive') }
                ]}
                onChange={(next) => set('isActive', next as QrCodeListFilterState['isActive'])}
            />
            <FilterSelect
                id="qr-filter-campaign"
                label={t('admin-qr-codes.filters.campaign')}
                value={
                    value.utmCampaign === null
                        ? QR_FILTER_ALL
                        : `${QR_CAMPAIGN_VALUE_PREFIX}${value.utmCampaign}`
                }
                options={[
                    all,
                    ...campaignOptions.map((campaign) => ({
                        value: `${QR_CAMPAIGN_VALUE_PREFIX}${campaign}`,
                        label: campaign
                    }))
                ]}
                onChange={(next) =>
                    set(
                        'utmCampaign',
                        next.startsWith(QR_CAMPAIGN_VALUE_PREFIX)
                            ? next.slice(QR_CAMPAIGN_VALUE_PREFIX.length)
                            : null
                    )
                }
            />
            {value.utmCampaign === null ? null : (
                <QrCampaignUmamiFilterLink campaign={value.utmCampaign} />
            )}
            <div className="space-y-1">
                <span className="block font-medium text-xs">
                    {t('admin-qr-codes.filters.tags')}
                </span>
                <QrCodeTagPicker
                    value={value.tagIds}
                    onChange={(next) => set('tagIds', next)}
                />
            </div>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(DEFAULT_QR_CODE_LIST_FILTERS)}
            >
                {t('admin-qr-codes.filters.reset')}
            </Button>
        </div>
    );
}
