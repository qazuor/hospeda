/**
 * SortableFaqRow
 *
 * A single draggable FAQ row rendered inside a DndContext / SortableContext.
 * Each row supports inline editing (question, answer, category) with per-field
 * validation via Zod, plus save and delete actions.
 *
 * Drag-and-drop follows the pattern from GalleryField / SortableGalleryItem:
 *  - useSortable hook from @dnd-kit/sortable
 *  - GripVerticalIcon as the drag handle
 *  - prefers-reduced-motion respected (transition disabled when opted out)
 *  - keyboard sensor wired in parent FaqManager
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { FaqItem } from '@/features/faqs/hooks/useFaqs';
import { cn } from '@/lib/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckIcon, CloseIcon, DeleteIcon, GripVerticalIcon, LoaderIcon } from '@repo/icons';
import { FaqUpdatePayloadSchema } from '@repo/schemas';
import * as React from 'react';
import { FaqCategoryCombobox } from './FaqCategoryCombobox';

/**
 * Validation result from FaqUpdatePayloadSchema.
 * Keys match the payload field names.
 */
interface FieldErrors {
    readonly question?: string;
    readonly answer?: string;
    readonly category?: string;
}

/**
 * Props for SortableFaqRow.
 */
export interface SortableFaqRowProps {
    /** The FAQ data to display / edit. */
    readonly faq: FaqItem;
    /** Whether drag-and-drop is globally disabled (e.g., while mutations run). */
    readonly dragDisabled: boolean;
    /** Whether prefers-reduced-motion is active (disables drag transitions). */
    readonly reducedMotion: boolean;
    /** Called after the user confirms they want to save inline edits. */
    readonly onSave: (
        faqId: string,
        payload: { question: string; answer: string; category: string }
    ) => void;
    /** Called after the user confirms deletion (parent shows AlertDialog). */
    readonly onDelete: (faqId: string) => void;
    /** Whether this row's save mutation is in-flight. */
    readonly isSaving: boolean;
    /** Whether this row's delete mutation is in-flight. */
    readonly isDeleting: boolean;
    /** Translated label strings. */
    readonly labels: {
        readonly question: string;
        readonly answer: string;
        readonly category: string;
        readonly categoryPlaceholder: string;
        readonly edit: string;
        readonly save: string;
        readonly cancel: string;
        readonly delete: string;
        readonly dragHandle: string;
        readonly confirmDelete: string;
    };
}

/**
 * Draggable FAQ row with inline edit capability.
 * In view mode it shows the question, answer and category badge.
 * In edit mode it shows full inputs.
 */
