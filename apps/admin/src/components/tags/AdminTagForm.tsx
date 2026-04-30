import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LifecycleStatusEnum, TagColorEnum, TagUpdateInputSchema } from '@repo/schemas';
import type { TagCreateInput, TagUpdateInput } from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { PostTagColorBadge } from './PostTagColorBadge';

/** Color options for the color select. */
const COLOR_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
    { value: TagColorEnum.RED, label: 'Rojo' },
    { value: TagColorEnum.BLUE, label: 'Azul' },
    { value: TagColorEnum.GREEN, label: 'Verde' },
    { value: TagColorEnum.YELLOW, label: 'Amarillo' },
    { value: TagColorEnum.ORANGE, label: 'Naranja' },
    { value: TagColorEnum.PURPLE, label: 'Púrpura' },
    { value: TagColorEnum.PINK, label: 'Rosa' },
    { value: TagColorEnum.GREY, label: 'Gris' },
    { value: TagColorEnum.CYAN, label: 'Cian' },
    { value: TagColorEnum.LIGHT_BLUE, label: 'Azul Claro' },
    { value: TagColorEnum.LIGHT_GREEN, label: 'Verde Claro' }
] as const;

/** Lifecycle state options for the state select. */
const STATE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
    { value: LifecycleStatusEnum.ACTIVE, label: 'Activo' },
    { value: LifecycleStatusEnum.DRAFT, label: 'Borrador' },
    { value: LifecycleStatusEnum.ARCHIVED, label: 'Archivado' }
] as const;

/** Tag type accepted by AdminTagForm — either 'SYSTEM' or 'INTERNAL'. */
type AdminTagType = 'SYSTEM' | 'INTERNAL';

interface AdminTagFormCreateProps {
    /** Form mode: create a new tag. */
    readonly mode: 'create';
    /**
     * Tag type — hardcoded by the parent route, not shown to the user.
     * Determines which API endpoint the parent calls after submit.
     */
    readonly tagType: AdminTagType;
    /** Called with validated partial payload (no type/ownerId — injected by parent). */
    readonly onSubmit: (values: Omit<TagCreateInput, 'type' | 'ownerId'>) => void | Promise<void>;
    /** Whether the parent create mutation is in progress. */
    readonly isSubmitting: boolean;
    /** Optional prefilled values. */
    readonly defaultValues?: Partial<Omit<TagCreateInput, 'type' | 'ownerId'>>;
}

interface AdminTagFormEditProps {
    /** Form mode: edit an existing tag. */
    readonly mode: 'edit';
    /**
     * Tag type — hardcoded by the parent route, not shown to the user.
     * Drives label copy only in edit mode.
     */
    readonly tagType: AdminTagType;
    /** Called with validated partial payload. */
    readonly onSubmit: (values: TagUpdateInput) => void | Promise<void>;
    /** Whether the parent update mutation is in progress. */
    readonly isSubmitting: boolean;
    /** Prefilled values from the existing tag. */
    readonly defaultValues?: Partial<TagUpdateInput>;
}

/** Props union for AdminTagForm. */
export type AdminTagFormProps = AdminTagFormCreateProps | AdminTagFormEditProps;

/** Internal form values type — all strings for controlled inputs. */
type FormValues = {
    name: string;
    color: string;
    icon: string;
    description: string;
    lifecycleState: string;
};

/** Display labels per tag type. */
const TAG_TYPE_LABELS: Readonly<Record<AdminTagType, string>> = {
    SYSTEM: 'etiqueta de sistema',
    INTERNAL: 'etiqueta interna'
} as const;

/**
 * Shared form component for creating and editing SYSTEM and INTERNAL tags.
 *
 * Per D-002 and the spec:
 * - No slug field (slug was removed from the unified tags table).
 * - No ownerId field (SYSTEM/INTERNAL tags are not user-owned).
 * - No type field shown to the user — `tagType` prop is injected by the parent route.
 *
 * Fields: name (required), color (required), icon (optional),
 * description (optional), lifecycleState (required, defaults to ACTIVE).
 *
 * Uses TanStack Form — admin convention.
 *
 * @see TagCreateInputSchema, TagUpdateInputSchema in @repo/schemas
 * @see SPEC-086 Phase 7 / T-030
 * @see D-002, D-012
 */
