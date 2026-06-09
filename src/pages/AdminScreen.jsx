import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { formatNumber, shortAddr } from '../utils/format.js';
import { api } from '../services/api.js';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const inputStyle = {
  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px', padding: '12px', color: '#fff', fontSize: '12px', fontFamily: 'inherit'
};

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, color = '#fff', sub }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px 20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: '10px', fontWeight: 800, color: color, letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 900 }}>{value}</div>
      {sub && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Task Management ────────────────────────────────────────────────────────────
function TaskManagementAdmin() {
  const { walletAddress } = useGameStore();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newTask, setNewTask] = useState({ name: '', reward: '', icon: '💎', url: '', type: 'social' });

  useEffect(() => { if (walletAddress) loadTasks(); }, [walletAddress]);

  const loadTasks = async () => {
    try { setTasks(await api.fetchTasks(walletAddress)); } catch { }
  };

  const handleCreate = async () => {
    if (!newTask.name || !newTask.reward) return toast.error('Name & Reward required');
    setLoading(true);
    try {
      await api.createAdminTask(walletAddress, { ...newTask, reward: Number(newTask.reward) });
      toast.success('Task created!');
      setNewTask({ name: '', reward: '', icon: '💎', url: '', type: 'social' });
      loadTasks();
    } catch { toast.error('Failed to create task'); }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    try { await api.deleteAdminTask(walletAddress, id); toast.success('Task deleted'); loadTasks(); }
    catch { toast.error('Delete failed'); }
  };

  return (
    <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '24px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.08)' }}>
      <h3 style={{ fontSize: '13px', fontWeight: 900, marginBottom: '20px', letterSpacing: 1, color: '#FFB74D' }}>⚙️ GLOBAL TASK MANAGEMENT</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <input placeholder="Task Name" value={newTask.name} onChange={e => setNewTask({ ...newTask, name: e.target.value })} style={inputStyle} />
        <input placeholder="Reward (e.g. 50000)" type="number" value={newTask.reward} onChange={e => setNewTask({ ...newTask, reward: e.target.value })} style={inputStyle} />
        <input placeholder="URL Link (optional)" value={newTask.url} onChange={e => setNewTask({ ...newTask, url: e.target.value })} style={inputStyle} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Icon" value={newTask.icon} onChange={e => setNewTask({ ...newTask, icon: e.target.value })} style={{ ...inputStyle, flex: 0.3 }} />
          <select value={newTask.type} onChange={e => setNewTask({ ...newTask, type: e.target.value })} style={{ ...inputStyle, flex: 0.7 }}>
            <option value="social">Social Link</option>
            <option value="node">Node Required</option>
            <option value="referral_count">Referral Task</option>
          </select>
        </div>
      </div>
      <button onClick={handleCreate} disabled={loading}
        style={{ background: '#fff', color: '#000', fontWeight: 900, padding: '12px', borderRadius: '12px', fontSize: '12px', width: '100%', marginBottom: '20px', cursor: 'pointer' }}>
        {loading ? '...' : '+ LAUNCH NEW GLOBAL TASK'}
      </button>
      <h4 style={{ fontSize: '11px', color: '#FFB74D', fontWeight: 800, marginBottom: 10 }}>LIVE TASKS ({tasks.length})</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.map(t => (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800 }}>{t.name}</div>
                <div style={{ fontSize: 10, color: 'var(--neon-lime)' }}>+{formatNumber(t.reward)} | {(t.type || 'social').toUpperCase()}</div>
              </div>
            </div>
            <button onClick={() => handleDelete(t.id)}
              style={{ background: 'rgba(255,0,0,0.15)', color: '#ff4444', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
              DELETE
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── VIP Events Management ──────────────────────────────────────────────────
function EventManagementAdmin() {
  const { walletAddress } = useGameStore();
  const [loading, setLoading] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', description: '', scheduleTime: '', maxSeats: 100, priceNfeglobal: 0, telegramLink: '' });

  const handleCreate = async () => {
    if (!newEvent.title || !newEvent.telegramLink) return toast.error('Title & Telegram Link required');
    setLoading(true);
    try {
      await api.createAdminEvent(walletAddress, newEvent);
      toast.success('VIP Seminar Event Created!');
      setNewEvent({ title: '', description: '', scheduleTime: '', maxSeats: 100, priceNfeglobal: 0, telegramLink: '' });
    } catch { toast.error('Failed to create event'); }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Create Event */}
      <div style={{ background: 'var(--bg-card)', padding: 24, borderRadius: 24, border: '1px solid rgba(163,255,18,0.15)' }}>
        <h3 style={{ fontSize: 13, fontWeight: 900, marginBottom: 16, color: '#A3FF12', letterSpacing: 1 }}>📅 CREATE VIP SEMINAR</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input style={inputStyle} placeholder="Event Title (e.g. Node Strategy AMA)" value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} />
          <textarea style={{...inputStyle, height: '80px', resize: 'none'}} placeholder="Event Description / Details" value={newEvent.description} onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} />
          <input style={inputStyle} placeholder="Date & Time (e.g. Tomorrow at 8 PM UTC)" value={newEvent.scheduleTime} onChange={e => setNewEvent({ ...newEvent, scheduleTime: e.target.value })} />
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input style={inputStyle} type="number" placeholder="Max Seats Limit" value={newEvent.maxSeats} onChange={e => setNewEvent({ ...newEvent, maxSeats: e.target.value })} />
            <input style={inputStyle} type="number" placeholder="Cost in $NFEGLOBAL (0 = Free)" value={newEvent.priceNfeglobal} onChange={e => setNewEvent({ ...newEvent, priceNfeglobal: e.target.value })} />
          </div>
          
          <input style={inputStyle} placeholder="Private Telegram Invite Link" value={newEvent.telegramLink} onChange={e => setNewEvent({ ...newEvent, telegramLink: e.target.value })} />
          
          <button onClick={handleCreate} disabled={loading} style={{
            background: 'var(--neon-lime)', color: '#000', border: 'none', padding: 14, borderRadius: 12,
            fontSize: 13, fontWeight: 900, cursor: 'pointer', marginTop: 8
          }}>
            {loading ? 'Processing...' : 'CREATE EVENT & OPEN BOOKING'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── User Management ────────────────────────────────────────────────────────────
function UserManagementAdmin({ adminWallet }) {
  const [searchWallet, setSearchWallet] = useState('');
  const [targetUser, setTargetUser] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);

  const handleSearch = async () => {
    if (!searchWallet) return;
    setIsSearching(true); setTargetUser(null);
    try { setTargetUser(await api.fetchAdminUserDetails(adminWallet, searchWallet)); }
    catch { toast.error('User not found in system'); }
    setIsSearching(false);
  };

  const handleAdjust = async () => {
    if (!targetUser || !adjustAmount) return;
    const amount = Number(adjustAmount);
    if (isNaN(amount)) return toast.error('Invalid amount');
    setIsAdjusting(true);
    try {
      const res = await api.adjustUserReward(adminWallet, targetUser.wallet_address, amount, reason);
      if (res.success) {
        toast.success(`Balance adjusted: ${amount > 0 ? '+' : ''}${formatNumber(amount)} coins`);
        setTargetUser(res.user); setAdjustAmount(''); setReason('');
      }
    } catch { toast.error('Failed to update balance'); }
    setIsAdjusting(false);
  };

  return (
    <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '24px', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.08)' }}>
      <h3 style={{ fontSize: '13px', fontWeight: 900, marginBottom: '20px', letterSpacing: 1, color: '#4FC3F7' }}>👤 USER MANAGEMENT & ADJUSTMENTS</h3>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input placeholder="Search User Wallet (0x...)" value={searchWallet}
          onChange={e => setSearchWallet(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
        <button onClick={handleSearch} disabled={isSearching}
          style={{ background: 'var(--neon-lime)', color: '#000', fontWeight: 900, padding: '0 20px', borderRadius: 12, fontSize: 12, cursor: 'pointer' }}>
          {isSearching ? '...' : 'SEARCH'}
        </button>
      </div>
      <AnimatePresence>
        {targetUser && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ padding: 16, borderRadius: 16, background: 'rgba(203,255,1,0.04)', border: '1px solid rgba(203,255,1,0.2)', marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div><div style={{ fontSize: 9, color: '#FFD700', fontWeight: 800 }}>NODE ID</div><div style={{ fontSize: 15, fontWeight: 900 }}>#{targetUser.node_id || '—'}</div></div>
              <div><div style={{ fontSize: 9, color: '#A3FF12', fontWeight: 800 }}>TIER</div><div style={{ fontSize: 15, fontWeight: 900, color: 'var(--neon-lime)' }}>T{targetUser.node_tier}</div></div>
              <div><div style={{ fontSize: 9, color: '#4FC3F7', fontWeight: 800 }}>BALANCE</div><div style={{ fontSize: 15, fontWeight: 900 }}>{formatNumber(targetUser.local_reward)}</div></div>
              <div><div style={{ fontSize: 9, color: '#FF5252', fontWeight: 800 }}>REFS</div><div style={{ fontSize: 15, fontWeight: 900 }}>{targetUser.direct_refs || 0}</div></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
              <input type="number" placeholder="Amount (e.g. +500000 or -100)" value={adjustAmount}
                onChange={e => setAdjustAmount(e.target.value)} style={inputStyle} />
              <input placeholder="Reason (optional)" value={reason}
                onChange={e => setReason(e.target.value)} style={inputStyle} />
              <button onClick={handleAdjust} disabled={isAdjusting}
                style={{ background: '#fff', color: '#000', fontWeight: 900, padding: '0 16px', borderRadius: 12, fontSize: 11, cursor: 'pointer' }}>
                {isAdjusting ? '...' : 'APPLY'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Telegram Admin Panel ───────────────────────────────────────────────────────
function TelegramAdminPanel({ adminWallet }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('all');
  const [imageUrl, setImageUrl] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [buttonLabel, setButtonLabel] = useState('');

  useEffect(() => { loadStats(); }, [adminWallet]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/telegram/stats', {
        headers: { 'x-admin-wallet': adminWallet }
      });
      setStats(await res.json());
    } catch { toast.error('Failed to load bot stats'); }
    setLoading(false);
  };

  const handleBroadcast = async () => {
    if (!message.trim()) return toast.error('Message cannot be empty');
    setSending(true);
    const tid = toast.loading('Sending broadcast...');
    try {
      const res = await fetch('/api/admin/telegram/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-wallet': adminWallet },
        body: JSON.stringify({ message, filter, imageUrl: imageUrl || null, buttonUrl: buttonUrl || null, buttonLabel: buttonLabel || null })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`✅ Sent to ${data.sent} users (${data.failed} failed)`, { id: tid });
        setMessage(''); setImageUrl(''); setButtonUrl(''); setButtonLabel('');
        loadStats();
      } else {
        toast.error(data.error || 'Broadcast failed', { id: tid });
      }
    } catch {
      toast.error('Network error', { id: tid });
    }
    setSending(false);
  };

  const filterLabels = { all: '📢 All Users', free: '⏳ Free Users Only', activated: '✅ Activated Nodes Only' };
  const broadcasts = stats?.recent_broadcasts || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div style={{ background: 'rgba(0,168,255,0.08)', border: '1px solid rgba(0,168,255,0.2)', borderRadius: 16, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#4FC3F7', fontWeight: 800, marginBottom: 4 }}>BOT CONNECTED</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>{loading ? '...' : (stats?.connected || 0)}</div>
        </div>
        <div style={{ background: 'rgba(163,255,18,0.08)', border: '1px solid rgba(163,255,18,0.2)', borderRadius: 16, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#A3FF12', fontWeight: 800, marginBottom: 4 }}>NODES</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#A3FF12' }}>{loading ? '...' : (stats?.connected_nodes || 0)}</div>
        </div>
        <div style={{ background: 'rgba(255,152,0,0.08)', border: '1px solid rgba(255,152,0,0.2)', borderRadius: 16, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#FF9800', fontWeight: 800, marginBottom: 4 }}>FREE USERS</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#FF9800' }}>{loading ? '...' : (stats?.connected_free || 0)}</div>
        </div>
      </div>

      {/* Composer */}
      <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(0,168,255,0.15)' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 900, marginBottom: '20px', color: '#4FC3F7' }}>📢 BROADCAST COMPOSER</h3>
        
        {/* Target Filter */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 800, marginBottom: 8 }}>TARGET AUDIENCE</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.entries(filterLabels).map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)} style={{
                flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none', fontSize: 9, fontWeight: 900, cursor: 'pointer',
                background: filter === val ? '#4FC3F7' : 'rgba(255,255,255,0.06)',
                color: filter === val ? '#000' : '#888'
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 800, marginBottom: 6 }}>MESSAGE (Markdown supported: *bold*, _italic_)</div>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="🚀 *NFEGlobal Update!*&#10;&#10;New milestone unlocked! Activate your node to start earning BNB rewards today!&#10;&#10;👉 Visit the app now:"
            rows={6}
            style={{ ...inputStyle, width: '100%', resize: 'vertical', lineHeight: 1.5 }}
          />
        </div>

        {/* Optional extras */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <input placeholder="Image URL (optional)" value={imageUrl} onChange={e => setImageUrl(e.target.value)} style={inputStyle} />
          <input placeholder="Button URL (optional)" value={buttonUrl} onChange={e => setButtonUrl(e.target.value)} style={inputStyle} />
          <input placeholder="Button Label (default: Open App)" value={buttonLabel} onChange={e => setButtonLabel(e.target.value)} style={{ ...inputStyle, gridColumn: 'span 2' }} />
        </div>

        {/* Preview */}
        {message && (
          <div style={{ background: 'rgba(0,168,255,0.05)', border: '1px solid rgba(0,168,255,0.15)', borderRadius: 12, padding: '12px 16px', marginBottom: 14, fontSize: 12, color: '#ccc', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            <div style={{ fontSize: 9, color: '#4FC3F7', fontWeight: 800, marginBottom: 6 }}>PREVIEW</div>
            {message}
            {buttonUrl && <div style={{ marginTop: 8, background: '#4FC3F7', color: '#000', padding: '6px 14px', borderRadius: 8, display: 'inline-block', fontWeight: 900, fontSize: 11 }}>{buttonLabel || '🌐 Open App'}</div>}
          </div>
        )}

        <button
          onClick={handleBroadcast}
          disabled={sending || !message.trim()}
          style={{
            background: sending ? 'rgba(79,195,247,0.3)' : '#4FC3F7', color: '#000',
            fontWeight: 900, padding: '14px', borderRadius: '12px',
            fontSize: '13px', width: '100%', cursor: 'pointer', letterSpacing: 1
          }}
        >
          {sending ? '⌛ SENDING...' : `📤 SEND TO ${filterLabels[filter].toUpperCase()}`}
        </button>
      </div>

      {/* Broadcast History */}
      {broadcasts.length > 0 && (
        <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 900, marginBottom: '16px', color: '#FFD700' }}>📋 RECENT BROADCASTS</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {broadcasts.map(b => (
              <div key={b.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 9, color: '#4FC3F7', fontWeight: 800, textTransform: 'uppercase' }}>{b.target_filter}</span>
                  <span style={{ fontSize: 9, color: '#A3FF12', fontWeight: 800 }}>✅ {b.sent_count} sent</span>
                </div>
                <div style={{ fontSize: 11, color: '#ccc', whiteSpace: 'pre-wrap', maxHeight: 60, overflow: 'hidden', opacity: 0.8 }}>{b.message}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 6 }}>{new Date(b.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── System Auto-Upgrade Panel ─────────────────────────────────────────────────
function SystemAdminPanel({ adminWallet }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [forceReset, setForceReset] = useState(false);
  const [logs, setLogs] = useState([]);
  const logsRef = useRef(null);

  useEffect(() => { loadStatus(); }, [adminWallet]);
  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const s = await api.fetchSystemStatus(adminWallet);
      setStatus(s);
    } catch { toast.error('Failed to fetch system status'); }
    setLoading(false);
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    setLogs(['⏳ Starting upgrade from nfeglobalhub...']);
    try {
      const res = await api.triggerSystemUpgrade(adminWallet, { forceReset });
      setLogs(res.logs || []);
      if (res.success) {
        toast.success('✅ Upgrade successful — server restarting...');
        setTimeout(loadStatus, 3000);
      } else {
        toast.error(res.error || 'Upgrade failed');
      }
    } catch (e) {
      setLogs(l => [...l, `ERROR: ${e.message}`]);
      toast.error('Upgrade request failed');
    }
    setUpgrading(false);
  };

  const badgeColor = status?.behindCount > 0 ? '#FF5252' : '#A3FF12';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Status Card */}
      <div style={{ background: 'var(--bg-card)', padding: 24, borderRadius: 24, border: '1px solid rgba(163,255,18,0.15)' }}>
        <h3 style={{ fontSize: 13, fontWeight: 900, color: '#A3FF12', marginBottom: 20, letterSpacing: 1 }}>⚡ SYSTEM STATUS</h3>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#A3FF12', fontSize: 13 }}>Checking...</div>
        ) : status ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Commit info row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'BRANCH', val: status.branch, color: '#4FC3F7' },
                { label: 'COMMIT', val: status.hash, color: '#FFD700' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color, marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 900, fontFamily: 'monospace', color: '#fff' }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Commit message */}
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>LAST COMMIT</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{status.message}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>{status.date}</div>
            </div>

            {/* Update availability badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', borderRadius: 14, background: `${badgeColor}12`, border: `1px solid ${badgeColor}40` }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: badgeColor }}
                >{status.behindCount > 0 ? `🔔 ${status.behindCount} UPDATE(S) AVAILABLE` : '✅ UP TO DATE'}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Source: nfeglobalhub (pull-only)</div>
              </div>
              <button onClick={loadStatus} style={{
                background: 'rgba(255,255,255,0.07)', color: '#fff', border: 'none',
                padding: '7px 14px', borderRadius: 10, fontSize: 10, fontWeight: 900, cursor: 'pointer'
              }}>🔄 RECHECK</button>
            </div>
          </div>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', fontSize: 11 }}>No status data</div>
        )}
      </div>

      {/* Upgrade Control */}
      <div style={{ background: 'var(--bg-card)', padding: 24, borderRadius: 24, border: '1px solid rgba(255,82,82,0.2)' }}>
        <h3 style={{ fontSize: 13, fontWeight: 900, color: '#FF5252', marginBottom: 16, letterSpacing: 1 }}>🚀 TRIGGER UPGRADE</h3>

        {/* Force-reset toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
          background: 'rgba(255,82,82,0.06)', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,82,82,0.15)' }}>
          <input type="checkbox" id="force-reset" checked={forceReset}
            onChange={e => setForceReset(e.target.checked)}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#FF5252' }} />
          <label htmlFor="force-reset" style={{ fontSize: 11, fontWeight: 800, color: '#FF5252', cursor: 'pointer' }}>
            ⚠️ FORCE OVERWRITE — discard local server edits and hard-reset to upstream
          </label>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={handleUpgrade} disabled={upgrading}
          style={{
            width: '100%', padding: '15px', borderRadius: 14, border: 'none', fontSize: 13,
            fontWeight: 900, cursor: upgrading ? 'not-allowed' : 'pointer', letterSpacing: 1,
            background: upgrading ? 'rgba(255,82,82,0.3)' : 'linear-gradient(135deg,#FF5252,#FF1744)',
            color: '#fff'
          }}
        >
          {upgrading ? '⏳ UPGRADING...' : '⬆ PULL & UPGRADE FROM NFEGLOBALHUB'}
        </motion.button>
      </div>

      {/* Terminal Log */}
      {logs.length > 0 && (
        <div style={{ background: '#0a0a0a', borderRadius: 20, padding: 20, border: '1px solid rgba(163,255,18,0.15)' }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: '#A3FF12', letterSpacing: 2, marginBottom: 10 }}>📟 TERMINAL OUTPUT</div>
          <div ref={logsRef} style={{
            maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4,
            fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6
          }}>
            {logs.map((line, i) => (
              <div key={i} style={{
                color: line.startsWith('ERROR') ? '#FF5252' : line.startsWith('$') ? '#A3FF12' : line.startsWith('✅') ? '#69F0AE' : '#ccc',
                paddingLeft: line.startsWith('$') ? 0 : 12
              }}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Targeted Users Panel ──────────────────────────────────────────────────────
function TargetedUsersPanel({ adminWallet }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newWallet, setNewWallet] = useState('');

  useEffect(() => { loadUsers(); }, [adminWallet]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.fetchTargetedUsers(adminWallet);
      setUsers(Array.isArray(data) ? data : []);
    } catch { toast.error('Failed to load targeted users'); }
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newWallet || newWallet.length < 10) return toast.error('Enter a valid wallet address');
    setSaving(true);
    try {
      await api.setTargetedUser(adminWallet, newWallet.trim(), true);
      toast.success('✅ Wallet marked as targeted');
      setNewWallet('');
      await loadUsers();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  const handleRemove = async (wallet) => {
    setSaving(true);
    try {
      await api.setTargetedUser(adminWallet, wallet, false);
      toast.success('Removed from targeted list');
      await loadUsers();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  const cardStyle = {
    background: 'var(--bg-card)', padding: 24, borderRadius: 24,
    border: '1px solid rgba(255,215,0,0.18)'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Explainer */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 13, fontWeight: 900, color: '#FFD700', marginBottom: 12, letterSpacing: 1 }}>🎯 TARGETED USER AUTO-UNLOCK</h3>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: 0 }}>
          Wallets marked as <strong style={{ color: '#FFD700' }}>Targeted</strong> will be automatically
          registered or tier-upgraded whenever a downline triggers a reward toward them — <em>provided
          their wallet has sufficient BNB balance</em>. If their wallet is unfunded, the reward is missed
          and locked in treasury as normal.
        </p>
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            { icon: '💰', text: 'Fund wallet → auto-qualifies' },
            { icon: '🔒', text: 'Unfunded → reward stays in treasury' },
            { icon: '⬆', text: 'Same-or-upper tier enforced on-chain' },
          ].map(({ icon, text }) => (
            <span key={text} style={{
              background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)',
              borderRadius: 10, padding: '5px 11px', fontSize: 10, fontWeight: 700, color: '#FFD700'
            }}>{icon} {text}</span>
          ))}
        </div>
      </div>

      {/* Add New */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 12, fontWeight: 900, color: '#A3FF12', marginBottom: 14, letterSpacing: 1 }}>➕ ADD TARGETED WALLET</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            id="targeted-wallet-input"
            value={newWallet}
            onChange={e => setNewWallet(e.target.value)}
            placeholder="0x... wallet address"
            style={{ ...inputStyle, flex: 1, width: '100%' }}
          />
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={handleAdd} disabled={saving}
            style={{
              background: saving ? 'rgba(163,255,18,0.3)' : 'linear-gradient(135deg,#A3FF12,#6AFF00)',
              color: '#000', border: 'none', borderRadius: 12, padding: '0 20px',
              fontWeight: 900, fontSize: 12, cursor: saving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap'
            }}
          >
            {saving ? '...' : '🎯 ADD'}
          </motion.button>
        </div>
      </div>

      {/* Current Targeted Users */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 12, fontWeight: 900, color: '#FFD700', letterSpacing: 1, margin: 0 }}>
            🎯 TARGETED WALLETS ({users.length})
          </h3>
          <button onClick={loadUsers} style={{
            background: 'rgba(255,255,255,0.07)', color: '#fff', border: 'none',
            padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 900, cursor: 'pointer'
          }}>🔄 REFRESH</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#FFD700', fontSize: 13, padding: 20 }}>Loading...</div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 11, padding: 20 }}>
            No targeted wallets yet. Add one above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {users.map(u => (
              <div key={u.wallet_address} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(255,215,0,0.05)', borderRadius: 14,
                border: '1px solid rgba(255,215,0,0.15)', padding: '12px 16px'
              }}>
                {/* Status dot */}
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: u.node_id ? '#A3FF12' : '#FFD700',
                  boxShadow: u.node_id ? '0 0 8px #A3FF12' : '0 0 8px #FFD700'
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, fontFamily: 'monospace', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.wallet_address}
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                    {u.node_id ? `Node #${u.node_id} · Tier ${u.node_tier || 0}` : '⚠ Not yet registered on-chain'}
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleRemove(u.wallet_address)}
                  disabled={saving}
                  style={{
                    background: 'rgba(255,82,82,0.15)', color: '#FF5252', border: '1px solid rgba(255,82,82,0.3)',
                    borderRadius: 8, padding: '5px 10px', fontSize: 10, fontWeight: 900, cursor: 'pointer'
                  }}
                >✕ REMOVE</motion.button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Admin Screen ──────────────────────────────────────────────────────────
export default function AdminScreen() {
  const {
    walletAddress, adminStats, snapshotHistory, adjustmentLogs,
    takeSnapshot, loadSnapshots, fetchAdminOverview, fetchAdminAdjustments
  } = useGameStore();

  const [snapshotName, setSnapshotName] = useState('');
  const [conversionRate, setConversionRate] = useState(1000);
  const [tokenAddress, setTokenAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState('overview');

  useEffect(() => {
    loadSnapshots();
    fetchAdminOverview();
    fetchAdminAdjustments();
  }, []);

  const handleCreateSnapshot = async () => {
    if (!snapshotName) return toast.error('Enter a snapshot name first');
    setIsLoading(true);
    try {
      await takeSnapshot(snapshotName);
      toast.success(`Snapshot "${snapshotName}" captured!`);
      setSnapshotName('');
    } catch { toast.error('Snapshot failed'); }
    setIsLoading(false);
  };

  const exportCSV = async (snapshotId, name) => {
    const tid = toast.loading('Generating CSV...');
    try {
      const data = await api.fetchSnapshotData(walletAddress, snapshotId);
      if (!data?.data) { toast.error('No data', { id: tid }); return; }
      let csv = 'address,amount\n';
      data.data.forEach(u => {
        const amt = (parseFloat(u.local_reward) / conversionRate).toFixed(4);
        if (parseFloat(amt) > 0) csv += `${u.wallet_address},${amt}\n`;
      });
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url; a.download = `airdrop_${name}_rate${conversionRate}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exported!', { id: tid });
    } catch { toast.error('Export failed', { id: tid }); }
  };

  const s = adminStats || {};
  const totalCoins = parseFloat(s.total_reward || 0);
  const nodeCoins = parseFloat(s.coins_node_holders || 0);
  const freeCoins = parseFloat(s.coins_free_users || 0);
  const otherCoins = totalCoins - nodeCoins - freeCoins;

  const TABS = ['overview', 'snapshot', 'tasks', 'events', 'users', 'logs', 'telegram', 'system', 'targeted'];

  return (
    <div className="page-content" style={{ padding: '0 20px 60px' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--neon-lime)', marginBottom: '8px', letterSpacing: 1 }}>
        ⚡ MASTER CONTROL
      </h2>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 700, marginBottom: 24 }}>
        ADMIN ONLY · {shortAddr(walletAddress)}
      </p>

      {/* ── Tab Nav ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveAdminTab(t)} style={{
            padding: '8px 16px', borderRadius: 20, border: 'none', fontSize: 10, fontWeight: 900,
            cursor: 'pointer', whiteSpace: 'nowrap',
            background: activeAdminTab === t ? 'var(--neon-lime)' : 'rgba(255,255,255,0.05)',
            color: activeAdminTab === t ? '#000' : '#fff',
            letterSpacing: 1
          }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ══════════════ OVERVIEW TAB ══════════════ */}
      {activeAdminTab === 'overview' && (
        <>
          {/* User Growth */}
          <h4 style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, marginBottom: 12 }}>NETWORK OVERVIEW</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <StatCard label="TOTAL USERS" value={formatNumber(s.total_users || 0)} color="#4FC3F7" />
            <StatCard label="ACTIVE NODES" value={formatNumber(s.active_miners || 0)} color="var(--neon-lime)" />
            <StatCard label="FREE TRIAL" value={formatNumber(s.free_trial_users || 0)} color="#4FC3F7" sub="Within 30-day window" />
            <StatCard label="EXPIRED TRIAL" value={formatNumber(s.expired_users || 0)} color="#FF5252" sub="Need activation" />
            <StatCard label="NEW (24H)" value={`+${s.new_users_24h || 0}`} color="#FFD700" />
            <StatCard label="NEW (7D)" value={`+${s.new_users_7d || 0}`} color="#FFB74D" />
          </div>

          {/* Coin Distribution */}
          <h4 style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, marginBottom: 12 }}>COIN DISTRIBUTION SNAPSHOT</h4>
          <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: 24, border: '1px solid rgba(163,255,18,0.1)', marginBottom: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#FFD700', fontWeight: 800, marginBottom: 4 }}>TOTAL IN CIRCULATION</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--neon-lime)' }}>{formatNumber(totalCoins)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#A3FF12', fontWeight: 800, marginBottom: 4 }}>AVG BALANCE</div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{formatNumber(Math.floor(s.avg_balance || 0))}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#4FC3F7', fontWeight: 800, marginBottom: 4 }}>TOP HOLDER</div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{formatNumber(Math.floor(s.top_balance || 0))}</div>
              </div>
            </div>

            {/* Distribution Bar */}
            {totalCoins > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                  <span>NODE HOLDERS {((nodeCoins / totalCoins) * 100).toFixed(1)}%</span>
                  <span>FREE {((freeCoins / totalCoins) * 100).toFixed(1)}%</span>
                  <span>OTHER {((otherCoins / totalCoins) * 100).toFixed(1)}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${(nodeCoins / totalCoins) * 100}%`, background: 'var(--neon-lime)', transition: 'width 0.6s' }} />
                  <div style={{ width: `${(freeCoins / totalCoins) * 100}%`, background: '#4FC3F7', transition: 'width 0.6s' }} />
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)' }} />
                </div>
              </div>
            )}

            {/* Breakdown rows */}
            {[
              { label: '⬡ Node Holders', value: nodeCoins, color: 'var(--neon-lime)' },
              { label: '👤 Free Users', value: freeCoins, color: '#4FC3F7' },
              { label: '📦 Other', value: Math.max(0, otherCoins), color: 'rgba(255,255,255,0.3)' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, fontWeight: 800 }}>
                <span style={{ color: item.color }}>{item.label}</span>
                <span>{formatNumber(Math.floor(item.value))} $NFEGLOBAL</span>
              </div>
            ))}
          </div>

          {/* Top 100 Holders */}
          <h4 style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, marginBottom: 12 }}>🏆 TOP 100 COIN HOLDERS</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 520, overflowY: 'auto', paddingRight: 4, marginBottom: 24 }}>
            {(s.top_holders || []).map((h, i) => {
              const medalColor = i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'rgba(255,255,255,0.25)';
              const rankBg = i < 3 ? `rgba(${i === 0 ? '255,215,0' : i === 1 ? '192,192,192' : '205,127,50'},0.08)` : 'rgba(255,255,255,0.02)';
              return (
                <div key={h.wallet_address} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: rankBg, padding: '10px 14px', borderRadius: 14,
                  border: `1px solid ${i < 3 ? medalColor + '33' : 'rgba(255,255,255,0.04)'}`
                }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: medalColor, minWidth: 28, textAlign: 'center' }}>
                    {i < 3 ? ['🥇','🥈','🥉'][i] : `#${i + 1}`}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, fontFamily: 'monospace', color: '#fff' }}>
                      {h.wallet_address.slice(0, 8)}…{h.wallet_address.slice(-6)}
                    </div>
                    <div style={{ fontSize: 9, color: h.node_tier > 0 ? 'var(--neon-lime)' : '#4FC3F7', fontWeight: 700, marginTop: 2 }}>
                      {h.node_tier > 0 ? `⬡ Node T${h.node_tier}${h.node_id ? ` #${h.node_id}` : ''}` : '👤 Free User'}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 900, color: i < 3 ? medalColor : 'var(--neon-lime)', whiteSpace: 'nowrap' }}>
                    {formatNumber(Math.floor(h.local_reward))}
                  </span>
                </div>
              );
            })}
            {(s.top_holders || []).length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>No coin holders yet.</div>
            )}
          </div>

          {/* DB Init button */}
          <button
            onClick={async () => {
              setIsLoading(true);
              try { toast.success((await api.initAdminTasksDB(walletAddress)).message); }
              catch { toast.error('Init failed'); }
              setIsLoading(false);
            }}
            disabled={isLoading}
            style={{ background: 'rgba(255,80,80,0.1)', color: '#ff6262', border: '1px solid rgba(255,80,80,0.3)', padding: '10px 16px', borderRadius: 10, fontSize: 10, fontWeight: 900, cursor: 'pointer', width: '100%' }}>
            {isLoading ? '...' : '⚙️ RE-INITIALIZE TASKS DB TABLES'}
          </button>
        </>
      )}

      {/* ══════════════ SNAPSHOT TAB ══════════════ */}
      {activeAdminTab === 'snapshot' && (
        <>
          <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '24px', marginBottom: 24, border: '1px solid rgba(163,255,18,0.12)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 900, marginBottom: 20, color: 'var(--neon-lime)' }}>📸 CAPTURE COIN SNAPSHOT</h3>
            
            {/* Pre-flight stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ background: 'rgba(163,255,18,0.05)', padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: 9, color: 'var(--neon-lime)', fontWeight: 800 }}>ELIGIBLE WALLETS</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{formatNumber(s.total_users || 0)}</div>
              </div>
              <div style={{ background: 'rgba(79,195,247,0.05)', padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: 9, color: '#4FC3F7', fontWeight: 800 }}>TOTAL COINS</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{formatNumber(Math.floor(totalCoins))}</div>
              </div>
              <div style={{ background: 'rgba(255,215,0,0.05)', padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: 9, color: '#FFD700', fontWeight: 800 }}>RATE 1:{conversionRate}</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{(totalCoins / conversionRate).toFixed(2)}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <input type="text" placeholder="Snapshot Name (e.g. April 2026 Airdrop)"
                value={snapshotName} onChange={e => setSnapshotName(e.target.value)}
                style={{ ...inputStyle, flex: 1 }} />
              <button onClick={handleCreateSnapshot} disabled={isLoading || !snapshotName}
                style={{ background: 'var(--neon-lime)', color: '#000', fontWeight: 900, padding: '0 20px', borderRadius: 12, fontSize: 12, cursor: 'pointer' }}>
                {isLoading ? '...' : '📸 CAPTURE'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 10, color: '#FF5252', display: 'block', marginBottom: 4, fontWeight: 800 }}>TOKEN RATE (Coins : 1 Token)</label>
                <input type="number" value={conversionRate} onChange={e => setConversionRate(Number(e.target.value))}
                  style={{ ...inputStyle, width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: '#fff', display: 'block', marginBottom: 4, fontWeight: 800 }}>TOKEN CONTRACT ADDRESS</label>
                <input type="text" placeholder="0x..." value={tokenAddress} onChange={e => setTokenAddress(e.target.value)}
                  style={{ ...inputStyle, width: '100%' }} />
              </div>
            </div>
          </div>

          {/* Snapshot History */}
          <h4 style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, marginBottom: 12 }}>SNAPSHOT HISTORY</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(snapshotHistory || []).length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>No snapshots yet.</div>
            )}
            {(snapshotHistory || []).map(snap => (
              <div key={snap.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '16px 20px', borderRadius: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{snap.name}</div>
                  <div style={{ fontSize: 11, color: '#FFD700', marginTop: 4 }}>
                    {formatNumber(snap.total_users)} Wallets · {formatNumber(Math.floor(snap.total_coins))} Coins
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                    {new Date(snap.created_at).toLocaleString()}
                  </div>
                </div>
                <button onClick={() => exportCSV(snap.id, snap.name)}
                  style={{ background: 'rgba(163,255,18,0.1)', color: 'var(--neon-lime)', border: '1px solid rgba(163,255,18,0.3)', padding: '8px 14px', borderRadius: 10, fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>
                  ⬇ CSV
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ══════════════ TASKS TAB ══════════════ */}
      {activeAdminTab === 'tasks' && <TaskManagementAdmin />}

      {/* ══════════════ EVENTS TAB ══════════════ */}
      {activeAdminTab === 'events' && <EventManagementAdmin />}

      {/* ══════════════ USERS TAB ══════════════ */}
      {activeAdminTab === 'users' && <UserManagementAdmin adminWallet={walletAddress} />}

      {/* ══════════════ LOGS TAB ══════════════ */}
      {activeAdminTab === 'logs' && (
        <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ fontSize: 13, fontWeight: 900, marginBottom: 20, color: '#FFD700' }}>📋 ADJUSTMENT AUDIT LOG</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(adjustmentLogs || []).length === 0 ? (
              <div style={{ textAlign: 'center', fontSize: 11, color: '#4FC3F7', padding: 40 }}>No adjustments made yet.</div>
            ) : (
              (adjustmentLogs || []).slice(0, 20).map((log, idx) => (
                <div key={log.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800 }}>{shortAddr(log.target_wallet)}</div>
                    <div style={{ fontSize: 10, color: '#A3FF12', marginTop: 2 }}>{log.reason || 'Manual Adjustment'}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>{new Date(log.timestamp).toLocaleString()}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: log.amount > 0 ? 'var(--neon-lime)' : '#ff6262' }}>
                    {log.amount > 0 ? '+' : ''}{formatNumber(log.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {activeAdminTab === 'telegram' && (
        <TelegramAdminPanel adminWallet={walletAddress} />
      )}
      {activeAdminTab === 'system' && (
        <SystemAdminPanel adminWallet={walletAddress} />
      )}
      {activeAdminTab === 'targeted' && (
        <TargetedUsersPanel adminWallet={walletAddress} />
      )}

    </div>
  );
}
