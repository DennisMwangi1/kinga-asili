# Kinga Asili customer website

This folder owns the public website and complete order-request flow. It is a separate Next.js application from the staff system.

- `app/page.tsx`: public website entry.
- `components/storefront.tsx`: brand story, catalogue and request confirmation.
- `components/order-form.tsx`: customer order form and cart.
- `app/api/catalogue/route.ts`: public catalogue endpoint.
- `app/api/requests/route.ts`: order-request endpoint; prices are reconstructed by the database.
- `lib/supabase.ts`: public database client only; no staff authentication or operations API.
- `public/images/`: customer-facing brand imagery.

From the repository root: `npm run dev:storefront`. Or from this folder: `npm run dev`.

Open `http://localhost:3001/` for the live catalogue and ordering flow. The site requires the Kinga Supabase project. Requests do not reserve inventory or collect payments; staff confirm availability and delivery fees in the operations app first.

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_OPERATIONS_URL` as shown in `.env.example`. Shared code in `../shared/` is part of the source build context; deploy from the monorepo with this folder as the project root.
