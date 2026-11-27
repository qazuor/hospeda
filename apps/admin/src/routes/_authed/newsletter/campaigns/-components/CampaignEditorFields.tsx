import { NewsletterCampaignLocaleFilterEnum, NewsletterContentTypeEnum } from '@repo/schemas';
import type { TiptapDocument } from '@/components/newsletter/RichTextEditor';
import { RichTextEditor } from '@/components/newsletter/RichTextEditor';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { useTranslations } from '@/hooks/use-translations';
import type {
    AutosaveStatus,
    CampaignEditorForm,
    CampaignFormValues
} from './campaign-editor-form';

// Radix requires a non-empty selection; this sentinel persists as null.
const CONTENT_TYPE_ALL = 'all';

function CharCounter({ value, max }: { readonly value: string; readonly max: number }) {
    return (
        <span
            className={
                value.length > max ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'
            }
            aria-live="polite"
        >
            {value.length}/{max}
        </span>
    );
}

/** Existing autosave feedback, kept beside the form presentation. */
export function AutosaveIndicator({ status }: { readonly status: AutosaveStatus }) {
    if (status === 'idle') return null;
    const label =
        status === 'saving' ? 'Guardando...' : status === 'saved' ? 'Guardado' : 'Error al guardar';
    return (
        <span
            aria-live="polite"
            className={`text-xs ${status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}
        >
            {label}
        </span>
    );
}

/** Campaign fields and their autosave notifications, independent of page actions. */
export function CampaignEditorFields({
    form,
    isReadOnly,
    isSending,
    scheduleAutosave,
    schedulePreviewUpdate
}: {
    readonly form: CampaignEditorForm;
    readonly isReadOnly: boolean;
    readonly isSending: boolean;
    readonly scheduleAutosave: (value: CampaignFormValues) => void;
    readonly schedulePreviewUpdate: (bodyJson: unknown) => void;
}) {
    const { t } = useTranslations();
    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void form.handleSubmit();
            }}
            className="flex flex-col gap-5"
            noValidate
        >
            <form.Field name="title">
                {(field) => (
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="campaign-title">
                                {t('admin-newsletter.campaigns.titleField')}
                                <span className="ml-1 text-destructive">*</span>
                            </Label>
                            <CharCounter
                                value={field.state.value}
                                max={120}
                            />
                        </div>
                        <Input
                            id="campaign-title"
                            data-testid="campaign-title-input"
                            value={field.state.value}
                            onChange={(event) => {
                                field.handleChange(event.target.value);
                                scheduleAutosave({
                                    ...form.state.values,
                                    title: event.target.value
                                });
                            }}
                            onBlur={field.handleBlur}
                            disabled={isReadOnly || isSending}
                            maxLength={120}
                            placeholder="Nombre interno de la campaña"
                            aria-required="true"
                        />
                        {field.state.meta.errors.length > 0 && (
                            <p className="text-destructive text-xs">
                                {String(field.state.meta.errors[0])}
                            </p>
                        )}
                    </div>
                )}
            </form.Field>
            <form.Field name="subject">
                {(field) => (
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="campaign-subject">
                                {t('admin-newsletter.campaigns.subjectField')}
                                <span className="ml-1 text-destructive">*</span>
                            </Label>
                            <CharCounter
                                value={field.state.value}
                                max={120}
                            />
                        </div>
                        <Input
                            id="campaign-subject"
                            data-testid="campaign-subject-input"
                            value={field.state.value}
                            onChange={(event) => {
                                field.handleChange(event.target.value);
                                scheduleAutosave({
                                    ...form.state.values,
                                    subject: event.target.value
                                });
                            }}
                            onBlur={field.handleBlur}
                            disabled={isReadOnly || isSending}
                            maxLength={120}
                            placeholder="Asunto que verá el destinatario en su bandeja"
                            aria-required="true"
                        />
                        {field.state.meta.errors.length > 0 && (
                            <p className="text-destructive text-xs">
                                {String(field.state.meta.errors[0])}
                            </p>
                        )}
                    </div>
                )}
            </form.Field>
            <form.Field name="localeFilter">
                {(field) => (
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="campaign-locale">
                            {t('admin-newsletter.campaigns.localeFilterField')}
                        </Label>
                        <Select
                            value={field.state.value}
                            onValueChange={(value) => {
                                const next = value as NewsletterCampaignLocaleFilterEnum;
                                field.handleChange(next);
                                scheduleAutosave({ ...form.state.values, localeFilter: next });
                            }}
                            disabled={isReadOnly || isSending}
                        >
                            <SelectTrigger id="campaign-locale">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NewsletterCampaignLocaleFilterEnum.ALL}>
                                    Todos los idiomas
                                </SelectItem>
                                <SelectItem value={NewsletterCampaignLocaleFilterEnum.ES}>
                                    Español
                                </SelectItem>
                                <SelectItem value={NewsletterCampaignLocaleFilterEnum.EN}>
                                    English
                                </SelectItem>
                                <SelectItem value={NewsletterCampaignLocaleFilterEnum.PT}>
                                    Português
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </form.Field>
            <form.Field name="contentType">
                {(field) => (
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="campaign-content-type">
                            Segmentación por tipo de contenido
                        </Label>
                        <Select
                            value={field.state.value ?? CONTENT_TYPE_ALL}
                            onValueChange={(value) => {
                                const next =
                                    value === CONTENT_TYPE_ALL
                                        ? null
                                        : (value as NewsletterContentTypeEnum);
                                field.handleChange(next);
                                scheduleAutosave({ ...form.state.values, contentType: next });
                            }}
                            disabled={isReadOnly || isSending}
                        >
                            <SelectTrigger
                                id="campaign-content-type"
                                data-testid="campaign-content-type-select"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={CONTENT_TYPE_ALL}>
                                    Todos los suscriptores (sin segmentar)
                                </SelectItem>
                                <SelectItem value={NewsletterContentTypeEnum.OFFERS}>
                                    Ofertas
                                </SelectItem>
                                <SelectItem value={NewsletterContentTypeEnum.EVENTS}>
                                    Eventos
                                </SelectItem>
                                <SelectItem value={NewsletterContentTypeEnum.GUIDES}>
                                    Guías
                                </SelectItem>
                                <SelectItem value={NewsletterContentTypeEnum.PRODUCT_NEWS}>
                                    Novedades del producto
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-muted-foreground text-xs">
                            Solo los suscriptores con esta preferencia activa recibirán la campaña.
                            Dejar en &quot;sin segmentar&quot; envía a toda la audiencia que cumpla
                            el filtro de idioma.
                        </p>
                    </div>
                )}
            </form.Field>
            <form.Field name="bodyJson">
                {(field) => (
                    <div className="flex flex-col gap-1.5">
                        <Label>
                            {t('admin-newsletter.campaigns.bodyField')}
                            <span className="ml-1 text-destructive">*</span>
                        </Label>
                        <RichTextEditor
                            value={field.state.value as TiptapDocument | null}
                            onChange={(next) => {
                                field.handleChange(next);
                                schedulePreviewUpdate(next);
                                scheduleAutosave({ ...form.state.values, bodyJson: next });
                            }}
                            disabled={isReadOnly || isSending}
                            ariaLabel="Contenido del email"
                            className="min-h-[300px]"
                        />
                    </div>
                )}
            </form.Field>
            {/* Hidden submit trigger remains accessible but outside keyboard navigation. */}
            <button
                type="submit"
                className="sr-only"
                tabIndex={-1}
                aria-label="Enviar formulario"
            />
        </form>
    );
}
