/**
 * Shared form component for the announcement editor pages
 * (create T-039 / edit T-040). Renders the controlled inputs, validates
 * client-side with `AnnouncementItemSchema`, and delegates persistence to
 * the parent via the `onSubmit` callback.
 *
 * The parent decides whether to APPEND (create) or REPLACE (edit) the item
 * inside the announcements.global array — this component is shape-agnostic
 * and only emits a fully-built `AnnouncementItem`.
 *
 * @module features/announcements/AnnouncementForm
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/hooks/use-translations';
import {
    type AnnouncementItem,
    AnnouncementItemSchema,
    type AnnouncementVariant
} from '@repo/schemas';
import { useCallback, useState } from 'react';

const VARIANTS: ReadonlyArray<AnnouncementVariant> = ['info', 'warning', 'danger'];

export interface AnnouncementFormState {
    readonly textEs: string;
    readonly textEn: string;
    readonly textPt: string;
    readonly variant: AnnouncementVariant;
    readonly dismissible: boolean;
    readonly startsAt: string;
    readonly endsAt: string;
}

export interface AnnouncementFormProps {
    /** Pre-set values used as defaults (used by the edit form to seed the inputs). */
    readonly initial?: Partial<AnnouncementFormState>;
    /**
     * Persistent identifier for the item. The create form generates a fresh
     * UUID and passes it in so the helper can avoid pulling `crypto` here.
     */
    readonly itemId: string;
    /** Whether the form is currently submitting (drives the disabled state). */
    readonly submitting: boolean;
    /** Label for the primary submit button (i18n'd by the caller). */
    readonly submitLabel: string;
    /** Optional secondary CTA (e.g. "Cancel" linking back to the list). */
    readonly cancelHref?: string;
    /** Called on submit with a valid AnnouncementItem ready to persist. */
    readonly onSubmit: (item: AnnouncementItem) => void;
}

const EMPTY: AnnouncementFormState = {
    textEs: '',
    textEn: '',
    textPt: '',
    variant: 'info',
    dismissible: true,
    startsAt: '',
    endsAt: ''
};

/**
 * Validate and serialize the local form state into an `AnnouncementItem`
 * suitable for `announcements.global`. Returns either the parsed item or
 * a single error string for the form-level message.
 */
export function buildAnnouncementItem(input: {
    readonly id: string;
    readonly state: AnnouncementFormState;
}): { item: AnnouncementItem } | { error: 'requiredText' | 'endBeforeStart' | 'invalid' } {
    const { id, state } = input;
    const trimEs = state.textEs.trim();
    const trimEn = state.textEn.trim();
    const trimPt = state.textPt.trim();
    if (!trimEs || !trimEn || !trimPt) {
        return { error: 'requiredText' };
    }
    const startsAt = state.startsAt ? new Date(state.startsAt).toISOString() : undefined;
    const endsAt = state.endsAt ? new Date(state.endsAt).toISOString() : undefined;
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
        return { error: 'endBeforeStart' };
    }
    const candidate: AnnouncementItem = {
        id,
        text: { es: trimEs, en: trimEn, pt: trimPt },
        variant: state.variant,
        dismissible: state.dismissible,
        startsAt,
        endsAt
    };
    const parsed = AnnouncementItemSchema.safeParse(candidate);
    if (!parsed.success) return { error: 'invalid' };
    return { item: parsed.data };
}

/**
 * Convert an ISO-8601 datetime into the value accepted by an
 * `<input type="datetime-local">` (i.e. `YYYY-MM-DDTHH:mm`).
 */
