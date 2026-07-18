import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: "workifyr@gmail.com",
    password: "WorkfyrAdmin2026!",
    email_confirm: true,
  });

  if (error) {
    console.error("Error creating user:", error.message);
  } else {
    console.log("Success! Created user:", data.user.email);
  }
}

main();
