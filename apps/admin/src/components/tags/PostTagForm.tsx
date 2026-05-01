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
import { CreatePostTagSchema, LifecycleStatusEnum, TagColorEnum } from '@repo/schemas';
import type { CreatePostTagInput, UpdatePostTagInput } from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { useEffect } from 'react';
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
    { value: LifecycleStatusEnum.DRAFT, label: 'Borrador' },
    { value: LifecycleStatusEnum.ACTIVE, label: 'Activo' },
    { value: LifecycleStatusEnum.INACTIVE, label: 'Inactivo' },
    { value: LifecycleStatusEnum.ARCHIVED, label: 'Archivado' }
] as const;

interface PostTagFormCreateProps {
    readonly mode: 'create';
    readonly onSubmit: (values: CreatePostTagInput) => void | Promise<void>;
    readonly isSubmitting: boolean;
    readonly defaultValues?: Partial<CreatePostTagInput>;
}

interface PostTagFormEditProps {
    readonly mode: 'edit';
    readonly onSubmit: (values: UpdatePostTagInput) => void | Promise<void>;
    readonly isSubmitting: boolean;
    readonly defaultValues?: Partial<UpdatePostTagInput>;
}

type PostTagFormProps = PostTagFormCreateProps | PostTagFormEditProps;

/** Internal form values type. */
type FormValues = {
    name: string;
    slug: string;
    color: string;
    icon: string;
    description: string;
    lifecycleState: string;
};

/**
 * Converts a name string to a URL-safe slug (kebab-case lowercase).
 * Strips diacritics, replaces spaces and special chars with hyphens,
 * and collapses consecutive hyphens.
 *
 * @param name - Raw name string to convert
 * @returns Lowercase URL-safe slug
 */
export function nameToSlug(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/\u0300-\u036f/gu, '') // remove combining diacritics after NFD
        .replace(/[^a-z0-9\s-]/g, '') // keep alphanumeric, space, hyphen
        .trim()
        .replace(/\s+/g, '-') // spaces to hyphens
        .replace(/-{2,}/g, '-'); // collapse multiple hyphens
}

/**
 * Shared form component for creating and editing PostTags.
 *
 * Features:
 * - Slug auto-generation from name on keystroke (create mode only)
 * - Client-side Zod validation on submit via TanStack Form
 * - Color picker rendered as color swatches in a Select dropdown
 * - Lifecycle state select (create defaults to ACTIVE)
 *
 * Uses TanStack Form (`@tanstack/react-form`) — admin convention.
 *
 * @see CreatePostTagSchema, UpdatePostTagSchema in @repo/schemas
 * @see SPEC-086 Phase 7 / T-029
 */
export function PostTagForm(props: PostTagFormProps) {
    const isCreate = props.mode === 'create';

    const form = useForm<FormValues>({
        defaultValues: {
            name: props.defaultValues?.name ?? '',
            slug: props.defaultValues?.slug ?? '',
            color: props.defaultValues?.color ?? '',
            icon: props.defaultValues?.icon ?? '',
            description: props.defaultValues?.description ?? '',
            lifecycleState: props.defaultValues?.lifecycleState ?? LifecycleStatusEnum.ACTIVE
        },
        onSubmit: async ({ value }) => {
            const parsed = CreatePostTagSchema.safeParse(value);
            if (!parsed.success) return;
            await (props.onSubmit as (v: CreatePostTagInput) => void | Promise<void>)(parsed.data);
        }
    });

    // Read name value for slug auto-generation
    const nameValue = form.state.values.name;
    const colorValue = form.state.values.color;
    const lifecycleValue = form.state.values.lifecycleState;

    // Auto-generate slug from name in create mode only.
    useEffect(() => {
        if (!isCreate) return;
        form.setFieldValue('slug', nameToSlug(nameValue));
    }, [nameValue, isCreate, form]);

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit();
            }}
            className="space-y-6"
            noValidate
            aria-label={isCreate ? 'Crear PostTag' : 'Editar PostTag'}
        >
            {/* Name */}
            <form.Field name="name">
                {(field) => (
                    <div className="space-y-1.5">
                        <Label htmlFor="pt-name">
                            Nombre <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="pt-name"
                            placeholder="Ej: Gastronomía, Trekking, Historia"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            aria-describedby="pt-name-error"
                        />
                    </div>
                )}
            </form.Field>

            {/* Slug */}
            <form.Field name="slug">
                {(field) => (
                    <div className="space-y-1.5">
                        <Label htmlFor="pt-slug">
                            URL amigable (slug) <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="pt-slug"
                            placeholder="Ej: gastronomia, guia-de-viaje"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            aria-describedby="pt-slug-hint"
                        />
                        <p
                            id="pt-slug-hint"
                            className="text-muted-foreground text-xs"
                        >
                            Solo minúsculas, números y guiones. Aparece en URLs como{' '}
                            <code>/blog?tag=gastronomia</code>.
                        </p>
                    </div>
                )}
            </form.Field>

            {/* Color */}
            <div className="space-y-1.5">
                <Label htmlFor="pt-color">
                    Color <span className="text-destructive">*</span>
                </Label>
                <Select
                    value={colorValue}
                    onValueChange={(val) => form.setFieldValue('color', val)}
                >
                    <SelectTrigger id="pt-color">
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
                        <Label htmlFor="pt-icon">Icono (opcional)</Label>
                        <Input
                            id="pt-icon"
                            placeholder="Ej: utensils, mountain, book"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            aria-describedby="pt-icon-hint"
                        />
                        <p
                            id="pt-icon-hint"
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
                        <Label htmlFor="pt-description">Descripción (opcional)</Label>
                        <Textarea
                            id="pt-description"
                            placeholder="Descripción breve del tema de esta etiqueta..."
                            rows={3}
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            aria-describedby="pt-description-hint"
                        />
                        <p
                            id="pt-description-hint"
                            className="text-muted-foreground text-xs"
                        >
                            Uso interno. No se muestra públicamente.
                        </p>
                    </div>
                )}
            </form.Field>

            {/* Lifecycle state */}
            <div className="space-y-1.5">
                <Label htmlFor="pt-lifecycle">
                    Estado <span className="text-destructive">*</span>
                </Label>
                <Select
                    value={lifecycleValue}
                    onValueChange={(val) => form.setFieldValue('lifecycleState', val)}
                >
                    <SelectTrigger id="pt-lifecycle">
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
                          ? 'Crear PostTag'
                          : 'Guardar cambios'}
                </Button>
            </div>
        </form>
    );
}
