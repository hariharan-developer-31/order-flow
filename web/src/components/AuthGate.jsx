import React, { useState } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  UserPlus,
} from 'lucide-react';
import { loginUser, registerUser } from '../services/authService';

export default function AuthGate({ onAuthSuccess, initialMessage = null }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState(initialMessage || '');
  const [statusNotice, setStatusNotice] = useState(null); // 'pending' | 'rejected' | 'registered' | null
  const [registeredId, setRegisteredId] = useState('');

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setErrorMsg('');
    setStatusNotice(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusNotice(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await loginUser(username.trim(), password);
        if (res.ok && res.user) {
          onAuthSuccess(res.user, res.pendingCount || 0);
          return;
        }
        if (res.status === 'pending') {
          setStatusNotice('pending');
          setErrorMsg(res.error || 'Your account is waiting for Admin approval.');
        } else if (res.status === 'rejected') {
          setStatusNotice('rejected');
          setErrorMsg(res.error || 'Your access request was rejected by the Admin.');
        } else {
          setErrorMsg(res.error || 'Invalid User ID or Password.');
        }
      } else {
        const res = await registerUser(name.trim(), username.trim(), password);
        if (res.ok) {
          setRegisteredId(res.user?.username || username.trim().toLowerCase());
          setStatusNotice('registered');
          setName('');
          setUsername('');
          setPassword('');
          return;
        }
        setErrorMsg(res.error || 'Could not create account.');
      }
    } catch {
      setErrorMsg('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#0D0D0C] flex flex-col items-center justify-center p-4 font-sans selection:bg-[#0D0D0C] selection:text-white">
      <div className="w-full max-w-[390px] bg-white border border-[#0D0D0C]/12 rounded-[10px] p-6 sm:p-7 shadow-[0_4px_24px_rgba(13,13,12,0.06)]">
        {/* Brand Header */}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-[6px] bg-[#0D0D0C] text-white flex items-center justify-center font-bold text-xs shrink-0">
            TB
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-[#0D0D0C] font-headline leading-none">
              TRADING BOY
            </h1>
            <p className="text-[11px] font-mono text-[#0D0D0C]/50 mt-1">
              Authorized Access Only
            </p>
          </div>
        </div>

        {/* Registration Confirmation Screen */}
        {statusNotice === 'registered' ? (
          <div className="py-2">
            <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-3">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-base font-bold text-[#0D0D0C]">
              Approval Pending
            </h2>
            <p className="text-xs text-[#0D0D0C]/65 mt-1.5 leading-relaxed">
              Your account <span className="font-mono font-semibold text-[#0D0D0C]">@{registeredId}</span> has been created and sent to the Admin Panel.
            </p>
            <div className="mt-4 p-3 rounded-[6px] bg-[#F8F9FA] border border-[#0D0D0C]/10 text-[11px] text-[#0D0D0C]/70 leading-relaxed">
              Once the administrator clicks <strong className="text-[#0D0D0C]">Accept</strong>, you will be able to sign in and view live charts.
            </div>
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="mt-5 w-full h-9 rounded-[6px] bg-[#0D0D0C] text-white text-xs font-semibold hover:bg-[#0D0D0C]/90 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Back to Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <>
            {/* Mode Switcher: Sign In | Create Account */}
            <div className="grid grid-cols-2 bg-[#F4F4F5] p-1 rounded-[6px] border border-[#0D0D0C]/08 mb-5 text-xs font-mono">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`py-1.5 rounded-[5px] font-semibold transition cursor-pointer ${
                  mode === 'login'
                    ? 'bg-[#0D0D0C] text-white shadow-xs'
                    : 'text-[#0D0D0C]/60 hover:text-[#0D0D0C]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`py-1.5 rounded-[5px] font-semibold transition cursor-pointer ${
                  mode === 'register'
                    ? 'bg-[#0D0D0C] text-white shadow-xs'
                    : 'text-[#0D0D0C]/60 hover:text-[#0D0D0C]'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Status / Error Alerts */}
            {errorMsg && (
              <div
                className={`mb-4 p-3 rounded-[6px] border text-xs flex items-start gap-2 leading-relaxed ${
                  statusNotice === 'pending'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : statusNotice === 'rejected'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {statusNotice === 'pending' ? (
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                ) : statusNotice === 'rejected' ? (
                  <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === 'register' && (
                <div>
                  <label className="block text-[11px] font-mono font-semibold text-[#0D0D0C]/70 uppercase tracking-wider mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserPlus className="w-3.5 h-3.5 text-[#0D0D0C]/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      autoComplete="name"
                      className="w-full h-9 pl-9 pr-3 text-xs rounded-[6px] border border-[#0D0D0C]/15 bg-white text-[#0D0D0C] placeholder:text-[#0D0D0C]/35 focus:outline-none focus:border-[#0D0D0C]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-mono font-semibold text-[#0D0D0C]/70 uppercase tracking-wider mb-1">
                  User ID
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-[#0D0D0C]/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={mode === 'login' ? 'Enter ID' : 'Choose a User ID'}
                    autoComplete="username"
                    className="w-full h-9 pl-9 pr-3 text-xs font-mono rounded-[6px] border border-[#0D0D0C]/15 bg-white text-[#0D0D0C] placeholder:text-[#0D0D0C]/35 focus:outline-none focus:border-[#0D0D0C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-semibold text-[#0D0D0C]/70 uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-[#0D0D0C]/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="w-full h-9 pl-9 pr-9 text-xs font-mono rounded-[6px] border border-[#0D0D0C]/15 bg-white text-[#0D0D0C] placeholder:text-[#0D0D0C]/35 focus:outline-none focus:border-[#0D0D0C]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#0D0D0C]/40 hover:text-[#0D0D0C] cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-9 mt-2 rounded-[6px] bg-[#0D0D0C] text-white text-xs font-semibold hover:bg-[#0D0D0C]/90 transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {loading ? (
                  <span className="font-mono">Please wait...</span>
                ) : mode === 'login' ? (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Request Access</span>
                  </>
                )}
              </button>
            </form>

            {mode === 'register' && (
              <p className="mt-4 text-[11px] text-[#0D0D0C]/50 text-center leading-relaxed">
                New accounts require Admin approval before accessing live market data.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
