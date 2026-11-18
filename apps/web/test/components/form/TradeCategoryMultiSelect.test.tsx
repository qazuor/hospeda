/**
 * @file TradeCategoryMultiSelect.test.tsx
 * @description Tests for the grouped multi-select combobox behind the provider
 * sign-up category field (HOS-919 AC-1.1 to AC-1.4, AC-1.6, AC-1.8).
 *
 * The assertions are about what the user can perceive and operate: roles, ARIA
 * state, keyboard flow, and the text on screen.
 */

import type { PublicHostTradeCatalog } from '@repo/schemas';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TradeCategoryMultiSelect } from '@/components/form/TradeCategoryMultiSelect.client';

type Group = PublicHostTradeCatalog['groups'][number];
type Category = Group['categories'][number];

const cat = (input: {
    slug: string;
    es: string;
    en?: string;
    kwEs?: string[];
    weight?: number;
}): Category => ({
    id: `00000000-0000-4000-8000-${input.slug.length.toString().padStart(12, '0')}`,
    slug: input.slug,
    nameI18n: { es: input.es, en: input.en ?? input.es, pt: input.es },
    displayWeight: input.weight ?? 10,
    keywordsI18n: { es: input.kwEs ?? [], en: [], pt: [] }
});

const GROUPS: Group[] = [
    {
        slug: 'instalaciones',
        nameI18n: { es: 'Instalaciones', en: 'Installations', pt: 'Instalações' },
        displayWeight: 10,
        categories: [
            cat({ slug: 'plomeria', es: 'Plomería', en: 'Plumbing', kwEs: ['caño', 'agua'] }),
            cat({
                slug: 'destapaciones-desagotes',
                es: 'Destapaciones y desagotes',
                kwEs: ['pozo ciego']
            }),
            cat({ slug: 'climatizacion', es: 'Climatización', kwEs: ['aire acondicionado'] })
        ]
    },
    {
        slug: 'exterior',
        nameI18n: { es: 'Exterior', en: 'Outdoors', pt: 'Área externa' },
        displayWeight: 20,
        categories: [
            cat({ slug: 'piletas', es: 'Piletas', kwEs: ['piscina'] }),
            cat({ slug: 'parque-jardineria', es: 'Parque y jardinería', kwEs: ['pasto'] })
        ]
    }
];

/** Builds a catalog with `count` categories in one group, used for the max lock. */
function buildLargeGroups(count: number): Group[] {
    return [
        {
            slug: 'big',
            nameI18n: { es: 'Grande', en: 'Big', pt: 'Grande' },
            displayWeight: 1,
            categories: Array.from({ length: count }, (_, i) =>
                cat({ slug: `rubro-${String(i).padStart(2, '0')}`, es: `Rubro ${i}` })
            )
        }
    ];
}

interface HarnessProps {
    readonly groups?: Group[];
    readonly initial?: readonly string[];
    readonly max?: number;
    readonly locale?: 'es' | 'en' | 'pt';
    readonly onChangeSpy?: (value: readonly string[]) => void;
}

/** Controlled wrapper so selection state behaves like the real form. */
function Harness({ groups = GROUPS, initial = [], max, locale = 'es', onChangeSpy }: HarnessProps) {
    const [value, setValue] = useState<readonly string[]>(initial);
    return (
        <TradeCategoryMultiSelect
            locale={locale}
            groups={groups}
            value={value}
            max={max}
            label="Rubros"
            onChange={(next) => {
                onChangeSpy?.(next);
                setValue(next);
            }}
        />
    );
}

const getInput = () => screen.getByRole('combobox');

