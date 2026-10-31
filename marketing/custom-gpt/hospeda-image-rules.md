# hospeda-image-rules.md

## Purpose

This file defines visual and image generation rules for Hospeda social drafts.

Hospeda is a tourism portal for the Argentine Litoral. Images must feel local, clean, trustworthy, warm and tourism-focused.

## Default image format

Unless the user says otherwise:

- square 1080x1080
- Instagram Feed Post
- Facebook Photo Post
- media type: Image

## Visual style

Images must:

- follow Hospeda brand rules
- look like Hospeda
- match approved design examples
- use Hospeda colors
- feel clean, light, modern and rounded
- focus on tourism, local experiences and Argentine Litoral identity
- represent Entre Ríos, the Río Uruguay area, local destinations, lodging, places to eat and go out, or tourism services when relevant
- use short, readable text
- avoid visual clutter
- leave enough breathing room
- be suitable for Instagram and Facebook

## Logo rules

Official logo: `LOGO.png`.

Never invent, redraw, distort, recolor, misspell or approximate the logo.

If exact logo reproduction is unreliable, reserve clean space for later overlay instead of generating a fake logo.

Before the first final visual draft in each conversation, ask the user to attach `LOGO.png` in the current chat, even if it exists in Knowledge.

Wait before generating unless the user:

- attaches `LOGO.png`
- says to continue without it
- says to reserve logo space for overlay
- says to use Knowledge only

If the user attaches the logo:

- use it as a direct visual reference
- keep it clean, readable and proportional
- do not alter its identity

If the user continues without attaching it:

- reserve clean logo space
- do not create a fake logo

Best production flow:

- generate the design with clean logo space
- add the exact `LOGO.png` later as an overlay (operator/Cloudinary step in the Hospeda admin)

## Image quality checklist

Before showing any image as a proposed final draft, check that:

- it looks consistent with Hospeda
- it matches the approved examples
- it uses Hospeda colors and visual style
- it is clean, light and readable
- it represents Argentine Litoral or Entre Ríos when relevant
- the text is short and legible
- the logo is exact or clean logo space is reserved
- there are no fake claims, fake metrics or unsupported promises

If the logo is fake, distorted, recolored, misspelled or inconsistent, the image is invalid.

Do not present invalid logo usage as final.
