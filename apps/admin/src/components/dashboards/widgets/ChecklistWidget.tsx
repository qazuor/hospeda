/**
 * ChecklistWidget — Client-side completeness checklist renderer (SPEC-155 T-026).
 *
 * Unlike KpiWidget/ListWidget which fetch remote data through the resolver
 * registry, ChecklistWidget computes its items ENTIRELY CLIENT-SIDE from an
 * entity object supplied via `widget.config.entities`. No remote fetch is
 * needed because all the required fields are already present on the loaded
 * accommodation/user/post/event objects.
 *
 * ## Why client-side instead of a resolver?
 *
 * host.ts (dashboard-sources) documents card D and card F as "client-side only
 * slots" with an explicit NOTE that no resolver registration is needed. The data
 * is provided by the parent page/card that already holds the loaded entity. This
 * widget receives those entities through `widget.config.entities` (an array
 * injected by the card renderer) or through a resolver that returns the entity
 * list (e.g. `host.accommodations.list`). When a source IS present the widget
 * runs the full resolver+useQuery flow (same pattern as KpiWidget) to load the
 * entity list. When no source is given, entities are expected in config.entities.
 *
 * ## Multi-accommodation selector (HOST card D)
 *
 * When the `checkset` is `'accommodation-health'` and the config provides more
 * than one accommodation, a shadcn Select dropdown is rendered at the top of the
 * card. The user picks which listing to inspect; the checklist updates live. With
 * exactly one accommodation, no dropdown is shown.
 *
 * ## Config shape (`widget.config`)
 *
 * ```json
 * {
 *   "checkset": "accommodation-health",
 *   "source": "host.accommodations.list",   // optional — resolver ID for entity list
 *   "entities": [{ "id": "…", … }]           // optional — pre-loaded entities (no fetch)
 * }
 * ```
 *
 * ## Supported checksets
 *
 * | checkset              | Entity type       | Checks |
 * |-----------------------|-------------------|--------|
 * | `accommodation-health`| Accommodation     | photos, description, amenities, price, location, contact |
 * | `host-profile-health` | User/Host profile | avatar, bio, phone, social link, verified email, full name |
 * | `content-health`      | Post item list    | featuredImage, tags, SEO per post; featuredImage, locationId, organizerId, description per event |
 *
 * @module ChecklistWidget
 * @see apps/admin/src/lib/dashboard-sources/host.ts — card D + F client-side note
 * @see .claude/audit/admin-redesign/proposals/03c-dashboards-redefinition.md — HOST card D, F; EDITOR card G
 * @see SPEC-155 T-026
 */

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui-wrapped';
import type { Widget } from '@/config/ia/schema';
import { useDashboardResolver } from '@/contexts/dashboard-resolver-context';
import { cn } from '@/lib/utils';
import { AlertCircleIcon, CheckCircleIcon } from '@repo/icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
    WidgetCard,
    WidgetEmptyBody,
    WidgetErrorBody,
    WidgetSkeletonBody,
    WidgetUnavailableBody
} from './widget-states';

// ============================================================================
// CHECKSET TYPES
// ============================================================================

/**
 * Supported checkset identifiers. Each determines WHICH entity type is
 * inspected and WHICH fields are validated.
 *
 * - `'accommodation-health'` — HOST card D: accommodation completeness.
 * - `'host-profile-health'`  — HOST card F: host account + contact completeness.
 * - `'content-health'`       — EDITOR card G: posts + events content health.
 */
export type ChecksetId = 'accommodation-health' | 'host-profile-health' | 'content-health';

// ============================================================================
// ENTITY SHAPES (minimal — only fields the checklist cares about)
// ============================================================================

/**
 * Minimal shape of an accommodation entity needed for the health checklist.
 * Consumers pass the loaded accommodation object; only these fields are read.
 */
