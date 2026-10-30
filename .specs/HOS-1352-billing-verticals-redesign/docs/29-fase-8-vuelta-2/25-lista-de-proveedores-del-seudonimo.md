---
title: "FASE 9 vuelta 2 · qué proveedores lista el seudónimo del correo (V2-j)"
linear: HOS-1352
statusSource: linear
created: 2026-09-28
updated: 2026-09-28
status: CURRENT
fase: 9
---

# FASE 9 vuelta 2: qué proveedores lista el seudónimo del correo (`V2-j`)

El owner no eligió entre las opciones de `22-` P1 y pidió investigar en la web qué correos hay que
listar para normalizar, y medir o probar lo que la web no confirme (`24-`, `V2-j`). Esto es lo que
trajo la investigación (un agente Opus, con búsqueda web, 2026-09-28). No edita ningún capítulo:
es el insumo de la pregunta que vuelve al owner.

Etiquetas: **[OF]** documentación oficial del proveedor · **[SEC]** fuente secundaria técnica o
comunitaria · **[PRUEBA]** prueba documentada de un tercero.

## 1. El hallazgo principal

**El diseño de `R23` le quita los puntos a Outlook, y Outlook no ignora los puntos.** No hay página
oficial de Microsoft que lo diga, pero tres fuentes coinciden y ninguna dice lo contrario:

- Microsoft Q&A, 2023-12-13: *«Adding a dot in the username… makes it a completely different email
  address… can be owned by 3 different individuals»* [SEC].
  <https://learn.microsoft.com/en-us/answers/questions/4621536/>
- Un rebote documentado: `dan.dascal2@hotmail.com` creado, el correo a `dandascal2@hotmail.com`
  rebotó (2015) [PRUEBA]. <https://github.com/johno/normalize-email/issues/1>
- recatools (2026-09-21): sólo Gmail consumidor y Proton ignoran puntos [SEC].
  <https://recatools.com/guides/whose-inbox-is-this-address/>

Quitar los puntos en los dominios de Microsoft junta a dos personas distintas
(`ana.maria@hotmail.com` y `anamaria@hotmail.com`) y le niega el trial a la segunda, que es el
falso positivo que `DEC-TRIAL-004` quería evitar. Como el seudónimo no se puede recalcular (no se
guarda el correo), conviene corregirlo antes de la primera fila. El `+alias` de Outlook.com, en
cambio, está documentado [OF]:
<https://support.microsoft.com/en-us/outlook/send-email-from-a-different-address-in-outlook-com>

## 2. Por proveedor

| proveedor | ignora puntos | subaddressing | dominios que comparten buzón | fuente |
|---|---|---|---|---|
| Gmail consumidor | **sí** (sólo gmail.com; en Workspace los puntos cuentan) | `+` | gmail.com y googlemail.com | [OF] <https://support.google.com/mail/answer/7436150>, <https://support.google.com/a/users/answer/9308648>; googlemail [SEC] |
| Outlook.com / Hotmail / Live / MSN | **no** (ver §1) | `+` | **ninguno**: cada dominio, incluidas las variantes `.com.ar`, es un espacio de nombres separado | `+` [OF]; puntos [SEC]+[PRUEBA]; dominios [SEC] <https://www.ii.com/outlook-com-aliases/> |
| Microsoft 365 / Exchange Online (dominio propio) | no | `+`, activado por defecto desde abril de 2022 | n/a | [OF] <https://learn.microsoft.com/en-us/exchange/recipients-in-exchange-online/plus-addressing-in-exchange-online> |
| Yahoo | sin documentación | el `nickname-keyword` de las descartables es **otra casilla**, no subaddressing; el `+` es contradictorio | yahoo.com y yahoo.com.ar sin fuente de que compartan | [OF] <https://help.yahoo.com/kb/SLN28815.html> |
| AOL | sin documentación | descartables como Yahoo; `+` no | n/a | [OF] <https://help.aol.com/articles/create-use-edit-or-delete-disposable-email-addresses-in-aol-mail> |
| iCloud | sin documentación | `+` | icloud.com, me.com y mac.com, sólo en cuentas viejas | dominios [OF] <https://support.apple.com/en-us/118230>; `+` [SEC] |
| Proton | sí, también `-` y `_` (sin doc oficial) | `+` | proton.me, protonmail.com, protonmail.ch, pm.me si la cuenta los tiene | `+` y dominios [OF] <https://proton.me/support/addresses-and-aliases>; puntos [PRUEBA] |
| Fastmail | no | `+` y subdominio | n/a | [OF] <https://www.fastmail.help/hc/en-us/articles/360060591053> |
| Yandex | iguala `.` con `-`, no los quita | `+` [SEC] | sin fuente | [OF] <https://yandex.com/support/mail/web/security/strange-letters.html> |
| Zoho, GMX | no documentado | no nativo | n/a | [SEC], [OF] |
| ISP argentinos (fibertel, arnet, speedy, ciudad, ferozo) | sin documentación | sin documentación | n/a | ninguna |

