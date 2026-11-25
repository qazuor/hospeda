/** Listing FAQ adapter: merges partial edits so category is never discarded. */
import type { ReactNode } from 'react';
import { FaqEditorFields } from '@/components/account/editor/FaqEditorFields';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
import type { FaqEditor, FaqFieldErrors } from './listing-faq-helpers';

/** Listing form contract, independent of the shared presentation. */
export interface ListingFaqEditorFieldsProps {
    readonly locale: SupportedLocale;
    readonly questionId: string;
    readonly answerId: string;
    readonly values: FaqEditor;
    readonly errors: FaqFieldErrors;
    readonly onChange: (patch: Partial<FaqEditor>) => void;
    readonly answerExtra?: ReactNode;
    readonly isBusy: boolean;
    readonly onSave: () => void;
    readonly onCancel: () => void;
    readonly t: TranslationFn;
}

/** Supplies the listing namespace to the shared fields. */
export function ListingFaqEditorFields(props: ListingFaqEditorFieldsProps) {
    return (
        <FaqEditorFields
            {...props}
            namespace="listing.owner.editor.faqManager"
        />
    );
}
