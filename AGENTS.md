<!-- BEGIN:nextjs-agent-rules -->

## Overview

This project uses **Next.js (latest)**, **TypeScript (strict)**, **Tailwind CSS (latest)**, and **shadcn/ui**.

Assume breaking changes may exist. Always follow current conventions.

---

## 1. Tailwind — Latest Conventions Only

Never use deprecated utilities. Always use modern equivalents.

| Deprecated          | Required           |
| ------------------- | ------------------ |
| `bg-gradient-to-r`  | `bg-linear-to-r`   |
| `bg-gradient-to-b`  | `bg-linear-to-b`   |
| `bg-gradient-to-tr` | `bg-linear-to-tr`  |
| `shadow-sm`         | check for warnings |

Rules:

- Never use `bg-gradient-*` — always `bg-linear-*`
- Zero Tailwind lint warnings allowed
- Zero TypeScript errors allowed
- No suppressing or ignoring warnings

Class order:
Layout → Spacing → Size → Typography → Colors → Effects

Example:

```tsx
<div className="flex items-center gap-4 p-4 w-full text-sm text-white bg-linear-to-r from-blue-500 to-purple-600 rounded-xl">
```

---

## 2. shadcn/ui Rules

- Always install components via CLI: `npx shadcn@latest add <component>`
- **Never manually edit** files inside `components/ui/` — these are managed by shadcn
- Import from `@/components/ui/<component>` — never use relative paths
- Extend or wrap shadcn components in `components/` if customization is needed
- Use the `cn()` utility from `@/lib/utils` for conditional class merging — never use string concatenation or template literals for class names
- Do not install shadcn components manually or copy-paste them

---

## 3. Next.js — App Router Patterns

- Always use **App Router** (`app/` directory)
- Default to **Server Components** — no `"use client"` unless required
- Only add `"use client"` when the component uses:
  - `useState` / `useReducer`
  - `useEffect` / lifecycle logic
  - Browser APIs (`window`, `document`, etc.)
  - Event handlers that need interactivity
  - Third-party client-only libraries



## 4. TypeScript — Strict Mode

- No `any` — ever
- Define explicit types for all props, API responses, and state
- Use `type` for shapes, `interface` for extendable contracts

]
---

## 5. Images & Fonts

- Always use `next/image` — never `<img>`
- Always use `next/font` — never import fonts from Google Fonts directly
- Configure remote images via `remotePatterns` in `next.config.ts` — never use deprecated `domains`

---

## 6. Imports & Path Aliases

- Always use `@/` alias — never relative paths like `../../components`
- Group imports: external libs → internal modules → types → styles

---

## 7. Environment Variables

- Prefix browser-accessible vars with `NEXT_PUBLIC_`
- Never hardcode secrets or API keys in source files
- Access server-only vars only in Server Components or route handlers

---

## 8. Performance

- Use `dynamic()` imports for heavy client components
- Avoid unnecessary `"use client"` — it disables server rendering for the whole subtree
- Wrap async data boundaries with `<Suspense>`

---

## Final Checklist Before Writing Code

- [ ] No deprecated Tailwind classes
- [ ] No lint warnings, no TypeScript errors
- [ ] `"use client"` only where truly needed
- [ ] shadcn components installed via CLI, not edited directly
- [ ] `cn()` used for class merging
- [ ] `next/image` and `next/font` used
- [ ] All types explicit — no `any`
- [ ] `@/` imports throughout

<!-- END:nextjs-agent-rules -->

The biggest additions that will save you the most headaches day-to-day are the shadcn rules (the cn() enforcement especially) and the "use client" trigger list — those two alone prevent a large class of common mistakes.import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Script from "next/script";

import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Toaster } from "@/components/ui/sonner";

// ==========pastedthis is not the dashboard this is the marketing site and also i am not using google fonts i have a font i have downloaded into the root app and calling it in the layout so make you updates accordingly2:09 PMGood catches. Here's the updated rules file reflecting your actual setup:
markdown<!-- BEGIN:nextjs-agent-rules -->

## Overview

This project is a **Next.js (latest) marketing site** with **TypeScript (strict)**, **Tailwind CSS (latest)**, and **shadcn/ui**.

This is NOT a dashboard or app — it is a public-facing marketing website. Keep that context in mind when making decisions about structure, performance, and rendering strategy.

Assume breaking changes may exist in any dependency. Always follow current conventions.

---

## 1. Tailwind — Latest Conventions Only

Never use deprecated utilities. Always use modern equivalents.

| Deprecated          | Required          |
| ------------------- | ----------------- |
| `bg-gradient-to-r`  | `bg-linear-to-r`  |
| `bg-gradient-to-b`  | `bg-linear-to-b`  |
| `bg-gradient-to-tr` | `bg-linear-to-tr` |

Rules:

- Never use `bg-gradient-*` — always `bg-linear-*`
- Zero Tailwind lint warnings allowed
- Zero TypeScript errors allowed
- No suppressing or ignoring warnings

