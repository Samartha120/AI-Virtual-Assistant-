import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User as UserIcon, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';

import { auth } from '../../lib/firebaseClient';
import { useStore } from '../../store/useStore';

const AuthPage: React.FC = () => {
  const { login } = useStore();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const normalizeEmail = (value: string) => value.trim();

  const getAuthErrorMessage = (err: any) => {
    const code = err?.code as string | undefined;

    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Invalid email or password. If you migrated from Nhost/Supabase, you must create this user in Firebase (use Sign up) or import users.';
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
        return 'Email/password sign-in is not enabled for this Firebase project.';
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
        const cred = await signInWithEmailAndPassword(auth, normalizeEmail(email), password);
        const token = await cred.user.getIdToken();
        login(
          {
            id: cred.user.uid,
            email: cred.user.email,
            displayName: cred.user.displayName,
          },
          token
        );
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, normalizeEmail(email), password);
      if (fullName.trim()) {
        await updateProfile(cred.user, { displayName: fullName.trim() });
      }
      const token = await cred.user.getIdToken();
      login(
        {
          id: cred.user.uid,
          email: cred.user.email,
          displayName: fullName.trim() || cred.user.displayName,
        },
        token
      );
    } catch (err: any) {
      setError(getAuthErrorMessage(err));
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
