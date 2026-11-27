import {
    applyDynamicBlockDefaults,
    NewsletterDynamicEntityTypeEnum,
    NewsletterDynamicSourceEnum
} from '@repo/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DynamicBlockConfigPanel } from './DynamicBlockConfigPanel';

vi.mock('@/components/selects/DestinationSelect', () => ({ DestinationSelect: () => <div /> }));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) =>
            key === 'admin-newsletter.dynamicBlock.comingSoon'
                ? 'Próximamente'
                : key.split('.').at(-1)
    })
}));

const selection = {
    blockKey: 'block-one',
    ifBelowMinManual: false,
    config: applyDynamicBlockDefaults({
        config: {
            blockKey: 'block-one',
            entityType: NewsletterDynamicEntityTypeEnum.ACCOMMODATION,
            source: NewsletterDynamicSourceEnum.NEWEST,
            count: 4
        },
        dynamicBlockCount: 1
    })
};

describe('DynamicBlockConfigPanel', () => {
    it('lists all six entity types, disabling five with a coming-soon badge', async () => {
        render(
            <DynamicBlockConfigPanel
                selection={selection}
                dynamicBlockCount={1}
                onSave={vi.fn()}
            />
        );
        fireEvent.click(screen.getByLabelText('entityType'));
        const options = await screen.findAllByRole('option');
        const entities = options.filter((option) =>
            option.hasAttribute('data-radix-collection-item')
        );
        expect(entities).toHaveLength(6);
        expect(
            entities.filter((option) => option.getAttribute('aria-disabled') === 'true')
        ).toHaveLength(5);
        expect(screen.getAllByText('Próximamente')).toHaveLength(5);
    });

    it('filters sources by entity and keeps featured disabled', () => {
        const { rerender } = render(
            <DynamicBlockConfigPanel
                selection={selection}
                dynamicBlockCount={1}
                onSave={vi.fn()}
            />
        );
        expect(screen.getByLabelText('source').querySelectorAll('option')).toHaveLength(4);
        expect(screen.getByRole('option', { name: /featured/ })).toBeDisabled();
        rerender(
            <DynamicBlockConfigPanel
                key="post"
                selection={{
                    ...selection,
                    ifBelowMinManual: true,
                    config: {
                        ...selection.config,
                        entityType: NewsletterDynamicEntityTypeEnum.POST
                    }
                }}
                dynamicBlockCount={1}
                onSave={vi.fn()}
            />
        );
        expect(screen.getByLabelText('source').querySelectorAll('option')).toHaveLength(0);
    });

    it('applies source defaults and only shows relevant source parameters', async () => {
        const onSave = vi.fn();
        render(
            <DynamicBlockConfigPanel
                selection={selection}
                dynamicBlockCount={1}
                onSave={onSave}
            />
        );
        fireEvent.change(screen.getByLabelText('source'), { target: { value: 'most_viewed' } });
        expect(screen.getByLabelText('windowDays')).toHaveValue(30);
        expect(screen.getByLabelText('excludeRecentEditions')).toHaveValue(2);
        expect(screen.getByLabelText('fillWithRepeats')).toBeChecked();
        fireEvent.change(screen.getByLabelText('source'), { target: { value: 'top_rated' } });
        expect(screen.queryByLabelText('windowDays')).not.toBeInTheDocument();
        expect(screen.getByLabelText('minReviews')).toHaveValue(3);
        fireEvent.click(screen.getByRole('button', { name: 'save' }));
        await waitFor(() =>
            expect(onSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    config: expect.objectContaining({
                        source: 'top_rated',
                        params: { minReviews: 3 },
                        excludeRecentEditions: 3
                    })
                })
            )
        );
    });

    it('shows a field error and does not save when minimum exceeds count', async () => {
        const onSave = vi.fn();
        render(
            <DynamicBlockConfigPanel
                selection={selection}
                dynamicBlockCount={1}
                onSave={onSave}
            />
        );
        fireEvent.change(screen.getByLabelText('minItems'), { target: { value: '5' } });
        fireEvent.click(screen.getByRole('button', { name: 'save' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('invalidField');
        expect(screen.getByLabelText('minItems')).toHaveAttribute('aria-invalid', 'true');
        expect(onSave).not.toHaveBeenCalled();
    });

    it('recomputes automatic policy on count changes but preserves manual intent', async () => {
        const onSave = vi.fn();
        const { rerender } = render(
            <DynamicBlockConfigPanel
                selection={selection}
                dynamicBlockCount={1}
                onSave={onSave}
            />
        );
        expect(screen.getByLabelText('ifBelowMin')).toHaveValue('skip_run');
        rerender(
            <DynamicBlockConfigPanel
                selection={selection}
                dynamicBlockCount={2}
                onSave={onSave}
            />
        );
        expect(screen.getByLabelText('ifBelowMin')).toHaveValue('hide_block');
        fireEvent.change(screen.getByLabelText('ifBelowMin'), { target: { value: 'send_anyway' } });
        rerender(
            <DynamicBlockConfigPanel
                selection={selection}
                dynamicBlockCount={1}
                onSave={onSave}
            />
        );
        expect(screen.getByLabelText('ifBelowMin')).toHaveValue('send_anyway');
        fireEvent.click(screen.getByRole('button', { name: 'save' }));
        await waitFor(() =>
            expect(onSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    ifBelowMinManual: true,
                    config: expect.objectContaining({ ifBelowMin: 'send_anyway' })
                })
            )
        );
    });
});
