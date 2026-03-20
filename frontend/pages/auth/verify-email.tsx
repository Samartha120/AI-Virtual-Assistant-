'use client';

import * as React from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

import { auth } from '../../lib/firebaseClient';
import PhoneVerificationPage from './phone-verification';
import { useStore } from '../../store/useStore';

type Mode = 'email' | 'phone';

const EMAIL_RESEND_COOLDOWN_SECONDS = 30;
const EMAIL_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const EMAIL_RATE_LIMIT_MAX_SENDS = 3;

function formatFirebaseAuthError(err: any): string {
  const code = err?.code as string | undefined;
  switch (code) {
    case 'auth/too-many-requests':
      return 'Firebase allows only a few emails per minute. Please wait 1-2 minutes and try again. And check your Spam/Junk folder!';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    default:
      return err?.message || 'Something went wrong. Please check your Spam folder or try again.';
  }
}

function loadEmailSendHistory(): number[] {
  try {
    const raw = localStorage.getItem('nexus:emailVerifySendHistory');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => typeof t === 'number');
  } catch {
    return [];
  }
}

function saveEmailSendHistory(history: number[]) {
  try {
    localStorage.setItem('nexus:emailVerifySendHistory', JSON.stringify(history));
  } catch {
    // ignore
  }
}

function canSendEmailNow(): { ok: boolean; message?: string } {
  const now = Date.now();
  const history = loadEmailSendHistory().filter((t) => now - t < EMAIL_RATE_LIMIT_WINDOW_MS);
  if (history.length >= EMAIL_RATE_LIMIT_MAX_SENDS) {
    return { ok: false, message: 'You requested multiple emails. Please wait a few minutes, and check your Spam/Junk folder.' };
  }
  return { ok: true };
}

function isAccountVerified(user: typeof auth.currentUser): boolean {
  if (!user) return false;
  return user.emailVerified || Boolean(user.phoneNumber);
}

export default function VerifyEmailPage() {
  const setVerificationComplete = useStore((s) => s.setVerificationComplete);
  const isVerified = useStore((s) => s.isVerified);
  const navigate = useNavigate();

  const [mode, setMode] = React.useState<Mode>('email');
  const [isSending, setIsSending] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isVerified) return;
    navigate('/dashboard', { replace: true });
  }, [isVerified, navigate]);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [cooldown]);

  // Poll for verification while on email mode.
  React.useEffect(() => {
    if (mode !== 'email') return;

    const interval = window.setInterval(async () => {
      try {
        if (!auth.currentUser) return;
        await auth.currentUser.reload();
        if (isAccountVerified(auth.currentUser)) {
          setVerificationComplete(true);
        }
      } catch {
        // ignore polling errors
      }
    }, 4000);

    return () => window.clearInterval(interval);
  }, [mode, setVerificationComplete]);

  const handleResend = async () => {
    setError(null);

    if (!auth.currentUser) {
      setError('You are not signed in.');
      return;
    }

    if (cooldown > 0) return;

    const rate = canSendEmailNow();
    if (!rate.ok) {
      setError(rate.message ?? 'Too many requests.');
      return;
    }

    setIsSending(true);
    try {
      await sendEmailVerification(auth.currentUser);

      const now = Date.now();
      const history = loadEmailSendHistory().filter((t) => now - t < EMAIL_RATE_LIMIT_WINDOW_MS);
      history.push(now);
      saveEmailSendHistory(history);

      setCooldown(EMAIL_RESEND_COOLDOWN_SECONDS);
    } catch (err: any) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setIsSending(false);
    }
  };

  const handleCheck = async () => {
    setError(null);

    if (!auth.currentUser) {
      setError('You are not signed in.');
      return;
    }

    setIsChecking(true);
    try {
      await auth.currentUser.reload();
      if (isAccountVerified(auth.currentUser)) {
        setVerificationComplete(true);
      } else {
        setError('Not verified yet. Please check your Inbox and Spam/Junk folders, click the link, and try again.');
      }
    } catch (err: any) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setIsChecking(false);
    }
  };

  if (mode === 'phone') {
    return (
      <PhoneVerificationPage
        onVerified={() => {
          setVerificationComplete(true);
          navigate('/dashboard', { replace: true });
        }}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface/40 p-8 shadow-2xl backdrop-blur-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-linear-to-tr from-primary to-blue-500 shadow-lg shadow-primary/30 flex items-center justify-center mb-5">
            <span className="text-3xl font-bold text-white">N</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Verify your email</h1>
          <p className="text-sm text-gray-400 mt-2">
             We sent a verification link to your email.<br/>
             <span className="text-amber-400 font-medium">IMPORTANT: Please check your Spam/Junk folder if you don't see it!</span>
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 text-center">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleCheck}
            disabled={isChecking}
            className="w-full flex items-center justify-center py-3 rounded-xl font-medium bg-linear-to-r from-primary to-blue-600 text-white shadow-lg shadow-primary/25 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isChecking ? <Loader2 className="animate-spin w-5 h-5" /> : 'I have verified my email'}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={isSending || cooldown > 0}
            className="w-full flex items-center justify-center py-3 rounded-xl font-medium border border-white/10 bg-black/20 text-white hover:bg-black/30 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <Loader2 className="animate-spin w-5 h-5" />
            ) : cooldown > 0 ? (
              `Resend email in ${cooldown}s`
            ) : (
              'Resend email'
            )}
          </button>

          <button
            type="button"
            onClick={() => setMode('phone')}
            className="w-full text-sm text-primary hover:text-primary/80 transition-colors"
          >
            Use phone verification instead
          </button>

          <button
            type="button"
            onClick={async () => {
              try {
                await signOut(auth);
              } catch {
                // ignore
              }
              navigate('/login');
            }}
            className="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mt-2"
          >
            <ArrowLeft size={14} />
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
