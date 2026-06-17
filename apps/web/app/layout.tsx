import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Providers } from '@/components/Providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CP Battle — 1v1 Competitive Programming Duels',
  description:
    'Race head-to-head against another programmer. Solve progressively harder problems, climb the ELO ladder.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen antialiased`}>
        <Providers>
          <Navbar />
          <div className="pt-14">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
