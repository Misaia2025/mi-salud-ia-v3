import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Magic-link
export async function signIn(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) console.error("Error enviando enlace:", error.message);
}

// Cerrar sesión
export async function signOut() {
  await supabase.auth.signOut();
}
