# Workspace design system

The staff workspace copies its geometry and UI component styles from `/home/mwangii/Code/andishixkikapu/studio/src`, adapted to Next.js routing and Kinga's olive/cream palette.

Copied sources live under `components/ui`: `theme/designTokens.ts`, `theme/tokensCss.ts`, `sheet.css`, `mobile-bottom-nav.css`, `navigation-grid.css`, `action-footer.css`, `action-footer.tsx`, `controls.css` and `button.tsx`. Run `node scripts/generate-design-tokens.mjs` after editing the TypeScript tokens. `app/workspace-design.css` provides the Kinga palette and shared workspace/card rules. Body text and mobile inputs remain 16 px.

The installed UI dependencies match the source project: Base UI 1.9.0, Lucide React 1.48.0, Plus Jakarta Sans/DM Sans/Bricolage Grotesque 5.3.0, and TanStack React Query 5.104.0. Next.js continues to own routing; the source project's Vite and React Router runtime are not substituted for it. Unrelated website-editor packages are not needed by this workspace.

`components/sheet.tsx` uses Base UI Drawer for portal, focus, scroll locking, swipe gestures, keyboard handling and opening/closing presence. The root remains mounted while closed. Record data is retained until the close transition completes. Phones use bottom sheets; larger screens use a right drawer. Headers and footers sit outside the single scrolling body. Form totals are portalled into the sheet footer and submit their associated form by ID.

All tabular collections use the same mobile record card and sheet through the shared Table component. Orders have a dedicated card and customer/item/payment summary sheet. Desktop collections retain tables. The mobile dock and full navigation grid use the copied Studio components' classes and Lucide icons, with role-specific destinations.

`app/dashboard/layout.tsx` owns the workspace above the changing catch-all route. The authenticated snapshot and assistant state remain mounted across navigation. Requests are deduplicated in a per-session in-memory query cache; no staff data is saved to an offline cache. Live data refreshes after writes, when the app regains visibility and every minute while visible.

The seed uses normal names and references. `scripts/refresh-workspace-data.mjs` refreshes display fields only on known seeded IDs, preserving existing quantities, reservations, payments and unrelated records. It never sends messages or collects money. Customer phone numbers are not invented; internal contact identifiers are displayed as missing phone numbers.
