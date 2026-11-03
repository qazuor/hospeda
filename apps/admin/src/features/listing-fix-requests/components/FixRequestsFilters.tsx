import type { AdminListingFixRequestListQuery } from '@repo/schemas';
import { useTranslations } from '@/hooks/use-translations';

/** Filter controls for the pending fix request queue. */
export function FixRequestsFilters({
    value,
    onChange
}: {
    readonly value: Pick<AdminListingFixRequestListQuery, 'vertical' | 'ownerReported' | 'overdue'>;
    readonly onChange: (
        value: Pick<AdminListingFixRequestListQuery, 'vertical' | 'ownerReported' | 'overdue'>
    ) => void;
}) {
    const { t } = useTranslations();
    const labels = 'admin-entities.fixRequestList.filters';
    const verticals = [
        ['accommodation', t('admin-entities.entities.accommodation.singular')],
        ['venue', t('admin-entities.entities.venue.singular')],
        ['experience', t('admin-entities.entities.experience.singular')]
    ] as const;
    return (
        <div
            data-testid="fix-requests-filters"
            className="flex flex-wrap gap-4"
        >
            <label>
                {t(`${labels}.vertical`)}
                <select
                    value={value.vertical ?? ''}
                    onChange={(event) =>
                        onChange({
                            ...value,
                            vertical: (event.target.value || undefined) as typeof value.vertical
                        })
                    }
                >
                    <option value="">{t(`${labels}.verticalAll`)}</option>
                    {verticals.map(([entry, name]) => (
                        <option
                            key={entry}
                            value={entry}
                        >
                            {name}
                        </option>
                    ))}
                </select>
            </label>
            <label>
                {t(`${labels}.ownerReported`)}
                <select
                    value={value.ownerReported ?? ''}
                    onChange={(event) =>
                        onChange({
                            ...value,
                            ownerReported: (event.target.value ||
                                undefined) as typeof value.ownerReported
                        })
                    }
                >
                    <option value="">{t(`${labels}.ownerReportedAll`)}</option>
                    <option value="yes">{t(`${labels}.ownerReportedYes`)}</option>
                    <option value="no">{t(`${labels}.ownerReportedNo`)}</option>
                </select>
            </label>
            <label>
                <input
                    type="checkbox"
                    checked={value.overdue === 'true'}
                    onChange={(event) =>
                        onChange({ ...value, overdue: event.target.checked ? 'true' : undefined })
                    }
                />
                {t(`${labels}.overdue`)}
            </label>
        </div>
    );
}
