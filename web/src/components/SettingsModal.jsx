import React, { useState } from 'react';
import { X, Check, Globe, RefreshCw, AlertCircle } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, apiUrl, onSaveApiUrl }) {
  const [inputUrl, setInputUrl] = useState(apiUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const cleanUrl = inputUrl.replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/api/status`, { mode: 'cors' });
      if (res.ok) {
        const data = await res.json();
        setTestResult({ ok: true, msg: `Connected successfully! Engine: ${data.engine || 'Online'}` });
      } else {
        setTestResult({ ok: false, msg: `HTTP Error: ${res.status} ${res.statusText}` });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: `Connection failed: ${e.message}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onSaveApiUrl(inputUrl.replace(/\/+$/, ''));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">
              Terminal Backend API Settings
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="py-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Backend API URL (Render or Localhost)
            </label>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="https://your-service.onrender.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900"
            />
            <p className="text-[11px] text-slate-500 mt-1.5">
              Enter the public URL of your Render Web Service.
            </p>
          </div>

          {/* Presets */}
          <div>
            <span className="text-[11px] font-bold text-slate-500 block mb-1.5 uppercase">
              Quick Presets
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setInputUrl('http://localhost:8080')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Localhost (:8080)
              </button>
              <button
                type="button"
                onClick={() => setInputUrl('http://127.0.0.1:8080')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                127.0.0.1 (:8080)
              </button>
              <button
                type="button"
                onClick={() => setInputUrl('')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition"
              >
                Simulation / Demo
              </button>
            </div>
          </div>

          {/* Test Status */}
          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                testResult.ok
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {testResult.ok ? (
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              )}
              <span>{testResult.msg}</span>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 hover:bg-slate-50 text-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
            {testing ? 'Testing...' : 'Test Connection'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
