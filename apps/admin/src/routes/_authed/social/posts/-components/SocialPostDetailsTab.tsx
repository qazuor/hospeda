/**
 * @file SocialPostDetailsTab.tsx
 * @description "Details" secondary tab for the social post detail page (SPEC-254 T-040).
 *
 * Renders:
 *   - Caption base (GPT original, read-only reference block)
 *   - Final caption editor (textarea + save button) — editable when user has SOCIAL_POST_UPDATE
 *   - Hashtag editor: current chips (removable) + catalog search input + save button
 *   - GPT hashtag suggestions (read-only chips)
 *   - Public notes and internal notes (read-only)
 *
 * Gate: SOCIAL_POST_UPDATE controls whether editors appear.
 * If the user lacks the permission, all fields are read-only (original behaviour).
 */

import { Textarea } from '@/components/ui/textarea';
import { useSocialHashtagsList } from '@/hooks/use-social-catalog';
import { useSetPostHashtags, useUpdateSocialPost } from '@/hooks/use-social-posts';
import { useTranslations } from '@/hooks/use-translations';
import { useHasPermission } from '@/hooks/use-user-permissions';
import { PermissionEnum } from '@repo/schemas';
import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SectionProps {
    readonly label: string;
    readonly children: React.ReactNode;
}

/**
 * Labeled section wrapper for grouping related fields.
 */
function Section({ label, children }: SectionProps) {
    return (
        <div>
            <p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                {label}
            </p>
            {children}
        </div>
    );
}

