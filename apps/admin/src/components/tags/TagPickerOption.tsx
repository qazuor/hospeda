import type { Tag } from '@repo/schemas';
import { TagTypeEnum } from '@repo/schemas';
import { PostTagColorBadge } from './PostTagColorBadge';

/** Maps tag type to a badge label + style. */
const TYPE_BADGE: Readonly<Record<string, { label: string; className: string }>> = {
    [TagTypeEnum.SYSTEM]: {
        label: 'Sistema',
        className: 'bg-blue-100 text-blue-700'
    },
    [TagTypeEnum.INTERNAL]: {
        label: 'Interno',
        className: 'bg-red-100 text-red-700'
    },
    [TagTypeEnum.USER]: {
        label: 'Personal',
        className: 'bg-violet-100 text-violet-700'
    }
} as const;

interface TagPickerOptionProps {
    /** The tag to render. */
    readonly tag: Tag;
    /** Whether this tag is currently assigned to the entity. */
    readonly isChecked: boolean;
    /** Called when the option is clicked (toggle). */
    readonly onToggle: (tagId: string) => void;
    /** Whether a mutation is in flight for this specific tag. */
    readonly isPending?: boolean;
}

/**
 * Single option row in the TagPicker dropdown.
 *
 * Renders:
 * - Color swatch
 * - Tag name
 * - Type badge (Sistema / Interno / Personal)
 * - Checkbox-like checked state
 *
 * @see TagPicker, D-006, D-008
 * @see SPEC-086 T-033
 */
export function TagPickerOption({ tag, isChecked, onToggle, isPending }: TagPickerOptionProps) {
    const badge = TYPE_BADGE[tag.type] ?? TYPE_BADGE[TagTypeEnum.SYSTEM];

    return (
        <button
            type="button"
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                isChecked ? 'bg-primary/10' : 'hover:bg-muted'
            } ${isPending ? 'pointer-events-none opacity-60' : ''}`}
            onClick={() => onToggle(tag.id)}
            aria-pressed={isChecked}
            aria-label={`${isChecked ? 'Quitar' : 'Aplicar'} tag ${tag.name}`}
            disabled={isPending}
        >
            {/* Checkbox indicator */}
            <span
                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border text-xs ${
                    isChecked
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input bg-background'
                }`}
                aria-hidden="true"
            >
                {isChecked && '✓'}
            </span>

            {/* Color swatch */}
            <PostTagColorBadge color={tag.color} />

            {/* Name */}
            <span className="flex-1 truncate font-medium">{tag.name}</span>

            {/* Type badge */}
            <span
                className={`flex-shrink-0 rounded-full px-1.5 py-0.5 font-medium text-xs ${badge.className}`}
                aria-label={`Tipo: ${badge.label}`}
            >
                {badge.label}
            </span>
        </button>
    );
}
