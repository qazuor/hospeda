import { useEntityFormContext } from '@/components/entity-form/context/EntityFormContext';
import { computeScore } from '@/components/quality-score';
import { QualityScore } from '@/components/quality-score/QualityScore';
import { useMyEntitlements } from '@/features/billing/use-my-entitlements';
import { EntitlementKey } from '@repo/billing';
import { useStore } from '@tanstack/react-form';
import * as React from 'react';
import { createEventSignals } from '../config/score-signals';

// Same workaround as AccommodationQualityScore — `ReactFormApi` doesn't
// expose `.store` on the type even though the runtime FormApi always has it.
type FormStore = Parameters<typeof useStore>[0];
type FormStoreState = { readonly values: Record<string, unknown> };

export interface EventQualityScoreProps {
    /** Compact rendering for the sticky reduced header. */
    readonly compact?: boolean;
}

/**
 * Quality-score widget specialised for events (SPEC-154 Phase 6 PR2).
 *
 * Mirrors `AccommodationQualityScore` byte-for-byte except for the signal
 * factory. Both widgets share the same engine + `QualityScore` UI; only
 * the signal config is entity-specific.
 *
 * MUST be rendered inside an EntityFormProvider — EntityPageBase places the
 * header (and therefore the `qualityScore` slot) inside the provider. The
 * widget subscribes to TanStack Form's store via `useStore`, so the score
 * recomputes as the user types.
 */
export const EventQualityScore = React.memo(function EventQualityScoreComponent({
    compact = false
}: EventQualityScoreProps) {
    const { form } = useEntityFormContext();
    const { has, isLoading: entitlementsLoading } = useMyEntitlements();

    const formStore = (form as unknown as { readonly store: FormStore }).store;
    const values = useStore(formStore, (state) => (state as FormStoreState).values);

    // SPEC-171 — staff receive every entitlement (`has` → true); HOSTs depend
    // on their plan. While entitlements are loading we fail-open to avoid
    // flashing the gated state.
    const hasVideoGalleryFeature = entitlementsLoading || has(EntitlementKey.CAN_EMBED_VIDEO);

    const signals = React.useMemo(
        () => createEventSignals({ hasVideoGalleryFeature }),
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

EventQualityScore.displayName = 'EventQualityScore';
