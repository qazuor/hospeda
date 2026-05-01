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
import { LifecycleStatusEnum, TagColorEnum } from '@repo/schemas';
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

/** Internal form values type. */
type FormValues = {
    name: string;
    color: string;
    icon: string;
    description: string;
    lifecycleState: string;
};

interface OwnTagFormCreateProps {
    readonly mode: 'create';
    readonly onSubmit: (values: Omit<TagCreateInput, 'type' | 'ownerId'>) => void | Promise<void>;
    readonly isSubmitting: boolean;
    readonly defaultValues?: Partial<FormValues>;
}

interface OwnTagFormEditProps {
    readonly mode: 'edit';
    readonly onSubmit: (values: TagUpdateInput) => void | Promise<void>;
    readonly isSubmitting: boolean;
    readonly defaultValues?: Partial<FormValues>;
}

type OwnTagFormProps = OwnTagFormCreateProps | OwnTagFormEditProps;

/**
 * Shared form component for creating and editing own USER tags.
 *
 * Features:
 * - No slug field (USER tags don't have public URLs per D-002)
 * - Color picker rendered as color swatches in a Select dropdown
 * - Lifecycle state select (create defaults to ACTIVE)
 * - Optional icon and description fields
 *
 * Uses TanStack Form — admin convention.
 *
 * @see TagCreateInputSchema in @repo/schemas
 * @see D-002, SPEC-086 T-032
 */
export function OwnTagForm(props: OwnTagFormProps) {
    const isCreate = props.mode === 'create';

    const form = useForm<FormValues>({
        defaultValues: {
            name: props.defaultValues?.name ?? '',
            color: props.defaultValues?.color ?? '',
            icon: props.defaultValues?.icon ?? '',
            description: props.defaultValues?.description ?? '',
            lifecycleState: props.defaultValues?.lifecycleState ?? LifecycleStatusEnum.ACTIVE
        },
        onSubmit: async ({ value }) => {
            await (
                props.onSubmit as (
                    v: Omit<TagCreateInput, 'type' | 'ownerId'>
                ) => void | Promise<void>
            )({
                name: value.name,
                color: value.color as TagCreateInput['color'],
                icon: value.icon || undefined,
                description: value.description || undefined,
                lifecycleState: value.lifecycleState as TagCreateInput['lifecycleState']
            });
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
            className="space-y-5"
            noValidate
            aria-label={isCreate ? 'Crear tag personal' : 'Editar tag personal'}
        >
            {/* Name */}
            <form.Field name="name">
                {(field) => (
                    <div className="space-y-1.5">
                        <Label htmlFor="ot-name">
                            Nombre <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="ot-name"
                            placeholder="Ej: Revisar después, VIP, Urgente"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            aria-describedby="ot-name-hint"
                            maxLength={50}
                        />
                        <p
                            id="ot-name-hint"
                            className="text-muted-foreground text-xs"
                        >
                            Este tag es privado y solo vos podés verlo.
                        </p>
                    </div>
                )}
            </form.Field>

            {/* Color */}
            <div className="space-y-1.5">
                <Label htmlFor="ot-color">
                    Color <span className="text-destructive">*</span>
                </Label>
                <Select
                    value={colorValue}
                    onValueChange={(val) => form.setFieldValue('color', val)}
                >
                    <SelectTrigger id="ot-color">
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
                        <Label htmlFor="ot-icon">Icono (opcional)</Label>
                        <Input
                            id="ot-icon"
                            placeholder="Ej: star, bookmark, flag"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                        />
                    </div>
                )}
            </form.Field>

            {/* Description (optional) */}
            <form.Field name="description">
                {(field) => (
                    <div className="space-y-1.5">
                        <Label htmlFor="ot-description">Descripción (opcional)</Label>
                        <Textarea
                            id="ot-description"
                            placeholder="Para qué uso este tag..."
                            rows={2}
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                        />
                    </div>
                )}
            </form.Field>

            {/* Lifecycle state — only shown in edit mode */}
            {!isCreate && (
                <div className="space-y-1.5">
                    <Label htmlFor="ot-lifecycle">
                        Estado <span className="text-destructive">*</span>
                    </Label>
                    <Select
                        value={lifecycleValue}
                        onValueChange={(val) => form.setFieldValue('lifecycleState', val)}
                    >
                        <SelectTrigger id="ot-lifecycle">
                            <SelectValue placeholder="Seleccionar estado..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={LifecycleStatusEnum.ACTIVE}>Activo</SelectItem>
                            <SelectItem value={LifecycleStatusEnum.INACTIVE}>Inactivo</SelectItem>
                            <SelectItem value={LifecycleStatusEnum.ARCHIVED}>Archivado</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
                <Button
                    type="submit"
                    disabled={props.isSubmitting}
                    aria-busy={props.isSubmitting}
                >
                    {props.isSubmitting
                        ? 'Guardando...'
                        : isCreate
                          ? 'Crear tag'
                          : 'Guardar cambios'}
                </Button>
            </div>
        </form>
    );
}
