import type { Metadata } from 'next';
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Providers } from '@/components/Providers';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CP Battle — 1v1 Competitive Programming',
  description: 'Race head-to-head against another programmer. Solve problems, climb the ELO ladder.',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'CP Battle',
    description: '1v1 competitive programming. Solve problems faster than your opponent.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} ${spaceGrotesk.variable}`}>
      <head>
        <meta name="theme-color" content="#050505" />
      </head>
      <body className="min-h-screen bg-bg text-text-secondary antialiased" style={{ fontFamily: 'var(--font-jetbrains), monospace' }}>
        <Providers>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-mono focus:text-black"
          >
            Skip to content
          </a>
          <Navbar />
          <div id="main-content" className="pt-9">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
