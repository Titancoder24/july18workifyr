import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'admin@workifyr.com',
    password: 'WorkifyrAdmin2026!',
    email_confirm: true,
    user_metadata: { name: 'Workifyr Admin' }
  });

  if (error) {
    console.error("Error creating user:", error.message);
  } else {
    console.log("Admin user created:", data.user.id);
  }
}

main();