function toDatetimeLocal(iso: string | undefined): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    // Strip the seconds + the timezone suffix so the input accepts the value.
    const pad = (n: number) => `${n}`.padStart(2, '0');
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
        date.getUTCDate()
    )}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function AnnouncementForm(props: AnnouncementFormProps) {
    const { t } = useTranslations();
    const { initial, itemId, submitting, submitLabel, cancelHref, onSubmit } = props;

    const [state, setState] = useState<AnnouncementFormState>(() => ({
        ...EMPTY,
        ...initial,
        startsAt: toDatetimeLocal(initial?.startsAt) || initial?.startsAt || EMPTY.startsAt,
        endsAt: toDatetimeLocal(initial?.endsAt) || initial?.endsAt || EMPTY.endsAt
    }));
    const [errorKey, setErrorKey] = useState<'requiredText' | 'endBeforeStart' | 'invalid' | null>(
        null
    );

    const update = useCallback(
        <K extends keyof AnnouncementFormState>(key: K, value: AnnouncementFormState[K]) => {
            setState((prev) => ({ ...prev, [key]: value }));
            if (errorKey !== null) setErrorKey(null);
        },
        [errorKey]
    );

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        const result = buildAnnouncementItem({ id: itemId, state });
        if ('error' in result) {
            setErrorKey(result.error);
            return;
        }
        onSubmit(result.item);
    };

    const errorMessage = (() => {
        switch (errorKey) {
            case 'requiredText':
                return t('admin-pages.announcements.form.errorRequiredText');
            case 'endBeforeStart':
                return t('admin-pages.announcements.form.errorEndBeforeStart');
            case 'invalid':
                return t('admin-pages.announcements.form.errorGeneric');
            default:
                return null;
        }
    })();

    return (
        <form
            className="space-y-6"
            onSubmit={handleSubmit}
            data-testid="announcement-form"
        >
            <div className="grid gap-4">
                <div className="space-y-2">
                    <Label htmlFor="textEs">
                        {t('admin-pages.announcements.form.textLabel.es')}
                    </Label>
                    <Textarea
                        id="textEs"
                        rows={2}
                        value={state.textEs}
                        onChange={(e) => update('textEs', e.target.value)}
                        placeholder={t('admin-pages.announcements.form.textPlaceholder')}
                        disabled={submitting}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="textEn">
                        {t('admin-pages.announcements.form.textLabel.en')}
                    </Label>
                    <Textarea
                        id="textEn"
                        rows={2}
                        value={state.textEn}
                        onChange={(e) => update('textEn', e.target.value)}
                        placeholder={t('admin-pages.announcements.form.textPlaceholder')}
                        disabled={submitting}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="textPt">
                        {t('admin-pages.announcements.form.textLabel.pt')}
                    </Label>
                    <Textarea
                        id="textPt"
                        rows={2}
                        value={state.textPt}
                        onChange={(e) => update('textPt', e.target.value)}
                        placeholder={t('admin-pages.announcements.form.textPlaceholder')}
                        disabled={submitting}
                        required
                    />
                </div>
            </div>

            <fieldset
                className="space-y-2"
                disabled={submitting}
            >
                <legend className="font-medium text-sm">
                    {t('admin-pages.announcements.form.variantLabel')}
                </legend>
                <div className="flex flex-wrap gap-3">
                    {VARIANTS.map((variant) => (
                        <label
                            key={variant}
                            className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm hover:bg-accent"
                        >
                            <input
                                type="radio"
                                name="variant"
                                value={variant}
                                checked={state.variant === variant}
                                onChange={() => update('variant', variant)}
                                disabled={submitting}
                            />
                            <span>
                                {t(`admin-pages.announcements.variant.${variant}` as const)}
                            </span>
                        </label>
                    ))}
                </div>
            </fieldset>

            <div className="flex items-center justify-between rounded-lg border bg-card p-4">
                <div className="flex-1">
                    <p className="font-medium text-sm">
                        {t('admin-pages.announcements.form.dismissibleLabel')}
                    </p>
                    <p className="text-muted-foreground text-xs">
                        {t('admin-pages.announcements.form.dismissibleHint')}
                    </p>
                </div>
                <Switch
                    checked={state.dismissible}
                    onCheckedChange={(value: boolean) => update('dismissible', value)}
                    aria-label={t('admin-pages.announcements.form.dismissibleLabel')}
                    disabled={submitting}
                />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="startsAt">
                        {t('admin-pages.announcements.form.startsAtLabel')}
                    </Label>
                    <Input
                        id="startsAt"
                        type="datetime-local"
                        value={state.startsAt}
                        onChange={(e) => update('startsAt', e.target.value)}
                        disabled={submitting}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="endsAt">
                        {t('admin-pages.announcements.form.endsAtLabel')}
                    </Label>
                    <Input
                        id="endsAt"
                        type="datetime-local"
                        value={state.endsAt}
                        onChange={(e) => update('endsAt', e.target.value)}
                        disabled={submitting}
                    />
                </div>
            </div>

            {errorMessage && (
                <p
                    className="text-destructive text-sm"
                    data-testid="announcement-form-error"
                >
                    {errorMessage}
                </p>
            )}

            <div className="flex items-center justify-end gap-3">
                {cancelHref && (
                    <Button
                        type="button"
                        variant="outline"
                        disabled={submitting}
                        asChild
                    >
                        <a href={cancelHref}>{t('admin-pages.announcements.form.cancel')}</a>
                    </Button>
                )}
                <Button
                    type="submit"
                    disabled={submitting}
                    data-testid="announcement-form-submit"
                >
                    {submitting ? t('admin-pages.announcements.form.saving') : submitLabel}
                </Button>
            </div>
        </form>
    );
}
