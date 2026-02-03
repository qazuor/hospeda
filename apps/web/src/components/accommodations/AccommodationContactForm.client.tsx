'use client';

import { UpgradeFallback } from '@/components/billing';
import { EntitlementGate } from '@qazuor/qzpay-react';
import { useState } from 'react';

interface AccommodationContactFormProps {
    accommodationId: string;
}

export default function AccommodationContactForm({
    accommodationId
}: AccommodationContactFormProps) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Simulación: reemplazar por fetch real a `/api/contact`
            alert(`contact to: ${accommodationId} \n\n${name} \n${email} \n${message}`);
            await new Promise((r) => setTimeout(r, 800));
            setSent(true);
        } catch (_err) {
            setError('Hubo un problema al enviar el mensaje.');
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <div className="rounded-md bg-green-50 p-md text-green-800">
                ✅ Tu mensaje fue enviado con éxito. ¡Gracias!
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <form
                onSubmit={handleSubmit}
                className="space-y-4"
            >
                {error && <p className="text-red-500 text-sm">{error}</p>}

                <div>
                    <label
                        className="mb-1 block font-medium"
                        htmlFor="name"
                    >
                        Nombre
                    </label>
                    <input
                        id="name"
                        type="text"
                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                </div>

                <div>
                    <label
                        className="mb-1 block font-medium"
                        htmlFor="email"
                    >
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>

                <div>
                    <label
                        className="mb-1 block font-medium"
                        htmlFor="message"
                    >
                        Mensaje
                    </label>
                    <textarea
                        id="message"
                        rows={4}
                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required
                    />
                </div>

                <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading}
                >
                    {loading ? 'Enviando...' : 'Enviar'}
                </button>
            </form>

            {/* WhatsApp Direct Contact Section - Gated Feature */}
            <div className="border-gray-200 border-t pt-6">
                <EntitlementGate
                    entitlementKey="contact-whatsapp-direct"
                    fallback={
                        <UpgradeFallback
                            featureName="Contacto directo por WhatsApp"
                            requiredPlan="Premium"
                            upgradeLink="/precios/turistas"
                            description="Conectá directamente con el anfitrión para obtener respuestas inmediatas a tus consultas."
                        />
                    }
                >
                    <div className="rounded-lg bg-green-50 p-4">
                        <div className="mb-3 flex items-center gap-3">
                            <svg
                                className="h-6 w-6 text-green-600"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            <h3 className="font-semibold text-gray-900 text-lg">
                                ¿Preferís WhatsApp?
                            </h3>
                        </div>
                        <p className="mb-4 text-gray-700">
                            Contactá directamente al anfitrión por WhatsApp para una respuesta más
                            rápida
                        </p>
                        <a
                            href={`https://wa.me/5493442000000?text=Hola, estoy interesado en el alojamiento (ID: ${accommodationId})`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700"
                        >
                            <svg
                                className="h-5 w-5"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            Abrir WhatsApp
                        </a>
                    </div>
                </EntitlementGate>
            </div>
        </div>
    );
}