/** Normalises a hashtag string to always start with '#'. */
function normaliseHashtag(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

// ---------------------------------------------------------------------------
// Caption editor sub-component
// ---------------------------------------------------------------------------

interface CaptionEditorProps {
    readonly postId: string;
    readonly captionBase: string;
    readonly finalCaption: string | null;
}

/**
 * Editable final caption with a read-only reference block showing captionBase.
 */
function CaptionEditor({ postId, captionBase, finalCaption }: CaptionEditorProps) {
    const { t } = useTranslations();
    const updatePost = useUpdateSocialPost();

    const [value, setValue] = useState(finalCaption ?? '');
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    // Keep local state in sync if the query revalidates and returns a new value
    useEffect(() => {
        setValue(finalCaption ?? '');
    }, [finalCaption]);

    const handleSave = useCallback(async () => {
        setSuccessMsg('');
        setErrorMsg('');
        try {
            await updatePost.mutateAsync({ id: postId, finalCaption: value });
            setSuccessMsg(t('social.posts.detail.detailsTab.saveCaptionSuccess'));
        } catch {
            setErrorMsg(t('social.posts.detail.detailsTab.saveCaptionError'));
        }
    }, [postId, value, updatePost, t]);

    return (
        <div className="space-y-3">
            {/* GPT original — read-only reference */}
            <Section label={t('social.posts.detail.detailsTab.captionBaseLabel')}>
                <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-muted-foreground text-sm leading-relaxed">
                    {captionBase}
                </p>
            </Section>

            {/* Editable final caption */}
            <Section label={t('social.posts.detail.detailsTab.captionFinalLabel')}>
                <Textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={t('social.posts.detail.detailsTab.captionFinalPlaceholder')}
                    rows={5}
                    className="resize-y text-sm"
                    data-testid="final-caption-textarea"
                />
                <div className="mt-2 flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={updatePost.isPending}
                        className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                        data-testid="save-caption-btn"
                    >
                        {updatePost.isPending
                            ? t('social.posts.detail.detailsTab.savingCaption')
                            : t('social.posts.detail.detailsTab.saveCaptionBtn')}
                    </button>
                    {successMsg && (
                        <output
                            aria-live="polite"
                            className="text-green-600 text-xs"
                            data-testid="caption-save-success"
                        >
                            {successMsg}
                        </output>
                    )}
                    {errorMsg && (
                        <p
                            role="alert"
                            aria-live="assertive"
                            className="text-destructive text-xs"
                            data-testid="caption-save-error"
                        >
                            {errorMsg}
                        </p>
                    )}
                </div>
            </Section>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Hashtag editor sub-component
// ---------------------------------------------------------------------------

interface HashtagEditorProps {
    readonly postId: string;
    readonly hashtags: readonly string[];
}

/**
 * Editor for the post's managed hashtag set.
 *
 * Shows current hashtags as removable chips. An input with live catalog
 * suggestions allows adding hashtags — either from the catalog or as a
 * new value (backend creates it if not present). A "Save" button commits
 * the full set via PUT /admin/social/posts/:id/hashtags.
 */
function HashtagEditor({ postId, hashtags }: HashtagEditorProps) {
    const { t } = useTranslations();
    const setHashtags = useSetPostHashtags();

    // Local working copy (starts from server data; kept in sync via useEffect)
    const [current, setCurrent] = useState<string[]>(() => [...hashtags]);
    const [inputValue, setInputValue] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Keep local state in sync if server data changes (e.g. after a save)
    useEffect(() => {
        setCurrent([...hashtags]);
    }, [hashtags]);

    const { data: catalogData } = useSocialHashtagsList({
        search: inputValue.replace(/^#/, ''),
        pageSize: 8,
        active: true
    });

    const suggestions = catalogData?.items ?? [];

    const addHashtag = useCallback(
        (raw: string) => {
            const normalised = normaliseHashtag(raw);
            if (!normalised || current.includes(normalised)) return;
            setCurrent((prev) => [...prev, normalised]);
            setInputValue('');
            setShowSuggestions(false);
        },
        [current]
    );

    const removeHashtag = useCallback((tag: string) => {
        setCurrent((prev) => prev.filter((h) => h !== tag));
    }, []);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addHashtag(inputValue);
            }
            if (e.key === 'Escape') {
                setShowSuggestions(false);
            }
        },
        [inputValue, addHashtag]
    );

    const handleSave = useCallback(async () => {
        setSuccessMsg('');
        setErrorMsg('');
        try {
            await setHashtags.mutateAsync({ id: postId, hashtags: current });
            setSuccessMsg(t('social.posts.detail.detailsTab.saveHashtagsSuccess'));
        } catch {
            setErrorMsg(t('social.posts.detail.detailsTab.saveHashtagsError'));
        }
    }, [postId, current, setHashtags, t]);

    return (
        <div className="space-y-3">
            {/* Current chips */}
            <Section label={t('social.posts.detail.detailsTab.currentHashtagsLabel')}>
                {current.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                        {t('social.posts.detail.detailsTab.currentHashtagsEmpty')}
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-1.5">
                        {current.map((tag) => (
                            <span
                                key={tag}
                                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-primary text-xs"
                            >
                                {tag}
                                <button
                                    type="button"
                                    onClick={() => removeHashtag(tag)}
                                    className="ml-0.5 rounded-full text-primary/70 hover:text-primary"
                                    aria-label={`Quitar ${tag}`}
                                    data-testid={`remove-hashtag-${tag}`}
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </Section>

            {/* Add hashtag input */}
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        setShowSuggestions(e.target.value.length > 0);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (inputValue.length > 0) setShowSuggestions(true);
                    }}
                    onBlur={() => {
                        // Delay so click on suggestion fires first
                        setTimeout(() => setShowSuggestions(false), 150);
                    }}
                    placeholder={t('social.posts.detail.detailsTab.addHashtagPlaceholder')}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    data-testid="hashtag-input"
                />

                {/* Catalog suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                    <ul
                        className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover py-1 shadow-md"
                        data-testid="hashtag-suggestions"
                    >
                        <li className="px-3 py-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                            {t('social.posts.detail.detailsTab.hashtagSuggestionsLabel')}
                        </li>
                        {suggestions.map((h) => (
                            <li key={h.id}>
                                <button
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        addHashtag(h.hashtag);
                                    }}
                                    className="w-full px-3 py-1.5 text-left font-mono text-sm hover:bg-accent hover:text-accent-foreground"
                                    data-testid={`suggestion-${h.hashtag}`}
                                >
                                    {h.hashtag.startsWith('#') ? h.hashtag : `#${h.hashtag}`}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Save button + feedback */}
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={setHashtags.isPending}
                    className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                    data-testid="save-hashtags-btn"
                >
                    {setHashtags.isPending
                        ? t('social.posts.detail.detailsTab.savingHashtags')
                        : t('social.posts.detail.detailsTab.saveHashtagsBtn')}
                </button>
                {successMsg && (
                    <output
                        aria-live="polite"
                        className="text-green-600 text-xs"
                        data-testid="hashtags-save-success"
                    >
                        {successMsg}
                    </output>
                )}
                {errorMsg && (
                    <p
                        role="alert"
                        aria-live="assertive"
                        className="text-destructive text-xs"
                        data-testid="hashtags-save-error"
                    >
                        {errorMsg}
                    </p>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for {@link SocialPostDetailsTab}. */
export interface SocialPostDetailsTabProps {
    readonly post: {
        readonly id: string;
        readonly captionBase: string;
        readonly finalCaption: string | null;
        readonly notes: string | null;
        readonly internalNotes: string | null;
        readonly gptHashtagPayloadJson: readonly string[] | null;
        readonly hashtags: readonly string[];
    };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Details tab showing:
 *   - Editable caption (base as reference + final as textarea) — requires SOCIAL_POST_UPDATE
 *   - Editable hashtag set (chips + catalog search + save) — requires SOCIAL_POST_UPDATE
 *   - Read-only GPT hashtag suggestions
 *   - Read-only public and internal notes
 *
 * @param props - {@link SocialPostDetailsTabProps}
 */
export function SocialPostDetailsTab({ post }: SocialPostDetailsTabProps) {
    const { t } = useTranslations();
    const canEdit = useHasPermission(PermissionEnum.SOCIAL_POST_UPDATE);

    return (
        <div className="space-y-5 py-2">
            {/* Caption section */}
            {canEdit ? (
                <CaptionEditor
                    postId={post.id}
                    captionBase={post.captionBase}
                    finalCaption={post.finalCaption}
                />
            ) : (
                <>
                    <Section label={t('social.posts.detail.detailsTab.captionBaseLabel')}>
                        <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm leading-relaxed">
                            {post.captionBase}
                        </p>
                    </Section>

                    {post.finalCaption !== null && (
                        <Section label={t('social.posts.detail.detailsTab.captionFinalLabel')}>
                            <p className="whitespace-pre-wrap rounded-md bg-green-50 p-3 text-sm leading-relaxed">
                                {post.finalCaption}
                            </p>
                        </Section>
                    )}
                </>
            )}

            {/* Hashtag section */}
            {canEdit ? (
                <HashtagEditor
                    postId={post.id}
                    hashtags={post.hashtags}
                />
            ) : (
                post.hashtags.length > 0 && (
                    <Section label={t('social.posts.detail.detailsTab.currentHashtagsLabel')}>
                        <div className="flex flex-wrap gap-2">
                            {post.hashtags.map((tag) => (
                                <span
                                    key={tag}
                                    className="rounded bg-muted px-2 py-0.5 font-mono text-xs"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </Section>
                )
            )}

            {/* GPT hashtag suggestions (always read-only) */}
            {post.gptHashtagPayloadJson && post.gptHashtagPayloadJson.length > 0 && (
                <Section label={t('social.posts.detail.detailsTab.hashtagsLabel')}>
                    <div className="flex flex-wrap gap-2">
                        {post.gptHashtagPayloadJson.map((tag) => (
                            <span
                                key={tag}
                                className="rounded bg-muted px-2 py-0.5 font-mono text-xs"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </Section>
            )}

            {/* Public notes */}
            <Section label={t('social.posts.detail.detailsTab.notesLabel')}>
                <p className="whitespace-pre-wrap text-muted-foreground text-sm">
                    {post.notes ?? t('social.posts.detail.detailsTab.notesEmpty')}
                </p>
            </Section>

            {/* Internal notes */}
            <Section label={t('social.posts.detail.detailsTab.internalNotesLabel')}>
                <p className="whitespace-pre-wrap text-muted-foreground text-sm">
                    {post.internalNotes ?? t('social.posts.detail.detailsTab.internalNotesEmpty')}
                </p>
            </Section>
        </div>
    );
}
