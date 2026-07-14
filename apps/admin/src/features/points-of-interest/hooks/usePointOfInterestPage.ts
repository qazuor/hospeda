import type { PointOfInterest } from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import type { CoordinatesValue } from '@/components/entity-form/fields/CoordinatesField';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { filterSectionsByMode } from '@/components/entity-form/utils/section-filter.utils';
import { useTranslations } from '@/hooks/use-translations';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { adminLogger } from '@/utils/logger';
import { createPointOfInterestConsolidatedConfig } from '../config';
import {
    usePointOfInterestQuery,
    useUpdatePointOfInterestMutation
} from './usePointOfInterestQuery';

/**
 * `PointOfInterest` shaped for the entity form, with two synthetic fields
 * layered on top of the real API entity:
 *
 * - `coordinates`: the `CoordinatesField` value shape (`{ lat, long }` as
 *   strings), derived from the domain entity's plain numeric `lat`/`long`
 *   columns. There is no `coordinates` key on the real entity — this is
 *   purely a form-input convenience (HOS-144 §6.3).
 * - `keywords`: overridden from `text[]` to a newline-joined `string` for
 *   the "one keyword per line" textarea convention (§6.5).
 */
export type PointOfInterestFormEntity = Omit<PointOfInterest, 'keywords'> & {
    coordinates?: CoordinatesValue;
    keywords?: string;
};

/**
 * Which flow is submitting the form — the create-vs-edit nullability
 * contract differs (see {@link buildPointOfInterestSubmitPayload}).
 */
export type PointOfInterestSubmitMode = 'create' | 'edit';

/**
 * Result of {@link buildPointOfInterestSubmitPayload} — a discriminated
 * union so callers can't accidentally submit a payload built from invalid
 * coordinate input (HOS-144 judgment-day fix, FIX 1/FIX 3).
 */
export type PointOfInterestSubmitPayloadResult =
    | { readonly ok: true; readonly payload: Partial<PointOfInterest> }
    | { readonly ok: false; readonly error: string };

/**
 * Normalizes a single coordinate component: trims whitespace and rewrites
 * an Argentine-locale comma decimal separator (`-32,4825`) to a dot so
 * `Number()` can parse it. Returns `''` for `undefined`/empty input.
 */
const normalizeCoordComponent = (raw: string | undefined): string => {
    if (raw === undefined) return '';
    return raw.trim().replace(',', '.');
};

/**
 * Builds the `lat`/`long` slice of the submit payload from the synthetic
 * `coordinates` field, honouring the create-vs-edit nullability contract:
 *
 * - `PointOfInterestCreateInputSchema` has `lat`/`long` as `.nullable()`
 *   (NOT `.optional()`) — create must always send both keys, defaulting to
 *   `null` when no coordinate was entered (coordinate-less POIs are the
 *   majority case, HOS-138).
 * - `PointOfInterestUpdateInputSchema` is `.partial()` — omitting the keys
 *   means "leave unchanged", so edit only sends them when the user actually
 *   touched the field (explicit Clear, or a valid/emptied pair).
 * - Supports Argentine comma-decimal input (`-32,4825` → `-32.4825`).
 * - Never silently coerces unparseable input to `null` — that would wipe a
 *   real coordinate (`Number('-32,4825')` is `NaN` without normalization).
 *   Returns a validation error instead.
 * - Rejects a half-filled pair (one axis entered, the other left blank)
 *   instead of persisting a broken coordinate.
 */
