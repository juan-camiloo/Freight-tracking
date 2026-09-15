import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Para suspender y revocar sesiones (ban de 100 años):
await supabaseAdmin.auth.admin.updateUserById(userId, {
  ban_duration: "876000h",
});

// Para reactivar al restaurar:
await supabaseAdmin.auth.admin.updateUserById(userId, {
  ban_duration: "none",
});