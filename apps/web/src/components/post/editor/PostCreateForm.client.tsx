/**
 * @file PostCreateForm.client.tsx
 * @description Editor self-service post create form island (HOS-374 §5.2.2).
 *
 * Collects ONLY the minimum fields `PostCreateHttpSchema` genuinely requires
 * at create time — `title`, `summary`, `content`, `category` — then redirects
 * to the real editor (`PostEditor.client.tsx`) where the author fills in
 * everything else. Mirrors `CommerceCreateForm.client.tsx`'s "collect the
 * minimum, redirect to the editor" shape (HOS-374 §5.2.1/§5.2.2 — that form is
 * the explicit mold for this one).
 *
 * Deliberately excluded from this form:
 *  - `slug` — server-derived from `title` when absent.
 *  - `isFeatured` / `isPublished` — both default to `false` server-side;
 *    publication is a moderation-gate decision, not the author's, at create
 *    time.
 *  - `authorId` — injected server-side from the actor (HOS-374 D-2); the
 *    protected HTTP schema does not even accept it.
 *  - `destinationId` — optional per the schema, and already editable
 *    afterward via `DetailsSection.client.tsx` in the real editor. Wiring an
 *    SSR destination-catalog fetch (with its own load-failed/empty-catalog
 *    branches, as `CommerceCreateForm` does for its REQUIRED `destinationId`)
 *    into this minimal create form would duplicate a select the very next
 *    page already has, for a field nothing here actually requires.
 *  - `readingTimeMinutes` — optional, defaults server-side, editable in the
 *    real editor's Details section.
 *
 * `content` renders as a plain `<textarea>`, not the TipTap `RichTextEditor`
 * the real editor uses. This form's only job is to get a valid post into
 * existence and hand off to the editor immediately, and TipTap fires
 * `onChange` on mount — a footgun for a form whose entire state starts empty
 * and is submitted once, not a form that tracks "dirty" over a session.
 *
 * Native HTML form + `useZodForm` (no TanStack Form, per web conventions).
 * Validates against a `.pick()` SUBSET of the REAL `PostCreateHttpSchema`
 * (imported from `@repo/schemas`, never hand-rolled) — the exact schema the
 * create endpoint itself validates against, scoped to the fields this form
 * collects.
 *
 * Hydration: caller MUST use `client:load` (the primary interactive surface
 * of the create page).
 */

import { PostCategoryEnum, PostCreateHttpSchema } from '@repo/schemas';
import { type FormEvent, type JSX, useState } from 'react';
import { FieldError, fieldErrorId } from '@/components/ui/FieldError';
import { postEditApi } from '@/lib/api/endpoints-protected';
import { getPostCategoryLabel } from '@/lib/colors';
import { useZodForm } from '@/lib/forms/use-zod-form';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './PostCreateForm.module.css';

/** Fields this form collects — a subset of the real create schema. */
const POST_CREATE_FORM_SCHEMA = PostCreateHttpSchema.pick({
    title: true,
    summary: true,
    content: true,
    category: true
});

const CATEGORY_VALUES = Object.values(PostCategoryEnum);

/** Props for {@link PostCreateForm}. */
export interface PostCreateFormProps {
    /** Active locale. */
    readonly locale: SupportedLocale;
}

/**
 * PostCreateForm — editor self-service post create island.
 * Submits a minimal, unpublished post and redirects to its operational editor.
 *
 * @param props - See {@link PostCreateFormProps}.
 */
