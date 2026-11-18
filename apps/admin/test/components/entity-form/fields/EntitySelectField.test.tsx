/**
 * HOS-919 regression - EntitySelectField must honour ENTITY_MULTISELECT configs.
 *
 * The component used to read `typeConfig` only for `ENTITY_SELECT`, so a field
 * declared as `ENTITY_MULTISELECT` (e.g. the host-trade `categoryIds` field) got
 * a null entity config: `loadByIdsFn` never ran, `multiple` was false and the
 * prefilled ids rendered as an empty picker.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { FieldConfig, SelectOption } from '@/components/entity-form/types/field-config.types';
import { EntitySelectField } from '../../../../src/components/entity-form/fields/EntitySelectField';

vi.mock('@repo/i18n', () => ({
    useTranslations: () => ({
        t: (key: string) => key,
        tPlural: (key: string, count: number) => `${key}:${count}`
    })
}));

vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ addToast: vi.fn() })
}));

type LoadByIdsFn = (ids: string[]) => Promise<SelectOption[]>;
type LoadAllFn = () => Promise<SelectOption[]>;

const OPTIONS: SelectOption[] = [
    { value: 'cat-1', label: 'Plumbing' },
    { value: 'cat-2', label: 'Electrical' },
    { value: 'cat-3', label: 'Gardening' }
];

const buildConfig = ({
    type,
    multiple,
    loadByIdsFn,
    loadAllFn
}: {
    readonly type: FieldTypeEnum;
    readonly multiple: boolean;
    readonly loadByIdsFn: LoadByIdsFn;
    readonly loadAllFn: LoadAllFn;
}): FieldConfig =>
    ({
        id: 'categoryIds',
        type,
        label: 'Categories',
        required: false,
        modes: ['create', 'edit'],
        typeConfig: {
            entityType: 'CATEGORY',
            multiple,
            searchMode: 'client',
            searchFn: vi.fn().mockResolvedValue([]),
            loadByIdsFn,
            loadAllFn,
            minItems: 1,
            maxItems: 3
        }
    }) as unknown as FieldConfig;

describe('EntitySelectField - ENTITY_MULTISELECT (HOS-919)', () => {
    let loadByIdsFn: Mock<LoadByIdsFn>;
    let loadAllFn: Mock<LoadAllFn>;

    beforeEach(() => {
        loadByIdsFn = vi.fn<LoadByIdsFn>(async (ids: string[]) =>
            OPTIONS.filter((o) => ids.includes(o.value))
        );
        loadAllFn = vi.fn<LoadAllFn>(async () => OPTIONS);
    });

    it('loads and renders the labels of a prefilled id array', async () => {
        // Arrange
        const config = buildConfig({
            type: FieldTypeEnum.ENTITY_MULTISELECT,
            multiple: true,
            loadByIdsFn,
            loadAllFn
        });

        // Act
        await act(async () => {
            render(
                <EntitySelectField
                    config={config}
                    value={['cat-1', 'cat-2', 'cat-3']}
                    onChange={vi.fn()}
                />
            );
        });

        // Assert
        await waitFor(() => expect(loadByIdsFn).toHaveBeenCalled());
        expect(loadByIdsFn.mock.calls[0]?.[0]).toEqual(['cat-1', 'cat-2', 'cat-3']);
        expect(await screen.findByText('Plumbing')).toBeInTheDocument();
        expect(screen.getByText('Electrical')).toBeInTheDocument();
        expect(screen.getByText('Gardening')).toBeInTheDocument();
        expect(loadAllFn).toHaveBeenCalled();
    });

    it('treats the field as multiple: removing one badge keeps the rest', async () => {
        // Arrange
        const onChange = vi.fn();
        const config = buildConfig({
            type: FieldTypeEnum.ENTITY_MULTISELECT,
            multiple: true,
            loadByIdsFn,
            loadAllFn
        });
        await act(async () => {
            render(
                <EntitySelectField
                    config={config}
                    value={['cat-1', 'cat-2']}
                    onChange={onChange}
                />
            );
        });
        await screen.findByText('Plumbing');

        // Act: the badge remove button sits next to the label
        const removeButton = screen.getByText('Plumbing').parentElement?.querySelector('button');
        expect(removeButton).toBeTruthy();
        fireEvent.click(removeButton as HTMLButtonElement);

        // Assert
        expect(onChange).toHaveBeenCalledWith(['cat-2']);
    });
});

describe('EntitySelectField - ENTITY_SELECT regression', () => {
    it('keeps working in single mode and renders no badges', async () => {
        // Arrange
        const loadByIdsFn = vi.fn<LoadByIdsFn>(async (ids: string[]) =>
            OPTIONS.filter((o) => ids.includes(o.value))
        );
        const loadAllFn = vi.fn<LoadAllFn>(async () => OPTIONS);
        const config = buildConfig({
            type: FieldTypeEnum.ENTITY_SELECT,
            multiple: false,
            loadByIdsFn,
            loadAllFn
        });

        // Act
        await act(async () => {
            render(
                <EntitySelectField
                    config={config}
                    value="cat-2"
                    onChange={vi.fn()}
                />
            );
        });

        // Assert
        await waitFor(() => expect(loadByIdsFn).toHaveBeenCalledWith(['cat-2']));
        expect(await screen.findByRole('combobox')).toHaveTextContent('Electrical');
        expect(screen.queryByText('Plumbing')).not.toBeInTheDocument();
    });
});