const buildCoordinatesPayload = ({
    coordinates,
    mode
}: {
    coordinates: unknown;
    mode: PointOfInterestSubmitMode;
}):
    | { readonly ok: true; readonly value: Partial<Pick<PointOfInterest, 'lat' | 'long'>> }
    | { readonly ok: false; readonly error: string } => {
    // Explicit clear (`CoordinatesField`'s Clear button calls `onChange(null)`).
    if (coordinates === null) {
        return { ok: true, value: { lat: null, long: null } };
    }

    // Field never touched: create always sends null coordinates; edit omits
    // the keys entirely so the partial update leaves them unchanged.
    if (coordinates === undefined) {
        return mode === 'create'
            ? { ok: true, value: { lat: null, long: null } }
            : { ok: true, value: {} };
    }

    const { lat: rawLat, long: rawLong } = coordinates as CoordinatesValue;
    const lat = normalizeCoordComponent(rawLat);
    const long = normalizeCoordComponent(rawLong);
    const latEmpty = lat === '';
    const longEmpty = long === '';

    if (latEmpty && longEmpty) {
        return { ok: true, value: { lat: null, long: null } };
    }

    if (latEmpty !== longEmpty) {
        return {
            ok: false,
            error: 'Both latitude and longitude are required together — only one was provided.'
        };
    }

    const latNumber = Number(lat);
    const longNumber = Number(long);

    if (Number.isNaN(latNumber) || Number.isNaN(longNumber)) {
        return { ok: false, error: 'Coordinates must be valid numbers.' };
    }

    return { ok: true, value: { lat: latNumber, long: longNumber } };
};

/**
 * Transforms raw `EntityFormSection` submit values into the POI admin API's
 * PATCH/POST body shape:
 *
 * - Splits the synthetic `coordinates` field (`{ lat: string, long: string }`)
 *   back into numeric `lat`/`long` columns (HOS-144 §6.3 / AC-7), per the
 *   create-vs-edit nullability contract documented on
 *   {@link buildCoordinatesPayload}.
 * - Splits the "one keyword per line" `keywords` textarea value back into a
 *   trimmed, non-empty `text[]` (§6.5 / AC-6).
 *
 * @param values - Raw, unflattened form values as collected by `EntityPageBase`.
 * @param mode - `'create'` or `'edit'` — controls whether untouched
 *   coordinates are sent as `null` (create) or omitted (edit, partial update).
 * @returns `{ ok: true, payload }` with the API-shaped payload, or
 *   `{ ok: false, error }` when the coordinate input can't be safely
 *   translated (never silently drops/nulls a real value).
 */
export const buildPointOfInterestSubmitPayload = ({
    values,
    mode
}: {
    values: Record<string, unknown>;
    mode: PointOfInterestSubmitMode;
}): PointOfInterestSubmitPayloadResult => {
    const { coordinates, keywords, ...rest } = values;
    const payload: Record<string, unknown> = { ...rest };

    const coordsResult = buildCoordinatesPayload({ coordinates, mode });
    if (!coordsResult.ok) {
        return coordsResult;
    }
    Object.assign(payload, coordsResult.value);

    if (typeof keywords === 'string') {
        payload.keywords = keywords
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
    }

    return { ok: true, payload: payload as Partial<PointOfInterest> };
};

/**
 * Hook for managing point-of-interest entity pages.
 * Centralizes all point-of-interest-specific logic in one place, mirroring
 * `useAttractionPage`.
 */