describe('TradeCategoryMultiSelect', () => {
    describe('ARIA contract (AC-1.8)', () => {
        it('should expose a combobox whose aria-expanded follows the listbox', async () => {
            const user = userEvent.setup();
            render(<Harness />);

            expect(getInput()).toHaveAttribute('aria-expanded', 'false');

            await user.click(getInput());

            expect(getInput()).toHaveAttribute('aria-expanded', 'true');
            expect(getInput()).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
        });

        it('should render a multiselectable listbox with option[aria-selected]', async () => {
            const user = userEvent.setup();
            render(<Harness initial={['plomeria']} />);

            await user.click(getInput());

            const listbox = screen.getByRole('listbox');
            expect(listbox).toHaveAttribute('aria-multiselectable', 'true');
            expect(screen.getByRole('option', { name: 'Plomería' })).toHaveAttribute(
                'aria-selected',
                'true'
            );
            expect(screen.getByRole('option', { name: 'Piletas' })).toHaveAttribute(
                'aria-selected',
                'false'
            );
        });

        it('should render group headers as role=group labelled by their header', async () => {
            const user = userEvent.setup();
            render(<Harness />);

            await user.click(getInput());

            const group = screen.getByRole('group', { name: 'Instalaciones' });
            expect(group).toHaveAttribute('aria-labelledby');
            expect(within(group).getByRole('option', { name: 'Plomería' })).toBeInTheDocument();
            expect(within(group).queryByRole('option', { name: 'Piletas' })).toBeNull();
        });

        it('should point aria-activedescendant at the highlighted option', async () => {
            const user = userEvent.setup();
            render(<Harness />);

            await user.click(getInput());
            await user.keyboard('{ArrowDown}');

            const active = getInput().getAttribute('aria-activedescendant');
            expect(active).toBeTruthy();
            expect(document.getElementById(active as string)).toHaveAttribute('role', 'option');
        });
    });

    describe('grouping and order (AC-1.1)', () => {
        it('should list groups and options in catalog order', async () => {
            const user = userEvent.setup();
            render(<Harness />);

            await user.click(getInput());

            expect(screen.getAllByRole('group')).toHaveLength(2);
            expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
                'Plomería',
                'Destapaciones y desagotes',
                'Climatización',
                'Piletas',
                'Parque y jardinería'
            ]);
        });

        it('should label options and headers in the page locale', async () => {
            const user = userEvent.setup();
            render(<Harness locale="en" />);

            await user.click(getInput());

            expect(screen.getByRole('group', { name: 'Installations' })).toBeInTheDocument();
            expect(screen.getByRole('option', { name: 'Plumbing' })).toBeInTheDocument();
        });
    });

    describe('search (AC-1.2, AC-1.3)', () => {
        it('should hide groups with no match while filtering', async () => {
            const user = userEvent.setup();
            render(<Harness />);

            await user.type(getInput(), 'pozo');

            expect(
                screen.getByRole('option', { name: 'Destapaciones y desagotes' })
            ).toBeInTheDocument();
            expect(screen.queryByRole('group', { name: 'Exterior' })).toBeNull();
            expect(screen.queryByRole('option', { name: 'Plomería' })).toBeNull();
        });

        it('should find a category through an accent-free keyword', async () => {
            const user = userEvent.setup();
            render(<Harness />);

            await user.type(getInput(), 'AIRE');

            expect(screen.getByRole('option', { name: 'Climatización' })).toBeInTheDocument();
        });

        it('should show the empty state plus the hint when nothing matches', async () => {
            const user = userEvent.setup();
            render(<Harness />);

            await user.type(getInput(), 'zzzz');

            expect(screen.queryAllByRole('option')).toHaveLength(0);
            expect(screen.getByText('No encontramos ese rubro')).toBeVisible();
            expect(screen.getByText('Si tu oficio no está, escribilo en el mensaje')).toBeVisible();
        });
    });

    describe('selection and chips (AC-1.4)', () => {
        it('should toggle an option on click and render a removable chip', async () => {
            const user = userEvent.setup();
            const spy = vi.fn();
            render(<Harness onChangeSpy={spy} />);

            await user.click(getInput());
            await user.click(screen.getByRole('option', { name: 'Plomería' }));

            expect(spy).toHaveBeenLastCalledWith(['plomeria']);
            expect(screen.getByRole('button', { name: 'Quitar Plomería' })).toBeInTheDocument();
        });

        it('should deselect an already selected option when clicked again', async () => {
            const user = userEvent.setup();
            const spy = vi.fn();
            render(
                <Harness
                    initial={['plomeria']}
                    onChangeSpy={spy}
                />
            );

            await user.click(getInput());
            await user.click(screen.getByRole('option', { name: 'Plomería' }));

            expect(spy).toHaveBeenLastCalledWith([]);
        });

        it('should remove a chip with its remove button', async () => {
            const user = userEvent.setup();
            const spy = vi.fn();
            render(
                <Harness
                    initial={['plomeria', 'piletas']}
                    onChangeSpy={spy}
                />
            );

            await user.click(screen.getByRole('button', { name: 'Quitar Plomería' }));

            expect(spy).toHaveBeenLastCalledWith(['piletas']);
            expect(screen.queryByRole('button', { name: 'Quitar Plomería' })).toBeNull();
        });

        it('should remove the last chip with Backspace on an empty input', async () => {
            const user = userEvent.setup();
            const spy = vi.fn();
            render(
                <Harness
                    initial={['plomeria', 'piletas', 'climatizacion']}
                    onChangeSpy={spy}
                />
            );

            await user.click(getInput());
            await user.keyboard('{Backspace}');

            expect(spy).toHaveBeenLastCalledWith(['plomeria', 'piletas']);
        });

        it('should NOT remove a chip with Backspace while there is text to delete', async () => {
            const user = userEvent.setup();
            const spy = vi.fn();
            render(
                <Harness
                    initial={['plomeria']}
                    onChangeSpy={spy}
                />
            );

            await user.type(getInput(), 'pi{Backspace}');

            expect(spy).not.toHaveBeenCalled();
            expect(screen.getByRole('button', { name: 'Quitar Plomería' })).toBeInTheDocument();
        });
    });

    describe('keyboard flow (AC-1.8)', () => {
        it('should open on ArrowDown and move the highlight with ArrowDown/ArrowUp', async () => {
            const user = userEvent.setup();
            render(<Harness />);

            getInput().focus();
            await user.keyboard('{ArrowDown}');
            expect(getInput()).toHaveAttribute('aria-expanded', 'true');

            const idOf = () => getInput().getAttribute('aria-activedescendant');
            const first = idOf();
            await user.keyboard('{ArrowDown}');
            const second = idOf();
            expect(second).not.toBe(first);

            await user.keyboard('{ArrowUp}');
            expect(idOf()).toBe(first);
        });

        it('should toggle the highlighted option with Enter and keep the list open', async () => {
            const user = userEvent.setup();
            const spy = vi.fn();
            render(<Harness onChangeSpy={spy} />);

            getInput().focus();
            await user.keyboard('{ArrowDown}');
            await user.keyboard('{Enter}');

            expect(spy).toHaveBeenLastCalledWith(['plomeria']);
            expect(getInput()).toHaveAttribute('aria-expanded', 'true');
        });

        it('should toggle the highlighted option with Space when the input is empty', async () => {
            const user = userEvent.setup();
            const spy = vi.fn();
            render(<Harness onChangeSpy={spy} />);

            getInput().focus();
            await user.keyboard('{ArrowDown}');
            await user.keyboard(' ');

            expect(spy).toHaveBeenLastCalledWith(['plomeria']);
        });

        it('should keep Space as a typed character while searching', async () => {
            const user = userEvent.setup();
            const spy = vi.fn();
            render(<Harness onChangeSpy={spy} />);

            await user.type(getInput(), 'aire acond');

            expect(getInput()).toHaveValue('aire acond');
            expect(spy).not.toHaveBeenCalled();
            expect(screen.getByRole('option', { name: 'Climatización' })).toBeInTheDocument();
        });

        it('should close the list on Escape', async () => {
            const user = userEvent.setup();
            render(<Harness />);

            await user.click(getInput());
            expect(getInput()).toHaveAttribute('aria-expanded', 'true');

            await user.keyboard('{Escape}');

            expect(getInput()).toHaveAttribute('aria-expanded', 'false');
        });

        it('should not submit an enclosing form when Enter toggles an option', async () => {
            const user = userEvent.setup();
            const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
            render(
                <form onSubmit={onSubmit}>
                    <Harness />
                </form>
            );

            getInput().focus();
            await user.keyboard('{ArrowDown}{Enter}');

            expect(onSubmit).not.toHaveBeenCalled();
        });
    });

    describe('maximum selection lock (AC-1.6)', () => {
        const LARGE = buildLargeGroups(12);
        const TEN = LARGE[0]?.categories.slice(0, 10).map((c) => c.slug) ?? [];

        it('should disable unselected options once max is reached, with a visible reason', async () => {
            const user = userEvent.setup();
            render(
                <Harness
                    groups={LARGE}
                    initial={TEN}
                    max={10}
                />
            );

            await user.click(getInput());

            const eleventh = screen.getByRole('option', { name: 'Rubro 10' });
            expect(eleventh).toHaveAttribute('aria-disabled', 'true');
            expect(screen.getByText('Llegaste al máximo de 10 rubros')).toBeVisible();
            expect(eleventh).toHaveAttribute('aria-describedby');
        });

        it('should not select a disabled option', async () => {
            const user = userEvent.setup();
            const spy = vi.fn();
            render(
                <Harness
                    groups={LARGE}
                    initial={TEN}
                    max={10}
                    onChangeSpy={spy}
                />
            );

            await user.click(getInput());
            await user.click(screen.getByRole('option', { name: 'Rubro 10' }));

            expect(spy).not.toHaveBeenCalled();
        });

        it('should keep selected options deselectable at the limit', async () => {
            const user = userEvent.setup();
            const spy = vi.fn();
            render(
                <Harness
                    groups={LARGE}
                    initial={TEN}
                    max={10}
                    onChangeSpy={spy}
                />
            );

            await user.click(getInput());
            const first = screen.getByRole('option', { name: 'Rubro 0' });
            expect(first).not.toHaveAttribute('aria-disabled', 'true');
            await user.click(first);

            expect(spy).toHaveBeenLastCalledWith(TEN.slice(1));
        });

        it('should not show the reason below the limit', async () => {
            const user = userEvent.setup();
            render(
                <Harness
                    groups={LARGE}
                    initial={['rubro-00']}
                    max={10}
                />
            );

            await user.click(getInput());

            expect(screen.queryByText('Llegaste al máximo de 10 rubros')).toBeNull();
        });
    });
});
