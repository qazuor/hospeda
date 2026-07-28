import { Badge } from '@/components/ui/badge';
import { useTranslations } from '@/hooks/use-translations';
import type { User } from '../schemas/users.schemas';

export function UserRelationsSummaryCell({ row }: { readonly row: User }) {
    const { t } = useTranslations();

    const items = [
        {
            label: t('admin-pages.access.users.relatedCounts.accommodationsShort'),
            count: row.accommodationsCount ?? 0
        },
        {
            label: t('admin-pages.access.users.relatedCounts.gastronomiesShort'),
            count: row.gastronomiesCount ?? 0
        },
        {
            label: t('admin-pages.access.users.relatedCounts.experiencesShort'),
            count: row.experiencesCount ?? 0
        },
        {
            label: t('admin-pages.access.users.relatedCounts.eventsShort'),
            count: row.eventsCount ?? 0
        },
        {
            label: t('admin-pages.access.users.relatedCounts.postsShort'),
            count: row.postsCount ?? 0
        }
    ].filter((item) => item.count > 0);

    if (items.length === 0) {
        return <span className="text-muted-foreground">-</span>;
    }

    return (
        <div className="flex flex-wrap gap-1.5">
            {items.map((item) => (
                <Badge
                    key={item.label}
                    variant="outline"
                    className="gap-1"
                >
                    <span className="font-semibold">{item.label}</span>
                    <span>{item.count}</span>
                </Badge>
            ))}
        </div>
    );
}
