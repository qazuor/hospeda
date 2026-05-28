import { Button } from '@/components/ui-wrapped/Button';
import { cn } from '@/lib/utils';
import { AddIcon, ChevronLeftIcon, EditIcon, SaveIcon, XCircleIcon } from '@repo/icons';
import * as React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Mode of the entity page — controls which action buttons are displayed.
 */
export type EntityPageMode = 'view' | 'edit' | 'create';

/**
 * Media configuration for the header thumbnail/avatar slot.
 *
 * - `type: 'thumbnail'` — rectangular image with rounded corners (accommodations,
 *   events, posts, destinations).
 * - `type: 'avatar'` — circular image (users).
 */
export interface EntityPageHeaderMedia {
    /** Visual treatment: rectangular thumbnail or circular avatar. */
    readonly type: 'thumbnail' | 'avatar';
    /** Image URL. When undefined a placeholder bg is shown. */
    readonly src?: string;
    /** Fallback text/node shown when `src` is absent or fails to load. */
    readonly fallback?: React.ReactNode;
    /** Alt text for the <img>. Defaults to entity name. */
    readonly alt?: string;
}

/**
 * Action callbacks for view mode.
 */
export interface ViewModeActions {
    /** Called when the "Volver" button is clicked. */
    readonly onBack: () => void;
    /** Called when the "Editar" button is clicked. */
    readonly onEdit: () => void;
}

/**
 * Action callbacks for edit mode.
 */
export interface EditModeActions {
    /** Called when the "Cancelar" button is clicked. */
    readonly onCancel: () => void;
    /**
     * Called when the "Guardar" button is clicked.
     * Optional: consumers may prefer to rely on form submit instead.
     */
    readonly onSave?: () => void;
    /** When `true` the "sin guardar" dirty indicator is shown. */
    readonly isDirty?: boolean;
    /** When `true` the save button shows a loading spinner. */
    readonly isSaving?: boolean;
}

/**
 * Action callbacks for create mode.
 */
export interface CreateModeActions {
    /** Called when the "Cancelar" button is clicked. */
    readonly onCancel: () => void;
    /**
     * Called when the "Crear" button is clicked.
     * Optional: consumers may prefer to rely on form submit instead.
     */
    readonly onCreate?: () => void;
    /** When `true` the create button shows a loading spinner. */
    readonly isCreating?: boolean;
}

/**
 * Props for the EntityPageHeader component.
 */
export interface EntityPageHeaderProps {
    /** Page mode — controls which action set is shown. */
    readonly mode: EntityPageMode;
    /** Primary entity name / title. */
    readonly title: string;
    /**
     * Subtitle line shown below the title.
     * Typical content: "Tipo · Destino" (e.g. "Hotel · Gualeguaychú").
     * Omit for create mode or entities without a subtitle.
     */
    readonly subtitle?: string;
    /**
     * Status badge elements. Rendered in a flex row below the subtitle.
     * Pass `<Badge>` components from ui-wrapped.
     */
    readonly badges?: React.ReactNode;
    /**
     * Slot for the quality score widget.
     * Rendered to the right of the entity info, left of the action buttons.
     * Pass `null` for entities without a score (users, catalogs).
     */
    readonly qualityScore?: React.ReactNode;
    /**
     * Media configuration for the header thumbnail / avatar.
     * Omit to hide the image entirely (e.g. in create mode).
     */
    readonly media?: EntityPageHeaderMedia;
    /** Actions for view mode. Required when `mode === 'view'`. */
    readonly viewActions?: ViewModeActions;
    /** Actions for edit mode. Required when `mode === 'edit'`. */
    readonly editActions?: EditModeActions;
    /** Actions for create mode. Required when `mode === 'create'`. */
    readonly createActions?: CreateModeActions;
    /** Additional CSS classes applied to the outermost wrapper. */
    readonly className?: string;
}

// ---------------------------------------------------------------------------
// Internal sub-components
// ---------------------------------------------------------------------------

/**
 * Thumbnail / avatar slot rendered on the left of the header.
 * Transitions to a smaller size when the header is in reduced (shrunk) state.
 */
function HeaderMedia({
    media,
    title,
    isReduced
}: {
    readonly media: EntityPageHeaderMedia;
    readonly title: string;
    readonly isReduced: boolean;
}) {
    const isAvatar = media.type === 'avatar';
    const alt = media.alt ?? title;

    const wrapperClass = cn(
        'flex-none overflow-hidden bg-muted transition-all duration-200',
        isAvatar
            ? isReduced
                ? 'h-8 w-8 rounded-full'
                : 'h-14 w-14 rounded-full'
            : isReduced
              ? 'h-8 w-8 rounded-md'
              : 'h-14 w-14 rounded-lg'
    );

    if (!media.src) {
        return (
            <div
                className={wrapperClass}
                aria-hidden="true"
            >
                {media.fallback && (
                    <span className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">
                        {media.fallback}
                    </span>
                )}
            </div>
        );
    }

    return (
        <img
            src={media.src}
            alt={alt}
            className={cn(wrapperClass, 'object-cover')}
            loading="eager"
        />
    );
}

