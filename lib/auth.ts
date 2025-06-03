import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Envío de magic-link
export async function signIn(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) console.error("signIn error:", error.message);
}

// Cerrar sesión
export async function signOut() {
  await supabase.auth.signOut();
}
