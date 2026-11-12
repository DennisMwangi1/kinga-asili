# Kinga Asili

Two separate Next.js applications share a Supabase database and a small set of design primitives.

- Root `app/`, `components/`, `lib/`: staff operations application. Run `npm run dev` on port 3000. `/dashboard` requires the Kinga database and staff authentication.
- `storefront/`: imported Kinga Asili Wellness Storefront design, live product catalogue, shopping bag, order requests and public API routes. Run `npm run dev:storefront` on port 3001; the website is at `/`. The storefront always reads the live Kinga catalogue.
- `shared/`: common brand, typography, form styling, types and validation helpers. The storefront never imports the staff operations screen or staff database client.
- `supabase/`: clean-install database migrations and isolated SQL tests. These migrations must not be applied to the any existing business database.

Run `npm run build:all` to build both applications. Each has its own package, TypeScript configuration, build output and deployment entry point. Install root dependencies with `npm ci`; local development resolves the storefront's dependencies from the root installation. For a separate installation, run `npm install` inside `storefront/`.

Deploy the repository as one Vercel Services project using root `vercel.json`: `app` owns the staff UI and staff APIs; `storefront` owns `/` and its public request APIs. Its JS/CSS use `/_storefront/_next/*` to avoid staff asset collisions. The website includes a Login link to `/login`; previous `/shop` URLs redirect to `/`. Neither service calls the other: both access Supabase directly, so no internal service bindings are declared. See `docs/VERCEL-SERVICES.md`.

For separate local development servers, set `NEXT_PUBLIC_STOREFRONT_URL=http://localhost:3001` in the staff app. Leave this variable unset for the single-domain Vercel deployment, where shop links default to `/`.
Both apps need the same clean Kinga project's `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No service role key belongs in either application. No automated messages or payment collection are enabled.

Staff workspace typography defaults: 16 px body text and form fields, 15 px table text and navigation, 14 px labels/help text, and 12–13 px supporting captions. Mobile forms retain 16 px input text.

The database was reset at the owner’s request. Operational records and stock are empty. The six current GLT/GOT catalogue variants have been restored. Only the replacement admin account remains; credentials are in the ignored private `.local/staff-access.md` file. Apply the ride-share migration before recording deliveries. Review the indicative catalogue prices and add approved opening stock before confirming sales.

The staff workspace has mobile bottom tabs, a More menu, touch-friendly record cards and an Install workspace action on login and in navigation. Its PWA supports installation and a reconnect screen; it does not queue offline transactions. Serve the workspace over HTTPS for installation on phones.

## Single source checkout

The canonical source is `/home/mwangii/Documents/ChatGPT/Kinga Asili`. The path `/home/mwangii/Code/kinga-asili` is a symbolic link to the same checkout, so either launch path runs this Kinga application. Installed dependencies are stored in this workspace. Original supplied photography is preserved in `reference-images/instagram/`.

The cloned `KingaAsiliWellnessStorefront` frontend has been incorporated into `storefront/`. Its separate Git metadata and Figma/Vite scaffolding are not part of this checkout; the parent repository owns the storefront source.

### Ride-share fulfilment

Apply `supabase/migrations/006_rideshare_delivery.sql` to existing databases. Staff enter the delivery fee on an order (including a website request), confirm available stock, record payment, pack, hand to a ride-share service, and mark delivered after arrival. Rider assignment and the separate delivery module are retired; historical identities and assignments are retained. A changed delivery fee updates the total and outstanding balance, cannot reduce the total below money already received, and cannot leave an order already handed over unpaid. Dispatch still checks settled payment and approved stock.

The storefront and workspace must use the same Supabase environment variables. Public requests are inserted into `orders` with `source = 'web'` and `status = 'requested'` by `kinga_public_request`; no payment or stock reservation occurs at submission. Orders refresh while the workspace is visible, every 15 seconds and when returning to the app. Staff see the website source on both mobile and desktop.

### Catalogue and storefront

Apply `supabase/migrations/007_catalogue_management.sql`. It backfills the six current GLT/GOT variants without creating stock or orders. In **Settings → Catalogue & prices**, the owner can add bottle variants, edit product names, images, notes, descriptions and prices, or hide products with the storefront publication checkbox. Blend/size identify a variant and cannot be changed after creation; add a new variant instead. Prices remain indicative until confirmed by the owner. The storefront renders only active backend variants and reads their copy, photos and prices from `kinga_catalogue`, refreshing every 30 seconds while visible and when returning to the page. Active bundles only publish when their product is also active.

### Cash purchases and M-PESA expense intake

Apply `supabase/migrations/008_purchase_payment_methods.sql`. New purchases/expenses require a payment method. Cash may have no receipt reference; M-PESA and bank payments must have a real reference. Supplier/payee is optional; item/expense, amount and date remain required. Historical records keep their existing references and explicitly show an unknown payment method. Cash receipts still have internal IDs for traceable stock movements. Request keys prevent duplicate saves; payment references are unique ignoring case and surrounding spaces.

In Kinga AI, paste an outgoing M-PESA message and provide the item/expense. The message can supply amount, date, recipient and reference; the assistant asks for missing information or conflicting amounts. Principal amounts are kept separate from fees and balances. Incoming/reversed payments must not be recorded as expenses. AI records remain subject to manual or auto acceptance, role restrictions and subsequent Verify & post. Material stock receipts still require explicit material quantities; an operating expense alone never adds inventory.

### Automatic production references

Apply `supabase/migrations/009_automatic_batch_references.sql`. Saving a production batch generates `BLEND-YYMMDD-NN`, for example `GLT-261112-01`: the first GLT batch produced on 12 Nov 2026. The counter is per blend and production date, skips existing matching references and grows past 99 without truncation. The database allocates references under the same transaction lock as production, and a request key makes retries return the same batch. Existing references are retained. The generated reference flows into stock lots and input/output movements when verified production is posted, and is shown in the batch list and save confirmation. It does not determine use-by dates; those still require staff approval.
