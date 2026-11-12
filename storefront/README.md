# Kinga Asili storefront

The customer website uses the design imported from KingaAsiliWellnessStorefront: the botanical landing page, brand story, blend cards, bottle and pack selector, and shopping-bag drawer. It lives in the parent Kinga repository, without a nested Git repository or separate GitHub remote.

The imported React frontend runs in the existing Next.js storefront host so the public catalogue and order-request API remain connected to the operations database. Figma/Vite preview plugins and the separate Vite dependency tree are not required.

- `components/storefront.tsx`: imported website and bag/checkout UI.
- `app/globals.css`: imported responsive styling.
- `lib/catalogue.ts`: live bottle variants, active bundles and request lines.
- `app/api/catalogue/route.ts`: public catalogue.
- `app/api/requests/route.ts`: order requests, with server-calculated prices.

Run `npm run dev:storefront` from the repository root, then open http://localhost:3001. Build using `npm run build:storefront`. The existing storefront environment settings remain in place; use `.env.example` for a fresh environment. No service-role credentials are used.

Prices and active pack options come from Kinga's catalogue, rather than the imported prototype's hardcoded prices. Requests are saved with a reference; staff confirm availability and delivery fees before collecting payment. The website does not collect M-PESA payments or reserve stock.
