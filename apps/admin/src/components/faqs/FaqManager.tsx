/**
 * FaqManager
 *
 * Generic FAQ management UI used by both destinations and accommodations tabs.
 * Renders a sortable, editable list of FAQ items using per-row granular CRUD:
 *
 *  - Drag-to-reorder (DndContext + SortableContext, fires PATCH /faqs/reorder)
 *  - Per-row inline edit with Zod validation (PUT /:faqId)
 *  - Per-row delete with inline confirmation (DELETE /:faqId)
 *  - "Add FAQ" form that POSTs a new entry (POST /faqs)
 *  - Empty state and loading skeleton
 *
 * DnD pattern follows GalleryField.tsx:
 *  - PointerSensor (activationConstraint distance:4) + KeyboardSensor
 *  - sortableKeyboardCoordinates
 *  - GripVerticalIcon as drag handle
 *  - prefers-reduced-motion respected
 *  - screen-reader announcements via dnd-kit Announcements API
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AiTextImprovePanel } from '@/features/accommodations/components/AiTextImprovePanel';
import {
    useFaqCreate,
    useFaqDelete,
    useFaqList,
    useFaqReorder,
    useFaqUpdate
} from '@/features/faqs/hooks/useFaqs';
import type { FaqEntityType, FaqItem } from '@/features/faqs/hooks/useFaqs';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import {
    DndContext,
    type DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    type UniqueIdentifier,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import type { Announcements, ScreenReaderInstructions } from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { AddIcon, LoaderIcon } from '@repo/icons';
import { FaqCreatePayloadSchema } from '@repo/schemas';
import * as React from 'react';
import { FaqCategoryCombobox } from './FaqCategoryCombobox';
import { SortableFaqRow } from './SortableFaqRow';

/**
 * Props for FaqManager.
 */
export interface FaqManagerProps {
    /** Which entity type owns these FAQs. */
    readonly entityType: FaqEntityType;
    /** UUID of the parent entity. */
    readonly parentId: string;
    /** Whether the current user's plan includes the AI text-improve entitlement. */
    readonly canUseAiTextImprove?: boolean;
    /** Locale for AI text-improve suggestions. Defaults to 'es'. */
    readonly aiTextImproveLocale?: string;
}

interface AddFormState {
    readonly question: string;
    readonly answer: string;
    readonly category: string;
}

interface AddFormErrors {
    readonly question?: string;
    readonly answer?: string;
    readonly category?: string;
}

/**
 * Full FAQ management panel for a single parent entity (destination or accommodation).
 */
