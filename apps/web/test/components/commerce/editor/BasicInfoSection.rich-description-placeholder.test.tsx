/**
 * @file BasicInfoSection.rich-description-placeholder.test.tsx
 * @description Guard (HOS-829): the commerce "Descripción ampliada" field shows
 * NO placeholder hint. The owner asked for that copy to go — the field is
 * self-explanatory beside its own title — so re-adding a `placeholder` here
 * would restore removed copy, not fix anything.
 *
 * Kept out of `BasicInfoSection.test.tsx`: that suite's `RichTextEditor` shim is
 * a `<textarea>` that drops every prop it does not forward, so `placeholder`
 * would be unobservable there no matter what the section passes. This shim
 * records the props instead.
 *
 * @module test/components/commerce/editor/BasicInfoSection.rich-description-placeholder
 */

import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BasicInfoSection } from '../../../../src/components/commerce/editor/BasicInfoSection.client';
import { buildEditData } from './edit-data-fixture';

vi.mock('../../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            const raw =
                key === 'commerce.owner.editor.validation.summaryHint'
                    ? '{{count}}/300'
                    : (fallback ?? `[MISSING:${key}]`);
            if (!params) return raw;
            return Object.keys(params).reduce(
                (acc, k) => acc.replaceAll(`{{${k}}}`, String(params[k])),
                raw
            );
        }
    })
}));

/** Props captured from every `RichTextEditor` the section renders. */
const richTextProps: Array<Record<string, unknown>> = [];

vi.mock('@/components/host/editor/RichTextEditor.client', () => ({
    RichTextEditor: (props: Record<string, unknown>) => {
        richTextProps.push(props);
        return (
            <textarea
                aria-label={props.ariaLabel as string | undefined}
                value={props.value as string}
                onChange={(event) => (props.onChange as (v: string) => void)(event.target.value)}
            />
        );
    }
}));

const DESTINATION_1 = '11111111-1111-4111-8111-111111111111';

describe('BasicInfoSection — richDescription has no placeholder hint (HOS-829)', () => {
    beforeEach(() => {
        richTextProps.length = 0;
    });

    it('renders the rich description editor without any placeholder text', () => {
        render(
            <BasicInfoSection
                locale="es"
                vertical="gastronomy"
                data={buildEditData()}
                destinations={[{ id: DESTINATION_1, name: 'Concepción del Uruguay' }]}
                destinationsLoadFailed={false}
                errors={{}}
                onFieldChange={vi.fn()}
            />
        );

        // Anchor the assertion: exactly one rich editor must have rendered, or
        // "no placeholder" would be trivially true for zero editors.
        expect(richTextProps).toHaveLength(1);

        const props = richTextProps[0] as Record<string, unknown>;
        // Deliberately NOT `objectContaining` — that is blind to a missing key,
        // which is precisely the state under assertion here.
        expect('placeholder' in props && props.placeholder !== undefined).toBe(false);

        // The field is still labelled and still reaches the form, so this is
        // "the hint is gone", not "the field is gone".
        expect(props.ariaLabel).toBe('Descripción ampliada');
        expect(typeof props.onChange).toBe('function');
    });

    it('leaves the removed hint out of the rendered section entirely', () => {
        const { container } = render(
            <BasicInfoSection
                locale="es"
                vertical="gastronomy"
                data={buildEditData()}
                destinations={[{ id: DESTINATION_1, name: 'Concepción del Uruguay' }]}
                destinationsLoadFailed={false}
                errors={{}}
                onFieldChange={vi.fn()}
            />
        );

        expect(container.textContent).not.toContain('Contá la historia de tu comercio');
    });
});
