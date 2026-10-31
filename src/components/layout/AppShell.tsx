'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Calculator,
  Wallet,
  TrendingUp,
  BarChart3,
  BookOpen,
  Settings as SettingsIcon,
  Menu,
  X,
  Shield,
  ChevronDown,
  Sparkles,
  Cloud,
  CloudOff,
  RefreshCw,
  LogOut,
  LogIn,
  CloudUpload,
} from 'lucide-react';
import { useLocale } from '@/lib/i18n/useLocale';
import { useStorage } from '@/hooks/useStorage';
import { useAuth } from '@/hooks/useAuth';
import { useSync } from '@/hooks/useSync';
import { formatCurrency, type Locale } from '@/lib/i18n';
import { Badge } from '@/components/ui/Badge';
import { AuthModal } from '@/components/auth/AuthModal';
import { MigrationModal } from '@/components/auth/MigrationModal';

interface AppShellProps {
  children: React.ReactNode;
  initialLocale?: Locale;
}

export function AppShell({ children }: AppShellProps) {
  const { locale, t, switchLocale } = useLocale();
  const pathname = usePathname();
  const { accounts, activeAccount, selectAccount } = useStorage();
  const { user, isConfigured, signOut } = useAuth();
  const { isOnline, isSyncing, syncNow } = useSync();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [migrationModalOpen, setMigrationModalOpen] = useState(false);

  const navItems = [
    {
      label: t.nav.dashboard,
      href: `/${locale}`,
      icon: <LayoutDashboard className="w-5 h-5" />,
      exact: true,
    },
    {
      label: t.nav.calculator,
      href: `/${locale}/calculator`,
      icon: <Calculator className="w-5 h-5" />,
    },
    {
      label: t.nav.accounts,
      href: `/${locale}/accounts`,
      icon: <Wallet className="w-5 h-5" />,
    },
    {
      label: t.nav.trades,
      href: `/${locale}/trades`,
      icon: <TrendingUp className="w-5 h-5" />,
    },
    {
      label: t.nav.statistics,
      href: `/${locale}/statistics`,
      icon: <BarChart3 className="w-5 h-5" />,
    },
    {
      label: t.nav.analytics,
      href: `/${locale}/analytics`,
      icon: <Sparkles className="w-5 h-5 text-[#00F0FF]" />,
    },
    {
      label: t.nav.journal,
      href: `/${locale}/journal`,
      icon: <BookOpen className="w-5 h-5" />,
    },
    {
      label: t.nav.settings,
      href: `/${locale}/settings`,
      icon: <SettingsIcon className="w-5 h-5" />,
    },
  ];

  const isNavActive = (item: (typeof navItems)[0]) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  const handleManualSync = async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    await syncNow();
  };

  return (
    <div className="min-h-screen bg-[#0A1128] text-[#F5F7FA] flex flex-col lg:flex-row antialiased">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#0A1128]/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0A1128] border-r border-[#1E2D4A] flex flex-col justify-between transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Logo Brand */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-[#1E2D4A]">
            <Link
              href={`/${locale}`}
              className="flex items-center gap-2.5 font-bold tracking-tight text-lg group"
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00F0FF] to-[#3B82F6] flex items-center justify-center text-[#0A1128] shadow-[0_0_15px_rgba(0,240,255,0.4)] group-hover:scale-105 transition-transform">
                <Shield className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="flex flex-col">
                <span className="text-[#F5F7FA] font-bold text-base leading-tight">
                  Trade<span className="text-[#00F0FF]">Risk</span>
                </span>
                <span className="text-[10px] text-[#94A3B8] font-medium tracking-widest uppercase">
                  Manager
                </span>
              </div>
            </Link>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden text-[#94A3B8] hover:text-[#F5F7FA] p-1.5 rounded-lg"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const active = isNavActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'bg-[#111C35] text-[#00F0FF] border border-[#00F0FF]/30 shadow-[0_0_15px_rgba(0,240,255,0.1)]'
                      : 'text-[#94A3B8] hover:text-[#F5F7FA] hover:bg-[#111C35]/60'
                  }`}
                >
                  <span className={active ? 'text-[#00F0FF]' : 'text-[#94A3B8]'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Active Account Info */}
        <div className="p-4 border-t border-[#1E2D4A] bg-[#111C35]/40 m-3 rounded-xl border">
          <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-1">
            <span className="font-medium">{t.dashboard.accountStatus}</span>
            {activeAccount && (
              <Badge variant={activeAccount.type === 'Demo' ? 'yellow' : 'cyan'} size="sm">
                {activeAccount.type}
              </Badge>
            )}
          </div>
          <div className="font-semibold text-sm text-[#F5F7FA] truncate">
            {activeAccount?.name || t.common.loading}
          </div>
          <div className="text-xs text-[#00F0FF] font-mono mt-0.5">
            {activeAccount
              ? formatCurrency(activeAccount.balance, activeAccount.currency, locale)
              : '$0.00'}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="h-16 bg-[#0A1128]/95 backdrop-blur-md border-b border-[#1E2D4A] sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-[#94A3B8] hover:text-[#F5F7FA] hover:bg-[#111C35]"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb / Section Name */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-[#94A3B8]">
              <span>TradeRisk</span>
              <span>/</span>
              <span className="text-[#F5F7FA] font-medium capitalize">
                {pathname.split('/')[2] || t.nav.dashboard}
              </span>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Cloud Sync Status Indicator Pill */}
            <button
              onClick={handleManualSync}
              title={
                !isOnline
                  ? 'Sin conexión a internet'
                  : !isConfigured
                  ? 'Modo Local (Supabase no configurado)'
                  : user
                  ? isSyncing
                    ? 'Sincronizando datos...'
                    : 'Sincronizado con Supabase. Clic para forzar sincronización'
                  : 'Iniciar sesión para sincronizar con la nube'
              }
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                !isOnline
                  ? 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]'
                  : isSyncing
                  ? 'bg-[#00F0FF]/10 border-[#00F0FF]/40 text-[#00F0FF]'
                  : user
                  ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981] hover:border-[#10B981]/60'
                  : 'bg-[#111C35] border-[#1E2D4A] text-[#94A3B8] hover:text-[#F5F7FA] hover:border-[#00F0FF]/40'
              }`}
            >
              {!isOnline ? (
                <>
                  <CloudOff className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Offline</span>
                </>
              ) : isSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00F0FF]" />
                  <span className="hidden md:inline text-[#00F0FF]">Sincronizando...</span>
                </>
              ) : user ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-[#10B981]" />
                  <span className="hidden md:inline text-[#10B981]">Nube OK</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5 text-[#94A3B8]" />
                  <span className="hidden md:inline">Modo Local</span>
                </>
              )}
            </button>

            {/* Account Selector */}
            <div className="relative">
              <button
                onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111C35] border border-[#1E2D4A] hover:border-[#00F0FF]/40 text-xs font-medium text-[#F5F7FA] transition-colors"
              >
                <Wallet className="w-3.5 h-3.5 text-[#00F0FF]" />
                <span className="max-w-[100px] sm:max-w-[150px] truncate">
                  {activeAccount ? activeAccount.name : t.dashboard.selectAccount}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
              </button>

              {accountDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setAccountDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-[#111C35] border border-[#1E2D4A] rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-1 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                      {t.accounts.title}
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y divide-[#1E2D4A]/40 my-1">
                      {accounts.map((acc) => (
                        <button
                          key={acc.id}
                          onClick={() => {
                            selectAccount(acc.id);
                            setAccountDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-[#1A2744] transition-colors ${
                            acc.id === activeAccount?.id
                              ? 'bg-[#1A2744]/70 text-[#00F0FF] font-semibold'
                              : 'text-[#F5F7FA]'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <div>{acc.name}</div>
                            <div className="text-[10px] text-[#94A3B8]">{acc.type}</div>
                          </div>
                          <div className="text-right font-mono text-[11px]">
                            {formatCurrency(acc.balance, acc.currency, locale)}
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="pt-2 px-3 border-t border-[#1E2D4A]/60">
                      <Link
                        href={`/${locale}/accounts`}
                        onClick={() => setAccountDropdownOpen(false)}
                        className="text-xs text-[#00F0FF] hover:underline flex items-center gap-1"
                      >
                        {t.accounts.title} &rarr;
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Language Selector (ES / EN) */}
            <div className="flex items-center bg-[#111C35] border border-[#1E2D4A] rounded-lg p-0.5">
              <button
                onClick={() => switchLocale('es')}
                className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                  locale === 'es'
                    ? 'bg-[#00F0FF] text-[#0A1128] shadow-sm'
                    : 'text-[#94A3B8] hover:text-[#F5F7FA]'
                }`}
                title="Cambiar a Español"
              >
                ES
              </button>
              <button
                onClick={() => switchLocale('en')}
                className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                  locale === 'en'
                    ? 'bg-[#00F0FF] text-[#0A1128] shadow-sm'
                    : 'text-[#94A3B8] hover:text-[#F5F7FA]'
                }`}
                title="Switch to English"
              >
                EN
              </button>
            </div>

            {/* User Profile / Auth Button */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#111C35] border border-[#1E2D4A] hover:border-[#00F0FF]/40 text-xs transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#3B82F6] to-[#00F0FF] flex items-center justify-center text-[#0A1128] font-bold text-[11px]">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="hidden sm:block text-left text-xs">
                    <span className="font-medium text-[#F5F7FA] block leading-tight max-w-[100px] truncate">
                      {user.fullName || user.email?.split('@')[0]}
                    </span>
                    <span className="text-[10px] text-[#00F0FF] flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" /> Cloud Pro
                    </span>
                  </div>
                  <ChevronDown className="w-3 h-3 text-[#94A3B8]" />
                </button>

                {userDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-[#111C35] border border-[#1E2D4A] rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-1.5 border-b border-[#1E2D4A]/60">
                        <div className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-semibold">
                          Conectado como
                        </div>
                        <div className="text-xs font-mono text-[#F5F7FA] truncate mt-0.5">
                          {user.email}
                        </div>
                      </div>

                      <div className="p-1 space-y-0.5">
                        <button
                          onClick={() => {
                            setUserDropdownOpen(false);
                            handleManualSync();
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-[#F5F7FA] hover:bg-[#1A2744] rounded-lg flex items-center gap-2 transition-colors"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 text-[#00F0FF] ${isSyncing ? 'animate-spin' : ''}`} />
                          <span>Sincronizar ahora</span>
                        </button>

                        <button
                          onClick={() => {
                            setUserDropdownOpen(false);
                            setMigrationModalOpen(true);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-[#F5F7FA] hover:bg-[#1A2744] rounded-lg flex items-center gap-2 transition-colors"
                        >
                          <CloudUpload className="w-3.5 h-3.5 text-[#3B82F6]" />
                          <span>Asistente de migración</span>
                        </button>
                      </div>

                      <div className="pt-1 mt-1 border-t border-[#1E2D4A]/60 p-1">
                        <button
                          onClick={() => {
                            setUserDropdownOpen(false);
                            signOut();
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg flex items-center gap-2 transition-colors"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Cerrar sesión</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#00F0FF] to-[#3B82F6] hover:opacity-90 text-[#0A1128] font-semibold text-xs transition-opacity shadow-[0_0_12px_rgba(0,240,255,0.3)]"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Iniciar Sesión</span>
              </button>
            )}
          </div>
        </header>

        {/* Page View Children */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => {
          handleManualSync();
        }}
      />

      {/* Migration Wizard Modal */}
      <MigrationModal
        isOpen={migrationModalOpen}
        onClose={() => setMigrationModalOpen(false)}
      />
    </div>
  );
}
