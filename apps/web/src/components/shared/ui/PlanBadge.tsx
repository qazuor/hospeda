import { CrownIcon } from '@repo/icons';
import { StatusPill } from '@/components/account/ui/StatusPill';

/** Display the resolved catalog name, or nothing when no badge applies. */
export function PlanBadge({ name }: { readonly name: string | null }) {
    if (!name) return null;
    return (
        <StatusPill tone="plan">
            <CrownIcon
                size={14}
                aria-hidden="true"
            />{' '}
            {name}
        </StatusPill>
    );
}
