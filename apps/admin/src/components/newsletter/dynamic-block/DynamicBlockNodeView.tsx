import { DynamicBlockConfigSchema } from '@repo/schemas';
import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper, useEditorState } from '@tiptap/react';
import { Button } from '@/components/ui-wrapped/Button';
import { useTranslations } from '@/hooks/use-translations';
import type { DynamicBlockOptions } from './dynamic-block.extension';

/** Node-view props plus the extension's configuration-panel callback. */
export type DynamicBlockNodeViewProps = ReactNodeViewProps & DynamicBlockOptions;

/** Read-only summary of a dynamic query; actual content is resolved at send time. */
export function DynamicBlockNodeView({ node, editor, onEdit }: DynamicBlockNodeViewProps) {
    const { t } = useTranslations();
    const editable = useEditorState({
        editor,
        selector: ({ editor: current }) => current.isEditable
    });
    const config = parseConfig({ value: node.attrs.config });

    return (
        <NodeViewWrapper
            contentEditable={false}
            className="my-3 rounded-md border border-border bg-muted/30 p-4"
            data-dynamic-block={node.attrs.blockKey}
        >
            <p className="font-semibold">{t('admin-newsletter.dynamicBlock.title')}</p>
            {config ? (
                <>
                    <dl className="my-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <dt>{t('admin-newsletter.dynamicBlock.entityType')}</dt>
                        <dd>{t('admin-newsletter.dynamicBlock.accommodation')}</dd>
                        <dt>{t('admin-newsletter.dynamicBlock.source')}</dt>
                        <dd>{t(`admin-newsletter.dynamicBlock.sources.${config.source}`)}</dd>
                        <dt>{t('admin-newsletter.dynamicBlock.count')}</dt>
                        <dd>{config.count}</dd>
                    </dl>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!editable || !onEdit}
                        onClick={() =>
                            onEdit?.({
                                blockKey: node.attrs.blockKey,
                                config,
                                ifBelowMinManual: node.attrs.ifBelowMinManual === true
                            })
                        }
                    >
                        {t('admin-newsletter.dynamicBlock.edit')}
                    </Button>
                </>
            ) : (
                <p role="alert">{t('admin-newsletter.dynamicBlock.invalidConfig')}</p>
            )}
        </NodeViewWrapper>
    );
}

function parseConfig({ value }: { readonly value: unknown }) {
    if (typeof value !== 'string') return null;
    try {
        const result = DynamicBlockConfigSchema.safeParse(JSON.parse(value));
        return result.success ? result.data : null;
    } catch {
        return null;
    }
}
