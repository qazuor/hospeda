/** Editor surfaces omit headings already supplied by the route's page header, including SSR. */
import { Section, type SectionProps } from '@/components/account/ui/Section';
import { ACCOMMODATION_EDITOR_REGISTRY } from '@/lib/editor/accommodation-editor-sections';
import { LISTING_SECTION_PRESENTATION } from '@/lib/editor/listing-section-presentation';
import { createT, type SupportedLocale } from '@/lib/i18n';

/** Help anchors identify the same vertical and slug used by the editor shell registry. */
export function EditorSection({
    locale,
    title,
    helpId,
    ...props
}: SectionProps & {
    readonly locale: SupportedLocale;
}) {
    const [vertical, slug] = helpId.slice('section:'.length).split('.');
    const presentation =
        vertical === 'accommodation'
            ? ACCOMMODATION_EDITOR_REGISTRY.sections
            : vertical === 'venue' || vertical === 'experience'
              ? Object.values(LISTING_SECTION_PRESENTATION[vertical])
              : [];
    const labelKey = presentation.find((section) => section.slug === slug)?.labelKey;
    const pageTitle = labelKey ? createT(locale)(labelKey) : undefined;
    const duplicate = typeof title === 'string' && title.trim() === pageTitle?.trim();
    return (
        <Section
            {...props}
            helpId={helpId}
            title={duplicate ? null : title}
            ariaLabel={duplicate ? pageTitle : undefined}
        />
    );
}
