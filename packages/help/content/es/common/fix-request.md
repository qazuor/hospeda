---
id: fix-request
title: "Me pidieron un arreglo o moderaron mi publicación"
summary: "Qué significan un pedido de arreglo y una moderación, y qué podés hacer en cada caso."
audiences:
  - host
  - venue
  - experience
verticals:
  - accommodation
  - venue
  - experience
keywords:
  - "arreglo"
  - "pedido de arreglo"
  - "corregir"
  - "ya lo corregi"
  - "moderada"
  - "moderacion"
  - "moderaron"
  - "no se ve"
  - "rechazada"
destinations:
  - kind: ownerListings
    vertical: accommodation
    label: "Mis alojamientos"
  - kind: ownerListings
    vertical: venue
    label: "Mi comercio"
  - kind: ownerListings
    vertical: experience
    label: "Mi comercio"
  - kind: contact
public: false
related:
  - publish-requirements
  - delete-listing
  - pause-resume
covers:
  - "page:mi-cuenta/propiedades"
  - "page:mi-cuenta/comercio"
  - "enum:PublicationStatus.MODERATED"
  - "file:apps/web/src/lib/listing/listing-notices.ts"
entryFor: []
reviewedAt: "2026-11-24"
---

## Qué podés hacer

Ver el aviso de arreglo o de moderación en {{link:list:accommodation|Mis alojamientos}}, {{link:list:venue|Mis locales}} o {{link:list:experience|Mis experiencias}}, corregir desde el editor y avisar a Hospeda.

## Cómo se hace

1. Si Hospeda te pidió un arreglo, vas a ver el aviso «Te pidieron un arreglo en esta ficha» en «Mis alojamientos» o «Mi comercio» y en el editor de esa publicación.
2. El aviso puede traer una fecha sugerida para corregirlo. Tu publicación sigue a la vista mientras tanto.
3. Corregí lo que se pidió desde el editor.
4. Tocá «Ya lo corregí» para avisar a Hospeda. Eso no cierra el pedido ni publica nada: lo revisa el equipo.
5. Si la publicación quedó moderada («Ficha moderada»), no se ve en el sitio hasta que un administrador levante la moderación. Mientras tanto podés verla, exportarla y editarla, pero no publicarla. En alojamientos también podés borrarla; en comercios y experiencias el portal no tiene el botón «Eliminar».

## Qué esperar

- Con un pedido de arreglo la publicación sigue a la vista mientras corregís.
- «Ya lo corregí» avisa al equipo; el pedido lo cierra Hospeda.
- Una publicación moderada se puede ver, exportar y editar, pero no publicar.

## Qué NO esperar

- Levantar la moderación vos mismo.
- Que «Ya lo corregí» publique la ficha o cierre el pedido.

## Problemas comunes

### Corregí y el aviso sigue {#aviso-sigue}

El pedido queda abierto hasta que Hospeda lo revise. Mientras tanto, revisá {{article:publish-requirements|los requisitos para publicar}}.

### Prefiero borrar la publicación moderada {#borrar}

En alojamientos podés hacerlo: mirá {{article:delete-listing|cómo eliminarla}}.
