# V1 · Qué grabar y qué fijos hacen falta

V1 se arma con una sola grabación y una sola pantalla: el importador de fichas. Los
tres tiempos que necesita —vacío, en curso, completo— salen todos de la misma toma.
Estándar general de grabación y fijos: [`../grabaciones.md`](../grabaciones.md).

## Grabaciones que usa este video

| # | Grabar | Tipo | Dónde entra |
|:-:|---|---|---|
| A10 | Importar ficha: pegar el link, esperar, la ficha aparece completa | acción | T1 (fijo), T2 (fijo), T3 (grabación completa), T4 (fijo) |

⚠️ A10 no tiene un flujo cubierto por el resto del catálogo (P1-P13/A1-A9/E1-E3): se
graba aparte, siguiendo los cuatro pasos del "Material a grabar" en
[`montaje.md`](montaje.md#material-a-grabar-t3) — aviso de otra plataforma, pegar el
link en Hospeda, importar, y scroll por la ficha ya cargada.

## Fijos para las tiradas

El fijo es el primer frame de lo que ese recuadro va a mostrar, exportado a
1080 × 2340 (ratio 0,4615) porque en las tres tomas va dentro del marco del teléfono.

| Toma | Fijo | Sale de | Qué se ve |
|---|---|---|---|
| T1 | `capturas/a10-vacio.png` | primer frame de A10 | el importador con el campo de link vacío |
| T2 | `capturas/a10-vacio.png` | mismo frame que T1 | el importador vacío; tiene que calzar con el primer frame de T3, porque el corte T2→T3 es una entrada directa a la pantalla |
| T4 | `capturas/a10-ficha.png` | frame de A10 donde la ficha ya está completa | la ficha ya cargada, con fotos y título |

## Qué pantalla se ve en cada toma

| Toma | Qué pantalla | De dónde sale | ¿Se lee? |
|---|---|---|---|
| T1 | el importador vacío, celular al pecho, plano medio | fijo `a10-vacio.png` | No hace falta — es fastidio, no lectura |
| T2 | el importador vacío, celular llegando a primer plano | fijo `a10-vacio.png` | Sí, al llegar grande — es la que empalma con T3 |
| T3 | la importación completa: pegar el link, cargar, la ficha aparece | grabación real, pantalla completa | Sí |
| T4 | la ficha ya publicada, celular en alto, plano entero | fijo `a10-ficha.png` | No, es el beat de cierre — alcanza con reconocer el color y el logo |
