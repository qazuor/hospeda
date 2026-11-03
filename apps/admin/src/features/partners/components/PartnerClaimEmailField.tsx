/** Props for the direct Partner claim email control. */
export interface PartnerClaimEmailFieldProps {
    readonly value: string;
    readonly onBlur: () => void;
    readonly onChange: (value: string) => void;
    readonly error?: string;
    readonly disabled: boolean;
}

/** Renders the required, non-persisted recipient address for the claim notice. */
export function PartnerClaimEmailField({
    value,
    onBlur,
    onChange,
    error,
    disabled
}: PartnerClaimEmailFieldProps) {
    return (
        <div className="space-y-1">
            <label
                htmlFor="partner-claim-email"
                className="block font-medium text-foreground text-sm"
            >
                Correo para el aviso de reclamo<span className="ml-1 text-destructive">*</span>
            </label>
            <input
                id="partner-claim-email"
                name="claimEmail"
                type="email"
                required
                value={value}
                onBlur={onBlur}
                onChange={(event) => onChange(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disabled}
                aria-required="true"
                aria-invalid={Boolean(error)}
                aria-describedby="partner-claim-email-help"
            />
            <p
                id="partner-claim-email-help"
                className="text-muted-foreground text-xs"
            >
                Le llega el link para reclamar el Partner. No se guarda.
            </p>
            {error && <p className="text-destructive text-xs">{error}</p>}
        </div>
    );
}
