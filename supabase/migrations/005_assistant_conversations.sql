BEGIN;
CREATE TABLE IF NOT EXISTS public.assistant_conversations (
 id uuid PRIMARY KEY,
 owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
 workspace_role text NOT NULL DEFAULT public.kinga_role(),
 title text NOT NULL CHECK(char_length(title) BETWEEN 1 AND 120),
 messages jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(messages)='array' AND jsonb_array_length(messages)<=500),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS assistant_conversations_owner_updated ON public.assistant_conversations(owner_id,updated_at DESC);
DROP POLICY IF EXISTS assistant_conversations_own ON public.assistant_conversations;
CREATE POLICY assistant_conversations_own ON public.assistant_conversations FOR ALL TO authenticated
 USING(owner_id=auth.uid() AND workspace_role=public.kinga_role())
 WITH CHECK(owner_id=auth.uid() AND workspace_role=public.kinga_role());
REVOKE ALL ON public.assistant_conversations FROM PUBLIC,anon,authenticated;
GRANT SELECT,DELETE ON public.assistant_conversations TO authenticated;
GRANT INSERT(id,owner_id,workspace_role,title,messages,updated_at),UPDATE(title,messages,updated_at) ON public.assistant_conversations TO authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';
