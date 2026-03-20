/* eslint-disable react/no-unescaped-entities */
'use client';

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background text-white px-4">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 text-center max-w-md">
        {/* Logo */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-linear-to-tr from-primary to-blue-500 shadow-lg shadow-primary/30 flex items-center justify-center mb-8">
          <span className="text-3xl font-bold text-white">N</span>
        </div>

        {/* 404 */}
        <h1 className="text-8xl font-bold text-transparent bg-clip-text bg-linear-to-r from-primary to-blue-400 mb-4">
          404
        </h1>
        <h2 className="text-2xl font-semibold text-white mb-3">Page Not Found</h2>
        <p className="text-gray-400 text-sm mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white transition-all text-sm font-medium"
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-linear-to-r from-primary to-blue-600 text-white font-medium shadow-lg shadow-primary/25 hover:from-primary/90 hover:to-blue-600/90 transition-all text-sm"
          >
            <Home size={16} />
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
