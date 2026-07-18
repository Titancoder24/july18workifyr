import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createAdmin() {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: "admin@workifyr.com",
    password: "Password123!",
    email_confirm: true,
  });

  if (error) {
    if (error.code === 'email_exists') {
      console.log("Admin user already exists. Updating password...");
      const { data: users } = await supabaseAdmin.auth.admin.listUsers();
      const adminUser = users.users.find(u => u.email === "admin@workifyr.com");
      if (adminUser) {
        await supabaseAdmin.auth.admin.updateUserById(adminUser.id, { password: "Password123!" });
        console.log("Password updated successfully.");
      }
    } else {
      console.error("Error creating admin:", error);
    }
  } else {
    console.log("Admin user created successfully.");
  }
}

createAdmin();