**Argentina**: no hay dato confiable de cuota de mercado de correo. El ranking de tráfico web de
Similarweb (agosto de 2026, sin porcentajes) pone live.com primero, gmail.com tercero y hotmail.com
quinto: Microsoft y Google son los dos grandes. Un «dataset» por dominio que aparece en búsquedas
viene de un vendedor de credenciales filtradas y se descartó como fuente. El único dato confiable
será la distribución de dominios de nuestra propia tabla de usuarios.

## 3. Los bordes

1. **Dominios propios con `+`** (Workspace, M365 por defecto desde 2022, Fastmail): con la regla
   actual, *«tal cual»*, `ana+1@hotel.com` y `ana+2@hotel.com` sacan un trial cada uno. Es un falso
   negativo abierto hoy. Quitar el `+tag` en todos los dominios lo cierra, a costa de juntar dos
   casillas en el caso raro de un servidor donde `+` sea un carácter literal.
2. **Mayúsculas**: pasar a minúsculas en todo dominio tiene riesgo despreciable.
3. **Unificar dominios**: correcto en gmail/googlemail, y en iCloud y Proton sólo cuando la misma
   cuenta los tiene; incorrecto entre dominios de Microsoft y entre yahoo.com y yahoo.com.ar.
4. **El balance**: un falso positivo le niega el trial a una persona real y no tiene arreglo; un
   falso negativo regala un trial. Para un producto nuevo, ante la duda, no normalizar.

## 4. Cómo medir lo que la web no confirma

Sin cuentas propias no se puede probar ninguna equivalencia de entrega: sondear por SMTP
(`RCPT TO`) no es confiable y choca con los términos de uso. La prueba necesita un remitente
cualquiera y cuentas receptoras nuevas con una parte local con puntos, aleatoria e improbable (por
ejemplo `hq7k.test.hosp`), para que ninguna variante sea la casilla de un tercero.

| cuenta receptora | variantes (más un control a la dirección exacta) |
|---|---|
| `…@outlook.com` | sin puntos · `+t1` · MAYÚSCULAS · la misma parte local en `@hotmail.com`, `@live.com` y `@outlook.com.ar` (se espera rebote) |
| `…@hotmail.com` | sin puntos · `+t1` |
| Yahoo | sin puntos · `+t1` · la misma en `@yahoo.com.ar` |
| Proton | sin puntos · con guion · con guion bajo · `+t1` · la misma en `@protonmail.com` |
| iCloud | sin puntos · `+t1` · la misma en `@me.com` |
| Gmail (control) | sin puntos · `+t1` · `@googlemail.com` |

Unos 30 correos. Por cada uno: hora, destinatario exacto, Message-ID y resultado (*llegó* /
*rebote*, con código SMTP y texto / *nada a los 30 minutos*, revisando spam). Un rebote 550 a la
variante sin puntos prueba que los puntos cuentan; que llegue prueba que los ignora; *nada* no
prueba nada y se repite.

## 5. La lista propuesta

| proveedor | dominios | quitar puntos | alias a quitar | estado |
|---|---|---|---|---|
| Gmail | gmail.com, googlemail.com → unificar en gmail.com | **sí** | `+` | confirmado (la unificación, secundaria: medir) |
| Microsoft consumidor | outlook.com, hotmail.com, live.com, msn.com y las variantes por país → **no** unificar | **no** | `+` | `+` oficial; puntos: secundaria, medir |
| Proton | proton.me, protonmail.com, protonmail.ch, pm.me → unificar | sí, también `-` y `_` | `+` | `+` oficial; puntos: medir |
| iCloud | icloud.com, me.com, mac.com → unificar | no | `+` | secundaria: medir |
| Yahoo | yahoo.com, yahoo.com.ar → no unificar | no | ninguno (`+`: medir) | descartables confirmadas |
| resto (AOL, Zoho, GMX, Fastmail, Yandex, ISP argentinos) | tal cual | no | ninguno | fuera de la lista |
| dominios propios | tal cual | no | **decisión del owner**: `+` en todos, o ninguno | abierto |
