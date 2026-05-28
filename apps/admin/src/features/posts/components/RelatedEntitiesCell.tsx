import { cn } from '@/lib/utils';
import { AccommodationIcon, DestinationIcon, EventIcon } from '@repo/icons';
import { Link } from '@tanstack/react-router';
import type { Post } from '../schemas/posts.schemas';

const ACCOMMODATION_CLASSES =
    'bg-blue-50 text-blue-700 ring-blue-700/20 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-400/30 dark:hover:bg-blue-900/30';
const DESTINATION_CLASSES =
    'bg-green-50 text-green-700 ring-green-600/20 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-400/30 dark:hover:bg-green-900/30';
const EVENT_CLASSES =
    'bg-orange-50 text-orange-700 ring-orange-700/20 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:ring-orange-400/30 dark:hover:bg-orange-900/30';

const LINK_BASE =
    'inline-flex max-w-xs items-center gap-1.5 rounded-md px-2 py-1 font-medium text-xs ring-1 ring-inset transition-colors';

/**
 * Vertical stack of related-entity badge-links for the posts list. Replaces the
 * three separate columns (accommodation/destination/event) — when none is set
 * the cell renders an em-dash; one or more render stacked top-down.
 */
export const RelatedEntitiesCell = ({ row }: { readonly row: Post }) => {
    const accommodation = row.relatedAccommodation;
    const destination = row.relatedDestination;
    const event = row.relatedEvent;

    if (!accommodation?.id && !destination?.id && !event?.id) {
        return <span className="text-muted-foreground">—</span>;
    }

    return (
        <div className="flex flex-col items-start gap-1">
            {accommodation?.id && (
                <Link
                    to="/accommodations/$id"
                    params={{ id: accommodation.id }}
                    title={accommodation.name || 'Alojamiento'}
                    className={cn(LINK_BASE, ACCOMMODATION_CLASSES)}
                >
                    <AccommodationIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{accommodation.name || 'Alojamiento'}</span>
                </Link>
            )}
            {destination?.id && (
                <Link
                    to="/destinations/$id"
                    params={{ id: destination.id }}
                    title={destination.name || 'Destino'}
                    className={cn(LINK_BASE, DESTINATION_CLASSES)}
                >
                    <DestinationIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{destination.name || 'Destino'}</span>
                </Link>
            )}
            {event?.id && (
                <Link
                    to="/events/$id"
                    params={{ id: event.id }}
                    title={event.name || 'Evento'}
                    className={cn(LINK_BASE, EVENT_CLASSES)}
                >
                    <EventIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{event.name || 'Evento'}</span>
                </Link>
            )}
        </div>
    );
};
