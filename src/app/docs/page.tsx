import MarketingNavbar from '@/components/marketing/MarketingNavbar';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import { getAllDocs } from '@/lib/docs';
import DocsClient from './DocsClient';

export const dynamic = 'force-dynamic';

export default async function DocsPage() {
  const pages = getAllDocs();

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 flex flex-col selection:bg-[#40826D]/20">
      <MarketingNavbar />
      <DocsClient pages={pages} />
      <MarketingFooter />
    </div>
  );
}