export function SortableFaqRow({
    faq,
    dragDisabled,
    reducedMotion,
    onSave,
    onDelete,
    isSaving,
    isDeleting,
    labels
}: SortableFaqRowProps) {
    const [isEditing, setIsEditing] = React.useState(false);
    const [question, setQuestion] = React.useState(faq.question);
    const [answer, setAnswer] = React.useState(faq.answer);
    const [category, setCategory] = React.useState(faq.category ?? '');
    const [errors, setErrors] = React.useState<FieldErrors>({});
    const [confirmingDelete, setConfirmingDelete] = React.useState(false);

    const isBusy = isSaving || isDeleting;

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: faq.id,
        disabled: dragDisabled || isBusy || isEditing
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition: reducedMotion ? undefined : transition,
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.8 : undefined
    };

    const handleEdit = () => {
        // Reset local state to server values when entering edit mode
        setQuestion(faq.question);
        setAnswer(faq.answer);
        setCategory(faq.category ?? '');
        setErrors({});
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setErrors({});
    };

    const handleSave = () => {
        const result = FaqUpdatePayloadSchema.safeParse({
            question: question.trim(),
            answer: answer.trim(),
            category: category.trim() || undefined
        });

        if (!result.success) {
            const flat = result.error.flatten().fieldErrors;
            setErrors({
                question: flat.question?.[0],
                answer: flat.answer?.[0],
                category: flat.category?.[0]
            });
            return;
        }

        setErrors({});
        onSave(faq.id, {
            question: question.trim(),
            answer: answer.trim(),
            category: category.trim()
        });
        setIsEditing(false);
    };

    const handleDeleteClick = () => {
        setConfirmingDelete(true);
    };

    const handleDeleteConfirm = () => {
        setConfirmingDelete(false);
        onDelete(faq.id);
    };

    const handleDeleteCancel = () => {
        setConfirmingDelete(false);
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'relative flex gap-3 rounded-lg border bg-card p-4 transition-shadow',
                isDragging && 'shadow-lg ring-2 ring-primary ring-offset-2',
                isBusy && 'opacity-70'
            )}
        >
            {/* Drag handle */}
            <button
                type="button"
                {...attributes}
                {...listeners}
                aria-label={labels.dragHandle}
                disabled={dragDisabled || isBusy || isEditing}
                className={cn(
                    'mt-1 flex-shrink-0 cursor-grab touch-none text-muted-foreground transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                    'hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40',
                    isDragging && 'cursor-grabbing'
                )}
            >
                <GripVerticalIcon className="h-5 w-5" />
            </button>

            {/* Main content */}
            <div className="min-w-0 flex-1">
                {isEditing ? (
                    <div className="space-y-3">
                        {/* Question input */}
                        <div className="flex flex-col gap-1">
                            <Label htmlFor={`faq-question-${faq.id}`}>{labels.question}</Label>
                            <Input
                                id={`faq-question-${faq.id}`}
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                disabled={isBusy}
                                aria-invalid={Boolean(errors.question)}
                                aria-describedby={
                                    errors.question ? `faq-question-${faq.id}-error` : undefined
                                }
                                className={cn(
                                    errors.question &&
                                        'border-destructive focus-visible:ring-destructive'
                                )}
                            />
                            {errors.question && (
                                <p
                                    id={`faq-question-${faq.id}-error`}
                                    role="alert"
                                    className="text-destructive text-xs"
                                >
                                    {errors.question}
                                </p>
                            )}
                        </div>

                        {/* Answer textarea */}
                        <div className="flex flex-col gap-1">
                            <Label htmlFor={`faq-answer-${faq.id}`}>{labels.answer}</Label>
                            <Textarea
                                id={`faq-answer-${faq.id}`}
                                value={answer}
                                onChange={(e) => setAnswer(e.target.value)}
                                disabled={isBusy}
                                rows={4}
                                maxLength={2000}
                                aria-invalid={Boolean(errors.answer)}
                                aria-describedby={
                                    errors.answer ? `faq-answer-${faq.id}-error` : undefined
                                }
                                className={cn(
                                    'resize-y',
                                    errors.answer &&
                                        'border-destructive focus-visible:ring-destructive'
                                )}
                            />
                            {errors.answer && (
                                <p
                                    id={`faq-answer-${faq.id}-error`}
                                    role="alert"
                                    className="text-destructive text-xs"
                                >
                                    {errors.answer}
                                </p>
                            )}
                        </div>

                        {/* Category combobox */}
                        <FaqCategoryCombobox
                            value={category}
                            onChange={setCategory}
                            label={labels.category}
                            placeholder={labels.categoryPlaceholder}
                            disabled={isBusy}
                            errorMessage={errors.category}
                        />

                        {/* Edit actions */}
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleSave}
                                disabled={isBusy}
                                className="gap-1.5"
                            >
                                {isSaving ? (
                                    <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <CheckIcon className="h-3.5 w-3.5" />
                                )}
                                {labels.save}
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleCancel}
                                disabled={isBusy}
                                className="gap-1.5"
                            >
                                <CloseIcon className="h-3.5 w-3.5" />
                                {labels.cancel}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1">
                        <p className="font-medium text-sm leading-snug">{faq.question}</p>
                        <p className="whitespace-pre-wrap text-muted-foreground text-sm leading-relaxed">
                            {faq.answer}
                        </p>
                        {faq.category && (
                            <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground text-xs">
                                {faq.category}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Row actions (view mode only) */}
            {!isEditing && (
                <div className="flex flex-shrink-0 flex-col items-end gap-1">
                    {confirmingDelete ? (
                        <div className="flex gap-1">
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={handleDeleteConfirm}
                                disabled={isBusy}
                                className="h-7 px-2 text-xs"
                            >
                                {isDeleting ? (
                                    <LoaderIcon className="h-3 w-3 animate-spin" />
                                ) : (
                                    labels.confirmDelete
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleDeleteCancel}
                                disabled={isBusy}
                                className="h-7 px-2 text-xs"
                            >
                                {labels.cancel}
                            </Button>
                        </div>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleEdit}
                                disabled={isBusy}
                                className="h-7 px-2 text-xs"
                            >
                                {labels.edit}
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleDeleteClick}
                                disabled={isBusy}
                                className="h-7 px-2 text-destructive text-xs hover:text-destructive"
                            >
                                {isDeleting ? (
                                    <LoaderIcon className="h-3 w-3 animate-spin" />
                                ) : (
                                    <DeleteIcon className="h-3.5 w-3.5" />
                                )}
                                {labels.delete}
                            </Button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
