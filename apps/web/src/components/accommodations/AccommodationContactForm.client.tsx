'use client';

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
    );
}
