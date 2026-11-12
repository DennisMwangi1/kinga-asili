# Kinga Asili

Two separate Next.js applications share a Supabase database and a small set of design primitives.

- Root `app/`, `components/`, `lib/`: staff operations application. Run `npm run dev` on port 3000. `/dashboard` requires the Kinga database and staff authentication.
- `storefront/`: imported Kinga Asili Wellness Storefront design, live product catalogue, shopping bag, order requests and public API routes. Run `npm run dev:storefront` on port 3001; the website is at `/shop`. The storefront always reads the live Kinga catalogue.
- `shared/`: common brand, typography, form styling, types and validation helpers. The storefront never imports the staff operations screen or staff database client.
- `supabase/`: clean-install database migrations and isolated SQL tests. These migrations must not be applied to the any existing business database.

Run `npm run build:all` to build both applications. Each has its own package, TypeScript configuration, build output and deployment entry point. Install root dependencies with `npm ci`; local development resolves the storefront's dependencies from the root installation. For a separate installation, run `npm install` inside `storefront/`.

Deploy the repository as one Vercel Services project using root `vercel.json`: `app` owns the staff UI and staff APIs; `storefront` owns `/shop`, including `/shop/api/*` and `/shop/_next/*`. Service names and routing are pending final owner confirmation. Neither service calls the other: both access Supabase directly, so no internal service bindings are declared. See `docs/VERCEL-SERVICES.md`.

For separate local development servers, set `NEXT_PUBLIC_STOREFRONT_URL=http://localhost:3001/shop` in the staff app. Leave this variable unset for the single-domain Vercel deployment, where shop links default to `/shop/`.
Both apps need the same clean Kinga project's `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No service role key belongs in either application. No automated messages or payment collection are enabled.

Staff workspace typography defaults: 16 px body text and form fields, 15 px table text and navigation, 14 px labels/help text, and 12–13 px supporting captions. Mobile forms retain 16 px input text.

The Kinga database is configured with five role-based staff accounts and a populated walkthrough dataset using ordinary names and references. See `docs/MOBILE-AND-DEMO.md` for the dataset and the private `.local/staff-access.md` file for generated login credentials. Before production launch, confirm prices, provision actual staff, replace demonstration records with approved business data and reconcile opening stock. Sample lots remain on hold and cannot be sold through the storefront.

The staff workspace has mobile bottom tabs, a More menu, touch-friendly record cards and an Install workspace action on login and in navigation. Its PWA supports installation and a reconnect screen; it does not queue offline transactions. Serve the workspace over HTTPS for installation on phones.

## Single source checkout

The canonical source is `/home/mwangii/Documents/ChatGPT/Kinga Asili`. The path `/home/mwangii/Code/kinga-asili` is a symbolic link to the same checkout, so either launch path runs this Kinga application. Installed dependencies are stored in this workspace. Original supplied photography is preserved in `reference-images/instagram/`.

The cloned `KingaAsiliWellnessStorefront` frontend has been incorporated into `storefront/`. Its separate Git metadata and Figma/Vite scaffolding are not part of this checkout; the parent repository owns the storefront source.
