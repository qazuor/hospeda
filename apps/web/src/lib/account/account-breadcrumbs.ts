import type { createT } from '@/lib/i18n';
import type { BreadcrumbInputItem } from '@/lib/navigation/breadcrumb-trail';

/** Build an account trail with its linked root and the current page last. */
export function buildAccountBreadcrumbs({
    t,
    parents,
    current
}: {
    readonly t: ReturnType<typeof createT>;
    readonly parents: readonly BreadcrumbInputItem[];
    readonly current: string;
}): readonly BreadcrumbInputItem[] {
    return [{ label: t('account.title'), path: 'mi-cuenta' }, ...parents, { label: current }];
}
