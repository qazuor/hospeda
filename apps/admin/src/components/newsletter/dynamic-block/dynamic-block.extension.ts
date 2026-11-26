import type { DynamicBlockConfig, DynamicBlockDefaultsConfig } from '@repo/schemas';
import { applyDynamicBlockDefaults } from '@repo/schemas';
import { isNodeSelection, mergeAttributes, Node, ReactNodeViewRenderer } from '@tiptap/react';
import { createElement } from 'react';
import { DynamicBlockNodeView } from './DynamicBlockNodeView';

/** Selection passed to the configuration panel owned by the editor consumer. */
export interface DynamicBlockEditInput {
    readonly blockKey: string;
    readonly config: DynamicBlockConfig;
    readonly ifBelowMinManual: boolean;
}

/** Optional edit handler; T-021 supplies the configuration panel. */
export interface DynamicBlockOptions {
    readonly onEdit: ((input: DynamicBlockEditInput) => void) | null;
}

/** Insertion accepts selection fields and lets the shared helper fill defaults. */
export interface InsertDynamicBlockInput {
    readonly config: Omit<DynamicBlockDefaultsConfig, 'blockKey'>;
}

declare module '@tiptap/react' {
    interface Commands<ReturnType> {
        dynamicBlock: {
            /** Insert a validated atomic block at document root with a fresh key. */
            insertDynamicBlock: (input: InsertDynamicBlockInput) => ReturnType;
        };
    }
}

/** Root accepts dynamic blocks explicitly; nested containers only accept `block`. */
export const NewsletterDocument = Node.create({
    name: 'doc',
    topNode: true,
    content: '(block | dynamicBlock)+'
});

/** Atomic newsletter placeholder, excluded from the nestable `block` group. */
export const DynamicBlock = Node.create<DynamicBlockOptions>({
    name: 'dynamicBlock',
    atom: true,
    selectable: true,
    draggable: true,

    addOptions() {
        return { onEdit: null };
    },

    addAttributes() {
        return {
            blockKey: {
                default: '',
                parseHTML: (element) => element.getAttribute('data-block-key'),
                renderHTML: (attributes) => ({ 'data-block-key': attributes.blockKey })
            },
            config: {
                default: '',
                parseHTML: (element) => element.getAttribute('data-config'),
                renderHTML: (attributes) => ({ 'data-config': attributes.config })
            },
            ifBelowMinManual: {
                default: false,
                parseHTML: (element) => element.getAttribute('data-if-below-min-manual') === 'true',
                renderHTML: (attributes) => ({
                    'data-if-below-min-manual': String(attributes.ifBelowMinManual)
                })
            }
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="dynamicBlock"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': this.name })];
    },

    addCommands() {
        return {
            insertDynamicBlock:
                ({ config }) =>
                ({ commands, state }) => {
                    let dynamicBlockCount = 1;
                    state.doc.forEach((node) => {
                        if (node.type.name === this.name) dynamicBlockCount += 1;
                    });
                    const blockKey = crypto.randomUUID();
                    let resolvedConfig: DynamicBlockConfig;
                    try {
                        resolvedConfig = applyDynamicBlockDefaults({
                            config: { ...config, blockKey },
                            dynamicBlockCount
                        });
                    } catch {
                        return false;
                    }
                    const content = {
                        type: this.name,
                        attrs: {
                            blockKey,
                            config: JSON.stringify(resolvedConfig),
                            ifBelowMinManual: false
                        }
                    };
                    // In lists/quotes, insert after the outermost container rather
                    // than splitting it or silently placing a nested placeholder.
                    const { $from, $to } = state.selection;
                    if (
                        isNodeSelection(state.selection) &&
                        state.selection.node.type.name === this.name
                    ) {
                        return commands.insertContentAt($to.pos, content);
                    }
                    if ($from.depth > 1 || $to.depth > 1) {
                        return commands.insertContentAt(
                            $to.depth > 0 ? $to.after(1) : $to.pos,
                            content
                        );
                    }
                    return commands.insertContent(content);
                }
        };
    },

    addNodeView() {
        const onEdit = this.options.onEdit;
        return ReactNodeViewRenderer((props) =>
            createElement(DynamicBlockNodeView, { ...props, onEdit })
        );
    }
});