/**
 * Action buttons for view mode: Volver + Editar.
 */
function ViewActions({ actions }: { readonly actions: ViewModeActions }) {
    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={actions.onBack}
                leftIcon={<ChevronLeftIcon className="h-4 w-4" />}
                aria-label="Volver al listado"
            >
                Volver
            </Button>
            <Button
                variant="default"
                size="sm"
                onClick={actions.onEdit}
                leftIcon={<EditIcon className="h-4 w-4" />}
                aria-label="Editar entidad"
            >
                Editar
            </Button>
        </>
    );
}

/**
 * Action buttons for edit mode: Cancelar + (dirty indicator) + Guardar.
 */
function EditActions({ actions }: { readonly actions: EditModeActions }) {
    return (
        <>
            {actions.isDirty && (
                <output
                    className="hidden font-semibold text-warning text-xs sm:inline"
                    aria-live="polite"
                    data-testid="dirty-indicator"
                >
                    ● sin guardar
                </output>
            )}
            <Button
                variant="outline"
                size="sm"
                onClick={actions.onCancel}
                leftIcon={<XCircleIcon className="h-4 w-4" />}
                aria-label="Cancelar edición"
            >
                Cancelar
            </Button>
            <Button
                variant="default"
                size="sm"
                onClick={actions.onSave}
                loading={actions.isSaving}
                leftIcon={actions.isSaving ? undefined : <SaveIcon className="h-4 w-4" />}
                aria-label="Guardar cambios"
            >
                {actions.isSaving ? 'Guardando…' : 'Guardar'}
            </Button>
        </>
    );
}

/**
 * Action buttons for create mode: Cancelar + Crear.
 */
function CreateActions({ actions }: { readonly actions: CreateModeActions }) {
    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={actions.onCancel}
                leftIcon={<XCircleIcon className="h-4 w-4" />}
                aria-label="Cancelar creación"
            >
                Cancelar
            </Button>
            <Button
                variant="default"
                size="sm"
                onClick={actions.onCreate}
                loading={actions.isCreating}
                leftIcon={actions.isCreating ? undefined : <AddIcon className="h-4 w-4" />}
                aria-label="Crear entidad"
            >
                {actions.isCreating ? 'Creando…' : 'Crear'}
            </Button>
        </>
    );
}

// ---------------------------------------------------------------------------
// Hook: scroll sentinel via IntersectionObserver
// ---------------------------------------------------------------------------

/**
 * Detects whether the user has scrolled past the sentinel element.
 *
 * Uses IntersectionObserver (not scroll listener) to avoid main-thread
 * blocking. The sentinel is a zero-height div placed immediately after
 * the full-size header; when it leaves the viewport, `isReduced` becomes
 * `true`.
 *
 * @returns A tuple of [isReduced, sentinelRef] — attach `sentinelRef` to
 * the sentinel div in the render tree.
 */
function useScrollShrink(): [boolean, React.RefObject<HTMLDivElement | null>] {
    const [isReduced, setIsReduced] = React.useState(false);
    const sentinelRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                // entry is null-safe: IntersectionObserver always returns at least one
                setIsReduced(!(entry?.isIntersecting ?? true));
            },
            {
                // rootMargin: negative top offset equals the expected reduced header
                // height (~52px). The sentinel fires "not intersecting" a bit early
                // so the transition appears to happen right as the header touches top.
                rootMargin: '-52px 0px 0px 0px',
                threshold: 0
            }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, []);

    return [isReduced, sentinelRef];
}

// ---------------------------------------------------------------------------
// EntityPageHeader
// ---------------------------------------------------------------------------

