import React from 'react';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { AuthProvider } from '@/context/AuthContext';
import type { Locale } from '@/lib/types';

export function generateStaticParams() {
  return [{ locale: 'es' }, { locale: 'en' }];
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (locale !== 'es' && locale !== 'en') {
    notFound();
  }

  return (
    <AuthProvider>
      <AppShell initialLocale={locale as Locale}>{children}</AppShell>
    </AuthProvider>
  );
}
