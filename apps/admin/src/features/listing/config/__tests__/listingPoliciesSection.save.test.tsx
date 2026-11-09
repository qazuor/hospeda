/**
 * Regression test for the house-rules section save path (HOS-2060 staging
 * smoke): edits in "Normas de la casa" snapped back and "Guardar" answered
 * "No hay cambios para guardar" without sending a PATCH.
 *
 * Mounts the real provider + section wiring the edit page uses, with the real
 * accommodation update schema, so the submit-time validation runs exactly as
 * on the page before the payload is built.
 */
import { AccommodationUpdateInputSchema, PermissionEnum } from '@repo/schemas';
import { act, fireEvent, render } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@repo/i18n', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/i18n')>()),
    useTranslations: () => ({ t: (key: string) => key })
}));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));
vi.mock('@/features/billing/use-effective-set', () => ({
    useEffectiveSet: () => ({ has: () => true, isLoading: false })
}));

import {
    EntityFormContext,
    type EntityFormContextValue
} from '@/components/entity-form/context/EntityFormContext';
import { EntityFormSection } from '@/components/entity-form/EntityFormSection';
import { EntityFormProvider } from '@/components/entity-form/providers/EntityFormProvider';
import type { EntityConfig } from '@/components/entity-form/types/entity-config.types';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { filterSectionsByMode } from '@/components/entity-form/utils/section-filter.utils';
import { prepareFormValues } from '@/components/entity-form/utils/unflatten-values.utils';
import { buildEntityUpdatePayload } from '@/components/entity-pages/utils/build-update-payload';
import { createListingPoliciesSection } from '../listingPoliciesSection';

const PERMISSIONS = [
    PermissionEnum.ACCOMMODATION_VIEW_ALL,
    PermissionEnum.ACCOMMODATION_AMENITIES_EDIT
];

const t = ((key: string) => key) as Parameters<typeof createListingPoliciesSection>[0]['t'];

const [section] = filterSectionsByMode(
    [createListingPoliciesSection({ vertical: 'accommodation', t }).section],
    'edit'
) as SectionConfig[];

const config = {
    id: 'accommodation-1',
    entityType: 'accommodation',
    sections: [section],
    viewSections: [],
    editSections: [section],
    routes: { base: '/', view: '/', edit: '/', sections: {}, editSections: {} },
    permissions: { view: [], edit: [], create: [], delete: [] }
} as unknown as EntityConfig;

/** The owner's free-text pets note: only the owner editor writes it. */
const PETS_NOTE = { es: 'Solo perros chicos', en: 'Small dogs only', pt: 'Só cães pequenos' };

/** A stored accommodation carrying house rules, as the admin GET returns it. */
const STORED = {
    id: 'acc-1',
    name: 'Cabaña',
    policies: {
        paymentMethods: ['cash', 'debit', 'credit'],
        pets: { admission: 'yes', notes: PETS_NOTE },
        smokingAllowed: 'outdoor_only',
        minNights: 2
    }
};

function Harness({ ctxRef }: { readonly ctxRef: { current: EntityFormContextValue | null } }) {
    const ctx = React.useContext(EntityFormContext) as EntityFormContextValue;
    ctxRef.current = ctx;
    return (
        <EntityFormSection
            config={section as SectionConfig}
            values={ctx.values}
            errors={ctx.errors}
            onFieldChange={ctx.setFieldValue}
            onFieldBlur={() => undefined}
            userPermissions={PERMISSIONS}
        />
    );
}

function renderEditForm() {
    const fieldIds = section?.fields.map((field) => field.id) ?? [];
    const initialValues = prepareFormValues(STORED, fieldIds);
    const sent: Array<Record<string, unknown> | null> = [];
    const ctxRef: { current: EntityFormContextValue | null } = { current: null };

    const onSave = async (values: Record<string, unknown>) => {
        sent.push(buildEntityUpdatePayload({ fieldIds, values, initialValues }).payload);
    };

    render(
        <EntityFormProvider
            config={config}
            initialValues={initialValues}
            userPermissions={PERMISSIONS}
            zodSchema={AccommodationUpdateInputSchema}
            onSave={onSave}
        >
            <Harness ctxRef={ctxRef} />
        </EntityFormProvider>
    );
    return { sent, ctxRef };
}

const checkbox = (value: string) =>
    document.getElementById(`policies.paymentMethods-${value}`) as HTMLElement;

describe('house-rules section save path (HOS-2060)', () => {
    it('sends the payment method and pets edits, keeping the stored pets note', async () => {
        // Arrange
        const { sent, ctxRef } = renderEditForm();

        // Act: the checkbox click and the select write go through the same
        // `setFieldValue` the real controls call.
        act(() => {
            fireEvent.click(checkbox('transfer'));
        });
        act(() => {
            ctxRef.current?.setFieldValue('policies.pets.admission', 'on_request');
        });
        await act(async () => {
            await ctxRef.current?.save();
        });

        // Assert
        expect(sent).toHaveLength(1);
        const policies = (sent[0] as { policies: Record<string, unknown> }).policies;
        expect(policies.paymentMethods).toEqual(['cash', 'debit', 'credit', 'transfer']);
        expect(policies.pets).toEqual({ admission: 'on_request', notes: PETS_NOTE });
        expect(policies.smokingAllowed).toBe('outdoor_only');
    });

    it('keeps the edit on screen after the submit-time validation runs', async () => {
        // Arrange
        const { ctxRef } = renderEditForm();

        // Act
        act(() => {
            fireEvent.click(checkbox('transfer'));
        });
        await act(async () => {
            await ctxRef.current?.save();
        });

        // Assert
        expect(checkbox('transfer').getAttribute('data-state')).toBe('checked');
    });

    it('builds no payload when nothing changed', async () => {
        // Arrange
        const { sent, ctxRef } = renderEditForm();

        // Act
        await act(async () => {
            await ctxRef.current?.save();
        });

        // Assert
        expect(sent).toEqual([null]);
    });
});
