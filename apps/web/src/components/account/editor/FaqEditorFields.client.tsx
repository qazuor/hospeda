/** Shared FAQ state adapter; preserves each vertical's field-error policy. */
import type { ReactNode } from 'react';
import { FaqEditorFields as SharedFields } from '@/components/account/editor/FaqEditorFields';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
import {
    clearFaqFieldError,
    type FaqConfig,
    type FaqEditor,
    type FaqFieldErrors
} from './faq-model';

/** Shared form state and per-vertical validation policy. */
export interface FaqEditorFieldsProps extends FaqConfig {
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
            namespace={props.namespace}
            onSave={props.onSubmit}
            answerExtra={props.answerExtras}
            onChange={(patch) => {
                props.onValuesChange((previous) => ({ ...previous, ...patch }));
                if (props.validationMode !== 'schema') return;
                if (patch.question !== undefined)
                    props.onErrorsChange((errors) =>
                        clearFaqFieldError({ errors, field: 'question' })
                    );
                if (patch.answer !== undefined)
                    props.onErrorsChange((errors) =>
                        clearFaqFieldError({ errors, field: 'answer' })
                    );
            }}
        />
    );
}
