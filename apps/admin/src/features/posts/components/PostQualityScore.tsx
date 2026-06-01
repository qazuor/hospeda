import { useEntityFormContext } from '@/components/entity-form/context/EntityFormContext';
import { computeScore } from '@/components/quality-score';
import { QualityScore } from '@/components/quality-score/QualityScore';
import { useMyEntitlements } from '@/features/billing/use-my-entitlements';
import { EntitlementKey } from '@repo/billing';
import { useStore } from '@tanstack/react-form';
import * as React from 'react';
import { createPostSignals } from '../config/score-signals';

// Same workaround as Accommodation/EventQualityScore — `ReactFormApi`
// doesn't expose `.store` on the type even though the runtime FormApi
// always has it.
type FormStore = Parameters<typeof useStore>[0];
type FormStoreState = { readonly values: Record<string, unknown> };

export interface PostQualityScoreProps {
    /** Compact rendering for the sticky reduced header. */
    readonly compact?: boolean;
}

/**
 * Quality-score widget specialised for posts (SPEC-154 Phase 6 PR3).
 *
 * Byte-for-byte mirror of Accommodation/EventQualityScore except for the
 * signal factory. Reuses the shared `QualityScore` UI + engine.
 *
 * MUST be rendered inside an EntityFormProvider — EntityPageBase places
 * the header (and therefore the `qualityScore` slot) inside the provider.
 * Subscribes to TanStack Form's store via `useStore` so the score
 * recomputes live as the editor types.
 */
export const PostQualityScore = React.memo(function PostQualityScoreComponent({
    compact = false
}: PostQualityScoreProps) {
    const { form } = useEntityFormContext();
    const { has, isLoading: entitlementsLoading } = useMyEntitlements();

    // TYPE-WORKAROUND: `ReactFormApi` (the EntityFormContext type alias) doesn't expose
    // `.store` in its public type even though the runtime `FormApi` from `useForm` always
    // has it; casting to a structural shape that matches what `useStore` accepts.
    const formStore = (form as unknown as { readonly store: FormStore }).store;
    const values = useStore(formStore, (state) => (state as FormStoreState).values);

    // SPEC-171 — staff receive every entitlement (`has` → true); during
    // load we fail-open to avoid flashing the gated state.
    const hasVideoGalleryFeature = entitlementsLoading || has(EntitlementKey.CAN_EMBED_VIDEO);

    const signals = React.useMemo(
        () => createPostSignals({ hasVideoGalleryFeature }),
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

PostQualityScore.displayName = 'PostQualityScore';
