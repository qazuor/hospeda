/**
 * @file PromoteHashtagModal.tsx
 * @description Modal for promoting a GPT-suggested hashtag to the global hashtag library
 * (SPEC-254 T-040). Allows the admin to set a category, platform, and priority before
 * calling the promote-hashtag mutation.
 */

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePromoteHashtag } from '@/hooks/use-social-posts';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { useForm } from '@tanstack/react-form';
import { useCallback, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for the PromoteHashtagModal component. */
export interface PromoteHashtagModalProps {
    readonly postId: string;
    readonly hashtag: string;
    readonly open: boolean;
    readonly onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Dialog that lets an admin promote a GPT-suggested hashtag into the global
 * hashtag library, specifying category, optional platform, and optional priority.
 */
export function PromoteHashtagModal({ postId, hashtag, open, onClose }: PromoteHashtagModalProps) {
    const { t } = useTranslations();
    const promote = usePromoteHashtag();

    const form = useForm({
        defaultValues: {
            hashtag,
            category: '',
            platform: '',
            priority: ''
        },
        onSubmit: async ({ value }) => {
            const parsed = value.priority ? Number.parseInt(value.priority, 10) : undefined;
            const result = await promote.mutateAsync({
                postId,
                hashtag: value.hashtag,
                category: value.category,
                platform: value.platform || undefined,
                priority: Number.isNaN(parsed) ? undefined : parsed
            });
            setFeedback(
                result.isNew
                    ? t('social.posts.detail.promoteHashtag.successNew' as TranslationKey, {
                          hashtag: result.hashtag
                      })
                    : t('social.posts.detail.promoteHashtag.successExisting' as TranslationKey, {
                          hashtag: result.hashtag
                      })
            );
            onClose();
        }
    });

    const [feedback, setFeedback] = useState('');

    const handleClose = useCallback(() => {
        form.reset();
        setFeedback('');
        onClose();
    }, [form, onClose]);

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                if (!v) handleClose();
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {t('social.posts.detail.promoteHashtag.title' as TranslationKey)}
                    </DialogTitle>
                </DialogHeader>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.handleSubmit();
                    }}
                    className="space-y-4"
                >
                    <form.Field name="hashtag">
                        {(field) => (
                            <div className="space-y-1">
                                <Label htmlFor="ph-hashtag">
                                    {t(
                                        'social.posts.detail.promoteHashtag.hashtagLabel' as TranslationKey
                                    )}
                                </Label>
                                <Input
                                    id="ph-hashtag"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    readOnly
                                />
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="category">
                        {(field) => (
                            <div className="space-y-1">
                                <Label htmlFor="ph-category">
                                    {t(
                                        'social.posts.detail.promoteHashtag.categoryLabel' as TranslationKey
                                    )}
                                </Label>
                                <Input
                                    id="ph-category"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    placeholder={t(
                                        'social.posts.detail.promoteHashtag.categoryPlaceholder' as TranslationKey
                                    )}
                                    required
                                />
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="platform">
                        {(field) => (
                            <div className="space-y-1">
                                <Label htmlFor="ph-platform">
                                    {t(
                                        'social.posts.detail.promoteHashtag.platformLabel' as TranslationKey
                                    )}
                                </Label>
                                <Input
                                    id="ph-platform"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    placeholder={t(
                                        'social.posts.detail.promoteHashtag.platformAll' as TranslationKey
                                    )}
                                />
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="priority">
                        {(field) => (
                            <div className="space-y-1">
                                <Label htmlFor="ph-priority">
                                    {t(
                                        'social.posts.detail.promoteHashtag.priorityLabel' as TranslationKey
                                    )}
                                </Label>
                                <Input
                                    id="ph-priority"
                                    type="number"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                />
                            </div>
                        )}
                    </form.Field>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={promote.isPending}
                        >
                            {t('social.posts.detail.promoteHashtag.cancel' as TranslationKey)}
                        </Button>
                        <Button
                            type="submit"
                            disabled={promote.isPending}
                        >
                            {promote.isPending
                                ? t(
                                      'social.posts.detail.promoteHashtag.submitting' as TranslationKey
                                  )
                                : t('social.posts.detail.promoteHashtag.submit' as TranslationKey)}
                        </Button>
                    </DialogFooter>
                </form>

                {feedback && (
                    <output
                        aria-live="polite"
                        className="text-green-700 text-sm"
                    >
                        {feedback}
                    </output>
                )}
            </DialogContent>
        </Dialog>
    );
}
