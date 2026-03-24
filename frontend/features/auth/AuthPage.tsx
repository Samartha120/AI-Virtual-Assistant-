'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User as UserIcon, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
} from 'firebase/auth';

import { auth, isFirebaseConfigured, firebaseEnvStatus } from '../../lib/firebaseClient';
import { useStore } from '../../store/useStore';
import GoogleIcon from './GoogleIcon';
import { logSystemEvent } from '../../services/interactionService';

interface AuthPageProps {
  defaultMode?: 'login' | 'signup';
}

const AuthPage: React.FC<AuthPageProps> = ({ defaultMode = 'login' }) => {
  const { login, targetSwitchEmail, setTargetSwitchEmail, isAuthenticated, isVerified, isAuthLoading } = useStore();
  const navigate = useNavigate();

  if (!isFirebaseConfigured || !auth) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-foreground">
          <h1 className="text-xl font-semibold">Firebase is not configured</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your frontend environment variables are missing. Add these to <strong>frontend/.env</strong> (or a gitignored
            <strong> frontend/.env.local</strong>) and restart <strong>npm run dev</strong>.
          </p>

          <div className="mt-4 rounded-xl bg-background/60 p-4 text-sm">
            <div className="font-medium">Required keys</div>
            <ul className="mt-2 list-disc pl-5 text-muted-foreground">
              <li>NEXT_PUBLIC_FIREBASE_API_KEY {firebaseEnvStatus.apiKey ? '(set)' : '(missing)'}</li>
              <li>NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN {firebaseEnvStatus.authDomain ? '(set)' : '(missing)'}</li>
              <li>NEXT_PUBLIC_FIREBASE_PROJECT_ID {firebaseEnvStatus.projectId ? '(set)' : '(missing)'}</li>
              <li>NEXT_PUBLIC_FIREBASE_APP_ID {firebaseEnvStatus.appId ? '(set)' : '(missing)'}</li>
            </ul>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            You can copy the template from <strong>.env.example</strong> in the repo root.
          </p>
        </div>
      </div>
    );
  }

  const [isLogin, setIsLogin] = useState(defaultMode === 'login');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEmail = localStorage.getItem('nexus:lastEmail');
      if (savedEmail) setEmail(savedEmail);
    }
  }, []);

  useEffect(() => {
    if (targetSwitchEmail) {
      setEmail(targetSwitchEmail);
      setIsLogin(true);
      setTargetSwitchEmail(null);
    }
  }, [targetSwitchEmail, setTargetSwitchEmail]);

  // If the user is already authenticated, don't allow landing on /login or /signup
  // via browser back/forward or manual navigation.
  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAuthenticated) return;
    if (!isVerified) {
      navigate('/verify-email', { replace: true });
      return;
    }
    navigate('/dashboard', { replace: true });
  }, [isAuthLoading, isAuthenticated, isVerified, navigate]);
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const normalizeEmail = (value: string) => value.trim().toLowerCase();

  const PENDING_GOOGLE_LINK_KEY = 'nexus:pendingGoogleLink';

  const savePendingGoogleLink = (payload: { email: string; idToken: string; accessToken?: string | null }) => {
    try {
      sessionStorage.setItem(PENDING_GOOGLE_LINK_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  };

  const loadPendingGoogleLink = (): { email: string; idToken: string; accessToken?: string | null } | null => {
    try {
      const raw = sessionStorage.getItem(PENDING_GOOGLE_LINK_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as any;
      if (!parsed || typeof parsed !== 'object') return null;
      if (typeof parsed.email !== 'string' || typeof parsed.idToken !== 'string') return null;
      return {
        email: parsed.email,
        idToken: parsed.idToken,
        accessToken: typeof parsed.accessToken === 'string' ? parsed.accessToken : null,
      };
    } catch {
      return null;
    }
  };

  const clearPendingGoogleLink = () => {
    try {
      sessionStorage.removeItem(PENDING_GOOGLE_LINK_KEY);
    } catch {
      // ignore
    }
  };

  const getAuthErrorMessage = (err: any) => {
    const code = err?.code as string | undefined;
    const projectId = auth?.app?.options?.projectId ? String(auth.app.options.projectId) : '';

    switch (code) {
      case 'auth/invalid-credential':
        return `Incorrect password or this email uses a different sign-in method. If you signed up with Google, use “Continue with Google”. (Project: ${projectId})`;
      case 'auth/wrong-password':
        return `Incorrect password. If you signed up with Google, use “Continue with Google”. (Project: ${projectId})`;
      case 'auth/user-not-found':
        return `No account found for this email. If you haven't signed up, click “Sign up” below. (Project: ${projectId})`;
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a bit and try again.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection and try again.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Please log in instead.';
      case 'auth/weak-password':
        return 'Password is too weak. Use at least 6 characters.';
      case 'auth/operation-not-allowed':
        return `Email/password sign-in is not enabled for this Firebase project. (Project: ${projectId})`;
      case 'auth/account-exists-with-different-credential':
        return `This email is already registered with a different sign-in method. Sign in with your existing method first, then you can use both Email/Password and Google on future logins. (Project: ${projectId})`;
      default:
        return err?.message || 'An error occurred. Please try again.';
    }
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setError('Enter your email above, then click “Forgot password?” again.');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setError('Password reset email sent. Please check your inbox (and spam).');
    } catch (err: any) {
      const code = err?.code as string | undefined;
      if (code === 'auth/user-not-found') {
        setError('No account found for this email. Click “Sign up” to create one.');
      } else {
        setError(getAuthErrorMessage(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const token = await cred.user.getIdToken();

      // Save Google email for next time
      if (cred.user.email && typeof window !== 'undefined') {
        localStorage.setItem('nexus:lastEmail', normalizeEmail(cred.user.email));
      }

      login(
        {
          id: cred.user.uid,
          email: cred.user.email,
          displayName: cred.user.displayName,
          emailVerified: cred.user.emailVerified,
          phoneNumber: cred.user.phoneNumber,
        },
        token
      );

      logSystemEvent({ type: 'auth', action: 'USER_LOGIN' });

      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const code = err?.code as string | undefined;

      // Log failed Google auth
      logSystemEvent({
        type: 'auth',
        action: 'USER_LOGIN_FAILED',
        description: 'Google sign-in failed',
        errorCode: code,
        errorMessage: typeof err?.message === 'string' ? err.message : 'Unknown error',
      });

      // User intentionally closed the popup: don't show a scary error.
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }

      // If the email already exists with password login, store the Google credential so we can link it
      // right after the user signs in with email/password.
      if (code === 'auth/account-exists-with-different-credential') {
        const emailFromError = (err?.customData?.email as string | undefined) ?? '';
        const normalized = normalizeEmail(emailFromError);
        const pending = GoogleAuthProvider.credentialFromError(err) as any;
        const idToken = pending?.idToken as string | undefined;
        const accessToken = pending?.accessToken as string | undefined;

        // Best-effort: ask Firebase what sign-in methods exist for this email.
        // Note: This call may be blocked or return empty if Email Enumeration Protection is enabled.
        let methods: string[] = [];
        if (normalized) {
          try {
            methods = await fetchSignInMethodsForEmail(auth, normalized);
          } catch {
            methods = [];
          }
        }

        if (normalized && idToken) {
          savePendingGoogleLink({ email: normalized, idToken, accessToken });
          setEmail(normalized);

          // If methods indicate password, guide the user accordingly.
          if (methods.includes('password')) {
            setError('This email already has a password login. Sign in with your email + password to link Google for next time.');
          } else if (methods.length) {
            setError('This email already exists with a different sign-in method. Please sign in using your original method first, then try Google again to link accounts.');
          } else {
            // Fallback message when methods are unavailable.
            setError('This email already exists. Please sign in with your existing method (email + password) to link Google for next time.');
          }
          return;
        }
      }

      setError(getAuthErrorMessage(err));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const normalizedEmail = normalizeEmail(email);

    // Save email immediately for next time, even if attempt fails
    if (typeof window !== 'undefined') {
      localStorage.setItem('nexus:lastEmail', normalizedEmail);
    }

    try {
      if (isLogin) {
        const cred = await signInWithEmailAndPassword(auth, normalizedEmail, password);

        // If the user previously attempted Google sign-in for this same email, link providers now
        // so both login methods work going forward.
        const pending = loadPendingGoogleLink();
        if (pending && normalizeEmail(pending.email) === normalizedEmail) {
          try {
            const googleCredential = GoogleAuthProvider.credential(pending.idToken, pending.accessToken ?? undefined);
            await linkWithCredential(cred.user, googleCredential);
          } catch {
            // Linking is best-effort; login should still succeed.
          } finally {
            clearPendingGoogleLink();
          }
        }

        const token = await cred.user.getIdToken(true);
        login(
          {
            id: cred.user.uid,
            email: cred.user.email,
            displayName: cred.user.displayName,
            emailVerified: cred.user.emailVerified,
            phoneNumber: cred.user.phoneNumber,
          },
          token
        );
        logSystemEvent({ type: 'auth', action: 'USER_LOGIN' });
        navigate('/dashboard', { replace: true });
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, normalizeEmail(email), password);
      if (fullName.trim()) {
        await updateProfile(cred.user, { displayName: fullName.trim() });
      }

      // Professional verification flow: send verification email on sign-up.
      try {
        await sendEmailVerification(cred.user);
      } catch (emailErr) {
        console.error("Firebase sendEmailVerification failed:", emailErr);
        // If this fails, user can still resend from the verification screen.
      }

      const token = await cred.user.getIdToken();
      login(
        {
          id: cred.user.uid,
          email: cred.user.email,
          displayName: fullName.trim() || cred.user.displayName,
          emailVerified: cred.user.emailVerified,
          phoneNumber: cred.user.phoneNumber,
        },
        token
      );

      logSystemEvent({ type: 'auth', action: 'USER_SIGNUP' });

      // Redirect to verify-email; ProtectedRoute will also enforce this,
      // but explicit navigate gives a clean URL.
      navigate('/verify-email', { replace: true });
    } catch (err: any) {
      const code = err?.code as string | undefined;

      logSystemEvent({
        type: 'auth',
        action: isLogin ? 'USER_LOGIN_FAILED' : 'USER_SIGNUP_FAILED',
        description: isLogin ? 'Email/password login failed' : 'Signup failed',
        errorCode: code,
        errorMessage: typeof err?.message === 'string' ? err.message : 'Unknown error',
      });

      // If user tries email/password login but account was created with Google only,
      // explain how to enable password so both methods work.
      if (
        isLogin &&
        (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found')
      ) {
        const normalizedEmail = normalizeEmail(email);
        if (normalizedEmail) {
          try {
            const methods = await fetchSignInMethodsForEmail(auth, normalizedEmail);
            const hasGoogle = methods.includes('google.com');
            const hasPassword = methods.includes('password');
            if (hasGoogle && !hasPassword) {
              setError(
                'This email is registered with Google sign-in. Click “Continue with Google” to sign in, then go to Settings → Enable Email/Password Login to set a password. After that, both Google and normal sign-in will work.'
              );
              return;
            }
          } catch (fetchErr: any) {
            // Log for debugging if needed, but don't show to user.
            // Some Firebase projects block this for security (Email Enumeration Protection).
            console.warn('Firebase fetchSignInMethodsForEmail failed:', fetchErr);
            // If it fails with 400, it's often because the project doesn't allow it.
            // We'll still show the generic error below.
          }
        }
      }

      // If the user doesn't exist in Firebase Auth, guide them to Sign up (no Firebase-console manual creation).
      // We deliberately do NOT auto-create on failed login (security/account-takeover risk).
      // Note: fetchSignInMethodsForEmail is removed here as it frequently breaks with Firebase Email Enumeration Protection.

      // If a user tries to create an email/password account but the email already exists (often via Google)
      // guide them into the correct login flow.
      if (!isLogin && code === 'auth/email-already-in-use') {
        setIsLogin(true);
        setError('An account already exists for this email. Please sign in instead (use Google if that’s how you signed up). After signing in with Google, you can enable a password in Settings so both methods work.');
      } else {
        setError(getAuthErrorMessage(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-background">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, type: 'spring' }}
        className="relative z-10 w-full max-w-md p-8 bg-surface border border-border shadow-xl rounded-3xl"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-linear-to-tr from-primary to-blue-500 shadow-md shadow-primary/20 flex items-center justify-center mb-6">
            <span className="text-3xl font-bold text-white">N</span>
          </div>
          <h1 className="heading-lg text-text-primary tracking-tight">
            {isLogin ? 'Welcome back to NexusAI' : 'Join Nexus Enterprise OS'}
          </h1>
          <p className="body-sm text-text-secondary mt-2">
            {isLogin
              ? 'Enter your credentials to access your workspace.'
              : 'Create an account to unlock intelligent productivity.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden"
              >
                <label htmlFor="name-input" className="body-sm font-medium text-text-secondary">Full Name</label>
                <div className="flex items-center w-full h-12 bg-input-bg border border-border rounded-xl px-4 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/40 transition-all">
                  <UserIcon className="text-text-tertiary mr-3 shrink-0" size={18} />
                  <input
                    id="name-input"
                    type="text"
                    name="name"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="flex-1 h-full bg-transparent text-text-primary placeholder:text-text-tertiary focus:outline-none text-sm"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2">
            <label htmlFor="email-input" className="body-sm font-medium text-text-secondary">Email Address</label>
            <div className="flex items-center w-full h-12 bg-input-bg border border-border rounded-xl px-4 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/40 transition-all">
              <Mail className="text-text-tertiary mr-3 shrink-0" size={18} />
              <input
                id="email-input"
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="flex-1 h-full bg-transparent text-text-primary placeholder:text-text-tertiary focus:outline-none text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password-input" className="body-sm font-medium text-text-secondary">Password</label>
              {isLogin && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="caption text-text-tertiary hover:text-text-primary transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="flex items-center w-full h-12 bg-input-bg border border-border rounded-xl px-4 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/40 transition-all">
              <Lock className="text-text-tertiary mr-3 shrink-0" size={18} />
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="flex-1 h-full bg-transparent text-text-primary placeholder:text-text-tertiary focus:outline-none text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="ml-2 h-full px-2 text-text-tertiary hover:text-text-primary transition-colors flex items-center justify-center shrink-0"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl caption text-red-400 text-center"
            >
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={isLoading || isGoogleLoading}
            className="w-full relative group flex items-center justify-center py-3 bg-white hover:bg-gray-100 text-[#0B0E14] rounded-xl font-bold transition-all shadow-lg mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="relative z-10 flex items-center">
              {isLoading ? (
                <Loader2 className="animate-spin w-5 h-5" />
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </span>
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
              <span className="bg-surface px-2 text-text-tertiary">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading}
            className="w-full flex items-center justify-center py-3 bg-surface border border-border hover:bg-surface-muted text-text-secondary hover:text-text-primary rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
              <Loader2 className="animate-spin w-5 h-5" />
            ) : (
              <>
                <GoogleIcon className="w-5 h-5 mr-2" />
                Continue with Google
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin((v) => !v);
              setError(null);
            }}
            className="body-sm text-text-tertiary hover:text-text-primary transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