export interface AccommodationEntity {
    readonly id: string;
    readonly name: string;
    /** Array of photo/image objects. Present when > 0 means photos are uploaded. */
    readonly photos?: ReadonlyArray<unknown>;
    /** Plain-text or rich-text description of the property. */
    readonly description?: string | null;
    /** Amenities/features attached to this accommodation. */
    readonly amenities?: ReadonlyArray<unknown>;
    /** Base price per night (centavos). 0 or undefined = not set. */
    readonly price?: number | null;
    /** Latitude of exact location. Present when exact pin is set. */
    readonly latitude?: number | null;
    /** Longitude of exact location. */
    readonly longitude?: number | null;
    /** Owner contact phone. */
    readonly contactPhone?: string | null;
    /** Owner contact email. */
    readonly contactEmail?: string | null;
}

/**
 * Minimal shape of a host user/profile entity needed for the profile health check.
 */
export interface HostProfileEntity {
    readonly id: string;
    /** Display name — checked as "full name present". */
    readonly name?: string | null;
    /** Profile avatar URL. */
    readonly avatarUrl?: string | null;
    /** Short bio / about text. */
    readonly bio?: string | null;
    /** Contact phone number. */
    readonly phone?: string | null;
    /** External social or website link. */
    readonly socialLink?: string | null;
    /** Whether the user's email has been verified. */
    readonly emailVerified?: boolean | null;
}

/**
 * Minimal shape of a post entity for content-health checks.
 */
export interface PostEntity {
    readonly id: string;
    readonly title: string;
    readonly featuredImage?: string | null;
    readonly tags?: ReadonlyArray<unknown>;
    readonly seoTitle?: string | null;
    readonly seoDescription?: string | null;
}

/**
 * Minimal shape of an event entity for content-health checks.
 */
export interface EventEntity {
    readonly id: string;
    readonly title: string;
    readonly featuredImage?: string | null;
    readonly locationId?: string | null;
    readonly organizerId?: string | null;
    /** Extended description (only `summary` is required in the schema). */
    readonly description?: string | null;
}

/**
 * Union of all entity types accepted in `config.entities`.
 */
export type ChecklistEntity = AccommodationEntity | HostProfileEntity | PostEntity | EventEntity;

// ============================================================================
// CHECKLIST ITEM (computed result)
// ============================================================================

/**
 * A single resolved checklist item. Computed by the check functions below.
 */
export interface ChecklistItem {
    /** Stable key for React reconciliation. */
    readonly key: string;
    /** Human-readable label shown in the UI. */
    readonly label: string;
    /** `true` = field is present/complete; `false` = missing/incomplete. */
    readonly done: boolean;
}

// ============================================================================
// WIDGET CONFIG SHAPE
// ============================================================================

/**
 * ChecklistWidget-specific fields that may live inside `widget.config`.
 *
 * All fields are optional — the renderer degrades gracefully when absent.
 */
export interface ChecklistWidgetConfig {
    /**
     * Which set of checks to apply. Drives both the entity type assumption and
     * which fields are validated.
     */
    readonly checkset?: ChecksetId;
    /**
     * Optional source ID for the resolver registry. When present, the widget
     * fetches the entity list from this source (same pattern as KpiWidget).
     * When absent, entities must be supplied via `entities`.
     */
    readonly source?: string;
    /**
     * Pre-loaded entity objects. Used when the parent card already has the data
     * and no remote fetch is needed.
     */
    readonly entities?: ReadonlyArray<ChecklistEntity>;
}

// ============================================================================
// PROPS
// ============================================================================

/**
 * Props for the ChecklistWidget renderer. Follows the RO-RO pattern.
 */
export interface ChecklistWidgetProps {
    /**
     * Full widget definition from the IA config (validated by `WidgetSchema`).
     * The renderer reads `widget.config.checkset`, `widget.config.source`,
     * `widget.config.entities`, `widget.scope`, and `widget.label`.
     */
    readonly widget: Widget;
}

// ============================================================================
// CHECK COMPUTATION FUNCTIONS
// ============================================================================

/**
 * Computes the accommodation-health checklist items for one accommodation.
 *
 * Checks (per 03c-dashboards-redefinition.md — HOST card D):
 * - Photos uploaded (at least one)
 * - Description present
 * - Amenities set (at least one)
 * - Price set (> 0)
 * - Exact location pinned (lat + lng present)
 * - Contact info set (phone OR email)
 *
 * @param entity - The accommodation to inspect.
 * @returns Ordered list of checklist items.
 */
