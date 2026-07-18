import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Workifyr — Work, verified, faster.",
  description:
    "One business OS for SMEs. CRM and HRM in a single application, with AI assistants that converse with your data.",
  icons: { icon: "/favicon.ico" },
};

const themeInitScript = `
(function(){try{var t=localStorage.getItem('workifyr-theme');var v=t==='dark'?'dark':'light';var r=document.documentElement;if(v==='dark'){r.classList.add('dark');}r.style.colorScheme=v;}catch(e){}})();
`.trim();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--color-surface)",
              color: "var(--color-ink)",
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-pop)",
              borderRadius: "12px",
            },
          }}
        />
      </body>
    </html>
  );
}
