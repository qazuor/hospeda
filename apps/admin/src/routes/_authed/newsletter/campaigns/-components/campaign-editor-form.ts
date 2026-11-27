import type { NewsletterCampaign, NewsletterContentTypeEnum } from '@repo/schemas';
import { NewsletterCampaignLocaleFilterEnum } from '@repo/schemas';
import { useForm } from '@tanstack/react-form';

/** Form state keeps the rich document opaque to avoid excessive recursive inference. */
export interface CampaignFormValues {
    title: string;
    subject: string;
    localeFilter: NewsletterCampaignLocaleFilterEnum;
    contentType: NewsletterContentTypeEnum | null;
    bodyJson: unknown;
}

/** Build initial editor values from the saved campaign. */
export function buildCampaignDefaults({
    campaign
}: {
    readonly campaign?: NewsletterCampaign;
}): CampaignFormValues {
    return {
        title: campaign?.title ?? '',
        subject: campaign?.subject ?? '',
        localeFilter: campaign?.localeFilter ?? NewsletterCampaignLocaleFilterEnum.ALL,
        contentType: campaign?.contentType ?? null,
        bodyJson: campaign?.bodyJson ?? null
    };
}

/** Normalize an empty editor to the persisted TipTap document shape. */
export function buildCampaignBody({
    raw
}: {
    readonly raw: unknown;
}): NewsletterCampaign['bodyJson'] {
    if (raw && typeof raw === 'object' && 'type' in raw && raw.type === 'doc') {
        return raw as NewsletterCampaign['bodyJson'];
    }
    return { type: 'doc', content: [] };
}

/** Stable snapshot used to avoid saving an unchanged document. */
export function campaignSnapshot({ value }: { readonly value: CampaignFormValues }): string {
    return JSON.stringify([
        value.title,
        value.subject,
        value.localeFilter,
        value.contentType,
        buildCampaignBody({ raw: value.bodyJson })
    ]);
}

/** Typed form factory shared with the extracted field components. */
export function useCampaignEditorForm({
    campaign,
    onSubmit
}: {
    readonly campaign?: NewsletterCampaign;
    readonly onSubmit: (value: CampaignFormValues) => Promise<void>;
}) {
    return useForm({
        defaultValues: buildCampaignDefaults({ campaign }),
        onSubmit: async ({ value }) => {
            await onSubmit(value);
        }
    });
}

/** Concrete form API, inferred once instead of duplicating TanStack generics. */
export type CampaignEditorForm = ReturnType<typeof useCampaignEditorForm>;

/** Autosave feedback states. */
export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';
