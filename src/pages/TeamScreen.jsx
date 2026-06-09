import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { useContract } from '../hooks/useContract.js';
import { shortAddr } from '../utils/format.js';

const TIER_COLORS = [
  '#A3FF12','#FFD700','#FF9800','#F44336','#E91E63','#9C27B0',
  '#673AB7','#3F51B5','#2196F3','#00BCD4','#009688','#4CAF50',
  '#8BC34A','#CDDC39','#FFEB3B','#FF9800','#FF5722','#795548'
];

function TierBadge({ tier }) {
  const t = Number(tier) || 0;
  const color = TIER_COLORS[t - 1] || '#888';
  return (
    <span style={{
      background: color,
      color: t <= 2 ? '#000' : '#fff',
      fontSize: '8px', fontWeight: 900, padding: '2px 6px',
      borderRadius: '4px', letterSpacing: '0.5px'
    }}>T{t}</span>
  );
}

function NodeBadge({ nodeId }) {
  if (!nodeId || Number(nodeId) <= 0) return null;
  return (
    <span style={{
      background: 'rgba(79,195,247,0.15)',
      color: '#4FC3F7',
      border: '1px solid rgba(79,195,247,0.3)',
      fontSize: '8px', fontWeight: 900, padding: '2px 6px',
      borderRadius: '4px'
    }}>#{nodeId}</span>
  );
}

