import { describe, expect, it, vi } from 'vitest';
import { renderCampaignContent } from '../../../../src/services/newsletter/dynamic/render-campaign-content.js';

describe('renderCampaignContent', () => {
    it('keeps static campaigns on the legacy renderer even when the segment renderer is wired', async () => {
        // Arrange: a mark the strict schema does not list must not reject a static campaign.
        const bodyJson = {
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Hola', marks: [{ type: 'strike' }] }]
                }
            ]
        };
        const renderTiptapEmailFn = vi.fn(() => '<p>Hola</p>');
        const renderNewsletterEmailFn = vi.fn();

        // Act
        const result = await renderCampaignContent({
            bodyJson,
            resolvedBodyJson: null,
            locale: 'es',
            renderNewsletterEmailFn,
            renderTiptapEmailFn
        });

        // Assert
        expect(result).toEqual({ bodyHtml: '<p>Hola</p>' });
        expect(renderTiptapEmailFn).toHaveBeenCalledWith({ content: bodyJson });
        expect(renderNewsletterEmailFn).not.toHaveBeenCalled();
    });

    it('fails a dynamic campaign without frozen content before rendering', async () => {
        const renderTiptapEmailFn = vi.fn(() => '');
        await expect(
            renderCampaignContent({
                bodyJson: {
                    type: 'doc',
                    content: [{ type: 'dynamicBlock', attrs: { blockKey: 'k' } }]
                },
                resolvedBodyJson: null,
                locale: 'es',
                renderNewsletterEmailFn: vi.fn(),
                renderTiptapEmailFn
            })
        ).rejects.toMatchObject({ reason: 'DYNAMIC_BLOCK_UNRESOLVED' });
        expect(renderTiptapEmailFn).not.toHaveBeenCalled();
    });
});
