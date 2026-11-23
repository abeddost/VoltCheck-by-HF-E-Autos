// Creates (or promotes) an admin account.
// Usage: npm run create-admin -- <email> <password> "<Name>"
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local
import { createClient } from "@supabase/supabase-js";

const [email, password, name] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!email || !password) {
  console.error('Usage: npm run create-admin -- <email> <password> "<Name>"');
  process.exit(1);
}
if (!url || !secret) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must have at least 8 characters.");
  process.exit(1);
}

const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: name || email.split("@")[0] },
  app_metadata: { role: "admin" },
});

let userId = data?.user?.id;
if (error) {
  if (!/already|exists|registered/i.test(error.message)) {
    console.error("Error:", error.message);
    process.exit(1);
  }
  // user exists: promote to admin
  const { data: profile } = await supabase.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
  if (!profile) {
    console.error("User exists but no profile was found. Was the database migration applied?");
    process.exit(1);
  }
  userId = profile.id;
  await supabase.auth.admin.updateUserById(userId, { password, app_metadata: { role: "admin" } });
}

const { error: roleError } = await supabase.from("profiles").update({ role: "admin" }).eq("id", userId);
if (roleError) {
  console.error("Could not set admin role:", roleError.message);
  process.exit(1);
}
console.log(`Admin ready: ${email}`);