function computeAccommodationHealth(entity: AccommodationEntity): ReadonlyArray<ChecklistItem> {
    return [
        {
            key: 'photos',
            label: 'Fotos del alojamiento',
            done: Array.isArray(entity.photos) && entity.photos.length > 0
        },
        {
            key: 'description',
            label: 'Descripción',
            done: typeof entity.description === 'string' && entity.description.trim().length > 0
        },
        {
            key: 'amenities',
            label: 'Comodidades / servicios',
            done: Array.isArray(entity.amenities) && entity.amenities.length > 0
        },
        {
            key: 'price',
            label: 'Precio por noche',
            done: typeof entity.price === 'number' && entity.price > 0
        },
        {
            key: 'location',
            label: 'Ubicación exacta',
            done:
                typeof entity.latitude === 'number' &&
                typeof entity.longitude === 'number' &&
                entity.latitude !== 0 &&
                entity.longitude !== 0
        },
        {
            key: 'contact',
            label: 'Información de contacto',
            done:
                (typeof entity.contactPhone === 'string' &&
                    entity.contactPhone.trim().length > 0) ||
                (typeof entity.contactEmail === 'string' && entity.contactEmail.trim().length > 0)
        }
    ];
}

/**
 * Computes the host-profile-health checklist items.
 *
 * Checks (per 03c-dashboards-redefinition.md — HOST card F):
 * - Full name set
 * - Avatar uploaded
 * - Bio / about text present
 * - Phone set
 * - Social / website link set
 * - Email verified
 *
 * @param entity - The host profile to inspect.
 * @returns Ordered list of checklist items.
 */
function computeHostProfileHealth(entity: HostProfileEntity): ReadonlyArray<ChecklistItem> {
    return [
        {
            key: 'name',
            label: 'Nombre completo',
            done: typeof entity.name === 'string' && entity.name.trim().length > 0
        },
        {
            key: 'avatar',
            label: 'Foto de perfil',
            done: typeof entity.avatarUrl === 'string' && entity.avatarUrl.trim().length > 0
        },
        {
            key: 'bio',
            label: 'Descripción del perfil',
            done: typeof entity.bio === 'string' && entity.bio.trim().length > 0
        },
        {
            key: 'phone',
            label: 'Teléfono de contacto',
            done: typeof entity.phone === 'string' && entity.phone.trim().length > 0
        },
        {
            key: 'social',
            label: 'Enlace de redes / sitio web',
            done: typeof entity.socialLink === 'string' && entity.socialLink.trim().length > 0
        },
        {
            key: 'email-verified',
            label: 'Email verificado',
            done: entity.emailVerified === true
        }
    ];
}

/**
 * Computes the content-health checklist for a single post.
 *
 * Checks (per 03c-dashboards-redefinition.md — EDITOR card G, posts section):
 * - Featured image present
 * - At least one tag set
 * - SEO title or description present
 *
 * @param entity - The post to inspect.
 * @param index  - Position in the list (used to build stable keys).
 * @returns Ordered list of checklist items scoped to this post.
 */
function computePostHealth(entity: PostEntity, index: number): ReadonlyArray<ChecklistItem> {
    const prefix = `post-${index}`;
    return [
        {
            key: `${prefix}-featured-image`,
            label: `"${entity.title}" — Imagen destacada`,
            done: typeof entity.featuredImage === 'string' && entity.featuredImage.trim().length > 0
        },
        {
            key: `${prefix}-tags`,
            label: `"${entity.title}" — Etiquetas`,
            done: Array.isArray(entity.tags) && entity.tags.length > 0
        },
        {
            key: `${prefix}-seo`,
            label: `"${entity.title}" — Metadata SEO`,
            done:
                (typeof entity.seoTitle === 'string' && entity.seoTitle.trim().length > 0) ||
                (typeof entity.seoDescription === 'string' &&
                    entity.seoDescription.trim().length > 0)
        }
    ];
}

