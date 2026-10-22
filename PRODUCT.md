# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Indie hackers, SaaS founders, frontend engineers, product designers, and creators who need to transform raw, messy screenshots and screen recordings into clean, publication-grade visuals for Product Hunt, Chrome Web Store listings, landing pages, documentation, and social media without uploading private screenshots to remote servers.

## Product Purpose
Provide an instantaneous, zero-install, 100% private browser studio that beautifies screenshots and video recordings with authentic browser/device frames, tailored backgrounds, drop shadows, and high-DPI Retina exports.

## Positioning
"We beautify, not modify." Operates 100% locally in the browser with zero cloud uploads, zero account walls, instant clipboard paste (Ctrl+V / Cmd+V), and hardware-accelerated video recording beautification that competitors gate behind paid subscriptions.

## Operating Context
A user captures a window or screen area using system capture shortcuts, pastes straight into ScreenCraft, chooses a frame and canvas preset, and exports a crisp 2x/3x PNG or MP4 in under 15 seconds.

## Capabilities and Constraints
- 100% client-side rendering (HTML5 2D Canvas + MediaRecorder stream capture).
- Zero backend storage or servers.
- Deep binary signature validation for security.
- Offline-ready Progressive Web App.
- Preserves native resolution with zero downscaling blurriness.

## Brand Commitments
- Name: ScreenCraft
- Voice: Disciplined, studio-grade, direct, unpretentious. No AI buzzwords, no gradient fluff.
- Tagline: "We beautify, not modify."

## Evidence on Hand
- Functional high-DPI canvas engine (`src/lib/canvasRenderer.ts`).
- Frame-by-frame video pipeline (`src/lib/videoExporter.ts`).
- Production PWA with offline caching.

## Product Principles
1. Instant utility: First output in under 15 seconds.
2. Complete privacy: No image or video byte ever touches a server.
3. Pixel fidelity: Native resolution preservation with 1x/2x/3x Retina rendering.
4. Studio ergonomics: The interface stays out of the way; the work takes center stage.
