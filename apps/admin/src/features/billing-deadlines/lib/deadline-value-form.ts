export type DeadlineFormField = {
    readonly name: string;
    readonly kind: 'number' | 'list';
    readonly text: string;
};

/** Converts a published deadline value to editable scalar fields. */
export function toFormFields({ value }: { readonly value: unknown }): DeadlineFormField[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    return Object.entries(value).map(([name, field]) => ({
        name,
        kind: Array.isArray(field) ? 'list' : 'number',
        text: Array.isArray(field) ? field.join(', ') : String(field)
    }));
}

/** Converts editable scalar fields to a deadline value for schema validation. */
export function fromFormFields({
    fields
}: {
    readonly fields: readonly DeadlineFormField[];
}): Record<string, unknown> {
    return Object.fromEntries(
        fields.map(({ name, kind, text }) => [
            name,
            kind === 'list' ? text.split(',').map((item) => Number(item.trim())) : Number(text)
        ])
    );
}
