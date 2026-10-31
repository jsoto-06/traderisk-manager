'use client';

import { useParams, useRouter, usePathname } from 'next/navigation';
import { getTranslations, type Locale } from '@/lib/i18n';

export function useLocale() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const locale = (params.locale as Locale) || 'es';
  const t = getTranslations(locale);

  const switchLocale = (newLocale: Locale) => {
    const segments = pathname.split('/');
    segments[1] = newLocale;
    router.push(segments.join('/'));
  };

  return { locale, t, switchLocale };
}
