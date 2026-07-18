"use client";

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { DocPage } from '@/lib/docs';

export default function DocsClient({ pages }: { pages: DocPage[] }) {
  const [activeSlug, setActiveSlug] = useState<string>('index');

  const categories = pages.reduce((acc: any, page: DocPage) => {
    const cat = page.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(page);
    return acc;
  }, {});

  const currentPage = pages.find(p => p.slug === activeSlug) || pages[0];

  return (
    <main className="flex-1 pt-32 pb-24 max-w-[1400px] mx-auto w-full px-6 sm:px-12 flex flex-col md:flex-row gap-16 relative">
      {/* Sticky Sidebar */}
      <aside className="w-full md:w-64 flex-shrink-0 relative">
        <div className="md:sticky md:top-32 space-y-8">
          {Object.keys(categories).map((cat) => (
            <div key={cat} className="space-y-3">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-[0.15em] px-3">{cat}</h3>
              <div className="space-y-1">
                {categories[cat].map((p: DocPage) => {
                  const isActive = p.slug === activeSlug;
                  return (
                    <button
                      key={p.slug}
                      onClick={() => setActiveSlug(p.slug)}
                      className={`block w-full text-left px-3 py-2 text-[14px] rounded-xl transition-all ${
                        isActive
                          ? 'bg-[#40826D]/10 text-[#40826D] font-bold'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-medium'
                      }`}
                    >
                      {p.title}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 max-w-4xl min-w-0">
        {currentPage ? (
          <div className="prose prose-lg prose-gray max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-[#40826D] hover:prose-a:text-[#2d5c4d] prose-h1:text-4xl prose-h1:sm:text-5xl prose-h1:font-extrabold prose-h1:mb-8 prose-h2:border-b prose-h2:border-gray-100 prose-h2:pb-4 prose-h2:mt-12 prose-pre:bg-gray-900 prose-pre:text-gray-100">
            <h1>{currentPage.title}</h1>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentPage.content}</ReactMarkdown>
          </div>
        ) : (
          <div className="prose prose-lg prose-gray max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-h1:text-4xl prose-h1:sm:text-5xl prose-h1:font-extrabold">
            <h1>Documentation</h1>
            <p className="text-xl text-gray-500">Welcome to the documentation. Please select a topic from the sidebar.</p>
          </div>
        )}
      </div>
    </main>
  );
}
