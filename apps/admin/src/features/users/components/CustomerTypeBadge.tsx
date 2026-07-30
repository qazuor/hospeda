import type { TranslationKey } from '@repo/i18n';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import type { User } from '../schemas/users.schemas';

// HOS-296: `role` is gone from the admin user LIST payload (`UserListItemSchema`
// no longer projects it — a per-row role set would need the admin user-list
// endpoint to join `user_role` and carry a `roles` array, which is deliberately
// out of scope for this cut). The former INTERNAL_ROLES/NO_PLAN_ROLES
// staff/no-plan branches read a field that no longer exists on `User`, so they
// are removed rather than fabricating a role from another field — this badge
// now falls back to plan-slug-only logic for every row.

function resolveBadgeVariant(slug: string | null): 'default' | 'secondary' | 'outline' | 'success' {
    if (slug === 'tourist-vip' || slug === 'owner-premium') return 'default';
    if (slug === 'tourist-plus' || slug === 'owner-pro') return 'success';
    if (slug === 'tourist-free' || slug === 'owner-basico') return 'secondary';
    return 'outline';
}

function resolveBadgeClass(slug: string | null): string {
    if (slug === 'tourist-vip' || slug === 'owner-premium') {
        return '';
    }

    if (slug === 'tourist-plus' || slug === 'owner-pro') {
        return '';
    }

    if (slug === 'tourist-free' || slug === 'owner-basico') {
        return 'border-transparent bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-100';
    }

    if (!slug) {
        return 'border-transparent bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-100';
    }

    return '';
}

function resolveCustomerTypeLabel(row: User, translate: (key: string) => string): string {
    if (row.currentPlanSlug) {
        return translate(`billing.plan.${row.currentPlanSlug}.name`);
    }

    return translate('billing.plan.tourist-free.name');
}

export function CustomerTypeBadge({ row }: { readonly row: User }) {
    const { t } = useTranslations();
    const label = resolveCustomerTypeLabel(row, (key) => t(key as TranslationKey));
    const variant = resolveBadgeVariant(row.currentPlanSlug ?? null);
    const className = resolveBadgeClass(row.currentPlanSlug ?? null);

    return (
        <Badge
            variant={variant}
            className={cn(className)}
        >
            {label}
        </Badge>
    );
}
