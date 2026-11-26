import { RequiredMarker } from '@/components/ui/RequiredMarker';
import { TextField } from '@/components/ui/TextField';
import styles from './SignIn.module.css';

interface Props {
    readonly prefix: string;
    readonly label: string;
    readonly value: string;
    readonly onChange: (value: string) => void;
    readonly placeholder: string;
    readonly disabled: boolean;
    readonly error?: string;
}

/** Shared email control for sign-in, sign-up and password recovery. */
export function AuthEmailField({
    prefix,
    label,
    value,
    onChange,
    placeholder,
    disabled,
    error
}: Props) {
    return (
        <div className={styles.field}>
            <TextField
                prefix={prefix}
                name="email"
                controlName="email"
                type="email"
                label={
                    <>
                        {label}
                        <RequiredMarker />
                    </>
                }
                labelClassName={styles.label}
                className={styles.input}
                value={value}
                onChange={(event) => onChange(event.currentTarget.value)}
                autoComplete="email"
                required
                aria-required="true"
                disabled={disabled}
                placeholder={placeholder}
                error={error}
            />
        </div>
    );
}
