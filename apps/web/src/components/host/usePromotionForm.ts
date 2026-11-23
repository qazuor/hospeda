/**
 * @file usePromotionForm.ts
 * @description State and side effects of the owner-promotion form (SPEC-205
 * T-304, split out of `PromotionForm.client.tsx` for HOS-2505).
 *
 * - Edit without `initialData` reads the promotion with `getById`.
 * - The owner's accommodations fill the property select (never blocking).
 * - `save()` validates (explicit required fields, then the create or update
 *   Zod schema), sends the request and reports a `SaveOutcome` for the kit
 *   save bar. A 403 `LIMIT_REACHED` / `ENTITLEMENT_REQUIRED` becomes its own
 *   banner kind with an upgrade hint, never the generic «could not save».
 * - On success it queues the toast for the list page (HOS-2451) and resyncs
 *   the baseline BEFORE navigating, so the leave warning never fires on the
 *   redirect.
 */

import { OwnerPromotionCreateRequestSchema, OwnerPromotionUpdateInputSchema } from '@repo/schemas';
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { SaveOutcome } from '@/components/account/ui';
import { ownerPromotionApi, protectedAccommodationsApi } from '@/lib/api/endpoints-protected';
import { transformOwnerPromotion } from '@/lib/api/transforms';
import type {
    OwnerPromotionCreateInput,
    OwnerPromotionData,
    OwnerPromotionUpdateInput
} from '@/lib/api/types';
import { zodIssuesToFieldErrors } from '@/lib/forms/field-errors';
import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { queueToastForNextPage } from '@/store/toast-store';
import {
    buildInitialPromotionFields,
    buildPromotionPayload,
    type PromotionFieldErrors,
    type PromotionFieldValues,
    samePromotionFields,
    validatePromotionFields
} from './promotion-form-state';

/** Translator signature the form uses (`t(key, fallback)`). */
type Translate = (key: string, fallback?: string) => string;

/** Load state of the promotion record (edit mode without `initialData`). */
export type PromotionDataLoad =
    | { readonly status: 'idle' }
    | { readonly status: 'loading' }
    | { readonly status: 'error'; readonly message: string };

/** One option of the property select. */
export interface OwnAccommodationOption {
    readonly id: string;
    readonly label: string;
}

/** Load state of the property select. */
export type AccommodationsLoad =
    | { readonly status: 'loading' }
    | { readonly status: 'ready'; readonly items: readonly OwnAccommodationOption[] }
    | { readonly status: 'error' };

/** Which form-level failure is showing. */
export type PromotionFormFailure =
    | { readonly kind: 'generic'; readonly message: string }
    | { readonly kind: 'limit'; readonly message: string }
    | { readonly kind: 'entitlement'; readonly message: string };

/** Options of {@link usePromotionForm}. */
export interface UsePromotionFormOptions {
    readonly locale: SupportedLocale;
    readonly mode: 'create' | 'edit';
    readonly initialData?: OwnerPromotionData;
    readonly promotionId?: string;
    readonly t: Translate;
}