export function FaqManager({
    entityType,
    parentId,
    canUseAiTextImprove = false,
    aiTextImproveLocale = 'es'
}: FaqManagerProps) {
    const { t } = useTranslations();

    // ── Data fetching ──────────────────────────────────────────────────────────
    const { data: faqs = [], isLoading, isError } = useFaqList(entityType, parentId);
    const createMutation = useFaqCreate(entityType, parentId);
    const updateMutation = useFaqUpdate(entityType, parentId);
    const deleteMutation = useFaqDelete(entityType, parentId);
    const reorderMutation = useFaqReorder(entityType, parentId);

    // ── Local sorted list (optimistic reorder) ─────────────────────────────────
    const [sortedFaqs, setSortedFaqs] = React.useState<FaqItem[]>([]);

    // Sync sorted list when server data changes (after invalidation)
    React.useEffect(() => {
        setSortedFaqs([...faqs].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)));
    }, [faqs]);

    // ── prefers-reduced-motion ─────────────────────────────────────────────────
    const [reducedMotion, setReducedMotion] = React.useState(false);
    React.useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const apply = () => setReducedMotion(mq.matches);
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, []);

    // ── Add-FAQ form state ─────────────────────────────────────────────────────
    const [showAddForm, setShowAddForm] = React.useState(false);
    const [addForm, setAddForm] = React.useState<AddFormState>({
        question: '',
        answer: '',
        category: ''
    });
    const [addErrors, setAddErrors] = React.useState<AddFormErrors>({});

    // ── DnD sensors ───────────────────────────────────────────────────────────
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const itemIds = React.useMemo<UniqueIdentifier[]>(
        () => sortedFaqs.map((f) => f.id),
        [sortedFaqs]
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = sortedFaqs.findIndex((f) => f.id === active.id);
        const newIndex = sortedFaqs.findIndex((f) => f.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(sortedFaqs, oldIndex, newIndex).map((f, idx) => ({
            ...f,
            displayOrder: idx
        }));

        setSortedFaqs(reordered);
        reorderMutation.mutate({
            order: reordered.map((f, idx) => ({ faqId: f.id, displayOrder: idx }))
        });
    };

    // ── dnd-kit screen-reader announcements ───────────────────────────────────
    const announcements: Announcements = React.useMemo(
        () => ({
            onDragStart({ active }) {
                const pos = sortedFaqs.findIndex((f) => f.id === active.id) + 1;
                return t('admin-pages.faqs.dnd.onDragStart', { position: String(pos) });
            },
            onDragOver({ active, over }) {
                if (!over) return undefined;
                const from = sortedFaqs.findIndex((f) => f.id === active.id) + 1;
                const to = sortedFaqs.findIndex((f) => f.id === over.id) + 1;
                return t('admin-pages.faqs.dnd.onDragOver', {
                    from: String(from),
                    to: String(to)
                });
            },
            onDragEnd({ active, over }) {
                if (!over) {
                    return t('admin-pages.faqs.dnd.onDragCancel', {
                        position: String(sortedFaqs.findIndex((f) => f.id === active.id) + 1)
                    });
                }
                return t('admin-pages.faqs.dnd.onDragEnd', {
                    position: String(sortedFaqs.findIndex((f) => f.id === over.id) + 1)
                });
            },
            onDragCancel({ active }) {
                return t('admin-pages.faqs.dnd.onDragCancel', {
                    position: String(sortedFaqs.findIndex((f) => f.id === active.id) + 1)
                });
            }
        }),
        [sortedFaqs, t]
    );

    const screenReaderInstructions: ScreenReaderInstructions = React.useMemo(
        () => ({ draggable: t('admin-pages.faqs.dnd.instructions') }),
        [t]
    );

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleSave = (
        faqId: string,
        payload: { question: string; answer: string; category: string }
    ) => {
        updateMutation.mutate({
            faqId,
            payload: {
                question: payload.question,
                answer: payload.answer,
                category: payload.category || undefined
            }
        });
    };

    const handleDelete = (faqId: string) => {
        deleteMutation.mutate(faqId);
    };

    const handleAddSubmit = () => {
        const result = FaqCreatePayloadSchema.safeParse({
            question: addForm.question.trim(),
            answer: addForm.answer.trim(),
            category: addForm.category.trim() || undefined
        });

        if (!result.success) {
            const flat = result.error.flatten().fieldErrors;
            setAddErrors({
                question: flat.question?.[0],
                answer: flat.answer?.[0],
                category: flat.category?.[0]
            });
            return;
        }

        setAddErrors({});
        createMutation.mutate(result.data, {
            onSuccess: () => {
                setShowAddForm(false);
                setAddForm({ question: '', answer: '', category: '' });
            }
        });
    };

    const handleAddCancel = () => {
        setShowAddForm(false);
        setAddForm({ question: '', answer: '', category: '' });
        setAddErrors({});
    };

    // ── Derived state ─────────────────────────────────────────────────────────
    const anyMutationPending =
        createMutation.isPending ||
        updateMutation.isPending ||
        deleteMutation.isPending ||
        reorderMutation.isPending;

    const rowLabels = React.useMemo(
        () => ({
            question: t('admin-pages.faqs.fields.question'),
            answer: t('admin-pages.faqs.fields.answer'),
            category: t('admin-pages.faqs.fields.category'),
            categoryPlaceholder: t('admin-pages.faqs.fields.categoryPlaceholder'),
            edit: t('admin-pages.faqs.actions.edit'),
            save: t('admin-pages.faqs.actions.save'),
            cancel: t('admin-pages.faqs.actions.cancel'),
            delete: t('admin-pages.faqs.actions.delete'),
            dragHandle: t('admin-pages.faqs.dnd.dragHandle'),
            confirmDelete: t('admin-pages.faqs.actions.confirmDelete')
        }),
        [t]
    );

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg">{t('admin-pages.faqs.title')}</h2>
                {!showAddForm && (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setShowAddForm(true)}
                        className="gap-1.5"
                    >
                        <AddIcon className="h-4 w-4" />
                        {t('admin-pages.faqs.actions.add')}
                    </Button>
                )}
            </div>

            {/* Add FAQ form */}
            {showAddForm && (
                <div className="space-y-3 rounded-lg border bg-card p-4">
                    <h3 className="font-medium text-sm">{t('admin-pages.faqs.addTitle')}</h3>

                    <div className="flex flex-col gap-1">
                        <Label htmlFor="faq-add-question">
                            {t('admin-pages.faqs.fields.question')}
                        </Label>
                        <Input
                            id="faq-add-question"
                            value={addForm.question}
                            onChange={(e) =>
                                setAddForm((prev) => ({ ...prev, question: e.target.value }))
                            }
                            disabled={createMutation.isPending}
                            aria-invalid={Boolean(addErrors.question)}
                            aria-describedby={
                                addErrors.question ? 'faq-add-question-error' : undefined
                            }
                            className={cn(
                                addErrors.question &&
                                    'border-destructive focus-visible:ring-destructive'
                            )}
                        />
                        {addErrors.question && (
                            <p
                                id="faq-add-question-error"
                                role="alert"
                                className="text-destructive text-xs"
                            >
                                {addErrors.question}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col gap-1">
                        <Label htmlFor="faq-add-answer">
                            {t('admin-pages.faqs.fields.answer')}
                        </Label>
                        <Textarea
                            id="faq-add-answer"
                            value={addForm.answer}
                            onChange={(e) =>
                                setAddForm((prev) => ({ ...prev, answer: e.target.value }))
                            }
                            disabled={createMutation.isPending}
                            rows={4}
                            maxLength={2000}
                            aria-invalid={Boolean(addErrors.answer)}
                            aria-describedby={addErrors.answer ? 'faq-add-answer-error' : undefined}
                            className={cn(
                                'resize-y',
                                addErrors.answer &&
                                    'border-destructive focus-visible:ring-destructive'
                            )}
                        />
                        {addErrors.answer && (
                            <p
                                id="faq-add-answer-error"
                                role="alert"
                                className="text-destructive text-xs"
                            >
                                {addErrors.answer}
                            </p>
                        )}

                        {canUseAiTextImprove && (
                            <AiTextImprovePanel
                                fieldType="faq_answer"
                                fieldValue={addForm.answer}
                                locale={aiTextImproveLocale}
                                onAccept={(suggestion) =>
                                    setAddForm((prev) => ({ ...prev, answer: suggestion }))
                                }
                                canUse={true}
                            />
                        )}
                    </div>

                    <FaqCategoryCombobox
                        value={addForm.category}
                        onChange={(v) => setAddForm((prev) => ({ ...prev, category: v }))}
                        label={t('admin-pages.faqs.fields.category')}
                        placeholder={t('admin-pages.faqs.fields.categoryPlaceholder')}
                        disabled={createMutation.isPending}
                        errorMessage={addErrors.category}
                    />

                    <div className="flex gap-2">
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleAddSubmit}
                            disabled={createMutation.isPending}
                            className="gap-1.5"
                        >
                            {createMutation.isPending && (
                                <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                            )}
                            {t('admin-pages.faqs.actions.save')}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleAddCancel}
                            disabled={createMutation.isPending}
                        >
                            {t('admin-pages.faqs.actions.cancel')}
                        </Button>
                    </div>

                    {createMutation.isError && (
                        <p
                            role="alert"
                            className="text-destructive text-sm"
                        >
                            {t('admin-pages.faqs.errors.createFailed')}
                        </p>
                    )}
                </div>
            )}

            {/* Loading skeleton */}
            {isLoading && (
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div
                            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
                            key={i}
                            className="h-20 animate-pulse rounded-lg border bg-muted"
                        />
                    ))}
                </div>
            )}

            {/* Error state */}
            {isError && !isLoading && (
                <div
                    role="alert"
                    className="rounded-lg border border-destructive/50 bg-destructive/10 p-4"
                >
                    <p className="text-destructive text-sm">
                        {t('admin-pages.faqs.errors.loadFailed')}
                    </p>
                </div>
            )}

            {/* Global reorder error */}
            {reorderMutation.isError && (
                <div
                    role="alert"
                    className="rounded-lg border border-destructive/50 bg-destructive/10 p-4"
                >
                    <p className="text-destructive text-sm">
                        {t('admin-pages.faqs.errors.reorderFailed')}
                    </p>
                </div>
            )}

            {/* Empty state */}
            {!isLoading && !isError && sortedFaqs.length === 0 && (
                <div className="rounded-lg border border-dashed p-8 text-center">
                    <p className="text-muted-foreground text-sm">{t('admin-pages.faqs.empty')}</p>
                </div>
            )}

            {/* Sortable FAQ list */}
            {sortedFaqs.length > 0 && (
                <DndContext
                    sensors={sensors}
                    onDragEnd={handleDragEnd}
                    accessibility={{ announcements, screenReaderInstructions }}
                >
                    <SortableContext
                        items={itemIds}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-2">
                            {sortedFaqs.map((faq) => (
                                <SortableFaqRow
                                    key={faq.id}
                                    faq={faq}
                                    dragDisabled={anyMutationPending}
                                    reducedMotion={reducedMotion}
                                    onSave={handleSave}
                                    onDelete={handleDelete}
                                    isSaving={
                                        updateMutation.isPending &&
                                        updateMutation.variables?.faqId === faq.id
                                    }
                                    isDeleting={
                                        deleteMutation.isPending &&
                                        deleteMutation.variables === faq.id
                                    }
                                    labels={rowLabels}
                                    canUseAiTextImprove={canUseAiTextImprove}
                                    aiTextImproveLocale={aiTextImproveLocale}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}
        </div>
    );
}