/**
 * Computes the content-health checklist for a single event.
 *
 * Checks (per 03c-dashboards-redefinition.md — EDITOR card G, events section):
 * - Featured image present
 * - Location linked
 * - Organizer linked
 * - Extended description present
 *
 * @param entity - The event to inspect.
 * @param index  - Position in the list (used to build stable keys).
 * @returns Ordered list of checklist items scoped to this event.
 */
function computeEventHealth(entity: EventEntity, index: number): ReadonlyArray<ChecklistItem> {
    const prefix = `event-${index}`;
    return [
        {
            key: `${prefix}-featured-image`,
            label: `"${entity.title}" — Imagen destacada`,
            done: typeof entity.featuredImage === 'string' && entity.featuredImage.trim().length > 0
        },
        {
            key: `${prefix}-location`,
            label: `"${entity.title}" — Lugar del evento`,
            done: typeof entity.locationId === 'string' && entity.locationId.trim().length > 0
        },
        {
            key: `${prefix}-organizer`,
            label: `"${entity.title}" — Organizador`,
            done: typeof entity.organizerId === 'string' && entity.organizerId.trim().length > 0
        },
        {
            key: `${prefix}-description`,
            label: `"${entity.title}" — Descripción extendida`,
            done: typeof entity.description === 'string' && entity.description.trim().length > 0
        }
    ];
}

/**
 * Dispatches to the appropriate health-check function based on checkset.
 * For `content-health` the entities array must contain both posts and events
 * (the caller decides how to mix them; this function handles the flat list).
 *
 * @param checkset - Which set of checks to run.
 * @param entity   - The entity to inspect.
 * @param index    - Position in a multi-entity array (used for stable keys).
 * @returns Computed checklist items or an empty array on unknown checkset.
 */
function computeItems(
    checkset: ChecksetId,
    entity: ChecklistEntity,
    index: number
): ReadonlyArray<ChecklistItem> {
    if (checkset === 'accommodation-health') {
        return computeAccommodationHealth(entity as AccommodationEntity);
    }
    if (checkset === 'host-profile-health') {
        return computeHostProfileHealth(entity as HostProfileEntity);
    }
    if (checkset === 'content-health') {
        // Heuristic: event entities have `locationId`; post entities have `tags`.
        // Both are optional — we use the presence of `locationId` as the
        // discriminator because it only exists on EventEntity.
        const hasLocationId = 'locationId' in entity;
        if (hasLocationId) {
            return computeEventHealth(entity as EventEntity, index);
        }
        return computePostHealth(entity as PostEntity, index);
    }
    return [];
}

// ============================================================================
// COMPLETENESS INDICATOR
// ============================================================================

/**
 * Renders the X/Y completeness indicator and a thin progress bar.
 * Color bands: ≥ 80% green, ≥ 50% amber, < 50% destructive.
 */
interface CompletenessBarProps {
    readonly done: number;
    readonly total: number;
}

function CompletenessBar({ done, total }: CompletenessBarProps) {
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);

    const barColor = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-destructive';

    const textColor =
        pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-destructive';

    return (
        <div
            className="mb-3"
            data-testid="checklist-completeness"
        >
            <div className="mb-1 flex items-center justify-between text-xs">
                <span
                    className={cn('font-semibold', textColor)}
                    data-testid="checklist-completeness-fraction"
                >
                    {done}/{total} completado
                </span>
                <span
                    className={cn('font-medium tabular-nums', textColor)}
                    data-testid="checklist-completeness-pct"
                >
                    {pct}%
                </span>
            </div>
            {/* Track */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                {/* Fill */}
                {/* biome-ignore lint/a11y/useFocusableInteractive: presentational progress indicator, not keyboard-interactive */}
                <div
                    className={cn('h-full rounded-full transition-all duration-300', barColor)}
                    style={{ width: `${pct}%` }}
                    data-testid="checklist-completeness-bar"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                />
            </div>
        </div>
    );
}

// ============================================================================
// CHECKLIST ITEM ROW
// ============================================================================

/**
 * Renders one checklist row with a done/missing icon and label.
 */
interface ChecklistRowProps {
    readonly item: ChecklistItem;
}

