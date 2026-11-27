import {
    applyDynamicBlockDefaults,
    DynamicBlockConfigSchema,
    NewsletterDynamicEntityTypeEnum,
    NewsletterDynamicSourceEnum
} from '@repo/schemas';
import type { TiptapDocument } from '@repo/utils';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from '../RichTextEditor';

vi.mock('@/components/selects/DestinationSelect', () => ({ DestinationSelect: () => <div /> }));

describe('Dynamic block editor integration', () => {
    it('opens the node configuration and persists validated config and manual intent', async () => {
        const config = applyDynamicBlockDefaults({
            config: {
                blockKey: 'block-one',
                entityType: NewsletterDynamicEntityTypeEnum.ACCOMMODATION,
                source: NewsletterDynamicSourceEnum.NEWEST,
                count: 4
            },
            dynamicBlockCount: 1
        });
        const value: TiptapDocument = {
            type: 'doc',
            content: [
                {
                    type: 'dynamicBlock',
                    attrs: {
                        blockKey: config.blockKey,
                        config: JSON.stringify(config),
                        ifBelowMinManual: false
                    }
                }
            ]
        };
        const onChange = vi.fn();
        render(
            <RichTextEditor
                value={value}
                onChange={onChange}
            />
        );
        fireEvent.click(
            await screen.findByRole('button', { name: 'admin-newsletter.dynamicBlock.edit' })
        );
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('admin-newsletter.dynamicBlock.count'), {
            target: { value: '6' }
        });
        fireEvent.change(screen.getByLabelText('admin-newsletter.dynamicBlock.ifBelowMin'), {
            target: { value: 'send_anyway' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'admin-newsletter.dynamicBlock.save' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        await waitFor(() => expect(onChange).toHaveBeenCalled());
        const saved = onChange.mock.lastCall?.[0] as TiptapDocument;
        const block = saved.content?.find((node) => node.type === 'dynamicBlock');
        expect(block?.attrs?.ifBelowMinManual).toBe(true);
        expect(
            DynamicBlockConfigSchema.parse(JSON.parse(String(block?.attrs?.config)))
        ).toMatchObject({ count: 6, ifBelowMin: 'send_anyway' });
    });

    it('inserts the first block with the documented defaults from the toolbar', async () => {
        const onChange = vi.fn();
        render(
            <RichTextEditor
                value={null}
                onChange={onChange}
            />
        );
        fireEvent.click(
            await screen.findByRole('button', { name: 'admin-newsletter.dynamicBlock.insert' })
        );
        await waitFor(() => expect(onChange).toHaveBeenCalled());
        const saved = onChange.mock.lastCall?.[0] as TiptapDocument;
        const block = saved.content?.find((node) => node.type === 'dynamicBlock');
        expect(
            DynamicBlockConfigSchema.parse(JSON.parse(String(block?.attrs?.config)))
        ).toMatchObject({ source: 'newest', count: 4, minItems: 1, ifBelowMin: 'skip_run' });
    });
});
