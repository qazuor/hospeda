/**
 * @file GastronomyQualityScore.tsx
 * Quality-score widget for gastronomy listings (SPEC-239 T-059).
 *
 * Mirrors `EventQualityScore` — subscribes to the TanStack Form store via
 * `useStore` so the score recomputes live as the admin edits the form.
 *
 * MUST be rendered inside an `EntityFormProvider` (EntityPageBase wraps the
 * header inside one automatically, which is where the `qualityScore` slot
 * renders).
 */

import { useEntityFormContext } from '@/components/entity-form/context/EntityFormContext';
import { computeScore } from '@/components/quality-score';
import { QualityScore } from '@/components/quality-score/QualityScore';
import { useStore } from '@tanstack/react-form';
import * as React from 'react';
import { createGastronomySignals } from '../config/score-signals';

// TYPE-WORKAROUND: `ReactFormApi` doesn't expose `.store` on the public type
// even though the runtime `FormApi` (from `useForm`) always has it.
type FormStore = Parameters<typeof useStore>[0];
type FormStoreState = { readonly values: Record<string, unknown> };

/** Props accepted by {@link GastronomyQualityScore}. */
export interface GastronomyQualityScoreProps {
    /** Compact rendering for the sticky reduced header. */
    readonly compact?: boolean;
}

/**
 * Quality-score widget specialised for gastronomy listings.
 *
 * Signals: featuredImage · galleryPhotos · photosAlt · description · summary ·
 * contact · cuisine · operatingHours · capacity = 100 pts total.
 */
export const GastronomyQualityScore = React.memo(function GastronomyQualityScoreComponent({
    compact = false
}: GastronomyQualityScoreProps) {
    const { form } = useEntityFormContext();

    // TYPE-WORKAROUND: cast form to the structural { store } shape useStore accepts (TanStack Form generic gap).
    const formStore = (form as unknown as { readonly store: FormStore }).store;
    const values = useStore(formStore, (state) => (state as FormStoreState).values);

    const signals = React.useMemo(() => createGastronomySignals(), []);

    const result = React.useMemo(() => computeScore(signals, values), [signals, values]);

    return (
        <QualityScore
            result={result}
            compact={compact}
        />
    );
});

GastronomyQualityScore.displayName = 'GastronomyQualityScore';