function ChecklistRow({ item }: ChecklistRowProps) {
    return (
        <div
            className="flex items-center gap-2 py-1"
            data-testid={`checklist-item-${item.key}`}
        >
            {item.done ? (
                <CheckCircleIcon
                    className="h-4 w-4 shrink-0 text-green-500"
                    aria-hidden="true"
                    data-testid={`checklist-icon-done-${item.key}`}
                />
            ) : (
                <AlertCircleIcon
                    className="h-4 w-4 shrink-0 text-amber-500"
                    aria-hidden="true"
                    data-testid={`checklist-icon-missing-${item.key}`}
                />
            )}
            <span
                className={cn('text-sm', item.done ? 'text-foreground' : 'text-muted-foreground')}
            >
                {item.label}
            </span>
        </div>
    );
}

// ============================================================================
// ACCOMMODATION SELECTOR + CHECKLIST (HOST card D inner component)
// ============================================================================

/**
 * Renders the accommodation checklist with an optional selector dropdown.
 * When there is exactly one accommodation, no selector is shown.
 * When there are multiple, a shadcn Select lets the user pick which to inspect.
 */
interface AccommodationChecklistBodyProps {
    readonly accommodations: ReadonlyArray<AccommodationEntity>;
}

function AccommodationChecklistBody({ accommodations }: AccommodationChecklistBodyProps) {
    const [selectedId, setSelectedId] = useState<string>(accommodations[0]?.id ?? '');

    const selectedAccommodation =
        accommodations.find((a) => a.id === selectedId) ?? accommodations[0];

    const items = selectedAccommodation ? computeAccommodationHealth(selectedAccommodation) : [];

    const doneCount = items.filter((i) => i.done).length;

    return (
        <div>
            {/* Selector — shown only when > 1 accommodation */}
            {accommodations.length > 1 && (
                <div
                    className="mb-3"
                    data-testid="checklist-accommodation-selector"
                >
                    <Select
                        value={selectedId}
                        onValueChange={setSelectedId}
                    >
                        <SelectTrigger
                            className="h-8 text-xs"
                            aria-label="Seleccionar alojamiento"
                        >
                            <SelectValue placeholder="Elegir alojamiento…" />
                        </SelectTrigger>
                        <SelectContent>
                            {accommodations.map((acc) => (
                                <SelectItem
                                    key={acc.id}
                                    value={acc.id}
                                    className="text-xs"
                                >
                                    {acc.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <CompletenessBar
                done={doneCount}
                total={items.length}
            />

            <ul
                className="flex list-none flex-col"
                data-testid="checklist-items"
                aria-label="Estado del alojamiento"
            >
                {items.map((item) => (
                    <li key={item.key}>
                        <ChecklistRow item={item} />
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ============================================================================
// GENERIC CHECKLIST BODY (host-profile-health, content-health)
// ============================================================================

/**
 * Generic flat checklist body — collects all items from all entities and
 * renders them in a single list. Used for host-profile and content-health
 * where there is no entity selector (one profile / flat post+event list).
 */
interface GenericChecklistBodyProps {
    readonly checkset: ChecksetId;
    readonly entities: ReadonlyArray<ChecklistEntity>;
}

function GenericChecklistBody({ checkset, entities }: GenericChecklistBodyProps) {
    const items = entities.flatMap((entity, idx) => computeItems(checkset, entity, idx));
    const doneCount = items.filter((i) => i.done).length;

    return (
        <div>
            <CompletenessBar
                done={doneCount}
                total={items.length}
            />

            <ul
                className="flex list-none flex-col"
                data-testid="checklist-items"
                aria-label="Estado del contenido"
            >
                {items.map((item) => (
                    <li key={item.key}>
                        <ChecklistRow item={item} />
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * ChecklistWidget — renders a completeness checklist for an entity.
 *
 * Supports three checksets:
 * - `accommodation-health`: HOST card D — accommodation completeness with
 *   optional selector when > 1 listing.
 * - `host-profile-health`: HOST card F — host account + contact data.
 * - `content-health`: EDITOR card G — posts/events missing required fields.
 *
 * Data can be supplied via:
 * 1. `widget.config.source` — a resolver ID; the widget fetches the entity list
 *    using the same resolver+useQuery pattern as KpiWidget.
 * 2. `widget.config.entities` — pre-loaded entity array; no network fetch.
 *
 * Config shape:
 * ```json
 * {
 *   "checkset": "accommodation-health",
 *   "source": "host.accommodations.list",
 *   "entities": []
 * }
 * ```
 *
 * @example
 * ```tsx
 * <ChecklistWidget widget={widget} />
 * ```
 */
export function ChecklistWidget({ widget }: ChecklistWidgetProps) {
    // -- 1. Extract config fields --------------------------------------------
    const config = (widget.config ?? {}) as ChecklistWidgetConfig;
    const checkset = config.checkset ?? 'accommodation-health';
    const sourceId = config.source ?? '';
    const configEntities = config.entities ?? null;

    // -- 2. Resolver (always call — hooks cannot be conditional) --------------
    const { resolveForScope } = useDashboardResolver();
    const { found, options } = resolveForScope(sourceId, widget.scope);

    // -- 3. useQuery — always call, but enabled only when a source is present -
    // When no source is given (sourceId === '') found will be false and we fall
    // through to the config.entities path after the query.
    const {
        data: fetchedData,
        isLoading,
        error,
        refetch
    } = useQuery({
        ...options,
        // Disable the query when no source is configured (client-side mode).
        enabled: found && sourceId !== ''
    });

    const displayLabel = widget.label.es;

    // -- 4. Source mode: unavailable when source provided but not registered --
    if (sourceId !== '' && !found) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="checklist"
                dataTestId="checklist-widget"
            >
                <WidgetUnavailableBody variant="checklist" />
            </WidgetCard>
        );
    }

    // -- 5. Source mode: loading + error + empty states -----------------------
    if (sourceId !== '' && found) {
        if (isLoading) {
            return (
                <WidgetCard
                    label={displayLabel}
                    variant="checklist"
                    dataTestId="checklist-widget"
                >
                    <WidgetSkeletonBody variant="checklist" />
                </WidgetCard>
            );
        }
        if (error) {
            return (
                <WidgetCard
                    label={displayLabel}
                    variant="checklist"
                    dataTestId="checklist-widget"
                >
                    <WidgetErrorBody
                        variant="checklist"
                        onRetry={() => void refetch()}
                    />
                </WidgetCard>
            );
        }
        if (fetchedData == null) {
            return (
                <WidgetCard
                    label={displayLabel}
                    variant="checklist"
                    dataTestId="checklist-widget"
                >
                    <WidgetEmptyBody
                        variant="checklist"
                        text="Sin datos disponibles"
                    />
                </WidgetCard>
            );
        }
    }

    // -- 6. Resolve entity list -----------------------------------------------
    // Priority: fetched data from resolver > config.entities fallback.
    const resolvedEntities: ReadonlyArray<ChecklistEntity> = (() => {
        if (fetchedData != null) {
            return Array.isArray(fetchedData)
                ? (fetchedData as ReadonlyArray<ChecklistEntity>)
                : ([fetchedData] as unknown as ReadonlyArray<ChecklistEntity>);
        }
        if (configEntities != null && configEntities.length > 0) {
            return configEntities;
        }
        return [];
    })();

    // -- 7. Empty (no entities at all) ----------------------------------------
    if (resolvedEntities.length === 0) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="checklist"
                dataTestId="checklist-widget"
            >
                <WidgetEmptyBody
                    variant="checklist"
                    text="Sin datos disponibles"
                />
            </WidgetCard>
        );
    }

    // -- 8. Render the card ---------------------------------------------------
    return (
        <WidgetCard
            label={displayLabel}
            variant="checklist"
            dataTestId="checklist-widget"
        >
            {/* Body — dispatched by checkset */}
            {checkset === 'accommodation-health' ? (
                <AccommodationChecklistBody
                    accommodations={resolvedEntities as ReadonlyArray<AccommodationEntity>}
                />
            ) : (
                <GenericChecklistBody
                    checkset={checkset}
                    entities={resolvedEntities}
                />
            )}
        </WidgetCard>
    );
}
