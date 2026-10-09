import type { Metadata } from 'next';
import { Fraunces, Geist, Geist_Mono } from 'next/font/google';
import { Providers } from '@/components/providers';
import { Header } from '@/components/header';
import './globals.css';

const sans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const mono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const display = Fraunces({ variable: '--font-fraunces', subsets: ['latin'], axes: ['opsz'] });

export const metadata: Metadata = {
  title: 'TicketRush',
  description: 'Pick your seats. We hold them while you pay.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable} antialiased`}>
      <body className="min-h-screen">
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
