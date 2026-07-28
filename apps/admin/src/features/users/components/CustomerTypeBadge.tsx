import type { TranslationKey } from '@repo/i18n';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import type { User } from '../schemas/users.schemas';

const INTERNAL_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'CLIENT_MANAGER', 'EDITOR', 'SYSTEM']);
const NO_PLAN_ROLES = new Set(['HOST', 'SPONSOR']);

function resolveBadgeVariant(
    slug: string | null,
    role: string | undefined
): 'default' | 'secondary' | 'outline' | 'success' {
    if (slug === 'tourist-vip' || slug === 'owner-premium') return 'default';
    if (slug === 'tourist-plus' || slug === 'owner-pro') return 'success';
    if (slug === 'tourist-free' || slug === 'owner-basico') return 'secondary';
    if (role && INTERNAL_ROLES.has(role.toUpperCase())) return 'outline';
    return 'outline';
}

function resolveBadgeClass(slug: string | null, role: string | undefined): string {
    if (slug === 'tourist-vip' || slug === 'owner-premium') {
        return '';
    }

    if (slug === 'tourist-plus' || slug === 'owner-pro') {
        return '';
    }

    if (slug === 'tourist-free' || slug === 'owner-basico') {
        return 'border-transparent bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-100';
    }

    if (role && INTERNAL_ROLES.has(role.toUpperCase())) {
        return 'border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-100';
    }

    if (role && NO_PLAN_ROLES.has(role.toUpperCase())) {
        return 'border-transparent bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-100';
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

    const role = typeof row.role === 'string' ? row.role.toUpperCase() : '';
    if (INTERNAL_ROLES.has(role)) {
        return translate('admin-pages.access.users.customerType.staff');
    }

    if (NO_PLAN_ROLES.has(role)) {
        return translate('admin-pages.access.users.customerType.noPlan');
    }

    return translate('billing.plan.tourist-free.name');
}

export function CustomerTypeBadge({ row }: { readonly row: User }) {
    const { t } = useTranslations();
    const role = typeof row.role === 'string' ? row.role : undefined;
    const label = resolveCustomerTypeLabel(row, (key) => t(key as TranslationKey));
    const variant = resolveBadgeVariant(row.currentPlanSlug ?? null, role);
    const className = resolveBadgeClass(row.currentPlanSlug ?? null, role);

    return (
        <Badge
            variant={variant}
            className={cn(className)}
        >
            {label}
        </Badge>
    );
}
