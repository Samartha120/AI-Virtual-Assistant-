import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User as UserIcon, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
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

import { auth } from '../../lib/firebaseClient';
import { useStore } from '../../store/useStore';

const AuthPage: React.FC = () => {
  const { login, targetSwitchEmail, setTargetSwitchEmail } = useStore();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (targetSwitchEmail) {
      setEmail(targetSwitchEmail);
      setIsLogin(true);
      setTargetSwitchEmail(null);
    }
  }, [targetSwitchEmail, setTargetSwitchEmail]);
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
    const projectHint = projectId ? ` (project: ${projectId})` : '';

    switch (code) {
      case 'auth/invalid-credential':
        return `Invalid email or password. If this email was created with Google sign-in, use “Continue with Google”, then enable a password in Settings so both methods work.${projectHint}`;
      case 'auth/wrong-password':
        return 'Invalid email or password. If you don\'t have an account yet, click “Sign up”.';
      case 'auth/user-not-found':
        return 'No account found for this email. Click “Sign up” to create one.';
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
        return `Email/password sign-in is not enabled for this Firebase project.${projectHint}`;
      case 'auth/account-exists-with-different-credential':
        return `This email is already registered with a different sign-in method. Sign in with your existing method first, then you can use both Email/Password and Google on future logins.${projectHint}`;
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
    setIsLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const token = await cred.user.getIdToken();
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
    } catch (err: any) {
      const code = err?.code as string | undefined;

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
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        const normalizedEmail = normalizeEmail(email);
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
    } catch (err: any) {
      const code = err?.code as string | undefined;

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
          } catch {
            // If Email Enumeration Protection blocks this, fall back to generic message.
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
        <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, type: 'spring' }}
        className="relative z-10 w-full max-w-md p-8 bg-surface/40 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-linear-to-tr from-primary to-blue-500 shadow-lg shadow-primary/30 flex items-center justify-center mb-6">
            <span className="text-3xl font-bold text-white">N</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {isLogin ? 'Welcome back to NexusAI' : 'Join Nexus Enterprise OS'}
          </h1>
          <p className="text-sm text-gray-400 mt-2">
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
                <label className="text-sm font-medium text-gray-300">Full Name</label>
                <div className="flex items-center w-full h-13 bg-black/20 border border-white/10 rounded-xl px-4 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                  <UserIcon className="text-gray-500 mr-3 shrink-0" size={18} />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="flex-1 h-full bg-transparent text-white placeholder:text-gray-500 focus:outline-none"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Email Address</label>
            <div className="flex items-center w-full h-13 bg-black/20 border border-white/10 rounded-xl px-4 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
              <Mail className="text-gray-500 mr-3 shrink-0" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="flex-1 h-full bg-transparent text-white placeholder:text-gray-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">Password</label>
              {isLogin && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="flex items-center w-full h-13 bg-black/20 border border-white/10 rounded-xl px-4 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
              <Lock className="text-gray-500 mr-3 shrink-0" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="flex-1 h-full bg-transparent text-white placeholder:text-gray-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="ml-2 h-full px-2 text-gray-500 hover:text-white transition-colors flex items-center justify-center shrink-0"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 text-center"
            >
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full relative group flex items-center justify-center py-3 bg-linear-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white rounded-xl font-medium transition-all shadow-lg shadow-primary/25 overflow-hidden mt-6 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
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

          {isLogin && (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center py-3 bg-black/20 hover:bg-black/30 text-white rounded-xl font-medium transition-all border border-white/10 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              Continue with Google
            </button>
          )}
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin((v) => !v);
              setError(null);
            }}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
