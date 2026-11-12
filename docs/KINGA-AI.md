# Kinga AI

The floating **Kinga AI** button appears at the bottom right of the staff workspace for the roles listed in `ASSISTANT_ROLES` (initially the owner/admin). It is separate from the customer storefront.

The live assistant uses the existing Bedrock model configuration with `KINGA_AWS_PROFILE=kingaasili`, `KINGA_AWS_REGION=us-east-1`, and `ASSISTANT_MODEL=global.anthropic.claude-opus-4-6-v1`. AWS credentials stay in the local AWS credential store. Deployments need a suitable server workload identity or server-only AWS credentials; local named profiles are not shipped to hosting.

The assistant can answer questions about role-visible stock, orders, production and payments. It can prepare customer requests, batches, receipts, payments and supported fulfilment updates for review. Signed proposals are bound to the current staff member and expire after ten minutes. Applying a proposal calls the same `kinga_*` database functions as the forms, using that staff member's access token. It cannot send WhatsApp messages or collect payments. Stock corrections, bundles, settings and weekly sign-off remain in their dedicated screens.

The model receives role-filtered operational context with phone numbers and delivery addresses omitted from the order snapshot. Information staff deliberately paste into the chat is sent to the configured Bedrock model. Up to 100 recent orders and 60 batches/receipts are included; the assistant is instructed not to treat that as complete history.

Kinga AI always uses the authenticated staff workspace and role-filtered live database context.

Conversations are saved to Supabase with staff ownership and role policies (migration 005). The latest conversation restores when Kinga AI opens; the History button lists recent conversations and allows continuing a previous chat. New chat retains the saved conversation. Unsaved changes expose a retry action; switching or starting a chat waits for pending saves. Restored proposals are historical records and require a fresh review before execution. Chats that were lost before persistence was added cannot be recovered. Server requests enforce a per-process limit of 30 messages per hour. The legacy monthly cost ledger and distributed quota system have not been ported. No paid model invocation was made during this setup.

The dedicated local IAM user is `arn:aws:iam::874708626216:user/kingaasili`. Its `KingaBedrockInvoke` inline policy permits only InvokeModel and InvokeModelWithResponseStream against the exact configured inference profile and its conditioned foundation-model resources. The app-specific KINGA_AWS_PROFILE setting overrides a different terminal AWS_PROFILE.

## Chat interface and answer formatting

The interface reuses the KooKoo AI design from `erp-demo/components/assistant/assistant-chat.tsx`, its assistant stylesheet and order-chat message/panel geometry. It keeps Kinga's palette and the shared Base UI sheet host: a floating panel on desktop and a bottom sheet on phones. Quick-action pills navigate to permitted Kinga screens. The composer supports multiline drafts, desktop Enter to send, Shift+Enter for a newline and a Stop control. Closing the panel preserves the in-memory conversation; New chat clears it. Thinking dots show elapsed time without claiming tools have run.

`components/assistant/rich-text.tsx` extends the original formatter's layouts and Copy table interaction with `react-markdown` and `remark-gfm`. Headings, emphasis, lists, quotes, code blocks and tables render as React elements. Tables scroll horizontally and copy as HTML plus tab-separated text, with a plain-text fallback. Code blocks and whole answers also have copy actions. Raw HTML is skipped, dangerous URLs are removed, and Markdown images are shown as labels instead of loading remote assets. Workspace links use Next.js navigation.

Proposals use signed, role-checked changes. Manual approval is the default; Auto-accept can be selected for new requests in the current chat. New chat resets to Manual. Grouped requests support up to 50 changes and one Confirm all action. No persistent conversation-history feature or automated external messaging has been introduced. Focused renderer/export tests run with `node tests/markdown.test.mjs`; no model call is required.


## Grouped changes and approval modes

The AI can prepare multiple operations in one signed group. Unambiguous “release all held stock” requests, and “all of them” replies to a hold-release question, select every currently held stock entry from a fresh role-filtered snapshot. Scoped requests such as “GLT only” use the model's explicit record selection. Already released stock is excluded from a fresh all-held request. Hold-release reasons do not claim that an inspection or stock review occurred.

Manual mode prepares the entire group and waits for one Confirm all action. Auto-accept applies newly requested groups in that chat without another confirmation click; it does not approve older pending cards. Both paths verify the same signed token, current role and per-action database permissions. No new database migration is needed. The assistant never uses the service-role key.

Each operation calls the existing audited RPC separately. This is not an all-or-nothing database transaction: the response reports saved, already applied and failed records individually, with exact completion counts. Failed entries can be retried; successful entries are retained. In-flight duplicate submissions share a per-process receipt for the lifetime of the proposal. Orders also have signed idempotency keys, payments keep unique receipt references, and already-released stock is checked before a repeat hold write. Receipts are in memory, so cross-server or post-restart deduplication still relies on the database's transaction and uniqueness controls. Auto-accept requests run to their result instead of exposing a Stop control that could hide partially completed writes.

Focused group/signature/permission/retry tests run with `node tests/assistant-plans.test.mjs`. These do not release stock in the live database or call the model.

Operation and assistant failures use dismissible error toasts, expire after seven seconds, and are removed when navigating away from the originating screen. Field validation stays next to the relevant form input. Success toasts remain separate from failures.
