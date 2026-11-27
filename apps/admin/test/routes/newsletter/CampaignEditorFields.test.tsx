import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CampaignEditorFields } from '@/routes/_authed/newsletter/campaigns/-components/CampaignEditorFields';
import type { CampaignFormValues } from '@/routes/_authed/newsletter/campaigns/-components/campaign-editor-form';
import { useCampaignEditorForm } from '@/routes/_authed/newsletter/campaigns/-components/campaign-editor-form';

const dynamicDocument = {
    type: 'doc',
    content: [
        {
            type: 'dynamicBlock',
            attrs: { blockKey: 'block-one', config: '{}', ifBelowMinManual: true }
        }
    ]
};
vi.mock('@/components/newsletter/RichTextEditor', () => ({
    RichTextEditor: ({
        onChange,
        disabled
    }: {
        onChange: (value: unknown) => void;
        disabled: boolean;
    }) => (
        <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(dynamicDocument)}
        >
            Insert test block
        </button>
    )
}));

function Harness({
    onSubmit,
    onAutosave,
    onPreview,
    readOnly = false
}: {
    readonly onSubmit: (value: CampaignFormValues) => Promise<void>;
    readonly onAutosave: (value: CampaignFormValues) => void;
    readonly onPreview: (bodyJson: unknown) => void;
    readonly readOnly?: boolean;
}) {
    const form = useCampaignEditorForm({ onSubmit });
    return (
        <CampaignEditorFields
            form={form}
            isReadOnly={readOnly}
            isSending={false}
            scheduleAutosave={onAutosave}
            schedulePreviewUpdate={onPreview}
        />
    );
}

describe('Campaign editor field extraction', () => {
    it('preserves the entire dynamic document through autosave notifications and submit', async () => {
        const onSubmit = vi.fn();
        const onAutosave = vi.fn();
        const onPreview = vi.fn();
        render(
            <Harness
                onSubmit={onSubmit}
                onAutosave={onAutosave}
                onPreview={onPreview}
            />
        );
        fireEvent.change(screen.getByTestId('campaign-title-input'), {
            target: { value: 'Campaign' }
        });
        fireEvent.change(screen.getByTestId('campaign-subject-input'), {
            target: { value: 'Subject' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Insert test block' }));
        expect(onPreview).toHaveBeenCalledWith(dynamicDocument);
        expect(onAutosave).toHaveBeenLastCalledWith({
            title: 'Campaign',
            subject: 'Subject',
            bodyJson: dynamicDocument,
            localeFilter: 'all',
            contentType: null
        });
        fireEvent.click(screen.getByRole('button', { name: 'Enviar formulario' }));
        await waitFor(() =>
            expect(onSubmit).toHaveBeenCalledWith(
                expect.objectContaining({
                    bodyJson: dynamicDocument,
                    title: 'Campaign',
                    subject: 'Subject'
                })
            )
        );
    });

    it('keeps read-only fields and document editing disabled', () => {
        render(
            <Harness
                onSubmit={vi.fn()}
                onAutosave={vi.fn()}
                onPreview={vi.fn()}
                readOnly
            />
        );
        expect(screen.getByTestId('campaign-title-input')).toBeDisabled();
        expect(screen.getByTestId('campaign-subject-input')).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Insert test block' })).toBeDisabled();
    });
});