export function AdminTagForm(props: AdminTagFormProps) {
    const isCreate = props.mode === 'create';
    const typeLabel = TAG_TYPE_LABELS[props.tagType];

    const form = useForm<FormValues>({
        defaultValues: {
            name: props.defaultValues?.name ?? '',
            color: props.defaultValues?.color ?? '',
            icon: props.defaultValues?.icon ?? '',
            description: props.defaultValues?.description ?? '',
            lifecycleState: props.defaultValues?.lifecycleState ?? LifecycleStatusEnum.ACTIVE
        },
        onSubmit: async ({ value }) => {
            // Both create and edit payloads share the same optional fields shape.
            // We validate using TagUpdateInputSchema (partial, no type/ownerId refinements).
            // The parent hook injects `type` before calling the API.
            const payload = {
                name: value.name || undefined,
                color: value.color || undefined,
                icon: value.icon || undefined,
                description: value.description || undefined,
                lifecycleState: value.lifecycleState || undefined
            };
            const parsed = TagUpdateInputSchema.safeParse(payload);
            if (!parsed.success) return;
            if (isCreate) {
                await (props as AdminTagFormCreateProps).onSubmit(
                    parsed.data as Omit<TagCreateInput, 'type' | 'ownerId'>
                );
            } else {
                await (props as AdminTagFormEditProps).onSubmit(parsed.data);
            }
        }
    });

    const colorValue = form.state.values.color;
    const lifecycleValue = form.state.values.lifecycleState;

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit();
            }}
            className="space-y-6"
            noValidate
            aria-label={isCreate ? `Crear ${typeLabel}` : `Editar ${typeLabel}`}
        >
            {/* Name */}
            <form.Field name="name">
                {(field) => (
                    <div className="space-y-1.5">
                        <Label htmlFor="tag-name">
                            Nombre <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="tag-name"
                            placeholder="Ej: Destacado, Urgente, Spam"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            aria-required="true"
                        />
                    </div>
                )}
            </form.Field>

            {/* Color */}
            <div className="space-y-1.5">
                <Label htmlFor="tag-color">
                    Color <span className="text-destructive">*</span>
                </Label>
                <Select
                    value={colorValue}
                    onValueChange={(val) => form.setFieldValue('color', val)}
                >
                    <SelectTrigger id="tag-color">
                        <SelectValue placeholder="Seleccionar color...">
                            {colorValue && (
                                <PostTagColorBadge
                                    color={colorValue}
                                    label={COLOR_OPTIONS.find((o) => o.value === colorValue)?.label}
                                />
                            )}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {COLOR_OPTIONS.map((option) => (
                            <SelectItem
                                key={option.value}
                                value={option.value}
                            >
                                <PostTagColorBadge
                                    color={option.value}
                                    label={option.label}
                                />
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Icon (optional) */}
            <form.Field name="icon">
                {(field) => (
                    <div className="space-y-1.5">
                        <Label htmlFor="tag-icon">Icono (opcional)</Label>
                        <Input
                            id="tag-icon"
                            placeholder="Ej: star, flag, alert-circle"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            aria-describedby="tag-icon-hint"
                        />
                        <p
                            id="tag-icon-hint"
                            className="text-muted-foreground text-xs"
                        >
                            Nombre del icono de la librería del proyecto.
                        </p>
                    </div>
                )}
            </form.Field>

            {/* Description (optional) */}
            <form.Field name="description">
                {(field) => (
                    <div className="space-y-1.5">
                        <Label htmlFor="tag-description">Descripción (opcional)</Label>
                        <Textarea
                            id="tag-description"
                            placeholder="Descripción interna del propósito de esta etiqueta..."
                            rows={3}
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            aria-describedby="tag-description-hint"
                        />
                        <p
                            id="tag-description-hint"
                            className="text-muted-foreground text-xs"
                        >
                            Uso interno. No se muestra a los usuarios finales.
                        </p>
                    </div>
                )}
            </form.Field>

            {/* Lifecycle state */}
            <div className="space-y-1.5">
                <Label htmlFor="tag-lifecycle">
                    Estado <span className="text-destructive">*</span>
                </Label>
                <Select
                    value={lifecycleValue}
                    onValueChange={(val) => form.setFieldValue('lifecycleState', val)}
                >
                    <SelectTrigger id="tag-lifecycle">
                        <SelectValue placeholder="Seleccionar estado..." />
                    </SelectTrigger>
                    <SelectContent>
                        {STATE_OPTIONS.map((option) => (
                            <SelectItem
                                key={option.value}
                                value={option.value}
                            >
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
                <Button
                    type="submit"
                    disabled={props.isSubmitting}
                    aria-busy={props.isSubmitting}
                >
                    {props.isSubmitting
                        ? 'Guardando...'
                        : isCreate
                          ? `Crear ${typeLabel}`
                          : 'Guardar cambios'}
                </Button>
            </div>
        </form>
    );
}