export function PostCreateForm({ locale }: PostCreateFormProps): JSX.Element {
    const { t } = createTranslations(locale);

    const { fieldErrors, formError, validate, handleApiError } = useZodForm({
        schema: POST_CREATE_FORM_SCHEMA,
        t
    });

    const [title, setTitle] = useState('');
    const [summary, setSummary] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Category options are derived from `PostCategoryEnum`, matching
    // `BasicInfoSection.client.tsx`'s approach — never hand-listed, so a
    // category added to the enum later is pickable here without a code change.
    const categoryOptions = CATEGORY_VALUES.map((value) => ({
        value,
        label: getPostCategoryLabel({ category: value, t })
    })).sort((a, b) => a.label.localeCompare(b.label, locale));

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();

        const parsed = validate({
            title,
            summary,
            content,
            category: category || undefined
        });
        if (!parsed.success) {
            return;
        }

        setIsSubmitting(true);

        const created = await postEditApi.create({ data: parsed.data });

        if (created.ok) {
            // TYPE-WORKAROUND: `postEditApi.create` returns the raw
            // `Record<string, unknown>` API payload (same shape as every other
            // `postEditApi` method) rather than a typed detail object — only
            // `id` is read here, to build the editor redirect.
            const id = created.data.id as string;
            window.location.href = buildUrl({
                locale,
                path: `mi-cuenta/publicaciones/${id}/editar`
            });
            return;
        }

        handleApiError(
            created.error,
            t(
                'account.myContent.posts.create.error',
                'No pudimos crear la publicación. Probá de nuevo.'
            )
        );
        setIsSubmitting(false);
    }

    return (
        <form
            className={styles.form}
            onSubmit={(event) => void handleSubmit(event)}
            noValidate
        >
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="pc-title"
                >
                    {t('account.myContent.posts.create.field.title', 'Título')}
                </label>
                <input
                    id="pc-title"
                    type="text"
                    className={styles.input}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    aria-invalid={fieldErrors.title ? 'true' : 'false'}
                    aria-describedby={fieldErrors.title ? fieldErrorId('title') : undefined}
                    required
                />
                <FieldError
                    id={fieldErrorId('title')}
                    message={fieldErrors.title}
                />
            </div>

            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="pc-category"
                >
                    {t('account.myContent.posts.create.field.category', 'Categoría')}
                </label>
                <select
                    id="pc-category"
                    className={styles.input}
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    aria-invalid={fieldErrors.category ? 'true' : 'false'}
                    aria-describedby={fieldErrors.category ? fieldErrorId('category') : undefined}
                    required
                >
                    <option value="">—</option>
                    {categoryOptions.map((opt) => (
                        <option
                            key={opt.value}
                            value={opt.value}
                        >
                            {opt.label}
                        </option>
                    ))}
                </select>
                <FieldError
                    id={fieldErrorId('category')}
                    message={fieldErrors.category}
                />
            </div>

            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="pc-summary"
                >
                    {t('account.myContent.posts.create.field.summary', 'Resumen')}
                </label>
                <textarea
                    id="pc-summary"
                    className={styles.textarea}
                    rows={2}
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    aria-invalid={fieldErrors.summary ? 'true' : 'false'}
                    aria-describedby={fieldErrors.summary ? fieldErrorId('summary') : undefined}
                    required
                />
                <span className={styles.hint}>
                    {t(
                        'account.myContent.posts.create.hint.summary',
                        'Entre 10 y 500 caracteres. Se muestra en el listado del blog.'
                    )}
                </span>
                <FieldError
                    id={fieldErrorId('summary')}
                    message={fieldErrors.summary}
                />
            </div>

            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="pc-content"
                >
                    {t('account.myContent.posts.create.field.content', 'Contenido')}
                </label>
                <textarea
                    id="pc-content"
                    className={styles.textarea}
                    rows={10}
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    aria-invalid={fieldErrors.content ? 'true' : 'false'}
                    aria-describedby={fieldErrors.content ? fieldErrorId('content') : undefined}
                    required
                />
                <span className={styles.hint}>
                    {t(
                        'account.myContent.posts.create.hint.content',
                        'Mínimo 100 caracteres. Vas a poder seguir editándolo en el editor completo.'
                    )}
                </span>
                <FieldError
                    id={fieldErrorId('content')}
                    message={fieldErrors.content}
                />
            </div>

            {formError && (
                <p
                    className={styles.error}
                    role="alert"
                >
                    {formError}
                </p>
            )}

            <button
                type="submit"
                className={styles.submit}
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                data-testid="post-create-submit"
            >
                {isSubmitting
                    ? t('account.myContent.posts.create.submitting', 'Creando...')
                    : t('account.myContent.posts.create.submit', 'Crear publicación')}
            </button>
        </form>
    );
}
