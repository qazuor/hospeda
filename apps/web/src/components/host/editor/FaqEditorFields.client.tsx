/** Accommodation FAQ field adapter; retains field-error clearing and focus IDs. */
import type { ReactNode } from 'react';
import { FaqEditorFields as SharedFields } from '@/components/account/editor/FaqEditorFields';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
import type { FaqEditor } from './faq-section-model';
import { clearFaqFieldError, type FaqFieldErrors } from './faq-validation';

/** Accommodation form contract. */
export interface FaqEditorFieldsProps {
    readonly locale: SupportedLocale;
    readonly questionId: string;
    readonly answerId: string;
    readonly values: FaqEditor;
    readonly errors: FaqFieldErrors;
    readonly t: TranslationFn;
    readonly onValuesChange: (update: (previous: FaqEditor) => FaqEditor) => void;
    readonly onErrorsChange: (update: (previous: FaqFieldErrors) => FaqFieldErrors) => void;
    readonly onSubmit: () => void;
    readonly onCancel: () => void;
    readonly isBusy: boolean;
    readonly answerExtras?: ReactNode;
}

/** Adapts partial presentation changes without replacing consumer state. */
export function FaqEditorFields(props: FaqEditorFieldsProps) {
    return (
        <SharedFields
            {...props}
            namespace="host.properties.editor.faq"
            onSave={props.onSubmit}
            answerExtra={props.answerExtras}
            onChange={(patch) => {
                props.onValuesChange((previous) => ({ ...previous, ...patch }));
                if (patch.question !== undefined)
                    props.onErrorsChange((previous) => clearFaqFieldError(previous, 'question'));
                if (patch.answer !== undefined)
                    props.onErrorsChange((previous) => clearFaqFieldError(previous, 'answer'));
            }}
        />
    );
}