/**
 * EntityPageHeader — sticky header for entity view / edit / create pages.
 *
 * Renders a hybrid thumbnail header with:
 * - Left: optional media (thumbnail or avatar) + title + subtitle + status badges.
 * - Right: optional quality score slot + mode-specific action buttons.
 *
 * Behaviour:
 * - Sticky at the top of the viewport (`position: sticky; top: 0`).
 * - **Reduced state** when scrolled past a sentinel: thumbnail shrinks,
 *   subtitle and badges hide, resulting in a compact single-line strip.
 *   Uses IntersectionObserver (no scroll listener — no layout thrash).
 * - Accessible: landmark role `banner`, keyboard-navigable action buttons.
 *
 * @example
 * ```tsx
 * <EntityPageHeader
 *   mode="edit"
 *   title="Hotel Plaza"
 *   subtitle="Hotel · Gualeguaychú"
 *   badges={<><Badge variant="success">Publicado</Badge><Badge>Activo</Badge></>}
 *   media={{ type: 'thumbnail', src: '/images/hotel.jpg' }}
 *   qualityScore={<QualityScoreWidget score={80} />}
 *   editActions={{
 *     onCancel: () => navigate({ to: '../' }),
 *     onSave: handleSave,
 *     isDirty: form.isDirty,
 *     isSaving: mutation.isPending,
 *   }}
 * />
 * ```
 */
export function EntityPageHeader({
    mode,
    title,
    subtitle,
    badges,
    qualityScore,
    media,
    viewActions,
    editActions,
    createActions,
    className
}: EntityPageHeaderProps) {
    const [isReduced, sentinelRef] = useScrollShrink();

    return (
        <>
            {/* ----------------------------------------------------------------
                Sticky header
            ---------------------------------------------------------------- */}
            <header
                className={cn(
                    // Positioning — sticks under the chrome row (h-14 = 56px). The chrome's
                    // 12px wave svg sits at z-40 on top of this header (z-30), so the entity
                    // header tucks under the wave without a visible gap.
                    'sticky top-14 z-30',
                    // Surface — card style at rest, morphs into a full-bleed bar when shrunken
                    // (breaks out of the parent's p-6 with negative margins to reach the chrome).
                    isReduced
                        ? '-mx-6 -mt-6 rounded-none border-border border-x-0 border-t-0 border-b bg-card shadow-sm'
                        : 'rounded-lg border border-border bg-card shadow-sm',
                    // Spacing — transitions between full and reduced
                    isReduced ? 'px-6 py-3' : 'px-4 py-3 sm:px-5 sm:py-4',
                    // Flex layout
                    'flex items-center gap-3',
                    // Smooth transitions for padding + children
                    'transition-all duration-200',
                    className
                )}
                data-testid="entity-page-header"
                data-reduced={isReduced}
            >
                {/* ---- Media (thumbnail / avatar) ---- */}
                {media && (
                    <HeaderMedia
                        media={media}
                        title={title}
                        isReduced={isReduced}
                    />
                )}

                {/* ---- Entity info ---- */}
                <div className="min-w-0 flex-1">
                    <h1
                        className={cn(
                            'truncate font-heading font-semibold text-foreground leading-tight',
                            isReduced ? 'text-base' : 'text-xl sm:text-2xl'
                        )}
                    >
                        {title}
                    </h1>

                    {/* Subtitle + badges — hidden in reduced mode */}
                    {!isReduced && (
                        <>
                            {subtitle && (
                                <p className="mt-0.5 truncate text-muted-foreground text-sm">
                                    {subtitle}
                                </p>
                            )}
                            {badges && (
                                <div
                                    className="mt-1.5 flex flex-wrap items-center gap-1.5"
                                    data-testid="header-badges"
                                >
                                    {badges}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ---- Right side: quality score + actions ---- */}
                {/* When reduced, nudge the actions down a touch (`mt-1`) so the buttons */}
                {/* don't feel glued to the bar's top edge in the slim chrome state. */}
                <div
                    className={cn(
                        'flex flex-none items-center gap-2 sm:gap-3',
                        isReduced && 'mt-1'
                    )}
                >
                    {/* Quality score slot — always visible (it's the point of sticky) */}
                    {qualityScore && (
                        <div
                            className="hidden sm:block"
                            data-testid="quality-score-slot"
                        >
                            {qualityScore}
                        </div>
                    )}

                    {/* Mode-specific action buttons */}
                    <div
                        className="flex items-center gap-2"
                        data-testid="header-actions"
                    >
                        {mode === 'view' && viewActions && <ViewActions actions={viewActions} />}
                        {mode === 'edit' && editActions && <EditActions actions={editActions} />}
                        {mode === 'create' && createActions && (
                            <CreateActions actions={createActions} />
                        )}
                    </div>
                </div>
            </header>

            {/* ----------------------------------------------------------------
                Sentinel — zero-height element placed immediately after the
                header. IntersectionObserver watches this; when it leaves the
                viewport the header enters reduced mode.
            ---------------------------------------------------------------- */}
            <div
                ref={sentinelRef}
                aria-hidden="true"
                className="h-0 w-full"
                data-testid="scroll-sentinel"
            />
        </>
    );
}

EntityPageHeader.displayName = 'EntityPageHeader';
