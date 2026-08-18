/**
 * @fileoverview
 * Turns content-change events into search-engine notifications (HOS-585 G-1).
 *
 * Sits alongside `RevalidationService` rather than inside it: both react to the
 * same write, but a cache purge and a search-engine notification have different
 * destinations, different failure modes and different switches. See
 * `adapters/indexnow.adapter.ts` for the full rationale.
 */

import { createLogger } from '@repo/logger';
import type { EntityChangeData } from '../revalidation/entity-change.types.js';
import type { IndexNowAdapter, NotifiableEntity } from './adapters/indexnow.adapter.js';

const logger = createLogger('indexnow-service');

/** Default coalescing window for notifications. */
const DEFAULT_DEBOUNCE_MS = 30_000;

/**
 * Compile-time proof that every `EntityChangeData` variant was considered.
 *
 * @param value - The value TypeScript has narrowed to `never`.
 * @returns Never returns a notifiable entity; present so the switch type-checks.
 */
function assertNever(value: never): undefined {
    void value;
    return undefined;
}

/** Configuration for {@link IndexNowService}. */
export interface IndexNowServiceConfig {
    /** Transport. Never throws; failures come back in its result. */
    readonly adapter: IndexNowAdapter;
    /**
     * Reads the operator's on/off toggle.
     *
     * A function, not a boolean, on purpose: it is evaluated at FLUSH time so
     * turning the toggle off takes effect without restarting the API (AC-12).
     */
    readonly isEnabled: () => Promise<boolean>;
    /** Coalescing window in ms. Defaults to 30s. */
    readonly debounceMs?: number;
}

/**
 * Reduce a change event to the entity whose own public page changed.
 *
 * Four kinds of event produce nothing, each for a different reason:
 *
 * - `tag` / `amenity` have no page of their own.
 * - Any event without a slug cannot address a URL. `slug` is optional on every
 *   variant of the union (some call sites only hold a UUID), so this is a real
 *   case and not defensive padding.
 * - Reviews are folded into their PARENT: a new review changes the
 *   accommodation's page, and the review has no URL.
 * - `attraction`, `partner` and `pointOfInterest` all HAVE pages and all appear
 *   in the sitemap, but none is unconditionally public: a silver partner 404s
 *   and a retired gold one answers 410, only POIs carrying `hasOwnPage` render
 *   at all, and an attraction landing is closer to a facet than to a detail
 *   page. Submitting a URL that answers 404 is what IndexNow penalizes, and the
 *   visibility each one needs is not knowable here. Deferred deliberately, not
 *   forgotten — see `entity-public-urls.ts` in the web app for the same list.
 *
 * Deliberately does NOT cascade. An accommodation event carries the parent
 * `destinationSlug`, and that destination's listing did technically change —
 * but notifying it on every accommodation edit would submit the same handful of
 * destination URLs dozens of times a day, which is exactly the "resubmitting
 * unchanged URLs" behaviour IndexNow penalizes (spec R-1). Listings are found by
 * crawling; detail pages are what benefit from being announced.
 *
 * @param event - The change event.
 * @returns The notifiable entity, or `undefined` when there is nothing to say.
 */
export function toNotifiableEntity(event: EntityChangeData): NotifiableEntity | undefined {
    switch (event.entityType) {
        case 'accommodation':
        case 'destination':
        case 'event':
        case 'post':
        case 'gastronomy':
        case 'experience':
            return event.slug ? { entityType: event.entityType, slug: event.slug } : undefined;
        case 'accommodation_review':
            return event.accommodationSlug
                ? { entityType: 'accommodation', slug: event.accommodationSlug }
                : undefined;
        case 'destination_review':
            return event.destinationSlug
                ? { entityType: 'destination', slug: event.destinationSlug }
                : undefined;
        case 'tag':
        case 'amenity':
        case 'attraction':
        case 'partner':
        case 'pointOfInterest':
            return undefined;
        default:
            // Exhaustiveness check, and the whole reason it is here: this switch
            // shipped handling 8 of the union's 13 variants and dropped the
            // other 5 in SILENCE, because a switch with no default just falls
            // through to `undefined`. A 14th variant must be a compile error,
            // not a content type that quietly stops being announced.
            return assertNever(event);
    }
}

/** Coalesces change events and notifies the search engines once per window. */
export class IndexNowService {
    private readonly adapter: IndexNowAdapter;
    private readonly isEnabled: () => Promise<boolean>;
    private readonly debounceMs: number;

    /** Pending entities, keyed by `entityType:slug` so duplicates collapse. */
    private readonly pending = new Map<string, NotifiableEntity>();
    private timer: ReturnType<typeof setTimeout> | undefined;

    constructor(config: IndexNowServiceConfig) {
        this.adapter = config.adapter;
        this.isEnabled = config.isEnabled;
        this.debounceMs = config.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    }

    /** The adapter's name, for diagnostics. */
    getAdapterName(): string {
        return this.adapter.name;
    }

    /**
     * Record that an entity changed. Fire-and-forget: never throws, never
     * blocks, and never awaits the notification.
     *
     * @param event - The change event. Events with no public page are dropped.
     */
    scheduleNotification(event: EntityChangeData): void {
        const entity = toNotifiableEntity(event);
        if (!entity) return;

        this.pending.set(`${entity.entityType}:${entity.slug}`, entity);

        if (this.timer === undefined) {
            this.timer = setTimeout(() => void this.flush(), this.debounceMs);
        }
    }

    /**
     * Send everything accumulated so far.
     *
     * Reads the toggle HERE rather than at schedule time. An operator who turns
     * notifications off mid-window expects nothing further to go out, and a
     * value captured when the event was queued would send anyway.
     *
     * Exposed for tests and for a caller that needs a deterministic flush; the
     * normal path is the debounce timer.
     *
     * @returns Nothing. All failures are logged, never thrown.
     */
    async flush(): Promise<void> {
        this.timer = undefined;

        const entities = [...this.pending.values()];
        this.pending.clear();
        if (entities.length === 0) return;

        try {
            if (!(await this.isEnabled())) {
                logger.debug(
                    `IndexNow notification skipped for ${entities.length} entity(ies): disabled by the platform setting`
                );
                return;
            }

            const result = await this.adapter.notify({ entities });
            if (!result.success) {
                logger.warn(
                    `IndexNow notification failed via ${this.adapter.name}: ${result.error}`
                );
            }
        } catch (error) {
            // The adapter contract forbids throwing, and `isEnabled` fails
            // closed on its own — but this hook runs next to a content write, so
            // a broken collaborator must not become a failed publish.
            logger.error(
                `IndexNow notification threw unexpectedly: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}