function MemberCard({ m, index, total }) {
  const rawJoin = m.joined_at || m.joinedAt;
  let dateStr = '—';
  if (rawJoin) {
    const dateObj = new Date(Number(rawJoin) * 1000);
    if (!isNaN(dateObj.getTime())) {
      dateStr = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${String(dateObj.getFullYear()).slice(-2)}`;
    }
  }

  const wallet = m.wallet_address || m.wallet || '';
  const teamSize = Number(m.team_size || m.totalMatrixNodes || 0);
  const directs = Number(m.direct_count || m.directNodes || 0);
  const tier = m.node_tier || m.tier || 0;

  return (
    <div style={{
      padding: '12px 0',
      borderBottom: index < total - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
      display: 'flex', flexDirection: 'column', gap: '10px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: '#A3FF12',
            boxShadow: '0 0 6px #A3FF12',
            flexShrink: 0
          }} />
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>
            {shortAddr(wallet)}
          </span>
        </div>
        <span style={{ fontSize: '9px', color: '#666', fontWeight: 600 }}>{dateStr}</span>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <TierBadge tier={tier} />
        <NodeBadge nodeId={m.node_id || m.nodeId} />
        {m.is_direct && (
          <span style={{ background: 'rgba(255, 215, 0, 0.15)', color: '#FFD700', border: '1px solid rgba(255, 215, 0, 0.4)', fontSize: '8px', fontWeight: 900, padding: '2px 8px', borderRadius: '4px' }}>DIRECT</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 900, color: '#A3FF12' }}>{directs}</div>
          <div style={{ fontSize: '7px', color: '#888', fontWeight: 700, textTransform: 'uppercase', marginTop: '2px' }}>Directs</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 900, color: '#4FC3F7' }}>{teamSize}</div>
          <div style={{ fontSize: '7px', color: '#888', fontWeight: 700, textTransform: 'uppercase', marginTop: '2px' }}>Sub Team</div>
        </div>
      </div>
    </div>
  );
}

// ── Lazy Expandable Matrix Tree View ─────────────────────────────────────────
function MatrixTreeView({ nodeId, nodeTier, walletAddress, directRefs, teamSize, fetchFn }) {
  const cacheRef = useRef({});
  const fetchingRef = useRef(new Set());
  const [childMap, setChildMap] = useState({});
  const [expanded, setExpanded] = useState({});
  const [loadingSet, setLoading] = useState({});

  const loadChildren = async (nId) => {
    if (cacheRef.current[nId] !== undefined) return;
    if (fetchingRef.current.has(nId)) return;
    fetchingRef.current.add(nId);
    setLoading(p => ({ ...p, [nId]: true }));
    try {
      const kids = await fetchFn(nId, 0);
      cacheRef.current[nId] = kids || [];
    } catch {
      cacheRef.current[nId] = [];
    }
    fetchingRef.current.delete(nId);
    setChildMap({ ...cacheRef.current });
    setLoading(p => { const n = { ...p }; delete n[nId]; return n; });
  };

  const toggle = async (nId, hasKids) => {
    if (expanded[nId]) {
      setExpanded(p => ({ ...p, [nId]: false }));
    } else {
      if (hasKids) await loadChildren(nId);
      setExpanded(p => ({ ...p, [nId]: true }));
    }
  };

  useEffect(() => {
    const rId = Number(nodeId);
    if (!rId) return;
    loadChildren(rId).then(() => setExpanded(p => ({ ...p, [rId]: true })));
  }, [nodeId]);

  const renderNode = (node, depth) => {
    const nId = Number(node.nodeId || node.node_id || 0);
    const sponsor = Number(node.sponsor || 0);
    const tier = Number(node.tier || node.node_tier || 0);
    const color = TIER_COLORS[tier - 1] || '#555';
    const wallet = node.wallet || node.wallet_address || '';
    const directs = Number(node.directNodes || node.direct_count || 0);
    const sub = Number(node.totalMatrixNodes || node.team_size || 0);

    const rootId = Number(nodeId);
    let boxColor = 'rgba(0,0,0,0.28)';
    let borderColor = `${color}28`;
    let typeTag = null;
    
    if (node.isRoot) {
      boxColor = `linear-gradient(135deg, ${color}18 0%, rgba(0,0,0,0.45) 100%)`;
      borderColor = `${color}55`;
    } else if (sponsor > 0) {
      if (sponsor === rootId) {
        boxColor = 'rgba(163,255,18,0.06)';
        borderColor = 'rgba(163,255,18,0.3)';
        typeTag = <span style={{fontSize:6, color:'#A3FF12', border:'1px solid #A3FF1255', padding:'1px 4px', borderRadius:4}}>DIRECT</span>;
      } else if (sponsor < rootId) {
        boxColor = 'rgba(255,152,0,0.06)';
        borderColor = 'rgba(255,152,0,0.3)';
        typeTag = <span style={{fontSize:6, color:'#FF9800', border:'1px solid #FF980055', padding:'1px 4px', borderRadius:4}}>SPILLOVER</span>;
      } else {
        boxColor = 'rgba(79,195,247,0.06)';
        borderColor = 'rgba(79,195,247,0.3)';
        typeTag = <span style={{fontSize:6, color:'#4FC3F7', border:'1px solid #4FC3F755', padding:'1px 4px', borderRadius:4}}>TEAM</span>;
      }
    }
    const joined = node.joinedAt || node.joined_at;
    let dateStr = '';
    if (joined) {
      const d = new Date(Number(joined) * 1000);
      if (!isNaN(d)) dateStr = `${d.getDate()}/${d.getMonth()+1}/${String(d.getFullYear()).slice(-2)}`;
    }
    const hasKids = directs > 0 || sub > 0;
    const isExpanded = expanded[nId];
    const isLoading = !!loadingSet[nId];
    const children = childMap[nId] || [];

    return (
      <div key={nId || depth} style={{ marginLeft: depth ? 20 : 0, position: 'relative' }}>
        {depth > 0 && (
          <div style={{ position: 'absolute', left: -12, top: 0, bottom: 0, borderLeft: `1px solid ${color}20`, pointerEvents: 'none' }} />
        )}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 8 }}>
          {depth > 0 && (
            <div style={{ position: 'absolute', left: -12, top: 18, width: 12, borderTop: `1px solid ${color}20` }} />
          )}
          <div
            onClick={() => nId && toggle(nId, hasKids)}
            style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 8,
              background: hasKids ? `${color}18` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${hasKids ? color+'35' : 'rgba(255,255,255,0.06)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: hasKids ? 'pointer' : 'default',
              fontSize: 12, color: color, fontWeight: 900, transition: 'all 0.15s',
              userSelect: 'none',
            }}
          >
            {isLoading ? '◌' : hasKids ? (isExpanded ? '−' : '+') : '·'}
          </div>

          <div style={{
            flex: 1,
            background: boxColor,
            border: `1px solid ${borderColor}`,
            borderRadius: 10, padding: '8px 10px',
            boxShadow: node.isRoot ? `0 0 12px ${color}15` : 'none',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}`, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: '#eee', fontFamily: 'monospace' }}>
                  {wallet ? `${wallet.slice(0,6)}…${wallet.slice(-4)}` : '—'}
                </span>
                {node.isRoot && (
                  <span style={{ fontSize: 7, background: 'rgba(163,255,18,0.12)', color: '#A3FF12', padding: '1px 5px', borderRadius: 4, fontWeight: 900 }}>YOU</span>
                )}
                {typeTag}
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                {nId > 0 && <span style={{ fontSize: 8, color: color, fontWeight: 900 }}>#{nId}</span>}
                <TierBadge tier={tier} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
              <div style={{ fontSize: 9, color: '#666', fontWeight: 700 }}>
                DIRECTS <span style={{ color: '#A3FF12', fontWeight: 900 }}>{directs}</span>
              </div>
              <div style={{ fontSize: 9, color: '#666', fontWeight: 700 }}>
                TEAM <span style={{ color: '#4FC3F7', fontWeight: 900 }}>{sub}</span>
              </div>
              {dateStr && (
                <div style={{ fontSize: 9, color: '#444', fontWeight: 700, marginLeft: 'auto' }}>{dateStr}</div>
              )}
            </div>
          </div>
        </div>

        {isExpanded && (
          <div style={{ paddingLeft: 28, position: 'relative' }}>
            {isLoading && (
              <div style={{ padding: '6px 0 10px', fontSize: 9, color: '#FFB74D', fontWeight: 800, letterSpacing: 1 }}>
                ◌ LOADING…
              </div>
            )}
            {!isLoading && children.map(child => renderNode(child, depth + 1))}
            {!isLoading && children.length === 0 && hasKids && (
              <div style={{ padding: '6px 0', fontSize: 9, color: '#333', fontWeight: 700 }}>NO DATA ON CHAIN</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const rootNode = {
    nodeId, isRoot: true,
    tier: nodeTier, node_tier: nodeTier,
    wallet: walletAddress, wallet_address: walletAddress,
    directNodes: directRefs || 0, direct_count: directRefs || 0,
    totalMatrixNodes: teamSize || 0, team_size: teamSize || 0,
  };

  return (
    <div style={{ padding: '0 12px 24px' }}>
      <div style={{ fontSize: '10px', fontWeight: 900, color: '#4FC3F7', marginBottom: 6, letterSpacing: '1.5px', textAlign: 'center' }}>
        🌐 PERSONAL MATRIX TREE
      </div>
      <div style={{ fontSize: '8px', color: '#444', textAlign: 'center', marginBottom: 16, fontWeight: 700, letterSpacing: 1 }}>
        TAP + TO EXPAND ANY NODE · CHILDREN LOADED ON DEMAND
      </div>
      {renderNode(rootNode, 0)}
    </div>
  );
}

// ── Graphical Binary Tree View ───────────────────────────────────────────────
function GraphicalBinaryTreeView({ nodeId, nodeTier, walletAddress, directRefs, teamSize, fetchFn }) {
  const cacheRef = useRef({});
  const fetchingRef = useRef(new Set());
  const [childMap, setChildMap] = useState({});
  const [expanded, setExpanded] = useState({});
  const [loadingSet, setLoading] = useState({});

  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const onMouseDown = (e) => {
    if (!containerRef.current) return;
    isDragging.current = true;
    startX.current = e.pageX - containerRef.current.offsetLeft;
    scrollLeft.current = containerRef.current.scrollLeft;
  };
  const onMouseLeave = () => { isDragging.current = false; };
  const onMouseUp = () => { isDragging.current = false; };
  const onMouseMove = (e) => {
    if (!isDragging.current || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX.current) * 2;
    containerRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const loadChildren = async (nId) => {
    if (cacheRef.current[nId] !== undefined) return;
    if (fetchingRef.current.has(nId)) return;
    fetchingRef.current.add(nId);
    setLoading(p => ({ ...p, [nId]: true }));
    try {
      const kids = await fetchFn(nId, 0);
      cacheRef.current[nId] = kids || [];
    } catch {
      cacheRef.current[nId] = [];
    }
    fetchingRef.current.delete(nId);
    setChildMap({ ...cacheRef.current });
    setLoading(p => { const n = { ...p }; delete n[nId]; return n; });
  };

  const toggle = async (nId, hasKids) => {
    if (expanded[nId]) {
      setExpanded(p => ({ ...p, [nId]: false }));
    } else {
      if (hasKids) await loadChildren(nId);
      setExpanded(p => ({ ...p, [nId]: true }));
    }
  };

  useEffect(() => {
    const rId = Number(nodeId);
    if (!rId) return;
    loadChildren(rId).then(() => setExpanded(p => ({ ...p, [rId]: true })));
  }, [nodeId]);

  const renderNode = (node, depth = 0) => {
    if (!node) return null;
    const nId = Number(node.nodeId || node.node_id || 0);
    const sponsor = Number(node.sponsor || 0);
    const tier = Number(node.tier || node.node_tier || 0);
    const color = TIER_COLORS[tier - 1] || '#555';
    const wallet = node.wallet || node.wallet_address || '';
    const sub = Number(node.totalMatrixNodes || node.team_size || 0);
    const hasKids = sub > 0;
    const isExpanded = expanded[nId];
    const isLoading = !!loadingSet[nId];
    const children = childMap[nId] || [];

    const rootId = Number(nodeId);
    let boxColor = 'rgba(0,0,0,0.6)';
    let borderColor = `${color}33`;
    let typeTag = null;

    if (node.isRoot) {
      boxColor = `linear-gradient(135deg, ${color}18, rgba(0,0,0,0.6))`;
      borderColor = `${color}66`;
    } else if (sponsor > 0) {
      if (sponsor === rootId) {
        boxColor = 'rgba(163,255,18,0.06)';
        borderColor = 'rgba(163,255,18,0.3)';
        typeTag = <div style={{fontSize:5, color:'#A3FF12', fontWeight:900, marginBottom:2}}>DIRECT</div>;
      } else if (sponsor < rootId) {
        boxColor = 'rgba(255,152,0,0.06)';
        borderColor = 'rgba(255,152,0,0.3)';
        typeTag = <div style={{fontSize:5, color:'#FF9800', fontWeight:900, marginBottom:2}}>SPILLOVER</div>;
      } else {
        boxColor = 'rgba(79,195,247,0.06)';
        borderColor = 'rgba(79,195,247,0.3)';
        typeTag = <div style={{fontSize:5, color:'#4FC3F7', fontWeight:900, marginBottom:2}}>TEAM</div>;
      }
    }

    return (
      <li key={nId || Math.random()}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div 
            onClick={() => nId && toggle(nId, hasKids)}
            style={{
              background: boxColor,
              border: `1px solid ${borderColor}`,
              borderRadius: '12px', padding: '10px 14px',
              minWidth: '120px', cursor: hasKids ? 'pointer' : 'default',
              boxShadow: node.isRoot ? `0 0 15px ${color}20` : 'none',
              transition: 'all 0.2s', position: 'relative'
            }}
          >
            {typeTag}
            <div style={{ fontSize: '11px', color: '#fff', fontWeight: 800, marginBottom: '4px' }}>
              #{nId}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}` }} />
              <span style={{ fontSize: '10px', color: '#ccc', fontFamily: 'monospace' }}>
                {wallet ? `${wallet.slice(0,4)}…${wallet.slice(-4)}` : '—'}
              </span>
            </div>
            <TierBadge tier={tier} />
            <div style={{ fontSize: '9px', color: '#4FC3F7', fontWeight: 900, marginTop: '6px' }}>
              TEAM: {sub}
            </div>
            {hasKids && (
              <div style={{
                position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)',
                background: '#0D1117', border: `1px solid ${color}55`, borderRadius: '50%',
                width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color: color, fontWeight: 900, zIndex: 2
              }}>
                {isLoading ? '◌' : isExpanded ? '−' : '+'}
              </div>
            )}
          </div>
        </div>
        
        {isExpanded && children.length > 0 && (
          <ul>
            {children.map((child, idx) => child ? renderNode(child, depth + 1) : null)}
          </ul>
        )}
      </li>
    );
  };

  const rootNode = {
    nodeId, isRoot: true,
    tier: nodeTier, node_tier: nodeTier,
    wallet: walletAddress, wallet_address: walletAddress,
    directNodes: directRefs || 0, direct_count: directRefs || 0,
    totalMatrixNodes: teamSize || 0, team_size: teamSize || 0,
  };

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <div style={{ fontSize: '10px', fontWeight: 900, color: '#A3FF12', marginBottom: 6, letterSpacing: '1.5px', textAlign: 'center' }}>
        🌲 GRAPHICAL BINARY TREE
      </div>
      <div style={{ fontSize: '8px', color: '#444', textAlign: 'center', marginBottom: 16, fontWeight: 700, letterSpacing: 1 }}>
        DRAG TO PAN · TAP NODE TO EXPAND CHILDREN
      </div>
      <div 
        className="org-tree-container no-scrollbar"
        ref={containerRef}
        onMouseDown={onMouseDown}
        onMouseLeave={onMouseLeave}
        onMouseUp={onMouseUp}
        onMouseMove={onMouseMove}
        style={{ overflow: 'auto', cursor: 'grab' }}
      >
        <div className="org-tree">
          <ul>
            {renderNode(rootNode)}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function TeamScreen() {
  const { isConnected, nodeId, nodeTier, directRefs, teamSize, walletAddress } = useGameStore();
  const { fetchMatrixCounts, fetchTeamLevelMembers, fetchDirectMembers } = useContract();

  const [rpcMatrixCounts, setRpcMatrixCounts] = useState(new Array(18).fill(0));
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [expandedLevel, setExpandedLevel] = useState(null);
  const [levelMembers, setLevelMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [activeTab, setActiveTab] = useState('matrix');
  const [directMembers, setDirectMembers] = useState([]);
  const [loadingDirect, setLoadingDirect] = useState(false);

  useEffect(() => {
    setExpandedLevel(null);
    setLevelMembers([]);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'direct' && walletAddress && directMembers.length === 0) {
      setLoadingDirect(true);
      const loadDirects = async () => {
        try {
          let rpcDirects = [];
          if (nodeId && Number(nodeId) > 0 && fetchDirectMembers) {
            rpcDirects = await fetchDirectMembers(nodeId).catch(() => []);
          }
          setDirectMembers(rpcDirects);
        } catch (err) {
          console.error("Failed to load direct team:", err);
        } finally {
          setLoadingDirect(false);
        }
      };
      loadDirects();
    }
  }, [activeTab, walletAddress, nodeId, fetchDirectMembers]);

  useEffect(() => {
    const loadStats = async () => {
      if (!nodeId) return;
      setLoadingCounts(true);
      try {
        if (nodeId && Number(nodeId) > 0) {
          const liveMatrix = await fetchMatrixCounts(nodeId).catch(() => new Array(18).fill(0));
          setRpcMatrixCounts(liveMatrix);
        }
      } catch (err) {
        console.error('Failed to load matrix counts', err);
      } finally {
        setLoadingCounts(false);
      }
    };

    if (isConnected && nodeId) {
      loadStats();
    }
  }, [isConnected, nodeId]);

  const toggleLevel = async (levelIndex) => {
    if (expandedLevel === levelIndex) {
      setExpandedLevel(null);
      return;
    }
    setExpandedLevel(levelIndex);
    setLevelMembers([]);

    const hasCount = (rpcMatrixCounts[levelIndex] || 0) > 0;
    if (hasCount) {
      setLoadingMembers(true);
      try {
        if (activeTab === 'matrix') {
          const rpcMembers = await fetchTeamLevelMembers(nodeId, levelIndex);
          const mappedMembers = (rpcMembers || []).map(m => ({
            wallet_address: m.wallet,
            node_id: m.nodeId,
            node_tier: m.tier,
            joined_at: m.joinedAt,
            team_size: Number(m.totalMatrixNodes || 0),
            direct_count: Number(m.directNodes || 0),
            node_active: true,
            is_direct: false
          }));
          setLevelMembers(mappedMembers);
        }
      } catch (err) {
        console.error('Fetch members failure:', err);
      } finally {
        setLoadingMembers(false);
      }
    }
  };

  if (!isConnected) {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '8px' }}>MY NETWORK</h2>
        <p style={{ color: '#FFFFFF', fontSize: '13px', fontWeight: 600 }}>Please connect your wallet to view your team.</p>
      </div>
    );
  }

  const calculatedTotal = teamSize || 0;
  const levelData = new Array(18).fill(0).map((_, i) => rpcMatrixCounts[i] || 0);
  const maxCapacity = (level) => Math.pow(2, level);

  return (
    <div className="page page-team" style={{ paddingBottom: '100px' }}>
      <div style={{ textAlign: 'center', padding: '10px 0 24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '6px' }}>MY NETWORK</h2>
        <div style={{
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: '20px',
          background: 'rgba(79,195,247,0.1)',
          border: '1px solid rgba(79,195,247,0.2)'
        }}>
          <span style={{ fontSize: '10px', color: '#4FC3F7', fontWeight: 900, letterSpacing: '1px' }}>
            {calculatedTotal} MEMBERS TOTAL
          </span>
        </div>
      </div>

      <div className="h-scroll-noscroll" style={{ display: 'flex', gap: '8px', padding: '0 16px 20px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', justifyContent: 'center' }}>
        <button 
          onClick={() => setActiveTab('matrix')}
          style={{ flexShrink: 0, padding: '10px 16px', borderRadius: '8px', background: activeTab === 'matrix' ? 'rgba(79,195,247,0.15)' : 'rgba(255,255,255,0.05)', color: activeTab === 'matrix' ? '#4FC3F7' : '#888', border: `1px solid ${activeTab === 'matrix' ? 'rgba(79,195,247,0.3)' : 'transparent'}`, fontSize: '10px', fontWeight: 800 }}>
          MATRIX
        </button>
        <button
          onClick={() => setActiveTab('tree')}
          style={{ flexShrink: 0, padding: '10px 16px', borderRadius: '8px', background: activeTab === 'tree' ? 'rgba(163,255,18,0.15)' : 'rgba(255,255,255,0.05)', color: activeTab === 'tree' ? '#A3FF12' : '#888', border: `1px solid ${activeTab === 'tree' ? 'rgba(163,255,18,0.3)' : 'transparent'}`, fontSize: '10px', fontWeight: 800 }}>
          🌐 TREE
        </button>
        <button
          onClick={() => setActiveTab('graphical')}
          style={{ flexShrink: 0, padding: '10px 16px', borderRadius: '8px', background: activeTab === 'graphical' ? 'rgba(163,255,18,0.15)' : 'rgba(255,255,255,0.05)', color: activeTab === 'graphical' ? '#A3FF12' : '#888', border: `1px solid ${activeTab === 'graphical' ? 'rgba(163,255,18,0.3)' : 'transparent'}`, fontSize: '10px', fontWeight: 800 }}>
          🌲 GRAPHICAL
        </button>
        <button 
          onClick={() => setActiveTab('direct')}
          style={{ flexShrink: 0, padding: '10px 16px', borderRadius: '8px', background: activeTab === 'direct' ? 'rgba(163,255,18,0.15)' : 'rgba(255,255,255,0.05)', color: activeTab === 'direct' ? '#A3FF12' : '#888', border: `1px solid ${activeTab === 'direct' ? 'rgba(163,255,18,0.3)' : 'transparent'}`, fontSize: '10px', fontWeight: 800 }}>
          MY DIRECTS ({directRefs})
        </button>
      </div>

      {activeTab === 'matrix' && (
        <div style={{ padding: '0 8px' }}>
          <div style={{ fontSize: '10px', fontWeight: 900, color: '#4FC3F7', marginBottom: '12px', letterSpacing: '1.5px', textAlign: 'center' }}>
            BINARY MATRIX LEVELS
          </div>

          {loadingCounts ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#FFB74D', fontSize: '11px', fontWeight: 700 }}>
              LOADING MATRIX DATA...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18].map((level, index) => {
                const count = levelData[index] || 0;
                const maxSlots = maxCapacity(level);
                const fillPct = maxSlots > 0 ? Math.min(100, Math.round((count / maxSlots) * 100)) : 0;
                const isExpanded = expandedLevel === index;
                const canClick = count > 0 || isExpanded;

                return (
                  <div key={level} style={{
                    borderRadius: '12px',
                    border: `1px solid ${isExpanded ? 'rgba(79,195,247,0.25)' : count > 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
                    background: isExpanded ? 'rgba(79,195,247,0.03)' : 'rgba(255,255,255,0.02)',
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                    opacity: count === 0 ? 0.45 : 1
                  }}>
                    <div
                      onClick={() => canClick && toggleLevel(index)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 16px', cursor: canClick ? 'pointer' : 'default'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '8px',
                          background: count > 0 ? 'rgba(79,195,247,0.15)' : 'rgba(255,255,255,0.05)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: 900,
                          color: count > 0 ? '#4FC3F7' : '#555'
                        }}>
                          {level}
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 800, color: '#fff' }}>Level {level}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <div style={{ width: '60px', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ width: `${fillPct}%`, height: '100%', background: '#4FC3F7', borderRadius: '2px' }} />
                            </div>
                            <span style={{ fontSize: '8px', color: '#555', fontWeight: 700 }}>{count}/{maxSlots}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          fontSize: '16px', fontWeight: 900,
                          color: count > 0 ? '#4FC3F7' : '#333'
                        }}>{count}</span>
                        {count > 0 && (
                          <div style={{
                            width: '20px', height: '20px', borderRadius: '50%',
                            background: 'rgba(79,195,247,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transform: isExpanded ? 'rotate(90deg)' : 'none',
                            transition: 'transform 0.25s ease'
                          }}>
                            <span style={{ fontSize: '10px', color: '#4FC3F7' }}>›</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '0 16px' }}>
                        {loadingMembers ? (
                          <div style={{ padding: '24px 0', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#FFB74D', fontWeight: 800, letterSpacing: '1px' }}>EXPLORING HIERARCHY...</div>
                          </div>
                        ) : levelMembers.length === 0 ? (
                          <div style={{ padding: '24px 0', textAlign: 'center' }}>
                            <div style={{ fontSize: '8px', color: '#555', letterSpacing: '1px' }}>NO MEMBERS FOUND AT THIS DEPTH</div>
                          </div>
                        ) : (
                          <div>
                            {levelMembers.map((m, i) => (
                              <MemberCard key={i} m={m} index={i} total={levelMembers.length} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'tree' && (
        <MatrixTreeView
          nodeId={nodeId}
          nodeTier={nodeTier}
          walletAddress={walletAddress}
          directRefs={directRefs}
          teamSize={teamSize}
          fetchFn={fetchTeamLevelMembers}
        />
      )}

      {activeTab === 'graphical' && (
        <GraphicalBinaryTreeView 
          nodeId={nodeId} 
          nodeTier={nodeTier} 
          walletAddress={walletAddress}
          directRefs={directRefs} 
          teamSize={teamSize}
          fetchFn={async (parentNid) => {
            return await fetchTeamLevelMembers(parentNid, 0); 
          }}
        />
      )}

      {activeTab === 'direct' && (
        <div style={{ padding: '0 16px' }}>
          <div style={{ fontSize: '10px', fontWeight: 900, color: '#A3FF12', marginBottom: '16px', letterSpacing: '1.5px', textAlign: 'center' }}>
            MY DIRECT REFERRALS
          </div>
          {loadingDirect ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
               <span style={{ fontSize: '11px', color: '#888' }}>LOADING...</span>
            </div>
          ) : directMembers.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
               <div style={{ fontSize: '12px', color: '#666' }}>No directs found on-chain</div>
            </div>
          ) : (
            <div>
              {directMembers.map((m, i) => (
                <MemberCard 
                  key={i} 
                  m={{ ...m, is_direct: true }} 
                  index={i} 
                  total={directMembers.length} 
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
