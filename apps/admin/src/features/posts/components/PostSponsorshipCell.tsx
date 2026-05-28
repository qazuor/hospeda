import { cn } from '@/lib/utils';
import { PostSponsorIcon, PostSponsorshipIcon } from '@repo/icons';
import { Link } from '@tanstack/react-router';
import type { Post } from '../schemas/posts.schemas';

const SPONSOR_CLASSES =
    'bg-orange-50 text-orange-700 ring-orange-700/20 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:ring-orange-400/30 dark:hover:bg-orange-900/30';
const SPONSORSHIP_MUTED_CLASSES =
    'bg-purple-50 text-purple-700 ring-purple-700/20 dark:bg-purple-900/20 dark:text-purple-400 dark:ring-purple-400/30';

const BADGE_BASE =
    'inline-flex max-w-xs items-center gap-1.5 rounded-md px-2 py-1 font-medium text-xs ring-1 ring-inset';

/**
 * Combined sponsorship column for the posts list. Vertical stack of the
 * sponsor (orange link to /sponsors/$id) + the sponsorship message preview
 * (purple, plain badge — sponsorships have no dedicated detail route). When
 * neither is set, renders an em-dash.
 */
export const PostSponsorshipCell = ({ row }: { readonly row: Post }) => {
    const sponsor = row.sponsorship?.sponsor;
    const message = row.sponsorship?.message;

    if (!sponsor?.id && !message) {
        return <span className="text-muted-foreground">—</span>;
    }

    return (
        <div className="flex flex-col items-start gap-1">
            {sponsor?.id && (
                <Link
                    to="/sponsors/$id"
                    params={{ id: sponsor.id }}
                    title={sponsor.name || 'Patrocinador'}
                    className={cn(
                        BADGE_BASE,
                        'transition-colors hover:bg-orange-100 dark:hover:bg-orange-900/30',
                        SPONSOR_CLASSES
                    )}
                >
                    <PostSponsorIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{sponsor.name || 'Patrocinador'}</span>
                </Link>
            )}
            {message && (
                <span
                    title={message}
                    className={cn(BADGE_BASE, SPONSORSHIP_MUTED_CLASSES)}
                >
                    <PostSponsorshipIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{message}</span>
                </span>
            )}
        </div>
    );
};
