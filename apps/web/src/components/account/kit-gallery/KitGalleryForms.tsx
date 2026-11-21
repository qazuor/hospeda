/**
 * Gallery group: surfaces and form fields (HOS-2413 T-029).
 *
 * Dev-only fixture copy: exempt from i18n (see `Visual.tsx`).
 *
 * @module components/account/kit-gallery/KitGalleryForms
 */

import {
    Button,
    Checkbox,
    CheckboxGroup,
    Field,
    InputGroup,
    PhoneField,
    Radio,
    RadioGroup,
    Section,
    Select,
    Textarea,
    TextInput
} from '@/components/account/ui';
import styles from './KitGallery.module.css';
import type { GalleryGroupProps } from './KitGalleryActions';
import { Visual } from './Visual';

/**
 * Sections, fields, selects, textareas, checkboxes and radios.
 *
 * @param props - See {@link GalleryGroupProps}.
 * @returns The group.
 */
export function KitGalleryForms({ locale }: GalleryGroupProps) {
    return (
        <section className={styles.group}>
            <h2 className={styles.groupTitle}>Surfaces and fields</h2>
            <div className={styles.grid}>
                <Visual name="Section/default">
                    <div className={styles.stack}>
                        <Section
                            title="Datos del local"
                            description="Lo que ven los visitantes."
                            helpId="section:venue.datos"
                            footer={<Button>Guardar</Button>}
                        >
                            <p>Contenido de la sección.</p>
                        </Section>
                    </div>
                </Visual>
                <Visual name="Section/danger">
                    <div className={styles.stack}>
                        <Section
                            title="Zona de peligro"
                            variant="danger"
                            helpId="section:venue.peligro"
                        >
                            <p>Eliminar el local no se puede deshacer.</p>
                        </Section>
                    </div>
                </Visual>
                <Visual name="Section/flush">
                    <div className={styles.stack}>
                        <Section
                            title="Lista"
                            flush
                            headingLevel={3}
                            helpId="section:venue.lista"
                        >
                            <p>Sin relleno en el cuerpo.</p>
                        </Section>
                    </div>
                </Visual>
                <Visual name="Field/default">
                    <div className={styles.stack}>
                        <Field
                            label="Nombre"
                            locale={locale}
                            hint="Como figura en tu DNI."
                        >
                            <TextInput placeholder="Ej: La Casona" />
                        </Field>
                    </div>
                </Visual>
                <Visual name="Field/required">
                    <div className={styles.stack}>
                        <Field
                            label="Email"
                            locale={locale}
                            required
                        >
                            <TextInput type="email" />
                        </Field>
                    </div>
                </Visual>
                <Visual name="Field/optional">
                    <div className={styles.stack}>
                        <Field
                            label="Sitio web"
                            locale={locale}
                            optional
                        >
                            <TextInput />
                        </Field>
                    </div>
                </Visual>
                <Visual name="Field/error">
                    <div className={styles.stack}>
                        <Field
                            label="Nombre"
                            locale={locale}
                            required
                            error="Falta el nombre"
                        >
                            <TextInput />
                        </Field>
                    </div>
                </Visual>
                <Visual name="Field/disabled">
                    <div className={styles.stack}>
                        <Field
                            label="Nombre"
                            locale={locale}
                        >
                            <TextInput
                                disabled
                                defaultValue="No editable"
                            />
                        </Field>
                    </div>
                </Visual>
                <Visual name="InputGroup/default">
                    <div className={styles.stack}>
                        <Field
                            label="Precio"
                            locale={locale}
                        >
                            <InputGroup
                                prefix="$"
                                suffix="ARS"
                                inputMode="numeric"
                            />
                        </Field>
                    </div>
                </Visual>
                <Visual name="PhoneField/default">
                    <div className={styles.stack}>
                        <Field
                            label="Teléfono"
                            locale={locale}
                        >
                            <PhoneField />
                        </Field>
                    </div>
                </Visual>
                <Visual name="Select/default">
                    <div className={styles.stack}>
                        <Field
                            label="Provincia"
                            locale={locale}
                        >
                            <Select defaultValue="er">
                                <option value="er">Entre Ríos</option>
                                <option value="co">Corrientes</option>
                            </Select>
                        </Field>
                    </div>
                </Visual>
                <Visual name="Textarea/counter">
                    <div className={styles.stack}>
                        <Field
                            label="Descripción"
                            locale={locale}
                        >
                            <Textarea
                                limit={40}
                                locale={locale}
                                defaultValue="Un lugar tranquilo frente al río."
                            />
                        </Field>
                    </div>
                </Visual>
                <Visual name="Checkbox/states">
                    <CheckboxGroup
                        legend="Servicios"
                        locale={locale}
                        hint="Elegí los que ofrecés."
                    >
                        <Checkbox
                            label="Wifi"
                            defaultChecked
                        />
                        <Checkbox
                            label="Pileta"
                            indeterminate
                        />
                        <Checkbox
                            label="Cochera"
                            disabled
                        />
                    </CheckboxGroup>
                </Visual>
                <Visual name="Radio/states">
                    <RadioGroup
                        legend="Plan de pago"
                        locale={locale}
                        name="gallery-plan"
                        error="Elegí una opción"
                    >
                        <Radio
                            value="mensual"
                            label="Mensual"
                            description="Se cobra cada mes."
                        />
                        <Radio
                            value="anual"
                            label="Anual"
                            defaultChecked
                        />
                    </RadioGroup>
                </Visual>
                <Visual name="Radio/optionCard">
                    <RadioGroup
                        legend="Cómo querés cobrar"
                        locale={locale}
                        name="gallery-card"
                    >
                        <Radio
                            variant="card"
                            value="a"
                            label="Transferencia"
                            defaultChecked
                        />
                        <Radio
                            variant="card"
                            value="b"
                            label="Tarjeta"
                        />
                    </RadioGroup>
                </Visual>
            </div>
        </section>
    );
}
