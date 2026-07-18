const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const pages = [
    {
      title: "Privacy Policy",
      slug: "privacy-policy",
      category: "Legal",
      page_order: 1,
      content: "# Privacy Policy\n\nWelcome to Workfyr OS. We are committed to protecting your personal information and your right to privacy..."
    },
    {
      title: "Terms and Conditions",
      slug: "terms-and-conditions",
      category: "Legal",
      page_order: 2,
      content: "# Terms and Conditions\n\nThese terms and conditions outline the rules and regulations for the use of Workfyr's Website..."
    },
    {
      title: "Terms of Service",
      slug: "terms-of-service",
      category: "Legal",
      page_order: 3,
      content: "# Terms of Service\n\nBy accessing this website we assume you accept these terms of service..."
    }
  ];

  for (const p of pages) {
    const { data } = await supabase.from('documentation_pages').select('id').eq('slug', p.slug);
    if (!data || data.length === 0) {
      await supabase.from('documentation_pages').insert(p);
      console.log(`Seeded ${p.slug}`);
    } else {
      console.log(`Already exists: ${p.slug}`);
    }
  }
}
run();
