'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

interface ContactFormProps {
    apiBaseUrl: string;
    labels: {
        firstName: string;
        lastName: string;
        email: string;
        message: string;
        submit: string;
        placeholders: {
            firstName: string;
            lastName: string;
            email: string;
            message: string;
        };
    };
}

/**
 * ContactForm React island for submitting contact messages to the API.
 * Handles loading, success, and error states.
 */
export const ContactForm = ({ apiBaseUrl, labels }: ContactFormProps) => {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const form = e.currentTarget;
        const formData = new FormData(form);

        const body = {
            firstName: formData.get('firstName') as string,
            lastName: formData.get('lastName') as string,
            email: formData.get('email') as string,
            message: formData.get('message') as string,
            type: 'general' as const
        };

        try {
            const response = await fetch(`${apiBaseUrl}/api/v1/public/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error('Error al enviar el mensaje');
            }

            setSuccess(true);
            form.reset();
        } catch {
            setError('Hubo un problema al enviar el mensaje. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="rounded-lg bg-green-50 p-8 text-center dark:bg-green-900/20">
                <div className="mb-4 text-4xl">&#10003;</div>
                <h3 className="mb-2 font-semibold text-green-800 text-lg dark:text-green-200">
                    Mensaje enviado
                </h3>
                <p className="text-green-700 dark:text-green-300">
                    Gracias por contactarnos. Te responderemos a la brevedad.
                </p>
                <button
                    type="button"
                    onClick={() => setSuccess(false)}
                    className="mt-4 text-green-600 text-sm underline hover:no-underline dark:text-green-400"
                >
                    Enviar otro mensaje
                </button>
            </div>
        );
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-6"
        >
            {error && (
                <div className="rounded-md bg-red-50 p-4 text-red-800 text-sm dark:bg-red-900/20 dark:text-red-200">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                    <label
                        htmlFor="firstName"
                        className="mb-2 block font-medium text-gray-700 text-sm dark:text-gray-300"
                    >
                        {labels.firstName} *
                    </label>
                    <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        required
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        placeholder={labels.placeholders.firstName}
                    />
                </div>
                <div>
                    <label
                        htmlFor="lastName"
                        className="mb-2 block font-medium text-gray-700 text-sm dark:text-gray-300"
                    >
                        {labels.lastName} *
                    </label>
                    <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        required
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        placeholder={labels.placeholders.lastName}
                    />
                </div>
            </div>

            <div>
                <label
                    htmlFor="email"
                    className="mb-2 block font-medium text-gray-700 text-sm dark:text-gray-300"
                >
                    {labels.email} *
                </label>
                <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder={labels.placeholders.email}
                />
            </div>

            <div>
                <label
                    htmlFor="message"
                    className="mb-2 block font-medium text-gray-700 text-sm dark:text-gray-300"
                >
                    {labels.message} *
                </label>
                <textarea
                    id="message"
                    name="message"
                    rows={5}
                    required
                    minLength={10}
                    className="w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder={labels.placeholders.message}
                />
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {loading ? 'Enviando...' : labels.submit}
            </button>
        </form>
    );
};
