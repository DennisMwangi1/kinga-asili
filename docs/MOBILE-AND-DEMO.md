# Mobile workspace, installation and sample records

The staff workspace uses a bottom tab bar on phones and tablets below 768 px wide. Each role sees its main tasks, with the remaining permitted pages under More. The desktop sidebar remains available on larger screens. All record collections use compact cards that open a detail sheet on mobile; entry forms keep readable 16 px inputs and large touch targets. New orders open in a sheet with a pinned total and save action. The shared Base UI drawer handles transitions, gestures, focus and software keyboards.

## Staff sign-in

Five working Supabase Auth accounts are provisioned: `admin@kingaasili.test`, `sales@kingaasili.test`, `cashier@kingaasili.test`, `stock_keeper@kingaasili.test` and `driver@kingaasili.test`. Passwords are generated separately and saved to `.local/staff-access.md`, which is private, ignored by git, and readable only by the local file owner. No invitation emails are sent. Sign in at `/login`; each role lands on its own main page.

The database contains six fictional customers, eight sample orders, three batches, six finished-stock lots, three purchase/expense records, payment records, allocations and movements. Records use ordinary names and references, with marketing opted out. Customer phone numbers have not been supplied; internal customer identifiers are never dialled.

All seeded finished-bottle lots are held so they are excluded from the public catalogue's sellable quantity. The sample use-by dates are fixture dates, not validated storage or shelf-life guidance. Two sample bundles are inactive. The database seed is repeatable with fixed IDs and preserves existing records and user changes. Before starting actual business operations, remove the sample dataset through an owner-controlled database maintenance process; do not treat sample balances as opening inventory.

The `scripts/seed-workspace.mjs` tool accepts the service-role key through stdin. It does not put the key in application configuration or generated account files. `scripts/provision-users.mjs` creates the accounts and roles before the seed runs. A new seed in a different project requires deliberately changing the fixed project URL and supplying that project's credentials.

## Install the workspace

Open More → Install workspace. Installation is also available from the sign-in screen and desktop sidebar. On supported Chromium browsers, the button opens the native install prompt when available. On iPhone and iPad, the app explains Safari → Share → Add to Home Screen. Installed apps open at `/dashboard`, then route to the signed-in role's main page.

The PWA includes a web manifest, 192/512 px icons, maskable icon, Apple touch icon and service worker. A phone needs the workspace served over HTTPS; a plain HTTP LAN IP is not an installable secure context. Localhost works for local development. Installation remains a browser capability and cannot be forced by the website.

Only the static offline reconnect page is cached. Staff records, API responses, authentication pages and mutations are not cached or queued by the service worker. A connection is required to save orders, payments or stock changes. The current screen shows an offline status message when connectivity is lost.

## Workspace navigation and customer management

The mobile New tab opens a role-specific action sheet: sales can create orders and customers; stock keepers record production, materials and purchases; cashiers record orders, customers and costs; drivers select a delivery to update. Desktop creation buttons remain in page headings.

Selecting a page from More exposes that module in the bottom dock. Tap the active Stock or Settings tab again to open its sections. Settings routes separate catalogue prices, bundles, staff access, audit history and connections. The desktop keeps a section navigator.

Customer detail sheets include Edit customer. Names and Kenyan mobile numbers are required; optional multiline addresses and notes have length limits. Validation runs in the form, API and audited database update function. Customer edits preserve historical order details and purchase history remains linked by customer ID. Migration 004_customer_editing.sql adds the database update function and validation; it is also included in the clean setup script. CSV imports use a button instead of a native file widget, validate every row before submission, and leave marketing opted out.

The sales chart uses Nairobi transaction dates, limits mobile date ticks to four and reserves separate space for dates and the caption.
