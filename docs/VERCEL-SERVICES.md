# One-project Vercel deployment

The root `vercel.json` defines two Next.js services with independently scoped install and build commands. Import this repository once, choose Services, and keep the Vercel project root at `./`. The storefront is the public homepage, with a Login link to the staff workspace.

## Public routes

- `app` (`.`): `/login`, `/dashboard` and child routes, `/api/operations`, `/api/assistant` and child routes, staff assets, and the workspace PWA.
- `storefront` (`storefront`): `/`, `/api/catalogue`, `/api/requests`, `/favicon.png`, and the final public catch-all. JavaScript and CSS use `/_storefront/_next/*`.
- Neither service is internal-only. Staff routes remain protected by the application's staff authentication and database policies; a public rewrite is not an authentication bypass.

Specific staff and storefront asset rewrites precede the final storefront catch-all. The storefront has no base path. Its `assetPrefix` and local asset rewrite keep its JS/CSS separate from staff `/_next/*` assets. Previous `/shop` URLs temporarily redirect to the corresponding root path. The staff service worker only handles `/login` and `/dashboard` navigation.

## Bindings audit

There are no inter-service server calls in the current code. Each service owns its own API routes and connects directly to the external Supabase project. The staff's “Visit shop” link is browser navigation, not a function-to-function request. No bindings are needed or added. Supabase and Bedrock are external services and cannot be targeted by a Vercel service binding in this repository.

If a later server-side integration calls the other service, declare all four fields (`type`, `service`, `format`, `env`) on the caller and consume its injected URL in that caller's functions only. Never set the binding variable manually or use it in build code, middleware or browser bundles.

## Environment

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the shared Supabase project. Configure the workspace's Bedrock credentials, region, model, assistant roles and signing secret as server-only variables. Do not use a Supabase service-role key in either app. Local AWS profiles are not hosted credentials.

Leave `NEXT_PUBLIC_STOREFRONT_URL` unset on the unified deployment. `/` is the same-origin default. For the two standalone local development servers only, use `http://localhost:3001`. Do not copy local `.env.local` localhost URLs into Vercel production or preview environment variables.

## Validation and local development

Use a current Vercel CLI supporting Services and run `vercel dev` from the repository root (or `npm run dev:services`). It starts both services and applies the top-level routing. `vercel dev --local` avoids cloud sign-in when supported. No binding variables are expected because there are no service-to-service calls.

Smoke-check `/login`, an authenticated `/dashboard`, `/api/operations` without authentication (401 expected), `/`, `/api/catalogue`, the shop's prefixed JS/CSS assets, and an order request using an isolated test database. Never send a payment or create live stock mutations as deployment smoke tests.

Run `npm test` and `npm run build:all` before deployment. The root npm workspace includes `storefront`, and both services use the shared parent lockfile; its file tracing root includes the parent directory for `shared/` and the root `node_modules/`.

Both Next.js production builds and the routing tests pass. Validated using Vercel CLI 65.14.0 locally: `/`, `/login`, both apps’ separate JS asset paths, `/favicon.png` and `/icon.svg` returned 200; `/shop` redirected to `/`; unauthenticated `/api/operations` returned 401. Nothing is deployed by these checks.
