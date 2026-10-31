import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'TradeRisk Manager',
  description: 'Professional trading risk management platform',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} h-full dark`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#00F0FF" />
      </head>
      <body className="min-h-full bg-[#0A1128] text-[#F5F7FA] font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
