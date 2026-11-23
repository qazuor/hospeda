/**
 * @file PromotionForm.client.tsx
 * @description Create / edit owner-promotion island (SPEC-205 T-304) on the
 * account kit (HOS-2505, HOS-2451).
 *
 * Three ways in, all kept: create, edit with `initialData`, and edit by id
 * (reads the record with `getById`, shows a Skeleton meanwhile).
 *
 * - **Plan gate before the form (D9).** In create mode the effective set is
 *   read first; when it answers and `create_promotions` is absent, a
 *   `LockedState` with the catalog plan names (`lockPlanNames`, read by the
 *   page) replaces the form. «Tu plan no incluye promociones» is no longer
 *   something the owner discovers on save. A failed read does not lock: the
 *   API still decides on save, and its 403 keeps its own banner.
 * - **Explicit save (D8).** Kit fields in two Sections and a `StickySaveBar`
 *   driven by `useSaveBar`; «Cancelar» is a kit `LinkButton` of its own, so it
 *   can never sit on top of the save action (HOS-2451).
 * - **Feedback.** A 403 `LIMIT_REACHED` / `ENTITLEMENT_REQUIRED` is an `Alert`
 *   with an upgrade hint and a «Ver planes» `LinkButton`; success queues the
 *   toast the list page shows (HOS-2451).
 *
 * State and requests live in `usePromotionForm`; the fields in
 * `PromotionFormFields`; the pure rules in `promotion-form-state`.
 */

import { type JSX, useEffect, useState } from 'react';
import {
    Alert,
    ErrorState,
    LinkButton,
    LockedState,
    Skeleton,
    StickySaveBar,
    useSaveBar
} from '@/components/account/ui';
import type { OwnerPromotionData } from '@/lib/api/types';
import { getEntitlementsCached } from '@/lib/entitlements-cache';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import { buildUrl } from '@/lib/urls';
import styles from './PromotionForm.module.css';
import { PROMOTION_FIELD_PREFIX, PromotionFormFields } from './PromotionFormFields';
import { usePromotionForm } from './usePromotionForm';

/** Props for the PromotionForm island. */
export interface PromotionFormProps {
    /** Active locale for i18n and redirect URL generation. */
    readonly locale: SupportedLocale;
    /** Whether the form creates a new promotion or edits an existing one. */
    readonly mode: 'create' | 'edit';
    /** Pre-populated data for edit mode. Ignored in create mode. */
    readonly initialData?: OwnerPromotionData;
    /** Required in edit mode: the promotion's UUID to update. */
    readonly promotionId?: string;
    /**
     * HOS-2544: catalog names of the tourist plans that carry exclusive deals, read by the SSR
     * page (the catalog reader is server-only). Empty when the catalog could not be read.
     */
    readonly audiencePlanNames?: readonly string[];
    /**
     * HOS-2505: catalog names of the owner plans that include promotions, for the
     * LockedState. Empty when the catalog could not be read.
     */
    readonly lockPlanNames?: readonly string[];
}

/** Result of the create-mode plan check. */
type PlanGate = 'checking' | 'open' | 'locked';

/**
 * Reads the effective set once in create mode.
 *
 * @param input - Options object.
 * @param input.enabled - Whether to check (create mode).
 * @returns `checking` until the read settles, then `open` or `locked`.
 */
function usePromotionPlanGate({ enabled }: { readonly enabled: boolean }): PlanGate {
    const [gate, setGate] = useState<PlanGate>(enabled ? 'checking' : 'open');
    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        const check = async (): Promise<void> => {
            const effectiveSet = await getEntitlementsCached({ vertical: 'accommodation' });
            if (cancelled) return;
            // A failed read is not «no plan»: the API decides on save.
            const locked =
                !effectiveSet.failed && (effectiveSet.entitlements.create_promotions ?? 0) <= 0;
            setGate(locked ? 'locked' : 'open');
        };
        void check();
        return () => {
            cancelled = true;
        };
    }, [enabled]);
    return gate;
}

/**
 * PromotionForm — create / edit owner-promotion island.
 *
 * @param props - See {@link PromotionFormProps}.
 * @returns The plan lock, a load state, or the form with its save bar.
 */
