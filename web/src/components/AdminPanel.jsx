import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Check,
  X,
  Trash2,
  RefreshCw,
  ArrowLeft,
  UserPlus,
  Clock,
  CheckCircle2,
  XCircle,
  Database,
  LogOut,
} from 'lucide-react';
import { fetchAdminUsers, adminAction } from '../services/authService';

export default function AdminPanel({ onClose, onLogout, onPendingCountChange }) {
  const [users, setUsers] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [storageMode, setStorageMode] = useState('local_memory');
  const [filter, setFilter] = useState('pending'); // 'pending' | 'approved' | 'rejected' | 'all'
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'ok' | 'err', text }

  // Direct Add User Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const loadUsers = useCallback(async (initial = false) => {
    setLoading(true);
    try {
      const res = await fetchAdminUsers();
      if (res.ok) {
        setUsers(res.users || []);
        setCounts(res.counts || { pending: 0, approved: 0, rejected: 0, total: 0 });
        setStorageMode(res.storageMode || 'local_memory');
        if (onPendingCountChange) {
          onPendingCountChange(res.counts?.pending || 0);
        }
        // If initial load has 0 pending users, switch view to 'all'
        if (initial && (res.counts?.pending || 0) === 0) {
          setFilter('all');
        }
      } else {
        setFeedback({ type: 'err', text: res.error || 'Failed to load users.' });
      }
    } catch {
      setFeedback({ type: 'err', text: 'Connection error while loading users.' });
    } finally {
      setLoading(false);
    }
  }, [onPendingCountChange]);

  useEffect(() => {
    loadUsers(true);
  }, [loadUsers]);

  const handleUserAction = async (action, userId) => {
    setBusyId(userId);
    setFeedback(null);
    try {
      const res = await adminAction(action, { userId });
      if (res.ok) {
        setUsers(res.users || []);
        setCounts(res.counts || { pending: 0, approved: 0, rejected: 0, total: 0 });
        if (onPendingCountChange) {
          onPendingCountChange(res.counts?.pending || 0);
        }
        setFeedback({ type: 'ok', text: res.message || 'Updated successfully.' });
      } else {
        setFeedback({ type: 'err', text: res.error || 'Action failed.' });
      }
    } catch {
      setFeedback({ type: 'err', text: 'Network error.' });
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    setFeedback(null);
    try {
      const res = await adminAction('create', {
        name: newName.trim(),
        username: newUsername.trim(),
        password: newPassword,
      });
      if (res.ok) {
        setUsers(res.users || []);
        setCounts(res.counts || { pending: 0, approved: 0, rejected: 0, total: 0 });
        if (onPendingCountChange) {
          onPendingCountChange(res.counts?.pending || 0);
        }
        setNewName('');
        setNewUsername('');
        setNewPassword('');
        setShowAddForm(false);
        setFilter('approved');
        setFeedback({ type: 'ok', text: res.message || 'User created and approved.' });
      } else {
        setFeedback({ type: 'err', text: res.error || 'Could not create user.' });
      }
    } catch {
      setFeedback({ type: 'err', text: 'Network error.' });
    } finally {
      setCreating(false);
    }
  };

  const filteredUsers =
    filter === 'all' ? users : users.filter((u) => u.status === filter);

  return (
    <div className="min-h-screen bg-white text-[#0D0D0C] flex flex-col font-sans">
      {/* Top Bar */}
      <header className="bg-white border-b border-[#0D0D0C]/10 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="h-8 px-2.5 rounded-[5px] border border-[#0D0D0C]/15 bg-white hover:bg-[#F4F4F5] text-xs font-mono font-medium flex items-center gap-1.5 cursor-pointer transition"
              title="Return to Trading Terminal"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Charts</span>
            </button>
            <div className="flex items-center gap-2 pl-1">
              <div className="w-7 h-7 rounded-[5px] bg-[#0D0D0C] text-white flex items-center justify-center">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-sm tracking-tight font-headline">
                ADMIN PANEL
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm((prev) => !prev)}
              className={`h-8 px-2.5 sm:px-3 rounded-[5px] border text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer transition ${
                showAddForm
                  ? 'bg-[#0D0D0C] text-white border-[#0D0D0C]'
                  : 'bg-white text-[#0D0D0C] border-[#0D0D0C]/15 hover:bg-[#F4F4F5]'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Add User</span>
            </button>
            <button
              onClick={() => loadUsers(false)}
              disabled={loading}
              title="Refresh Requests"
              className="w-8 h-8 rounded-[5px] border border-[#0D0D0C]/15 bg-white hover:bg-[#F4F4F5] flex items-center justify-center cursor-pointer transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onLogout}
              title="Sign Out"
              className="w-8 h-8 rounded-[5px] border border-[#0D0D0C]/15 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 flex items-center justify-center cursor-pointer transition"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* Feedback Toast */}
        {feedback && (
          <div
            className={`px-3.5 py-2.5 rounded-[6px] border text-xs font-mono flex items-center justify-between ${
              feedback.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            <span>{feedback.text}</span>
            <button
              onClick={() => setFeedback(null)}
              className="opacity-60 hover:opacity-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Collapsible Direct Create Approved User Form */}
        {showAddForm && (
          <form
            onSubmit={handleCreateUser}
            className="bg-[#F8F9FA] border border-[#0D0D0C]/12 rounded-[8px] p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#0D0D0C]">
                Create Pre-Approved Account
              </h3>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-[#0D0D0C]/50 hover:text-[#0D0D0C] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Full Name"
                className="h-9 px-3 text-xs rounded-[5px] border border-[#0D0D0C]/15 bg-white focus:outline-none focus:border-[#0D0D0C]"
              />
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="User ID (e.g. trader1)"
                className="h-9 px-3 text-xs font-mono rounded-[5px] border border-[#0D0D0C]/15 bg-white focus:outline-none focus:border-[#0D0D0C]"
              />
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Password (min 4 chars)"
                className="h-9 px-3 text-xs font-mono rounded-[5px] border border-[#0D0D0C]/15 bg-white focus:outline-none focus:border-[#0D0D0C]"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="h-8 px-4 rounded-[5px] bg-[#0D0D0C] text-white text-xs font-semibold hover:bg-[#0D0D0C]/90 transition disabled:opacity-50 cursor-pointer"
              >
                {creating ? 'Creating...' : 'Create & Approve'}
              </button>
            </div>
          </form>
        )}

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center bg-[#F4F4F5] p-1 rounded-[6px] border border-[#0D0D0C]/10 text-xs font-mono">
            {[
              { id: 'pending', label: 'Pending', count: counts.pending },
              { id: 'approved', label: 'Approved', count: counts.approved },
              { id: 'rejected', label: 'Rejected', count: counts.rejected },
              { id: 'all', label: 'All', count: counts.total },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-2.5 sm:px-3 py-1 rounded-[5px] font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                  filter === tab.id
                    ? 'bg-[#0D0D0C] text-white shadow-xs'
                    : 'text-[#0D0D0C]/65 hover:text-[#0D0D0C]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    filter === tab.id
                      ? 'bg-white/20 text-white'
                      : tab.id === 'pending' && tab.count > 0
                      ? 'bg-amber-500 text-white'
                      : 'bg-[#0D0D0C]/10 text-[#0D0D0C]/70'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#0D0D0C]/55">
            <Database className="w-3.5 h-3.5" />
            <span>{storageMode === 'cloud_kv' ? 'Cloud KV Sync' : 'Local / Temp Store'}</span>
          </div>
        </div>

        {/* User Accounts List */}
        <div className="bg-white border border-[#0D0D0C]/12 rounded-[8px] overflow-hidden">
          {loading && users.length === 0 ? (
            <div className="p-10 text-center text-xs font-mono text-[#0D0D0C]/50">
              Loading accounts...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-xs font-mono text-[#0D0D0C]/50">
                {filter === 'pending'
                  ? 'No pending access requests.'
                  : `No ${filter} accounts found.`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#0D0D0C]/08">
              {filteredUsers.map((u) => {
                const isBusy = busyId === u.id;
                return (
                  <div
                    key={u.id}
                    className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAFAFA] transition"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-[#0D0D0C] truncate">
                          {u.name}
                        </span>
                        <span className="font-mono text-xs text-[#0D0D0C]/65 bg-[#F4F4F5] px-2 py-0.5 rounded-[4px] border border-[#0D0D0C]/08">
                          @{u.username}
                        </span>
                        {u.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                        {u.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Approved
                          </span>
                        )}
                        {u.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                            <XCircle className="w-3 h-3" />
                            Rejected
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-[#0D0D0C]/45 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>Created: {u.createdAt}</span>
                        {u.lastLoginAt && <span>Last Login: {u.lastLoginAt}</span>}
                      </div>
                    </div>

                    {/* Accept / Reject / Delete Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {u.status !== 'approved' && (
                        <button
                          onClick={() => handleUserAction('approve', u.id)}
                          disabled={isBusy}
                          className="h-8 px-3 rounded-[5px] bg-[#0D0D0C] text-white hover:bg-emerald-600 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Accept</span>
                        </button>
                      )}

                      {u.status !== 'rejected' && (
                        <button
                          onClick={() => handleUserAction('reject', u.id)}
                          disabled={isBusy}
                          className="h-8 px-3 rounded-[5px] border border-red-200 bg-white text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>{u.status === 'approved' ? 'Revoke' : 'Reject'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleUserAction('delete', u.id)}
                        disabled={isBusy}
                        title="Delete Account"
                        className="w-8 h-8 rounded-[5px] border border-[#0D0D0C]/12 bg-white text-[#0D0D0C]/50 hover:text-red-600 hover:border-red-200 hover:bg-red-50 flex items-center justify-center transition disabled:opacity-40 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cloud Persistence Info Note (Only shown if Upstash/Vercel KV is not linked yet) */}
        {storageMode !== 'cloud_kv' && (
          <div className="px-3.5 py-2.5 rounded-[6px] bg-[#F8F9FA] border border-[#0D0D0C]/10 text-[11px] text-[#0D0D0C]/65 font-mono leading-relaxed">
            <strong>Persistence Note:</strong> For permanent multi-device account sync on Vercel, connect free <strong>Upstash Redis</strong> in Vercel Dashboard &rarr; Storage (sets <code className="text-[#0D0D0C]">UPSTASH_REDIS_REST_URL</code> &amp; <code className="text-[#0D0D0C]">UPSTASH_REDIS_REST_TOKEN</code> automatically).
          </div>
        )}
      </main>
    </div>
  );
}
