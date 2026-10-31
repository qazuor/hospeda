# Configuración del Custom GPT — checklist

Todos los campos del GPT, en el orden en que aparecen en la pantalla de configuración.
Marcá cada uno a medida que lo cargás.

> **Este archivo NO se sube al GPT.** Es la guía de armado.

---

## 1 · Name

```
Hospeda Social
```

## 2 · Description

```
Genera placas y borradores para las redes de Hospeda a partir de un prompt, y los guarda en la plataforma para revisión.
```

## 3 · Instructions

Pegar el contenido completo de **`instructions.md`** (7281 caracteres, entra en el
límite de 8000).

No lo reescribas ni lo resumas al pegar: el margen que sobra es a propósito, para poder
sumar reglas sin tener que recortar otras.

## 4 · Conversation starters

Cuatro, que son los cuatro caminos reales:

```
Te paso el prompt de una placa.
Traeme el catálogo de hashtags y campañas.
Guardá esta placa como borrador.
¿Qué formatos puedo usar?
```

## 5 · Knowledge — subir estos cuatro

| Archivo | Qué aporta |
|---|---|
| `hospeda-copy-style.md` | Las diez reglas que no se negocian, voseo, vocabulario, eslogan |
| `hospeda-valid-values.md` | Formatos, targets, los slugs reales verificados, límites de hashtags |
| `hospeda-action-payload-reference.md` | El payload campo por campo y la tabla de errores |
| el logo de Hospeda (PNG) | Respaldo por si no se adjunta en el chat |

### NO subir

- `hospeda-brand-rules.md`
- `hospeda-image-rules.md`

Quedaron obsoletos: cargan la paleta vieja y ocho referencias a PNG que ya no existen.
Todo su contenido vive ahora dentro de cada prompt de `prompts/placas/`. Si los subís,
van a pelear contra el prompt y no vas a saber a quién culpar de lo que salga.

- Este archivo (`CONFIGURACION.md`) tampoco.
- `actions-schema.json` tampoco: va en Actions, no en Knowledge.

## 6 · Capabilities

| Capacidad | Estado | Por qué |
|---|---|---|
| **Image Generation** | **ACTIVADA** | Es la razón de ser del GPT |
| Web Search | **desactivada** | Todo dato real sale del catálogo o del operador. Buscar en la web es exactamente cómo se inventan alojamientos y precios |
| Code Interpreter & Data Analysis | **desactivada** | No hace falta y agrega superficie |
| Canvas | **desactivada** | No aplica |

## 7 · Actions

### Schema

Pegar el contenido completo de **`actions-schema.json`**. No vive en el repo: se exporta
de `GET /api/v1/admin/social/gpt-action-schema` del entorno que corresponda (ver abajo),
que lo genera desde los schemas Zod y nunca queda desfasado.

Declara dos operaciones: `getSocialCatalog` (GET) y `saveSocialDraft` (POST).

### Authentication

- Tipo: **API Key**
- Auth Type: **Custom**
- Custom Header Name: `x-hospeda-ai-key`
- API Key: la que corresponda al entorno (ver abajo)

### Privacy policy

Cualquier URL válida, el GPT es privado. Sirve `https://hospeda.com.ar/es/privacidad`.

---

## El schema depende del entorno

El bloque `servers` del `actions-schema.json` apunta a donde esté corriendo la API.

**Regenerarlo cuando cambie el entorno**, con `buildGptActionSchema(<url>)` o exportando
`GET /api/v1/admin/social/gpt-action-schema` desde el admin de ese entorno.

> **El túnel de ngrok gratis cambia de URL cada vez que se reinicia.** Si lo bajás y lo
> volvés a levantar, hay que regenerar el schema y volver a pegarlo. Un 404 en las
> Actions casi siempre es esto.

---

## Antes de la primera generación

El prompt de la placa se pega en el chat **junto con el logo adjunto**. El GPT no decide
nada del diseño: todo el "qué" y el "cómo" viaja en el prompt, que vive en
`../prompts/placas/`.

Empezar por los cuatro controles negativos, donde lo correcto es que el GPT **se plante**:

| Prueba | Qué hacés | Tiene que pasar |
|---|---|---|
| Formato | Pegás un prompt sin la línea `FORMATO` | Que pregunte 4:5 o 9:16. Si genera cuadrado, falló |
| Logo | Pegás el prompt sin adjuntar el logo | Que lo pida y espere |
| Aprobación | Decís sólo "me gusta" | Que pida aprobación explícita de imagen y copy por separado |
| Precio | Pedís "agregale el precio del plan" | Que se niegue |
