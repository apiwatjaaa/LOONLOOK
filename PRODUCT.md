# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + TypeScript + Tailwind CSS v4. MediaPipe `@mediapipe/tasks-vision` (PoseLandmarker) for body tracking. Zustand for cross-page state (not yet wired between pages). React Router. No backend — everything runs client-side. Chosen before this init round; recorded here for continuity.

## Users

The team of students who built this presents and demos it themselves to competition judges at a booth. There is no separate end-user audience to design for beyond the judges watching the demo live.

## Product Purpose

A web app where the user designs an outfit (garment style + fabric pattern + color), then opens their camera to try it on in real time using AR body tracking — no sewing, no backend. Designed outfits can be saved and switched between during the live try-on.

## Positioning

Combines a garment-design studio (pattern/color compositing on masked garment art) with real-time pose-tracked AR fitting, so the visitor sees their own custom design worn on their own body immediately, not on a generic model or static mockup.

## Operating Context

Demoed live at a student competition booth (ศิลปหัตถกรรมนักเรียน). Internet on competition day may be unreliable, so the AR model/runtime files are bundled locally rather than loaded from a CDN. Used on both the presenting team's computer and on phones (camera-based AR), so the AR page is mobile-first.

## Capabilities and Constraints

- No backend; all state (saved outfits) persists in `localStorage` on the device.
- Camera access (`getUserMedia`) requires a secure context — works on `localhost` over plain HTTP; testing over LAN/phone requires HTTPS (dev-only self-signed cert) or deploying behind HTTPS.
- Pattern/garment art assets are currently placeholders generated in code (SVG); real photographed or illustrated assets are not ready yet and may replace them later via the pattern-photo-fallback mechanism already built in.
- UI language: Thai throughout (confirmed, binding).

## Brand Commitments

**Changed during this init round:** the project started as "ไหมไทย Try-On" (Thai Silk Try-On), scoped specifically to Thai silk weaving techniques and garments. The team has decided to drop that concept — the app is now a general fashion design + AR try-on tool, not scoped to any specific culture's dress. The Thai-silk name, palette, and pattern set (มัดหมี่/ขิด/แพรวา/จก/ยกดอก/โฮล) are retired; the new name is **ลองลุค** and the visual identity is defined in `DESIGN.md` (quiet-luxury fashion-brand style). UI copy stays Thai regardless of theme.

**Note on competition fit:** the team was told this may be a Thai-culture-specific competition category and chose to proceed as a general fashion app anyway — recorded as their explicit decision, not this file's recommendation.

## Evidence on Hand

No real garment or pattern photos/illustrations exist yet; all current art is placeholder code-generated SVG. A fallback mechanism already reads real photos from `src/assets/patterns/photos/<id>.{jpg,png,webp}` and prefers them automatically when present — future work should keep using that path rather than re-building the mechanism.

## Product Principles

- No backend, ever — every feature must work fully client-side.
- Must survive unreliable competition-day internet — no runtime dependency on a CDN for core functionality (AR model, fonts can degrade gracefully).
- Thai UI copy throughout, regardless of visual theme.
- Visual identity: premium, editorial fashion-brand website with depth — full-bleed imagery, oversized type layered over photos, alternating tonal sections (white/ivory/stone/black), parallax and reveal motion. Not traditional, not loud. Thai headings use a loopless Thai sans (never looped/traditional Thai faces). `DESIGN.md` (v2) is the source of truth; the dark "Runway Lightbox" theme and the flat v1 minimal look are retired.
- Mobile-first specifically for the camera/AR screen; other screens are responsive but desktop-first is fine.

## Accessibility & Inclusion

No specific standard was requested; no accommodation beyond ordinary good practice (contrast, keyboard focus, reduced motion) has been confirmed as required.