export function PromotionForm({
    locale,
    mode,
    initialData,
    promotionId,
    audiencePlanNames = [],
    lockPlanNames = []
}: PromotionFormProps): JSX.Element {
    const { t } = createTranslations(locale);
    const form = usePromotionForm({ locale, mode, initialData, promotionId, t });
    const saveBar = useSaveBar({
        locale,
        isDirty: form.isDirty,
        onSave: form.save,
        onDiscard: form.discard,
        idPrefix: PROMOTION_FIELD_PREFIX
    });
    const gate = usePromotionPlanGate({ enabled: mode === 'create' });

    const promotionsListUrl = buildUrl({ locale, path: 'mi-cuenta/promociones' });
    const upgradeUrl = buildUrl({ locale, path: PRICING_PAGE_PATH_BY_AUDIENCE.owner });

    if (gate === 'locked') {
        return (
            <LockedState
                locale={locale}
                reason={{
                    kind: 'plan',
                    feature: t(
                        'host.promotions.errors.entitlementRequired',
                        'Tu plan no incluye promociones.'
                    ),
                    description: t(
                        'host.promotions.errors.entitlementRequiredHint',
                        'Mejorá tu plan para crear promociones.'
                    ),
                    plans: lockPlanNames.map((name) => ({ name })),
                    plansHref: upgradeUrl
                }}
            />
        );
    }

    if (gate === 'checking' || form.dataLoad.status === 'loading') {
        return (
            <div
                role="status"
                aria-label={t('host.promotions.loading', 'Cargando promoción...')}
            >
                <p className={styles.loadingText}>
                    {t('host.promotions.loading', 'Cargando promoción...')}
                </p>
                <Skeleton
                    locale={locale}
                    shape="text"
                    lines={6}
                />
            </div>
        );
    }

    if (form.dataLoad.status === 'error') {
        return (
            <div className={styles.promotionForm}>
                <ErrorState
                    locale={locale}
                    title={form.dataLoad.message}
                    description={t(
                        'host.promotions.kit.loadFailedHint',
                        'Volvé a la lista e intentá de nuevo.'
                    )}
                    onRetry={() => window.location.reload()}
                />
                <LinkButton
                    href={promotionsListUrl}
                    variant="secondary"
                >
                    {t('host.promotions.kit.backToList', 'Volver a mis promociones')}
                </LinkButton>
            </div>
        );
    }

    const { failure } = form;

    return (
        <form
            className={styles.promotionForm}
            onSubmit={(e) => {
                e.preventDefault();
                void saveBar.save();
            }}
            noValidate
            aria-label={
                mode === 'create'
                    ? t('host.promotions.createButton', 'Nueva promoción')
                    : t('host.promotions.actions.edit', 'Editar')
            }
        >
            <PromotionFormFields
                locale={locale}
                t={t}
                fields={form.fields}
                errors={form.errors}
                accommodationsLoad={form.accommodationsLoad}
                audiencePlanNames={audiencePlanNames}
                onFieldChange={form.onFieldChange}
                onVipOnlyChange={form.onVipOnlyChange}
            />

            {failure ? (
                <Alert
                    tone={failure.kind === 'generic' ? 'danger' : 'warning'}
                    locale={locale}
                    title={failure.message}
                    action={
                        failure.kind === 'entitlement' ? (
                            <LinkButton
                                href={upgradeUrl}
                                variant="accent"
                                size="sm"
                            >
                                {t('host.promotions.actions.upgradePlan', 'Ver planes')}
                            </LinkButton>
                        ) : undefined
                    }
                >
                    {failure.kind === 'limit'
                        ? t(
                              'host.promotions.errors.limitReachedHint',
                              'Alcanzaste el límite de promociones activas de tu plan. Mejorá tu plan para crear más.'
                          )
                        : failure.kind === 'entitlement'
                          ? t(
                                'host.promotions.errors.entitlementRequiredHint',
                                'Mejorá tu plan para crear promociones.'
                            )
                          : null}
                </Alert>
            ) : null}

            <div className={styles.footer}>
                <LinkButton
                    href={promotionsListUrl}
                    variant="secondary"
                >
                    {t('host.promotions.actions.cancel', 'Cancelar')}
                </LinkButton>
            </div>

            <StickySaveBar
                locale={locale}
                status={saveBar.status}
                onSave={() => void saveBar.save()}
                onDiscard={saveBar.discard}
                onGoToFirstError={() => {
                    saveBar.goToFirstError();
                }}
            />
        </form>
    );
}
