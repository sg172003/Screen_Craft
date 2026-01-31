# ScreenCraft 🎨

> Turn raw screenshots into professional visuals — client-side, privacy-first, and lightning fast.

---

## Table of Contents
- [Overview](#overview)
- [Demo](#demo)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Install](#install)
  - [Run (development)](#run-development)
  - [Build (production)](#build-production)
- [Project Structure](#project-structure)
- [Theme & Styling](#theme--styling)
- [UX Enhancements](#ux-enhancements)
- [Contributing](#contributing)
- [Author](#author)
- [License](#license)

---

## Overview

ScreenCraft is a small, focused web app that polishes screenshots for use in landing pages, portfolios, and stores. It runs entirely in the browser (no server uploads) so your screenshots never leave your device — privacy-first by design.

## Demo

Run locally and open the dev URL (usually `http://localhost:5173` or the alternate port Vite selects).

## Features

- 100% client-side screenshot polishing
- Device frames, padding, corner radius, background gradients, and shadow controls
- High-resolution PNG export
- Dark mode + light mode with persisted preference
- Smooth hover animations for buttons and cards
- Professional logo glow effect in the navbar

## Tech Stack

- React + TypeScript
- Vite (dev server + build)
- Tailwind CSS for utilities
- Radix UI primitives and lucide-react icons

## Getting Started

### Prerequisites

- Node.js (>=16 recommended)
- npm or yarn

### Install

```bash
cd app
npm install
```

### Run (development)

```bash
cd app
npm run dev
```

Open the URL shown by Vite (e.g. `http://localhost:5173` or the alternate port Vite picks).

### Build (production)

```bash
cd app
npm run build
# optionally preview
npm run preview
```

## Project Structure (important files)

- `src/` — application source
  - `src/sections/LandingPage.tsx` — landing page UI and hero
  - `src/sections/EditorPage.tsx` — editor UI (lazy loaded)
  - `src/components/ui/button.tsx` — shared `Button` component
  - `src/components/ThemeToggle.tsx` — theme toggle control
  - `src/context/ThemeContext.tsx` — theme provider + persistence logic
  - `src/index.css` — Tailwind base + custom utilities (hover/card/button/logo glow)

## Theme & Styling

- The app uses Tailwind CSS with CSS custom properties for colors.
- Dark mode is implemented via a top-level `.dark` class on the document root; the `ThemeProvider` reads/stores preference in `localStorage` and respects the system preference on first load.

## UX Enhancements

- Button hover effect: subtle lift + soft shadow to indicate interactivity.
- Card hover effect: slightly larger lift with an angled micro-rotation and a faint gradient sheen.
- Navbar logo glow: a polished pulsing glow + lift on hover/focus for a professional highlight.

If you'd like the effects tuned (duration, intensity, color), edit `src/index.css` where the animation utilities are defined.

## Contributing

Thanks for considering contributing! A few guidelines to help:

- Create a feature branch from `main`: `git switch -c feature/your-feature`
- Commit logically and write clear commit messages
- Open a PR describing what you changed and why

Please don't push directly to `main` without coordinating (you can push branches freely).

## Author

🚀 Author: Sarthak

## License

This project does not include an explicit license file. Add one (e.g., MIT) if you plan to publish this repository publicly.

---
