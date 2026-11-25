/** Minimal post draft create step, using the full editor's Markdown control. */
import { PostCategoryEnum, PostCreateHttpSchema } from '@repo/schemas';
import { type FormEvent, type JSX, useEffect, useRef, useState } from 'react';
import styles from '@/components/account/CreateStep.module.css';
import { CreateTextField } from '@/components/account/CreateTextField';
import { Alert } from '@/components/account/ui/Alert';
import { Button } from '@/components/account/ui/Button';
import { Field } from '@/components/account/ui/Field';
import { Section } from '@/components/account/ui/Section';
import { Select } from '@/components/account/ui/Select';
import { RichTextEditor } from '@/components/host/editor/RichTextEditor.client';
import { CharacterCounter } from '@/components/ui/CharacterCounter';
import { postEditApi } from '@/lib/api/endpoints-protected';
import { getPostCategoryLabel } from '@/lib/colors';
import { useZodForm } from '@/lib/forms/use-zod-form';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';

const POST_CREATE_FORM_SCHEMA = PostCreateHttpSchema.pick({
    title: true,
    summary: true,
    content: true,
    category: true
});

export interface PostCreateFormProps {
    readonly locale: SupportedLocale;
}

export function PostCreateForm({ locale }: PostCreateFormProps): JSX.Element {
    const { t } = createTranslations(locale);
    const { fieldErrors, formError, validate, handleApiError, setFormError } = useZodForm({
        schema: POST_CREATE_FORM_SCHEMA,
        t
    });
    const [title, setTitle] = useState('');
    const [summary, setSummary] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    useEffect(() => {
        formRef.current?.setAttribute('data-hydrated', 'true');
    }, []);
    const categoryOptions = Object.values(PostCategoryEnum)
        .map((value) => ({ value, label: getPostCategoryLabel({ category: value, t }) }))
        .sort((a, b) => a.label.localeCompare(b.label, locale));

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setFormError(null);
        const parsed = validate({ title, summary, content, category: category || undefined });
        if (!parsed.success) return;
        setIsSubmitting(true);
        const created = await postEditApi.create({ data: parsed.data });
        if (created.ok) {
            window.location.href = buildUrl({
                locale,
                path: `mi-cuenta/publicaciones/${created.data.id as string}/editar`
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
        <Section
            title={t('account.myContent.posts.create.sectionTitle')}
            helpId="section:content.post-create"
        >
            <form
                ref={formRef}
                className={styles.fields}
                onSubmit={(event) => void handleSubmit(event)}
                noValidate
            >
                <CreateTextField
                    id="pc-title"
                    locale={locale}
                    label={t('account.myContent.posts.create.field.title', 'Título')}
                    hint={t('account.myContent.posts.create.hint.title')}
                    error={fieldErrors.title}
                    value={title}
                    onChange={setTitle}
                    min={5}
                    max={200}
                />
                <Field
                    id="pc-category"
                    locale={locale}
                    label={t('account.myContent.posts.create.field.category', 'Categoría')}
                    hint={t('account.myContent.posts.create.hint.category')}
                    error={fieldErrors.category}
                    required
                >
                    <Select
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                    >
                        <option value="">
                            {t('account.myContent.posts.create.placeholder.category')}
                        </option>
                        {categoryOptions.map((option) => (
                            <option
                                key={option.value}
                                value={option.value}
                            >
                                {option.label}
                            </option>
                        ))}
                    </Select>
                </Field>
                <CreateTextField
                    id="pc-summary"
                    locale={locale}
                    label={t('account.myContent.posts.create.field.summary', 'Resumen')}
                    hint={t('account.myContent.posts.create.hint.summary')}
                    error={fieldErrors.summary}
                    value={summary}
                    onChange={setSummary}
                    min={10}
                    max={500}
                    rows={2}
                />
                <Field
                    id="pc-content"
                    locale={locale}
                    label={t('account.myContent.posts.create.field.content', 'Contenido')}
                    hint={t('account.myContent.posts.create.hint.content')}
                    error={fieldErrors.content}
                    required
                >
                    <RichTextEditor
                        id="pc-content"
                        locale={locale}
                        ariaLabel={t('account.myContent.posts.create.field.content', 'Contenido')}
                        ariaDescribedBy={`pc-content-hint pc-content-counter${fieldErrors.content ? ' pc-content-error' : ''}`}
                        required
                        value={content}
                        onChange={setContent}
                        placeholder={t(
                            'account.myContent.posts.editor.placeholder.content',
                            'Escribí tu nota...'
                        )}
                        hasError={Boolean(fieldErrors.content)}
                    />
                    <CharacterCounter
                        id="pc-content-counter"
                        locale={locale}
                        current={content.length}
                        min={100}
                        max={10000}
                    />
                </Field>
                {formError && (
                    <Alert
                        tone="danger"
                        locale={locale}
                    >
                        {formError}
                    </Alert>
                )}
                <Button
                    type="submit"
                    loading={isSubmitting}
                    data-testid="post-create-submit"
                >
                    {isSubmitting
                        ? t('account.myContent.posts.create.submitting', 'Creando...')
                        : t('account.myContent.posts.create.submit', 'Crear publicación')}
                </Button>
            </form>
        </Section>
    );
}
