# Kinga Supabase setup

The supplied project URL and publishable key are configured in the ignored `.env.local` files for both applications. The service-role key is not stored in source or in either application's environment.

## Database

1. Open the Supabase SQL Editor for project `tbxokonhjeellhfcusui`.
2. Run `supabase/kinga-setup.sql` once against the clean project. It refuses to overwrite an existing `public.products` table.
3. Verify six product variants appear in the products table and `kinga_catalogue` appears under database functions.
4. The storefront at `http://localhost:3001/` now reads the live catalogue. All requests use the live ordering API.

## First owner

Create or invite the owner's account in Supabase Authentication → Users. Then replace the email in the following SQL with that account's actual email and run it in the SQL Editor:

```sql
insert into public.profiles (id, full_name, role)
select id, 'Kinga owner', 'admin'
from auth.users
where email = 'REPLACE_WITH_OWNER_EMAIL';
```

Sign in at `http://localhost:3000/login`. Further staff profiles use one of: `sales`, `cashier`, `stock_keeper`, `driver`. Keep role assignment under owner control; users cannot promote themselves through the applications.

## Opening records

Confirm indicative catalogue prices in Settings. Import actual customers from a CSV with `name,phone,location,notes` headers; imported customers default to marketing opted out. Reconcile opening ingredient, packaging and finished-bottle stock in Inventory using actual source references and approved use-by dates. Only explicitly approved seed records are added to the live project.

## Separate deployments

The staff application is the repository root. The customer application is `storefront/`, built with the parent `shared/` directory available in the monorepo build context. Set their reciprocal `NEXT_PUBLIC_STOREFRONT_URL` and `NEXT_PUBLIC_OPERATIONS_URL` values to the deployed URLs. Each application uses the same publishable database credentials. No service-role key is needed by either app.

## Checks

`npm test` checks order arithmetic, invalid quantities, date boundaries, and CSV exports. `npm run build:all` builds both apps. Run `supabase/tests/transactions.sql` only against an isolated local test database after installing all migrations; its fixtures roll back. Never run `supabase/tests/bootstrap.sql` on Supabase—it is a local Auth test stub.