Class order:
Layout → Spacing → Size → Typography → Colors → Effects

Example:

```tsx
<div className="flex items-center gap-4 p-4 w-full text-sm text-white bg-linear-to-r from-blue-500 to-purple-600 rounded-xl">
```

---

## 2. Fonts

This project uses **local fonts only** — no Google Fonts, no CDN font imports.

Fonts are defined once in `app/layout.tsx` using `next/font/local` and exposed as CSS variables:

- `--font-pp-cirka` → serif/display font (PP Cirka)
- `--font-helvetica` → body/UI font (Helvetica Neue)

Rules:

- Never import fonts from Google Fonts or any external source
- Never redefine fonts outside of `app/layout.tsx`
- Access fonts in Tailwind via their CSS variable (configured in `tailwind.config.ts`)
- Always use the correct font variable for context:
  - Headings / display text → `font-cirka` (or whatever the Tailwind alias is)
  - Body copy, UI labels, buttons → `font-helvetica`

---

## 3. shadcn/ui Rules

- Always install components via CLI: `npx shadcn@latest add <component>`
- **Never manually edit** files inside `components/ui/` — these are managed by shadcn
- Import from `@/components/ui/<component>` — never relative paths
- Wrap or extend shadcn components in `components/` if customization is needed
- Use `cn()` from `@/lib/utils` for all conditional class merging — never string concatenation or template literals for class names
- Do not copy-paste shadcn components manually

---

## 4. Next.js — App Router, Marketing Site Patterns

- Always use **App Router** (`app/` directory)
- Default to **Server Components** — this is a marketing site, most pages have no interactivity
- Only add `"use client"` when the component uses:
  - `useState` / `useReducer`
  - `useEffect` / lifecycle logic
  - Browser APIs (`window`, `document`, `localStorage`, etc.)
  - Event handlers requiring interactivity
  - Third-party client-only libraries

Layout structure (already established — do not change):
app/
layout.tsx ← Root layout: fonts, Header, Footer, Toaster, Scripts
globals.css
fonts/
ppcirka/
helvetica/
[pages]/
page.tsx
components/ ← Page-specific components
components/
layout/
header.tsx
footer.tsx
ui/ ← shadcn managed — do not edit
[shared components]
lib/
utils.ts ← cn() lives here

Rules:

- `Header`, `Footer`, and `Toaster` are rendered globally in `app/layout.tsx` — never add them inside individual pages
- Third-party scripts go in `app/layout.tsx` using `next/script` with `strategy="afterInteractive"` or `"lazyOnload"`
- `loading.tsx` and `error.tsx` should be added to page routes that fetch data

---

## 5. TypeScript — Strict Mode

- No `any` — ever
- Define explicit types for all props, API responses, and state
- Use `type` for object shapes, `interface` for extendable contracts

```tsx
type HeroProps = {
  headline: string;
  subtext?: string;
  ctaLabel: string;
};
```

---

## 6. Images

- Always use `next/image` — never a raw `<img>` tag
- Static assets live in `/public` — reference as `/filename.ext`
- Configure remote images via `remotePatterns` in `next.config.ts` — never the deprecated `domains` key

---

## 7. Imports & Path Aliases

- Always use `@/` alias — never relative paths like `../../components`
- Group imports in order: external libraries → internal modules → types

---

## 8. Environment Variables

- Prefix browser-accessible vars with `NEXT_PUBLIC_`
- Never hardcode secrets or API keys in source files
- Server-only vars are only accessed in Server Components or route handlers

---

## 9. Performance — Marketing Site Priorities

- Pages should be statically rendered wherever possible (`generateStaticParams`, no dynamic data)
- Use `dynamic()` with `{ ssr: false }` only for client-heavy widgets (e.g. charts, maps) that can't SSR
- Wrap async sections in `<Suspense>` with meaningful fallbacks
- Avoid unnecessary `"use client"` — it disables server rendering for the entire subtree below it
- Prefer CSS animations over JS-driven ones for marketing transitions

---

## Final Checklist Before Writing Code

- [ ] No deprecated Tailwind classes (especially `bg-gradient-*`)
- [ ] No lint warnings, no TypeScript errors
- [ ] `"use client"` only where truly necessary
- [ ] Fonts used via CSS variables from `app/layout.tsx` — no new font imports
- [ ] shadcn components installed via CLI, never manually edited
- [ ] `cn()` used for all class merging
- [ ] `next/image` used — no raw `<img>` tags
- [ ] `@/` imports throughout — no relative paths
- [ ] No logic or scripts duplicating what's already in `app/layout.tsx`
- [ ] Ensure that no special characters like " ' " the apostrophe or "&" are used al special characters should be escaped with their apporopriate code like `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.
- [ ] Never use em dashes (`—`) anywhere in copy or JSX. Rewrite the sentence to use a colon, comma, or two separate sentences instead.

<!-- END:nextjs-agent-rules -->
