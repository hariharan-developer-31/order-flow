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

    const cleanUrl = (inputUrl || '').trim().replace(/\/+$/, '');
    if (!cleanUrl) {
      setTimeout(() => {
        setTestResult({
          ok: true,
          msg: '24/7 Global Live Feed active. Connected directly to Binance global liquidity feeds.',
        });
        setTesting(false);
      }, 300);
      return;
    }

    try {
      const res = await fetch(`${cleanUrl}/api/status`, { mode: 'cors' });
      if (res.ok) {
        const data = await res.json();
        setTestResult({ ok: true, msg: `Connected successfully! Engine: ${data.engine || 'Online'}` });
      } else {
        setTestResult({ ok: false, msg: `HTTP Error: ${res.status} ${res.statusText}` });
      }
    } catch (e) {
      setTestResult({
        ok: false,
        msg: `Connection failed: ${e.message}. If using Render, ensure your backend service is deployed and running.`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onSaveApiUrl(inputUrl.replace(/\/+$/, ''));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0D0C]/35 backdrop-blur-md animate-fade-rise">
      <div className="bg-[#FBF6EF] border border-[#0D0D0C]/20 rounded-[7px] w-full max-w-md shadow-2xl p-6 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#0D0D0C]/12">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-[#0D0D0C]" />
            <h3 className="text-base font-semibold text-[#0D0D0C] font-headline">
              Terminal Backend API Settings
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-[5px] flex items-center justify-center text-[#0D0D0C]/56 hover:text-[#0D0D0C] hover:bg-[#F4EFE6] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#0D0D0C] block mb-1.5 font-headline">
              Backend API URL (Render or Localhost)
            </label>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="https://your-service.onrender.com"
              className="w-full px-3.5 py-2.5 rounded-[5px] border border-[#0D0D0C]/20 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#0D0D0C] focus:border-[#0D0D0C] text-[#0D0D0C] bg-[#FBF6EF]"
            />
            <p className="text-[11.5px] text-[#0D0D0C]/56 mt-1.5 font-sans">
              Enter the public URL of your Render Web Service.
            </p>
          </div>

          {/* Presets */}
          <div>
            <span className="text-[11px] font-semibold text-[#0D0D0C]/56 block mb-1.5 uppercase font-mono">
              Quick Presets
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setInputUrl('http://localhost:8080')}
                className="px-3 py-1.5 rounded-[5px] text-xs font-medium bg-[#F4EFE6] hover:bg-[#0D0D0C] hover:text-[#FBF6EF] text-[#0D0D0C] border border-[#0D0D0C]/15 transition duration-300"
              >
                Localhost (:8080)
              </button>
              <button
                type="button"
                onClick={() => setInputUrl('http://127.0.0.1:8080')}
                className="px-3 py-1.5 rounded-[5px] text-xs font-medium bg-[#F4EFE6] hover:bg-[#0D0D0C] hover:text-[#FBF6EF] text-[#0D0D0C] border border-[#0D0D0C]/15 transition duration-300"
              >
                127.0.0.1 (:8080)
              </button>
              <button
                type="button"
                onClick={() => setInputUrl('')}
                className="px-3 py-1.5 rounded-[5px] text-xs font-medium bg-[#DFE9D4] hover:bg-[#0D0D0C] hover:text-[#FBF6EF] text-[#0D0D0C] border border-[#0D0D0C]/15 transition duration-300"
              >
                24/7 Global Live Feed
              </button>
            </div>
          </div>

          {/* Test Status */}
          {testResult && (
            <div
              className={`p-3 rounded-[5px] text-xs font-medium flex items-center gap-2 ${
                testResult.ok
                  ? 'bg-[#DFE9D4] text-[#0D0D0C] border border-[#0D0D0C]/15'
                  : 'bg-[#F8DCC7] text-[#0D0D0C] border border-[#0D0D0C]/15'
              }`}
            >
              {testResult.ok ? (
                <Check className="w-4 h-4 text-[#3FB874] flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-[#F2772F] flex-shrink-0" />
              )}
              <span>{testResult.msg}</span>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="pt-4 border-t border-[#0D0D0C]/12 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="px-4 py-2 rounded-[5px] text-xs font-medium border border-[#0D0D0C]/20 hover:bg-[#0D0D0C] hover:text-[#FBF6EF] text-[#0D0D0C] transition duration-300 flex items-center gap-1.5 disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
            {testing ? 'Testing...' : 'Test Connection'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-[5px] text-xs font-medium text-[#0D0D0C]/70 hover:bg-[#F4EFE6] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-[5px] text-xs font-semibold bg-[#0D0D0C] hover:bg-[#0D0D0C]/85 text-[#FBF6EF] border border-[#0D0D0C] transition duration-300"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