/** What {@link usePromotionForm} returns. */
export interface UsePromotionFormResult {
    readonly dataLoad: PromotionDataLoad;
    readonly accommodationsLoad: AccommodationsLoad;
    readonly fields: PromotionFieldValues;
    readonly errors: PromotionFieldErrors;
    readonly failure: PromotionFormFailure | null;
    readonly isDirty: boolean;
    readonly onFieldChange: (
        e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => void;
    readonly onVipOnlyChange: (e: ChangeEvent<HTMLInputElement>) => void;
    readonly save: () => Promise<SaveOutcome>;
    readonly discard: () => void;
}

/**
 * Drives the promotion form.
 *
 * @param options - See {@link UsePromotionFormOptions}.
 * @returns The form state and its handlers.
 */
export function usePromotionForm({
    locale,
    mode,
    initialData,
    promotionId,
    t
}: UsePromotionFormOptions): UsePromotionFormResult {
    const needsFetch = mode === 'edit' && !initialData && !!promotionId;
    const [dataLoad, setDataLoad] = useState<PromotionDataLoad>(
        needsFetch ? { status: 'loading' } : { status: 'idle' }
    );
    const [baseline, setBaseline] = useState<PromotionFieldValues>(() =>
        buildInitialPromotionFields({ data: initialData })
    );
    const [fields, setFields] = useState<PromotionFieldValues>(baseline);
    const [errors, setErrors] = useState<PromotionFieldErrors>({});
    const [failure, setFailure] = useState<PromotionFormFailure | null>(null);
    const [accommodationsLoad, setAccommodationsLoad] = useState<AccommodationsLoad>({
        status: 'loading'
    });
    const [redirectTo, setRedirectTo] = useState<string | null>(null);

    // biome-ignore lint/correctness/useExhaustiveDependencies: needsFetch encodes promotionId (stable prop); t is stable per locale; listing them would re-fetch in a loop
    useEffect(() => {
        if (!needsFetch) return;
        let cancelled = false;
        const loadFailed = t(
            'host.promotions.errors.loadFailed',
            'No se pudo cargar la promoción.'
        );
        const fetchPromotion = async (): Promise<void> => {
            try {
                const result = await ownerPromotionApi.getById({ id: promotionId as string });
                if (cancelled) return;
                if (!result.ok) {
                    const status = (result.error as { status?: number }).status;
                    const message =
                        status === 404
                            ? t('host.promotions.errors.notFound', 'No se encontró la promoción.')
                            : status === 403
                              ? t(
                                    'host.promotions.errors.forbidden',
                                    'No tenés permiso para acceder a esta promoción.'
                                )
                              : loadFailed;
                    setDataLoad({ status: 'error', message });
                    return;
                }
                const loaded = buildInitialPromotionFields({
                    data: transformOwnerPromotion({ item: result.data as Record<string, unknown> })
                });
                setBaseline(loaded);
                setFields(loaded);
                setDataLoad({ status: 'idle' });
            } catch {
                if (!cancelled) setDataLoad({ status: 'error', message: loadFailed });
            }
        };
        void fetchPromotion();
        return () => {
            cancelled = true;
        };
    }, [needsFetch]);

    useEffect(() => {
        let cancelled = false;
        const fetchOwnAccommodations = async (): Promise<void> => {
            try {
                const result = await protectedAccommodationsApi.listOwn({ pageSize: 100 });
                if (cancelled) return;
                if (!result.ok) {
                    setAccommodationsLoad({ status: 'error' });
                    return;
                }
                const rawItems = (result.data.items ?? []) as readonly Record<string, unknown>[];
                setAccommodationsLoad({
                    status: 'ready',
                    items: rawItems.map((item) => ({
                        id: String(item.id ?? ''),
                        label: String(item.name ?? item.title ?? item.id ?? '')
                    }))
                });
            } catch {
                if (!cancelled) setAccommodationsLoad({ status: 'error' });
            }
        };
        void fetchOwnAccommodations();
        return () => {
            cancelled = true;
        };
    }, []);

    const isDirty = useMemo(
        () => !samePromotionFields({ a: fields, b: baseline }),
        [fields, baseline]
    );

    // Navigate only once the baseline caught up: the leave guard is off by then.
    useEffect(() => {
        if (redirectTo !== null && !isDirty) window.location.href = redirectTo;
    }, [redirectTo, isDirty]);

    const onFieldChange = useCallback(
        (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
            const { name, value } = e.currentTarget;
            setFields((prev) => ({ ...prev, [name]: value }));
            setErrors((prev) =>
                prev[name as keyof PromotionFieldValues] ? { ...prev, [name]: undefined } : prev
            );
            setFailure(null);
        },
        []
    );

    const onVipOnlyChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const { checked } = e.currentTarget;
        setFields((prev) => ({ ...prev, vipOnly: checked }));
    }, []);

    const save = useCallback(async (): Promise<SaveOutcome> => {
        setFailure(null);
        const saveFailed = t(
            'host.promotions.errors.saveFailed',
            'No se pudo guardar la promoción. Intentá de nuevo.'
        );
        const required = validatePromotionFields({ fields, t });
        if (Object.keys(required).length > 0) {
            setErrors(required);
            return { ok: false, invalidFields: Object.keys(required) };
        }
        const payload = buildPromotionPayload({ fields });
        // Create validates against the exact client-facing POST schema (no
        // ownerId: the route injects it); edit against the partial strict
        // update schema.
        const parsed =
            mode === 'create'
                ? OwnerPromotionCreateRequestSchema.safeParse(payload)
                : OwnerPromotionUpdateInputSchema.safeParse(payload);
        if (!parsed.success) {
            // Each `zodError.*` key goes through `t` (HOS-190 BETA-190).
            const fieldErrors = zodIssuesToFieldErrors(
                parsed.error.issues,
                t
            ) as PromotionFieldErrors;
            setErrors(fieldErrors);
            return { ok: false, invalidFields: Object.keys(fieldErrors) };
        }
        setErrors({});
        try {
            const result =
                mode === 'create'
                    ? await ownerPromotionApi.create({
                          // TYPE-WORKAROUND: Zod-validated data (@repo/schemas) is structurally the web-local create input; the nominal types differ across the schema/web-lib boundary and serialize identically to JSON.
                          body: parsed.data as unknown as OwnerPromotionCreateInput
                      })
                    : await ownerPromotionApi.update({
                          id: promotionId ?? '',
                          // TYPE-WORKAROUND: Zod-validated data (@repo/schemas) is structurally the web-local update input; the nominal types differ across the schema/web-lib boundary and serialize identically to JSON.
                          body: parsed.data as unknown as OwnerPromotionUpdateInput
                      });
            if (!result.ok) {
                const { status, code } = result.error;
                if (
                    status === 403 &&
                    (code === 'LIMIT_REACHED' || code === 'ENTITLEMENT_LIMIT_REACHED')
                ) {
                    setFailure({ kind: 'limit', message: saveFailed });
                } else if (status === 403 && code === 'ENTITLEMENT_REQUIRED') {
                    setFailure({
                        kind: 'entitlement',
                        message: t(
                            'host.promotions.errors.entitlementRequired',
                            'Tu plan no incluye promociones.'
                        )
                    });
                } else {
                    setFailure({ kind: 'generic', message: saveFailed });
                }
                return { ok: false };
            }
            // HOS-2451: the redirect is a hard navigation, so the toast is
            // queued for the list page.
            queueToastForNextPage({
                type: 'success',
                message:
                    mode === 'create'
                        ? t('host.promotions.success.created', 'Promoción creada')
                        : t('host.promotions.success.updated', 'Promoción actualizada')
            });
            setBaseline(fields);
            setRedirectTo(buildUrl({ locale, path: 'mi-cuenta/promociones' }));
            return { ok: true };
        } catch {
            setFailure({ kind: 'generic', message: saveFailed });
            return { ok: false };
        }
    }, [fields, locale, mode, promotionId, t]);

    const discard = useCallback(() => {
        setFields(baseline);
        setErrors({});
        setFailure(null);
    }, [baseline]);

    return {
        dataLoad,
        accommodationsLoad,
        fields,
        errors,
        failure,
        isDirty,
        onFieldChange,
        onVipOnlyChange,
        save,
        discard
    };
}
