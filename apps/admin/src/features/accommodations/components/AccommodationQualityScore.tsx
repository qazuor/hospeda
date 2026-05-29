import { useEntityFormContext } from '@/components/entity-form/context/EntityFormContext';
import { computeScore } from '@/components/quality-score';
import { QualityScore } from '@/components/quality-score/QualityScore';
import { useMyEntitlements } from '@/features/billing/use-my-entitlements';
import { useShouldShowEntitlementGates } from '@/features/billing/use-should-show-entitlement-gates';
import { EntitlementKey } from '@repo/billing';
import { useStore } from '@tanstack/react-form';
import * as React from 'react';
import { createAccommodationSignals } from '../config/score-signals';

// The `ReactFormApi` alias used by EntityFormContext in this monorepo doesn't
// expose `.store` on the type even though the runtime FormApi from useForm
// always has it. We cast through `unknown` to a structural shape that matches
// what `useStore` accepts as its first arg — no behavior change at runtime.
type FormStore = Parameters<typeof useStore>[0];
type FormStoreState = { readonly values: Record<string, unknown> };

export interface AccommodationQualityScoreProps {
    /**
     * Compact rendering for the sticky reduced header. The route flips this
     * via the EntityPageHeader's `isReduced` flag — the route can keep
     * declaring the widget as a render function and forward the bit through.
     */
    readonly compact?: boolean;
}

/**
 * Quality-score widget specialised for accommodation.
 *
 * MUST be rendered inside an EntityFormProvider — EntityPageBase places the
 * header (and therefore the `qualityScore` slot) inside the provider for
 * exactly this reason. The component subscribes to TanStack Form's store via
 * `useStore`, so the score recomputes as the host types (spec §4.9 "en vivo
 * en edit"). In view mode the form's initial values mirror the loaded entity,
 * giving the same widget a stable snapshot without any extra plumbing.
 */
export const AccommodationQualityScore = React.memo(function AccommodationQualityScoreComponent({
    compact = false
}: AccommodationQualityScoreProps) {
    const { form } = useEntityFormContext();
    const shouldGate = useShouldShowEntitlementGates();
    const { has, isLoading: entitlementsLoading } = useMyEntitlements();

    // The engine is pure so recomputation is cheap (~10 signals per pass).
    // Selecting `state.values` triggers a re-render only when the values
    // identity changes, which TanStack Form does after each mutation.
    const formStore = (form as unknown as { readonly store: FormStore }).store;
    const values = useStore(formStore, (state) => (state as FormStoreState).values);

    // Per spec §4.7: staff (non-HOST) skip gating entirely — they have no
    // plan in the billing sense, so surfacing "Mejorar plan" at them is
    // misleading. Treat every feature as unlocked. While entitlements are
    // loading we fail-open too, matching the gate components' behavior.
    const hasVideoGalleryFeature =
        !shouldGate || entitlementsLoading || has(EntitlementKey.CAN_EMBED_VIDEO);

    const signals = React.useMemo(
        () => createAccommodationSignals({ hasVideoGalleryFeature }),
        [hasVideoGalleryFeature]
    );

    const result = React.useMemo(() => computeScore(signals, values), [signals, values]);

    return (
        <QualityScore
            result={result}
            compact={compact}
        />
    );
});

AccommodationQualityScore.displayName = 'AccommodationQualityScore';
