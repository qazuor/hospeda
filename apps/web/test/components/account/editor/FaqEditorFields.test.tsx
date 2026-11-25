/** Shared FAQ form contract: kit controls, retained IDs and partial value patches. */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FaqEditorFields } from '@/components/account/editor/FaqEditorFields';
import { createTranslations } from '@/lib/i18n';

describe('FaqEditorFields', () => {
    it('associates errors with stable focus IDs and emits only the changed field', () => {
        const onChange = vi.fn();
        render(
            <FaqEditorFields
                locale="en"
                questionId="faq-new-q"
                answerId="faq-new-a"
                namespace="host.properties.editor.faq"
                t={createTranslations('en').t}
                values={{ question: '', answer: '', isVisibleOnListing: true, isUsableByAi: true }}
                errors={{ question: 'Write a question.' }}
                onChange={onChange}
                onSave={vi.fn()}
                onCancel={vi.fn()}
                isBusy={false}
            />
        );
        const question = screen.getByRole('textbox', { name: 'Question' });
        expect(question).toHaveAttribute('id', 'faq-new-q');
        expect(question).toHaveAttribute('aria-invalid', 'true');
        expect(question).toHaveAccessibleDescription(/Write a question/);
        fireEvent.change(question, { target: { value: 'When does it open?' } });
        expect(onChange).toHaveBeenLastCalledWith({ question: 'When does it open?' });
        fireEvent.click(screen.getByRole('checkbox', { name: 'Usable by AI' }));
        expect(onChange).toHaveBeenLastCalledWith({ isUsableByAi: false });
        expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('primary');
    });
});
