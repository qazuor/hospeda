/**
 * Masked social credential card list (HOS-64 G-4, T-029).
 *
 * Renders one card per credential. Only masked fields are ever passed in —
 * `SocialCredentialMasked` has no ciphertext/iv/authTag/plaintext fields at
 * the type level, so this component structurally cannot leak them.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    type SocialCredentialMasked,
    getSocialCredentialKeyLabel
} from '@/features/social-credentials';
import { RotateCredentialDialog } from './RotateCredentialDialog';

/** A single masked social credential card. */
function CredentialCard({ credential }: { readonly credential: SocialCredentialMasked }) {
    return (
        <Card data-testid={`social-credential-card-${credential.key}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                    <CardTitle className="text-lg">
                        {getSocialCredentialKeyLabel(credential.key)}
                    </CardTitle>
                    <CardDescription>{credential.label ?? 'Sin etiqueta'}</CardDescription>
                </div>
                <RotateCredentialDialog
                    credentialKey={credential.key}
                    currentLabel={credential.label}
                />
            </CardHeader>
            <CardContent>
                <dl className="grid gap-4 text-sm md:grid-cols-3">
                    <div>
                        <dt className="text-muted-foreground">Clave</dt>
                        <dd className="font-mono text-xs">{credential.key}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Creado</dt>
                        <dd>{new Date(credential.createdAt).toLocaleDateString('es-AR')}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Actualizado</dt>
                        <dd>{new Date(credential.updatedAt).toLocaleDateString('es-AR')}</dd>
                    </div>
                </dl>
            </CardContent>
        </Card>
    );
}

/** Card list of masked social credentials. */
export function CredentialsList({
    credentials
}: {
    readonly credentials: readonly SocialCredentialMasked[];
}) {
    return (
        <div className="space-y-4">
            {credentials.map((credential) => (
                <CredentialCard
                    key={credential.id}
                    credential={credential}
                />
            ))}
        </div>
    );
}
