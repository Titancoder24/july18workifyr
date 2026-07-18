"use client";

import Link from "next/link";
import React from "react";

export default function MarketingNavbar() {
  return (
    <header className="bg-[#40826D] text-white fixed top-0 w-full z-50 border-b border-white/10 shadow-sm">
      <div className="flex justify-between items-center h-20 px-6 md:px-12 max-w-[1280px] mx-auto">
        <Link href="/" className="font-[family-name:var(--font-headline-sm)] text-2xl font-bold tracking-tight hover:opacity-80 transition-opacity">
          Workifyr
        </Link>
        <nav className="hidden md:flex gap-8 items-center">
          <Link
            href="/features"
            className="text-gray-300 hover:text-white transition-colors text-sm font-medium tracking-wide"
          >
            Features
          </Link>
          <Link
            href="/about"
            className="text-gray-300 hover:text-white transition-colors text-sm font-medium tracking-wide"
          >
            About Us
          </Link>
          <Link
            href="/pricing"
            className="text-gray-300 hover:text-white transition-colors text-sm font-medium tracking-wide"
          >
            Pricing
          </Link>
          <Link
            href="/docs"
            className="text-gray-300 hover:text-white transition-colors text-sm font-medium tracking-wide"
          >
            Docs
          </Link>
        </nav>
        <Link
          href="/login"
          className="bg-white text-[#40826D] hover:bg-gray-100 px-6 py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all active:scale-95 duration-150 ease-in-out hidden md:block"
        >
          Deploy Workspace
        </Link>
      </div>
    </header>
  );
}
