import * as React from 'react';
import { Loader2 } from 'lucide-react';
import {
  RecaptchaVerifier,
  PhoneAuthProvider,
  signInWithPhoneNumber,
  linkWithCredential,
  signInWithCredential,
  type ConfirmationResult,
} from 'firebase/auth';

import { auth } from '../../lib/firebaseClient';
import OtpInput from '../../components/OtpInput';

type Step = 'phone' | 'otp';

export interface PhoneVerificationPageProps {
  onVerified?: () => void;
}

const OTP_COOLDOWN_SECONDS = 60;
const OTP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const OTP_RATE_LIMIT_MAX_SENDS = 5;

function normalizePhoneNumber(input: string): string {
  return input.replace(/\s+/g, '').trim();
}

function formatFirebaseAuthError(err: any): string {
  const code = err?.code as string | undefined;
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'Please enter a valid phone number in international format (e.g., +15551234567).';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a bit and try again.';
    case 'auth/quota-exceeded':
      return 'SMS quota exceeded for this project. Try again later.';
    case 'auth/captcha-check-failed':
      return 'reCAPTCHA failed. Please try again.';
    case 'auth/code-expired':
      return 'That code has expired. Please request a new one.';
    case 'auth/invalid-verification-code':
      return 'Invalid code. Please double-check and try again.';
    case 'auth/credential-already-in-use':
      return 'That phone number is already linked to a different account.';
    default:
      return err?.message || 'Something went wrong. Please try again.';
  }
}

function loadSendHistory(): number[] {
  try {
    const raw = localStorage.getItem('nexus:otpSendHistory');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => typeof t === 'number');
  } catch {
    return [];
  }
}

function saveSendHistory(history: number[]) {
  try {
    localStorage.setItem('nexus:otpSendHistory', JSON.stringify(history));
  } catch {
    // ignore
  }
}

function canSendOtpNow(): { ok: boolean; message?: string } {
  const now = Date.now();
  const history = loadSendHistory().filter((t) => now - t < OTP_RATE_LIMIT_WINDOW_MS);

  if (history.length >= OTP_RATE_LIMIT_MAX_SENDS) {
    return { ok: false, message: 'You’ve requested too many codes recently. Please wait a few minutes and try again.' };
  }

  return { ok: true };
}

export default function PhoneVerificationPage({ onVerified }: PhoneVerificationPageProps) {
  const [step, setStep] = React.useState<Step>('phone');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [otp, setOtp] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(false);

  const [cooldown, setCooldown] = React.useState(0);

  const confirmationRef = React.useRef<ConfirmationResult | null>(null);
  const recaptchaRef = React.useRef<RecaptchaVerifier | null>(null);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [cooldown]);

  React.useEffect(() => {
    return () => {
      try {
        recaptchaRef.current?.clear();
      } catch {
        // ignore
      }
      recaptchaRef.current = null;
    };
  }, []);

  const getOrCreateRecaptcha = React.useCallback(async () => {
    if (recaptchaRef.current) return recaptchaRef.current;

    const container = document.getElementById('recaptcha-container');
    if (!container) throw new Error('Missing reCAPTCHA container');

    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    });

    await verifier.render();
    recaptchaRef.current = verifier;
    return verifier;
  }, []);

  const startCooldown = () => setCooldown(OTP_COOLDOWN_SECONDS);

  const sendCode = async () => {
    const normalized = normalizePhoneNumber(phoneNumber);
    setError(null);

    if (!/^\+\d{8,15}$/.test(normalized)) {
      setError('Enter a phone number in international format, e.g. +15551234567');
      return;
    }

    if (cooldown > 0) return;

    const rate = canSendOtpNow();
    if (!rate.ok) {
      setError(rate.message ?? 'Too many requests.');
      return;
    }

    setIsSending(true);
    try {
      const verifier = await getOrCreateRecaptcha();
      const confirmation = await signInWithPhoneNumber(auth, normalized, verifier);
      confirmationRef.current = confirmation;

      const now = Date.now();
      const history = loadSendHistory().filter((t) => now - t < OTP_RATE_LIMIT_WINDOW_MS);
      history.push(now);
      saveSendHistory(history);

      startCooldown();
      setStep('otp');
      setOtp('');
    } catch (err: any) {
      setError(formatFirebaseAuthError(err));

      try {
        recaptchaRef.current?.clear();
      } catch {
        // ignore
      }
      recaptchaRef.current = null;
    } finally {
      setIsSending(false);
    }
  };

  const verifyCode = async () => {
    setError(null);
    const confirmation = confirmationRef.current;

    if (!confirmation) {
      setError('Please request a code first.');
      setStep('phone');
      return;
    }

    if (otp.length !== 6) return;

    setIsVerifying(true);
    try {
      const credential = PhoneAuthProvider.credential(confirmation.verificationId, otp);

      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        await linkWithCredential(auth.currentUser, credential);
      } else {
        await signInWithCredential(auth, credential);
      }

      if (auth.currentUser) {
        await auth.currentUser.reload();
      }

      onVerified?.();
    } catch (err: any) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setIsVerifying(false);
    }
  };

  const canResend = cooldown === 0 && !isSending;

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface/40 p-8 shadow-2xl backdrop-blur-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-linear-to-tr from-primary to-blue-500 shadow-lg shadow-primary/30 flex items-center justify-center mb-5">
            <span className="text-3xl font-bold text-white">N</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Verify with phone</h1>
          <p className="text-sm text-gray-400 mt-2">
            {step === 'phone'
              ? 'Enter your phone number and we’ll send a one-time code.'
              : 'Enter the 6-digit code we sent to your phone.'}
          </p>
        </div>

        <div id="recaptcha-container" />

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 text-center">
            {error}
          </div>
        )}

        {step === 'phone' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Phone number</label>
              <input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+15551234567"
                className="w-full h-12 rounded-xl border border-white/10 bg-black/20 px-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
              />
              <p className="text-xs text-gray-500">Use international format (E.164), e.g. +1…</p>
            </div>

            <button
              type="button"
              onClick={sendCode}
              disabled={isSending || cooldown > 0}
              className="w-full flex items-center justify-center py-3 rounded-xl font-medium bg-linear-to-r from-primary to-blue-600 text-white shadow-lg shadow-primary/25 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSending ? <Loader2 className="animate-spin w-5 h-5" /> : 'Send code'}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <OtpInput value={otp} onChange={setOtp} disabled={isVerifying} />

            <button
              type="button"
              onClick={verifyCode}
              disabled={isVerifying || otp.length !== 6}
              className="w-full flex items-center justify-center py-3 rounded-xl font-medium bg-linear-to-r from-primary to-blue-600 text-white shadow-lg shadow-primary/25 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isVerifying ? <Loader2 className="animate-spin w-5 h-5" /> : 'Verify code'}
            </button>

            <div className="flex items-center justify-between text-sm text-gray-400">
              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setError(null);
                }}
                className="hover:text-white transition-colors"
              >
                Change number
              </button>

              <button
                type="button"
                disabled={!canResend}
                onClick={sendCode}
                className="text-primary hover:text-primary/80 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