export const usePointOfInterestPage = (entityId: string) => {
    const navigate = useNavigate();
    const { t } = useTranslations();

    // State for mode (view/edit)
    const [mode, setMode] = useState<'view' | 'edit'>('view');
    const [activeSection, setActiveSection] = useState<string>();

    // Use hooks directly at the top level
    const query = usePointOfInterestQuery(entityId);
    const updateMutation = useUpdatePointOfInterestMutation(entityId);

    // Consolidated configuration
    const entityConfig = useMemo(() => {
        const consolidatedConfig = createPointOfInterestConsolidatedConfig(t);

        const viewSections = filterSectionsByMode(consolidatedConfig.sections, 'view');
        const editSections = filterSectionsByMode(consolidatedConfig.sections, 'edit');

        return {
            viewSections,
            editSections,
            metadata: consolidatedConfig.metadata
        };
    }, [t]);

    // Permissions configuration - static
    const permissions = useMemo(
        () => ({
            view: [PermissionEnum.POINT_OF_INTEREST_VIEW],
            edit: [PermissionEnum.POINT_OF_INTEREST_UPDATE],
            create: [PermissionEnum.POINT_OF_INTEREST_CREATE],
            delete: [PermissionEnum.POINT_OF_INTEREST_DELETE]
        }),
        []
    );

    // Real permissions from AuthContext
    const userPermissions = useUserPermissions();

    // Check permissions for current mode
    const canView = useMemo(() => {
        return permissions.view.some((permission) => userPermissions.includes(permission));
    }, [permissions.view, userPermissions]);

    const canEdit = useMemo(() => {
        return permissions.edit.some((permission) => userPermissions.includes(permission));
    }, [permissions.edit, userPermissions]);

    // Mode switching
    const switchToView = () => setMode('view');
    const switchToEdit = () => setMode('edit');

    // Navigation
    // HOS-144 Phase 2 landed the points-of-interest routes, so these resolve
    // against real route-tree literals now — no `as never` workaround needed
    // (Phase 1 required one here since the routes didn't exist yet).
    const goToList = () => navigate({ to: '/content/points-of-interest' });
    const goToView = () =>
        navigate({
            to: '/content/points-of-interest/$id',
            params: { id: entityId }
        });
    const goToEdit = () =>
        navigate({
            to: '/content/points-of-interest/$id/edit',
            params: { id: entityId }
        });

    // Get sections based on current mode
    const getSections = (): SectionConfig[] => {
        return mode === 'view' ? entityConfig.viewSections : entityConfig.editSections;
    };

    // ----------------------------------------------------------------
    // Pre-populate the synthetic `coordinates` / `keywords` form fields from
    // the domain entity's plain `lat`/`long`/`keywords` columns (§6.3/§6.5).
    // ----------------------------------------------------------------
    const enrichedEntity = useMemo((): PointOfInterestFormEntity | undefined => {
        if (!query.data) return undefined;
        const raw = query.data;

        const coordinates: CoordinatesValue | undefined =
            raw.lat != null && raw.long != null
                ? { lat: String(raw.lat), long: String(raw.long) }
                : undefined;

        const keywords = Array.isArray(raw.keywords) ? raw.keywords.join('\n') : '';

        return { ...raw, coordinates, keywords };
    }, [query.data]);

    const hookReturn = {
        // State
        mode,
        setMode,
        switchToView,
        switchToEdit,
        activeSection,
        setActiveSection,

        // Data
        entity: enrichedEntity,
        isLoading: query.isLoading,
        error: query.error,

        // Configuration
        entityConfig,
        sections: getSections(),

        // Permissions
        userPermissions,
        canView,
        canEdit,

        // Mutations — wraps the raw update mutation with the submit-payload
        // builder (coordinates/keywords transform, §6.3/§6.5) so callers
        // (EntityPageBase) can keep passing raw, unflattened form values.
        // Invalid coordinate input (NaN, or a half-filled lat/long pair)
        // throws instead of silently persisting garbage — the error
        // propagates through `EntityFormProvider.handleSave` /
        // `EntityEditContent.handleSave`'s existing catch, which already
        // toasts `error.message` (HOS-144 judgment-day FIX 1/FIX 3).
        updateMutation: {
            mutateAsync: (values: Record<string, unknown>) => {
                const result = buildPointOfInterestSubmitPayload({ values, mode: 'edit' });
                if (!result.ok) {
                    adminLogger.error('[usePointOfInterestPage] Invalid coordinates on submit', {
                        entityId,
                        error: result.error
                    });
                    throw new Error(t('error.form.validation-failed'));
                }
                return updateMutation.mutateAsync(result.payload);
            },
            isLoading: updateMutation.isPending
        },

        // Utilities
        entityType: 'pointOfInterest',
        entityId,

        // Navigation
        goToList,
        goToView,
        goToEdit
    };

    return hookReturn;
};
