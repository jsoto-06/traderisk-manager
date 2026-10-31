'use client';

import React, { useState } from 'react';
import {
  LogIn,
  UserPlus,
  KeyRound,
  Mail,
  Lock,
  User as UserIcon,
  Sparkles,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/lib/i18n/useLocale';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'forgot';
  onSuccess?: () => void;
}

export function AuthModal({
  isOpen,
  onClose,
  initialMode = 'login',
  onSuccess,
}: AuthModalProps) {
  const { locale } = useLocale();
  const isEs = locale === 'es';
  const { isConfigured, signIn, signUp, resetPassword, error, clearError } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleModeSwitch = (newMode: 'login' | 'register' | 'forgot') => {
    setMode(newMode);
    setFormError(null);
    setSuccessMessage(null);
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);
    clearError();

    if (!email || !email.includes('@')) {
      setFormError(isEs ? 'Introduce un correo electrónico válido' : 'Please enter a valid email address');
      return;
    }

    if (mode === 'forgot') {
      setLoading(true);
      const res = await resetPassword(email);
      setLoading(false);
      if (res.error) {
        setFormError(res.error);
      } else {
        setSuccessMessage(
          isEs
            ? 'Se ha enviado un enlace de recuperación a tu correo electrónico.'
            : 'A password recovery link has been sent to your email.'
        );
      }
      return;
    }

    if (!password || password.length < 6) {
      setFormError(
        isEs
          ? 'La contraseña debe tener al menos 6 caracteres'
          : 'Password must be at least 6 characters long'
      );
      return;
    }

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setFormError(isEs ? 'Las contraseñas no coinciden' : 'Passwords do not match');
        return;
      }

      setLoading(true);
      const res = await signUp(email, password, fullName || undefined);
      setLoading(false);
      if (res.error) {
        setFormError(res.error);
      } else {
        setSuccessMessage(
          isEs
            ? '¡Cuenta creada con éxito! Si tu proyecto requiere confirmación por email, revisa tu bandeja de entrada.'
            : 'Account created successfully! If email confirmation is required, please check your inbox.'
        );
        if (onSuccess) onSuccess();
        setTimeout(() => {
          onClose();
        }, 1500);
      }
      return;
    }

    // Login mode
    setLoading(true);
    const res = await signIn(email, password);
    setLoading(false);
    if (res.error) {
      setFormError(res.error);
    } else {
      setSuccessMessage(isEs ? 'Sesión iniciada correctamente' : 'Signed in successfully');
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1000);
    }
  };

  const getTitle = () => {
    if (!isConfigured) {
      return isEs ? 'Autenticación & Nube' : 'Cloud & Authentication';
    }
    if (mode === 'login') return isEs ? 'Iniciar Sesión' : 'Sign In';
    if (mode === 'register') return isEs ? 'Crear Cuenta' : 'Create Account';
    return isEs ? 'Recuperar Contraseña' : 'Reset Password';
  };

  const getSubtitle = () => {
    if (!isConfigured) {
      return isEs ? 'Modo Local Activo' : 'Local Mode Active';
    }
    if (mode === 'login') {
      return isEs
        ? 'Accede a tu cuenta para sincronizar tus datos con Supabase'
        : 'Sign in to sync your trading data with Supabase';
    }
    if (mode === 'register') {
      return isEs
        ? 'Crea tu perfil cifrado para respaldo seguro multi-dispositivo'
        : 'Create your encrypted profile for multi-device cloud backup';
    }
    return isEs
      ? 'Introduce tu correo para recibir un enlace de restablecimiento'
      : 'Enter your email to receive a password reset link';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#00F0FF]/10 text-[#00F0FF] flex items-center justify-center">
            {mode === 'login' && <LogIn className="w-4 h-4" />}
            {mode === 'register' && <UserPlus className="w-4 h-4" />}
            {mode === 'forgot' && <KeyRound className="w-4 h-4" />}
          </div>
          <span>{getTitle()}</span>
        </div>
      }
      subtitle={getSubtitle()}
      size="md"
    >
      {!isConfigured ? (
        <div className="space-y-4 py-2">
          <Alert variant="info">
            <div className="space-y-1.5 text-xs">
              <p className="font-semibold text-sm text-[#F5F7FA]">
                {isEs ? 'Modo Local Offline Activo' : 'Offline Local Mode Active'}
              </p>
              <p className="text-[#94A3B8]">
                {isEs
                  ? 'TradeRisk Manager opera actualmente con persistencia local en tu navegador (LocalStorage). Todas tus cuentas, operaciones y notas están seguras en este dispositivo.'
                  : 'TradeRisk Manager is currently running with local browser storage. All your accounts, trades, and journal notes are safe on this device.'}
              </p>
              <div className="mt-3 p-3 bg-[#0A1128] rounded-lg border border-[#1E2D4A] space-y-1">
                <p className="font-mono text-[11px] text-[#00F0FF]">
                  {isEs ? '¿Quieres activar la persistencia en la nube?' : 'Want to enable cloud persistence?'}
                </p>
                <p className="text-[11px] text-[#94A3B8]">
                  {isEs
                    ? 'Configura las variables de entorno en tu archivo .env.local:'
                    : 'Set up environment variables in your .env.local file:'}
                </p>
                <code className="block bg-[#111C35] p-2 rounded text-[10px] text-[#00F0FF] font-mono break-all select-all">
                  NEXT_PUBLIC_SUPABASE_URL=https://xyz.supabase.co
                  <br />
                  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
                </code>
              </div>
            </div>
          </Alert>

          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={onClose}>
              {isEs ? 'Entendido (Continuar en Local)' : 'Understood (Continue Local)'}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Form / API feedback alerts */}
          {(formError || error) && (
            <Alert variant="error">
              <span className="text-xs">{formError || error}</span>
            </Alert>
          )}

          {successMessage && (
            <Alert variant="success">
              <span className="text-xs">{successMessage}</span>
            </Alert>
          )}

          {/* Mode Switch Tabs */}
          <div className="flex bg-[#0A1128] p-1 rounded-xl border border-[#1E2D4A] text-xs font-medium">
            <button
              type="button"
              onClick={() => handleModeSwitch('login')}
              className={`flex-1 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                mode === 'login'
                  ? 'bg-[#111C35] text-[#00F0FF] shadow-sm font-semibold'
                  : 'text-[#94A3B8] hover:text-[#F5F7FA]'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              {isEs ? 'Iniciar Sesión' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('register')}
              className={`flex-1 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                mode === 'register'
                  ? 'bg-[#111C35] text-[#00F0FF] shadow-sm font-semibold'
                  : 'text-[#94A3B8] hover:text-[#F5F7FA]'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              {isEs ? 'Registrarse' : 'Sign Up'}
            </button>
          </div>

          {/* Register: Full Name field */}
          {mode === 'register' && (
            <Input
              label={isEs ? 'Nombre completo' : 'Full Name'}
              type="text"
              placeholder={isEs ? 'Jonathan Trader' : 'John Trader'}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              prefixIcon={<UserIcon className="w-4 h-4" />}
            />
          )}

          {/* Email input */}
          <Input
            label={isEs ? 'Correo electrónico' : 'Email Address'}
            type="email"
            required
            placeholder="trader@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            prefixIcon={<Mail className="w-4 h-4" />}
          />

          {/* Password input */}
          {mode !== 'forgot' && (
            <Input
              label={isEs ? 'Contraseña' : 'Password'}
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              prefixIcon={<Lock className="w-4 h-4" />}
              helperText={
                mode === 'register'
                  ? isEs
                    ? 'Mínimo 6 caracteres'
                    : 'Minimum 6 characters'
                  : undefined
              }
            />
          )}

          {/* Register: Confirm Password */}
          {mode === 'register' && (
            <Input
              label={isEs ? 'Confirmar contraseña' : 'Confirm Password'}
              type="password"
              required
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              prefixIcon={<Lock className="w-4 h-4" />}
            />
          )}

          {/* Forgot link for login mode */}
          {mode === 'login' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleModeSwitch('forgot')}
                className="text-xs text-[#00F0FF] hover:underline"
              >
                {isEs ? '¿Olvidaste tu contraseña?' : 'Forgot password?'}
              </button>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              className="w-full flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <span>{isEs ? 'Procesando...' : 'Processing...'}</span>
              ) : mode === 'login' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>{isEs ? 'Acceder a mi cuenta' : 'Sign In'}</span>
                </>
              ) : mode === 'register' ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{isEs ? 'Crear cuenta segura' : 'Create Account'}</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>{isEs ? 'Enviar enlace de restablecimiento' : 'Send Reset Link'}</span>
                </>
              )}
            </Button>
          </div>

          {/* Footer mode toggles */}
          <div className="text-center text-xs text-[#94A3B8] pt-2">
            {mode === 'forgot' ? (
              <button
                type="button"
                onClick={() => handleModeSwitch('login')}
                className="text-[#00F0FF] hover:underline"
              >
                {isEs ? '← Volver a inicio de sesión' : '← Back to sign in'}
              </button>
            ) : mode === 'login' ? (
              <p>
                {isEs ? '¿No tienes cuenta? ' : "Don't have an account? "}
                <button
                  type="button"
                  onClick={() => handleModeSwitch('register')}
                  className="text-[#00F0FF] hover:underline font-medium"
                >
                  {isEs ? 'Regístrate aquí' : 'Sign up here'}
                </button>
              </p>
            ) : (
              <p>
                {isEs ? '¿Ya tienes cuenta? ' : 'Already have an account? '}
                <button
                  type="button"
                  onClick={() => handleModeSwitch('login')}
                  className="text-[#00F0FF] hover:underline font-medium"
                >
                  {isEs ? 'Inicia sesión' : 'Sign in here'}
                </button>
              </p>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}
