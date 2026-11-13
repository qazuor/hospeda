/**
 * @file PoliciesForm.client.tsx
 * @description Form island for `…/editar/politicas/` (HOS-2123).
 *
 * The house-rules panel HOS-2060 placed on the services page, moved to a page
 * of its own when that page was redesigned around the catalog browser. The
 * persistence is unchanged: its keys travel as a `policies` PATCH object built
 * by `buildListingPoliciesPatch` through `extendPayload`, holding only the
 * keys this page owns, compared against the baseline per key.
 *
 * Every key except `minNights` and `maxNights`, which the capacity/pricing page
 * owns (the minimum is a publish requirement and its hub status points there;
 * the maximum moved next to it in HOS-2121). The API merges the PATCH per key,
 * so a save here never touches the stay length and vice versa.
 *
 * The catalog still assigns `policies` to the `amenities` section
 * (`packages/schemas/src/catalog/listing-sections.ts`); this page is an editor
 * route, not a new catalog section (see `ACCOMMODATION_POLICIES_SECTION`).
 */

import { PoliciesPanel } from '@/components/listing/editor/PoliciesPanel.client';
import type { AccommodationEditData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import {
    buildListingPoliciesPatch,
    LISTING_BASE_POLICY_KEYS,
    type ListingPolicyKey,
    setListingPolicy
} from '@/lib/listing/listing-policies';
import { ActionBar } from '../ActionBar.client';
import { AccommodationPoliciesSchema } from '../accommodation-edit-form.schema';
import { ACCOMMODATION_FIELD_PREFIX } from '../field-ids';
import { useAccommodationSectionForm } from '../use-accommodation-section-form';
import styles from './SectionForm.module.css';

/**
 * The house-rule keys this page owns: the shared base plus the accommodation's
 * check-in/out, the private-events details (HOS-2122, right after
 * `eventsAllowed`, the base's last key, so they render under it), the booking
 * deposit and the spoken languages (HOS-2120).
 *
 * The stay length is NOT here: `minNights` and `maxNights` both live on the
 * capacity/pricing page (HOS-2121).
 */
export const ACCOMMODATION_POLICY_KEYS: readonly ListingPolicyKey[] = [
    'checkIn',
    'checkOut',
    ...LISTING_BASE_POLICY_KEYS,
    'eventsDetails',
    'deposit',
    'spokenLanguages'
];

/** No plain field of this page is diffed: `policies` travels via `extendPayload`. */
const OWN_FIELDS: readonly string[] = [];

/** Module-level so the hook's payload memo does not recompute on every render. */
function extendPolicies({
    values,
    baseline
}: {
    readonly values: AccommodationEditData;
    readonly baseline: AccommodationEditData;
}): Record<string, unknown> {
    const policies = buildListingPoliciesPatch({
        current: values.policies,
        baseline: baseline.policies,
        keys: ACCOMMODATION_POLICY_KEYS
    });
    return policies ? { policies } : {};
}

interface PoliciesFormProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly initialData: AccommodationEditData;
}

/**
 * House-rules form for one accommodation.
 *
 * @param props - Locale, id and the loaded entity.
 */
export function PoliciesForm({ locale, accommodationId, initialData }: PoliciesFormProps) {
    const form = useAccommodationSectionForm({
        locale,
        accommodationId,
        initialValues: initialData,
        ownFields: OWN_FIELDS,
        schema: AccommodationPoliciesSchema,
        extendPayload: extendPolicies
    });

    return (
        <form
            className={styles.form}
            onSubmit={form.handleSubmit}
            noValidate
        >
            <div className={styles.card}>
                <PoliciesPanel
                    locale={locale}
                    idPrefix={ACCOMMODATION_FIELD_PREFIX}
                    keys={ACCOMMODATION_POLICY_KEYS}
                    policies={form.values.policies}
                    errors={form.fieldErrors}
                    onChange={(key, value) =>
                        form.setValue(
                            'policies',
                            setListingPolicy({ policies: form.values.policies, key, value })
                        )
                    }
                />
            </div>

            {form.formError && (
                <div
                    className={styles.error}
                    role="alert"
                >
                    {form.formError}
                </div>
            )}

            <ActionBar
                locale={locale}
                isSaving={form.isSaving}
                onCancel={form.handleCancel}
            />
        </form>
    );
}
