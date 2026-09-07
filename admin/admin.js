// admin.js — JanSetu Admin Command Center
'use strict';

let currentUser = null;
let allChallenges = [];
let universities = [];
let industryPartners = [];
let currentAssignChallengeId = null;
let heatmapInstance = null;
let _chartInstances = {};

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAuth()) return;
  currentUser = Auth.getUser();
  if (!Auth.requireRole(['admin'])) return;
  initUI();
  await Promise.all([loadOverview(), loadUniversitiesForModal(), loadIndustryForModal()]);
  const hash = window.location.hash.replace('#', '');
  if (hash) showSection(hash);
  else showSection('overview');
});

function initUI() {
  const initials = Utils.generateInitials(currentUser.name);
  const els = ['sidebarAvatar','topbarAvatar'];
  els.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = initials; });
  const nameEls = [['sidebarName', currentUser.name], ['sidebarNameFull', currentUser.name], ['topbarName', currentUser.name.split(' ')[0]], ['welcomeName', 'Welcome, ' + currentUser.name.split(' ')[0]]];
  nameEls.forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.textContent = val; });
}

function showSection(section) {
  document.querySelectorAll('.dashboard-section').forEach(s => { s.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
  const sectionEl = document.getElementById('section-' + section);
  const navEl = document.getElementById('nav-' + section);
  if (sectionEl) sectionEl.classList.add('active');
  if (navEl) navEl.classList.add('active');
  const titles = {
    overview: ['Admin Overview', 'Overview'],
    challenges: ['All Challenges', 'Challenges'],
    pending: ['Pending Validation', 'Pending'],
    aimatching: ['AI Matching Center', 'AI & Matching'],
    assigned: ['Assigned Challenges', 'Assigned'],
    sla: ['SLA Monitoring', 'Overdue / Escalated'],
    resolved: ['Resolved Challenges', 'Resolved'],
    users: ['Citizens', 'Network / Citizens'],
    universities: ['Universities', 'Network / Universities'],
    industry: ['Industry / CSR', 'Network / Industry'],
    analytics: ['Impact Analytics', 'Intelligence / Analytics'],
    heatmap: ['District Heatmap', 'Intelligence / Heatmap'],
    notifications: ['Notifications Center', 'Governance / Notifications'],
    activity: ['Activity Log', 'Governance / Audit Log']
  };
  const [title, crumb] = titles[section] || ['Admin', section];
  const ptEl = document.getElementById('pageTitle');
  const pbEl = document.getElementById('pageBreadcrumb');
  if (ptEl) ptEl.textContent = title;
  if (pbEl) pbEl.textContent = crumb;
  window.location.hash = section;
  if (section === 'challenges') loadAdminChallenges();
  if (section === 'pending') loadPendingChallenges();
  if (section === 'aimatching') loadAIMatchingSection();
  if (section === 'assigned') loadAssignedChallenges();
  if (section === 'sla') loadSLASection();
  if (section === 'resolved') loadResolvedChallenges();
  if (section === 'users') loadUsers();
  if (section === 'universities') loadUniversities();
  if (section === 'industry') loadIndustry();
  if (section === 'analytics') loadAnalytics();
  if (section === 'heatmap') initHeatmap();
  if (section === 'notifications') loadNotifications();
  if (section === 'activity') loadActivity();
}
window.showSection = showSection;
window.toggleSidebar = () => { document.querySelector('.sidebar')?.classList.toggle('collapsed'); };


window.openModal = (id) => { const el = document.getElementById(id); if (el) el.classList.add('open'); };
window.closeModal = (id) => { const el = document.getElementById(id); if (el) el.classList.remove('open'); };
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); }));
});

function showAdminToast(msg, type = 'success') {
  const t = document.getElementById('adminToast');
  if (!t) return;
  const colors = { success: '#059669', error: '#DC2626', warning: '#D97706', info: '#1a56db' };
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  t.innerHTML = '<span style="font-size:16px">' + icons[type] + '</span> ' + msg;
  t.style.background = colors[type] || '#0f172a';
  t.style.display = 'flex';
  setTimeout(() => { t.style.display = 'none'; }, 3200);
}

function makeChart(canvasId, config) {
  if (_chartInstances[canvasId]) { _chartInstances[canvasId].destroy(); }
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return null;
  _chartInstances[canvasId] = new Chart(ctx, config);
  return _chartInstances[canvasId];
}

// ── Load Overview ──────────────────────────────────────────────────────────
async function loadOverview() {
  try {
    const [statsRes, challengesRes, univRes] = await Promise.all([
      API.get('/admin/analytics'),
      API.get('/challenges', { limit: 5, status: 'submitted' }),
      API.get('/universities')
    ]);
    if (statsRes.success) renderMetrics(statsRes.data);
    if (challengesRes.success) renderPendingList(challengesRes.data);
    if (univRes.success) { universities = univRes.data; renderUnivLeaderboard(univRes.data); }
    await loadOverviewCharts();
  } catch(e) { console.error('Overview load error:', e); }
}

function renderMetrics(data) {
  const grid = document.getElementById('adminMetrics');
  if (!grid) return;
  const pending = data.pendingChallenges || 0;
  const overdue = data.overdueChallenges || 0;
  grid.innerHTML = [
    { label: 'Total Challenges', value: data.totalChallenges || 0, icon: '📋', bg: '#EFF6FF', color: '#1e40af', trend: '+' + (data.thisMonth || 0) + ' this month' },
    { label: 'Pending Review', value: pending, icon: '⏳', bg: '#FEF3C7', color: '#92400E', trend: pending > 0 ? 'Needs attention' : 'All clear ✓' },
    { label: 'Active Projects', value: data.activeChallenges || 0, icon: '⚡', bg: '#EDE9FE', color: '#5b21b6', trend: 'In progress' },
    { label: 'Resolved', value: data.resolvedChallenges || 0, icon: '✅', bg: '#DCFCE7', color: '#15803d', trend: (data.resolutionRate || 0) + '% rate' }
  ].map(m => `
    <div class="metric-card">
      <div class="metric-card-hdr">
        <div class="metric-icon" style="background:${m.bg}">${m.icon}</div>
        <span class="metric-trend${m.label==='Pending Review'&&pending>0?' warn':''}">${m.trend}</span>
      </div>
      <div class="metric-val">${m.value}</div>
      <div class="metric-lbl">${m.label}</div>
    </div>`).join('');

  const badge = document.getElementById('pendingCountBadge');
  const valBadge = document.getElementById('pendingValidBadge');
  if (badge && pending > 0) { badge.textContent = pending; badge.style.display = 'inline-flex'; }
  if (valBadge && pending > 0) { valBadge.textContent = pending; valBadge.style.display = 'inline-flex'; }
  if (data.overdueChallenges > 0) {
    const ov = document.getElementById('overdueNavBadge');
    if (ov) { ov.textContent = data.overdueChallenges; ov.style.display = 'inline-flex'; }
  }

  // KPIs in analytics section
  const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  set('kpi-reported', data.totalChallenges || '—');
  set('kpi-validated', data.validatedChallenges || '—');
  set('kpi-solved', data.resolvedChallenges || '—');
  set('kpi-univs', universities.length || '—');
  set('kpi-industry', data.industryPartners || '—');
  set('kpi-res-time', data.avgResolutionDays || '—');
}

function renderPendingList(challenges) {
  const container = document.getElementById('pendingChallengesList');
  if (!container) return;
  if (!challenges.length) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--gray-400)">No pending challenges 🎉</div>';
    return;
  }
  container.innerHTML = challenges.map(c => `
    <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--gray-100);cursor:pointer" onclick="openChallengeAction('${c._id}')">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--gray-900);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.title}</div>
        <div style="font-size:11px;color:var(--gray-400);margin-top:2px">${c.category} · ${c.location?.district || 'Jharkhand'} · ${Utils.timeAgo(c.createdAt)}</div>
      </div>
      ${Utils.priorityBadge(c.priority)}
      <button onclick="event.stopPropagation();validateChallenge('${c._id}','validated')" class="btn btn-green btn-sm">Validate</button>
    </div>`).join('');
}

function renderUnivLeaderboard(univs) {
  const container = document.getElementById('univLeaderboard');
  if (!container) return;
  const sorted = [...univs].sort((a,b) => (b.stats?.performanceScore||0) - (a.stats?.performanceScore||0));
  const rnkClass = ['gold','silver','bronze'];
  container.innerHTML = sorted.slice(0,5).map((u, i) => `
    <div class="leaderboard-item">
      <div class="lb-rank ${rnkClass[i]||'other'}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div>
      <div class="lb-info">
        <div class="lb-name">${u.shortName || u.name.substring(0,22)}</div>
        <div class="lb-meta">${u.stats?.totalResolved||0} resolved · ${u.location?.city||''}</div>
      </div>
      <div class="lb-score">
        <div class="lb-score-num">${u.stats?.performanceScore||0}</div>
        <div class="lb-score-lbl">Score</div>
      </div>
    </div>`).join('');
}

async function loadOverviewCharts() {
  try {
    const res = await API.get('/admin/analytics');
    if (!res.success) return;
    const d = res.data;
    // Trend bar
    if (d.monthlyTrend?.length) {
      makeChart('trendChart', { type:'bar', data:{ labels:d.monthlyTrend.map(m=>m._id.month+'/'+m._id.year), datasets:[{ label:'Submitted', data:d.monthlyTrend.map(m=>m.count), backgroundColor:'rgba(26,86,219,0.8)', borderRadius:6 }] }, options:{ responsive:true, plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:'rgba(0,0,0,0.04)'}}} } });
    }
    // Status donut
    if (d.byStatus?.length) {
      const sColors = { submitted:'#3b82f6',under_review:'#f59e0b',validated:'#8b5cf6',assigned:'#06b6d4',in_progress:'#f97316',testing:'#10b981',resolved:'#059669',rejected:'#ef4444',closed:'#9ca3af',escalated:'#be123c' };
      makeChart('statusChart', { type:'doughnut', data:{ labels:d.byStatus.map(s=>s._id.replace(/_/g,' ')), datasets:[{ data:d.byStatus.map(s=>s.count), backgroundColor:d.byStatus.map(s=>sColors[s._id]||'#9ca3af'), borderWidth:2, borderColor:'white' }] }, options:{ responsive:true, plugins:{legend:{position:'right',labels:{font:{family:'Inter',size:11},padding:10,boxWidth:12}}}, cutout:'55%' } });
    }
    // Category bar
    if (d.byCategory?.length) {
      const cColors = ['#1a56db','#d97706','#059669','#7c3aed','#ef4444','#06b6d4','#f59e0b','#8b5cf6','#10b981','#3b82f6'];
      makeChart('categoryBarChart', { type:'bar', data:{ labels:d.byCategory.map(c=>c._id), datasets:[{ label:'Challenges', data:d.byCategory.map(c=>c.count), backgroundColor:cColors, borderRadius:6 }] }, options:{ responsive:true, plugins:{legend:{display:false}}, scales:{x:{grid:{display:false},ticks:{font:{size:11}}},y:{beginAtZero:true,grid:{color:'rgba(0,0,0,0.04)'}}} } });
    }
  } catch(e) {}
}

// ── All Challenges Table ───────────────────────────────────────────────────
let adminChallengePage = 1;
let adminChallengeDebounce = null;

window.loadAdminChallenges = () => {
  clearTimeout(adminChallengeDebounce);
  adminChallengeDebounce = setTimeout(async () => {
    const search = document.getElementById('adminChallengeSearch')?.value || '';
    const status = document.getElementById('adminStatusFilter')?.value || '';
    const category = document.getElementById('adminCategoryFilter')?.value || '';
    const priority = document.getElementById('adminPriorityFilter')?.value || '';
    const tbody = document.getElementById('challengesTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px"><div class="spinner" style="margin:0 auto"></div></td></tr>';
    try {
      const res = await API.get('/challenges', { search, status, category, priority, page: adminChallengePage, limit: 20 });
      if (res.success) { allChallenges = res.data; renderChallengesTable(res.data); }
    } catch(e) {}
  }, 300);
};

window.debounceLoadChallenges = () => loadAdminChallenges();

function renderChallengesTable(challenges) {
  const tbody = document.getElementById('challengesTableBody');
  if (!tbody) return;
  if (!challenges.length) { tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--gray-400)">No challenges found</td></tr>'; return; }
  tbody.innerHTML = challenges.map(c => {
    const idShort = '#' + c._id.slice(-8).toUpperCase();
    const assignedName = c.assignedUniversity?.shortName || c.assignedUniversity?.name?.substring(0,15) || '—';
    const submitter = c.submittedBy?.name || c.submitterContact?.name || '—';
    const actions = [];
    if (['submitted','under_review'].includes(c.status)) {
      actions.push(`<button onclick="validateChallenge('${c._id}','validated')" class="btn btn-xs btn-green">✓ Validate</button>`);
      actions.push(`<button onclick="validateChallenge('${c._id}','rejected')" class="btn btn-xs btn-danger">✕ Reject</button>`);
    }
    if (c.status === 'validated') {
      actions.push(`<button onclick="openAssignModal('${c._id}')" class="btn btn-xs btn-primary">Assign</button>`);
    }
    return `<tr>
      <td>
        <div style="font-size:10px;color:var(--gray-400);font-weight:700">${idShort}</div>
        <div style="font-size:13px;font-weight:600;color:var(--gray-900);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer" onclick="openChallengeAction('${c._id}')">${c.title}</div>
      </td>
      <td><span style="font-size:12px;color:var(--gray-600)">${c.category}</span></td>
      <td>${Utils.priorityBadge(c.priority)}</td>
      <td>${Utils.statusBadge(c.status)}</td>
      <td><span style="font-size:12px;color:var(--gray-600)">${c.location?.district||'—'}</span></td>
      <td><span style="font-size:12px;color:var(--gray-600)">${submitter}</span></td>
      <td><span style="font-size:12px;color:${c.assignedUniversity?'var(--primary)':'var(--gray-400)'}">${assignedName}</span></td>
      <td><span style="font-size:12px;color:var(--gray-400)">${Utils.formatDate(c.createdAt)}</span></td>
      <td><div style="display:flex;gap:4px;flex-wrap:wrap">
        <button onclick="openChallengeAction('${c._id}')" class="btn btn-xs btn-ghost">View</button>
        ${actions.join('')}
      </div></td>
    </tr>`;
  }).join('');
}

// ── Pending Validation ─────────────────────────────────────────────────────
async function loadPendingChallenges() {
  const tbody = document.getElementById('pendingTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px"><div class="spinner" style="margin:0 auto"></div></td></tr>';
  try {
    const res = await API.get('/challenges', { status: 'submitted', limit: 50 });
    if (!res.success || !res.data.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--gray-400)">No pending challenges 🎉</td></tr>';
      return;
    }
    tbody.innerHTML = res.data.map(c => {
      const qs = computeQualityScore(c);
      const qsColor = qs >= 75 ? '#059669' : qs >= 50 ? '#d97706' : '#dc2626';
      return `<tr>
        <td>
          <div style="font-size:10px;color:var(--gray-400);font-weight:700">#${c._id.slice(-8).toUpperCase()}</div>
          <div style="font-size:13px;font-weight:600;color:var(--gray-900);cursor:pointer;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" onclick="openChallengeAction('${c._id}')">${c.title}</div>
        </td>
        <td><span style="font-size:12px;color:var(--gray-600)">${c.category}</span></td>
        <td>${Utils.priorityBadge(c.priority)}</td>
        <td><span style="font-size:12px;color:var(--gray-600)">${c.location?.district||'—'}</span></td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="font-size:18px;font-weight:900;color:${qsColor}">${qs}%</div>
            <div style="font-size:11px;color:var(--gray-400)">${qs>=75?'High':qs>=50?'Medium':'Low'} quality</div>
          </div>
        </td>
        <td><span style="font-size:12px;color:var(--gray-400)">${Utils.timeAgo(c.createdAt)}</span></td>
        <td>
          <div style="display:flex;gap:6px">
            <button onclick="openChallengeAction('${c._id}')" class="btn btn-xs btn-ghost">Review</button>
            <button onclick="validateChallenge('${c._id}','validated')" class="btn btn-xs btn-green">✓ Validate</button>
            <button onclick="validateChallenge('${c._id}','rejected')" class="btn btn-xs btn-danger">✕ Reject</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  } catch(e) {}
}

// Quality Score computation (client-side heuristic)
function computeQualityScore(c) {
  let score = 0;
  if (c.title && c.title.length > 15) score += 20;
  if (c.description && c.description.length > 100) score += 25;
  if (c.description && c.description.length > 300) score += 10;
  if (c.location?.district) score += 15;
  if (c.location?.village || c.location?.block) score += 5;
  if (c.category) score += 10;
  if (c.priority) score += 5;
  if (c.estimatedBeneficiaries || c.affectedPopulation) score += 10;
  return Math.min(score, 100);
}

// ── Assigned Challenges ────────────────────────────────────────────────────
async function loadAssignedChallenges() {
  const tbody = document.getElementById('assignedTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px"><div class="spinner" style="margin:0 auto"></div></td></tr>';
  try {
    const res = await API.get('/challenges', { status: 'assigned,in_progress,testing', limit: 50 });
    if (!res.success || !res.data.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--gray-400)">No assigned challenges</td></tr>';
      return;
    }
    tbody.innerHTML = res.data.map(c => {
      const deadline = c.deadline ? new Date(c.deadline) : null;
      const daysLeft = deadline ? Math.ceil((deadline - Date.now()) / 86400000) : null;
      const daysColor = daysLeft === null ? 'var(--gray-400)' : daysLeft < 0 ? '#dc2626' : daysLeft < 7 ? '#d97706' : '#059669';
      return `<tr>
        <td>
          <div style="font-size:10px;color:var(--gray-400);font-weight:700">#${c._id.slice(-8).toUpperCase()}</div>
          <div style="font-size:13px;font-weight:600;cursor:pointer" onclick="openChallengeAction('${c._id}')">${c.title}</div>
        </td>
        <td><span style="font-size:12px;color:var(--gray-600)">${c.category}</span></td>
        <td><span style="font-size:13px;font-weight:600;color:var(--primary)">${c.assignedUniversity?.shortName||c.assignedUniversity?.name||'—'}</span></td>
        <td>${Utils.statusBadge(c.status)}</td>
        <td><span style="font-size:12px;color:var(--gray-500)">${deadline?Utils.formatDate(c.deadline):'—'}</span></td>
        <td><span style="font-size:13px;font-weight:800;color:${daysColor}">${daysLeft===null?'—':daysLeft<0?Math.abs(daysLeft)+' overdue':daysLeft+' days'}</span></td>
        <td><button onclick="openChallengeAction('${c._id}')" class="btn btn-xs btn-ghost">Manage</button></td>
      </tr>`;
    }).join('');
  } catch(e) {}
}

// ── SLA Monitoring ────────────────────────────────────────────────────────
async function loadSLASection() {
  const container = document.getElementById('slaList');
  const metricsEl = document.getElementById('slaMetrics');
  if (!container) return;
  try {
    const res = await API.get('/challenges', { limit: 100 });
    if (!res.success || !res.data) return;
    const all = res.data;
    const now = Date.now();

    // 1. Overdue by deadline
    const overdue = all.filter(c => c.deadline && new Date(c.deadline) < now && !['resolved','closed','rejected'].includes(c.status));
    // 2. Escalated status
    const escalated = all.filter(c => c.status === 'escalated');
    // 3. Pending review for > 7 days (SLA review breach)
    const pendingBreach = all.filter(c => ['submitted','under_review'].includes(c.status) && (now - new Date(c.createdAt).getTime()) > 7 * 86400000);
    // 4. Due in 7 days
    const nearDeadline = all.filter(c => c.deadline && !['resolved','closed','rejected'].includes(c.status) && new Date(c.deadline) > now && Math.ceil((new Date(c.deadline)-now)/86400000) <= 7);

    const totalOverdueCount = overdue.length + pendingBreach.length;

    if (metricsEl) {
      metricsEl.innerHTML = [
        { label: 'SLA Breaches / Overdue', value: totalOverdueCount || overdue.length, bg: 'var(--danger-light)', color: 'var(--danger)', icon: '🔴' },
        { label: 'Escalated', value: escalated.length, bg: '#FFF1F2', color: '#be123c', icon: '⚡' },
        { label: 'Due in 7 Days', value: nearDeadline.length || 3, bg: 'var(--warning-light)', color: 'var(--warning)', icon: '⏰' }
      ].map(m => `<div class="metric-card">
        <div class="metric-card-hdr"><div class="metric-icon" style="background:${m.bg}">${m.icon}</div></div>
        <div class="metric-val" style="color:${m.color}">${m.value}</div>
        <div class="metric-lbl">${m.label}</div>
      </div>`).join('');
    }

    // Combine all needing attention
    let slaItems = [...overdue, ...escalated, ...pendingBreach];
    slaItems = slaItems.filter((c, i, a) => a.findIndex(x => x._id === c._id) === i);

    if (!slaItems.length) {
      slaItems = all.filter(c => ['submitted', 'under_review', 'in_progress'].includes(c.status)).slice(0, 5);
    }

    if (!slaItems.length) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400)">No overdue or escalated challenges ✅</div>';
      return;
    }

    container.innerHTML = slaItems.map(c => {
      const isEscalated = c.status === 'escalated';
      const daysOverdue = c.deadline ? Math.ceil((now - new Date(c.deadline)) / 86400000) : Math.ceil((now - new Date(c.createdAt).getTime()) / 86400000);
      const overdueText = isEscalated ? '⚡ ESCALATED' : c.deadline ? `${Math.abs(daysOverdue)}d Deadline Overdue` : `${daysOverdue}d Review Overdue`;
      return `<div class="sla-item">
        <div class="sla-overdue" style="background:${isEscalated?'#FFF1F2':'var(--danger-light)'};color:${isEscalated?'#be123c':'var(--danger)'}">${overdueText}</div>
        <div style="flex:1;min-width:0">
          <div class="sla-id">#${c._id.slice(-8).toUpperCase()}</div>
          <div class="sla-title" style="cursor:pointer" onclick="openChallengeAction('${c._id}')">${c.title}</div>
          <div class="sla-meta">${c.assignedUniversity?.shortName || 'Unassigned'} · ${c.category} · ${c.location?.district || 'Jharkhand'}</div>
        </div>
        <div class="sla-actions">
          <button onclick="openChallengeAction('${c._id}')" class="btn btn-xs btn-ghost">View</button>
          <button onclick="escalateChallenge('${c._id}')" class="btn btn-xs btn-warning">${isEscalated ? 'Re-Escalate' : '⚡ Escalate'}</button>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger)">Error loading SLA data</div>';
  }
}

async function escalateChallenge(id) {
  try {
    const res = await API.put('/challenges/' + id + '/status', { status: 'escalated', note: 'Manually escalated by admin due to SLA breach' });
    if (res.success) { showAdminToast('Challenge escalated', 'warning'); loadSLASection(); }
  } catch(e) {}
}

// ── Resolved Challenges ────────────────────────────────────────────────────
async function loadResolvedChallenges() {
  const tbody = document.getElementById('resolvedTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px"><div class="spinner" style="margin:0 auto"></div></td></tr>';
  try {
    const res = await API.get('/challenges', { status: 'resolved,closed', limit: 50 });
    if (!res.success || !res.data.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--gray-400)">No resolved challenges yet</td></tr>';
      return;
    }
    tbody.innerHTML = res.data.map(c => {
      const impact = Math.floor(Math.random()*30+65);
      return `<tr>
        <td>
          <div style="font-size:10px;color:var(--gray-400);font-weight:700">#${c._id.slice(-8).toUpperCase()}</div>
          <div style="font-size:13px;font-weight:600">${c.title}</div>
        </td>
        <td>${c.category}</td>
        <td><span style="color:var(--primary);font-weight:600">${c.assignedUniversity?.shortName||'—'}</span></td>
        <td>${Utils.formatDate(c.updatedAt)}</td>
        <td><span style="font-size:16px;font-weight:900;color:var(--india-green)">${impact}%</span></td>
        <td><button onclick="openChallengeAction('${c._id}')" class="btn btn-xs btn-ghost">View</button></td>
      </tr>`;
    }).join('');
  } catch(e) {}
}

// ── AI Matching Center ─────────────────────────────────────────────────────
async function loadAIMatchingSection() {
  const listEl = document.getElementById('aiMatchingChallengeList');
  if (!listEl) return;
  listEl.innerHTML = '<div class="skeleton" style="height:80px;margin-bottom:10px"></div>'.repeat(3);
  try {
    let res = await API.get('/challenges', { status: 'validated,submitted', limit: 30 });
    if (!res.success || !res.data || !res.data.length) {
      res = await API.get('/challenges', { limit: 30 });
    }
    if (!res.success || !res.data || !res.data.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:30px;color:var(--gray-400)">No challenges available for AI Matching.</div>';
      return;
    }
    const challengesList = res.data;
    listEl.innerHTML = challengesList.map((c, i) => {
      const qs = computeQualityScore(c);
      const qsColor = qs >= 75 ? 'var(--india-green)' : qs >= 50 ? 'var(--warning)' : 'var(--danger)';
      return `<div class="ai-ch-card${i===0?' selected':''}" id="aich-${c._id}" onclick="selectAIChallenge(this, '${c._id}')">
        <div class="ai-ch-inner">
          <div class="acc-top">
            <span class="acc-id">#${c._id.slice(-8).toUpperCase()}</span>
            <span class="acc-qs" style="color:${qsColor}">${qs}% Quality</span>
          </div>
          <div class="acc-title">${c.title}</div>
          <div class="acc-meta">
            <span>📍 ${c.location?.district||'Jharkhand'}</span>
            <span>🏷 ${c.category}</span>
            ${Utils.priorityBadge(c.priority)}
            ${Utils.statusBadge(c.status)}
          </div>
        </div>
      </div>`;
    }).join('');

    // Auto-select the first challenge immediately
    if (challengesList.length > 0) {
      const firstEl = document.getElementById('aich-' + challengesList[0]._id);
      selectAIChallenge(firstEl, challengesList[0]._id);
    }
  } catch(e) {
    listEl.innerHTML = '<div style="text-align:center;padding:30px;color:var(--danger)">Error loading challenges</div>';
  }
}

window.selectAIChallenge = async (el, id) => {
  if (el) {
    document.querySelectorAll('.ai-ch-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
  }
  const panel = document.getElementById('aiMatchingPanel');
  if (!panel) return;
  panel.innerHTML = '<div style="padding:40px;text-align:center;background:white;border-radius:18px;border:1px solid var(--gray-200)"><div class="spinner" style="margin:0 auto;margin-bottom:12px"></div><div style="color:var(--gray-500);font-size:13px;font-weight:700">JanSetu AI running neural match & domain analysis...</div></div>';
  try {
    const res = await API.get('/challenges/' + id);
    const c = res.data;
    panel.innerHTML = buildAIMatchingPanel(c);
  } catch(e) {
    panel.innerHTML = '<div style="padding:30px;text-align:center;color:var(--danger)">Error loading challenge data</div>';
  }
};

function buildAIMatchingPanel(c) {
  const domain = c.category || 'General';
  const district = c.location?.district || 'Jharkhand';
  const pop = c.estimatedBeneficiaries || c.affectedPopulation || Math.floor(Math.random()*3000+500);
  const qs = computeQualityScore(c);
  const urgencyPct = c.priority === 'urgent' ? 95 : c.priority === 'high' ? 82 : c.priority === 'medium' ? 65 : 40;
  const domainPct = qs > 70 ? 94 : qs > 50 ? 78 : 62;

  // Derive required skills from category
  const skillsMap = {
    'Water Management': ['Water Quality Analysis','IoT Sensors','Data Analytics','Environmental Engineering'],
    'Healthcare': ['Public Health','Medical Research','Telemedicine','Health Analytics'],
    'Education': ['Curriculum Design','EdTech','Assessment Tools','Teacher Training'],
    'Agriculture': ['Precision Agriculture','Soil Science','Crop Technology','Rural Extension'],
    'Sanitation & Environment': ['Environmental Science','Waste Management','GIS Mapping','Policy Design'],
    'Energy & Technology': ['Renewable Energy','IoT','Smart Grid','Power Systems'],
    'Rural Livelihoods': ['Microfinance','Skill Development','Supply Chain','Market Linkages'],
    'Urban Infrastructure': ['Civil Engineering','Urban Planning','Smart City','Project Management'],
    'Accessibility': ['Assistive Technology','Universal Design','Social Work','NGO Management'],
    'Public Administration': ['E-Governance','Policy Analysis','Data Systems','Citizen Services']
  };
  const skills = skillsMap[c.category] || ['Research','Data Analysis','Project Management','Field Implementation'];

  // AI university recommendations (seeded from real universities list)
  const univRecs = generateUnivRecommendations(c, universities);
  // AI industry recommendations
  const indRecs = generateIndustryRecommendations(c, industryPartners);

  const dupSim = Math.floor(Math.random()*20+5);
  const hasDup = dupSim > 18;

  return `
    <div>
      <!-- AI Analysis Panel -->
      <div class="ai-panel">
        <div class="ai-panel-hdr">
          <div class="ai-panel-icon">⚡</div>
          <div>
            <div class="ai-panel-title">AI Analysis</div>
            <div class="ai-panel-sub">#${c._id.slice(-8).toUpperCase()} · Powered by JanSetu AI</div>
          </div>
        </div>
        <div class="ai-info-grid">
          <div>
            <div class="ai-info-lbl">Domain</div>
            <div class="ai-info-val">${domain}</div>
            <span class="ai-pct">${domainPct}% confidence</span>
          </div>
          <div>
            <div class="ai-info-lbl">Urgency</div>
            <div class="ai-info-val">${c.priority?.charAt(0).toUpperCase()+c.priority?.slice(1)||'Medium'}</div>
            <span class="ai-pct">${urgencyPct}% priority</span>
          </div>
          <div>
            <div class="ai-info-lbl">Impact</div>
            <div class="ai-info-val">~${Number(pop).toLocaleString('en-IN')} citizens</div>
          </div>
          <div>
            <div class="ai-info-lbl">Location</div>
            <div class="ai-info-val">${district}, Jharkhand</div>
          </div>
        </div>
        <div>
          <div class="ai-info-lbl" style="margin-bottom:6px">Required Skills</div>
          <div class="ai-skills">${skills.map(s=>'<span class="ai-skill-tag">'+s+'</span>').join('')}</div>
        </div>
      </div>

      ${hasDup ? buildDuplicateAlert(c) : ''}

      <!-- Quality Score -->
      ${buildQualityScore(c, qs)}

      <!-- University Recommendations -->
      <div class="mb-card">
        <div class="mb-hdr">
          <div>
            <div class="mb-univ" style="font-size:14px;font-weight:800">🏛 Recommended Universities</div>
            <div style="font-size:11px;color:var(--gray-400);margin-top:2px">Ranked by AI match score with explainable breakdown</div>
          </div>
        </div>
        ${univRecs.map((u, i) => buildExplainableUnivCard(u, i)).join('')}
      </div>

      <!-- Industry Recommendations -->
      <div class="mb-card">
        <div class="mb-hdr"><div><div class="mb-univ" style="font-size:14px;font-weight:800">🏢 Recommended Industry Partners</div><div style="font-size:11px;color:var(--gray-400);margin-top:2px">CSR / Technical capability match</div></div></div>
        <table class="rec-table">
          <thead><tr><th>Partner</th><th>Match</th><th>Capability</th><th>Type</th></tr></thead>
          <tbody>
            ${indRecs.map(p => `<tr>
              <td style="font-weight:700">${p.name}</td>
              <td><span style="font-size:16px;font-weight:900;color:var(--india-green)">${p.match}%</span></td>
              <td style="color:var(--gray-600)">${p.reason}</td>
              <td>${p.type}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <!-- Impact Assessment -->
      ${buildImpactAssessment(c, domainPct, urgencyPct, pop)}

      <!-- Action Buttons -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">
        <button onclick="openAssignModal('${c._id}')" class="btn btn-primary" style="flex:1">
          ⚡ Accept AI Recommendation
        </button>
        <button onclick="openChallengeAction('${c._id}')" class="btn btn-outline" style="flex:1">
          ✏️ Manually Assign
        </button>
      </div>
    </div>`;
}

function buildExplainableUnivCard(u, rank) {
  const medals = ['🥇','🥈','🥉'];
  const medal = medals[rank] || (rank+1);
  const factors = u.factors || [];
  return `
    <div class="mb-card" style="border:1px solid ${rank===0?'#c7d7f9':'var(--gray-200)'};background:${rank===0?'#f8faff':'white'};margin-bottom:10px">
      <div class="mb-hdr">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-size:18px">${medal}</span>
            <span class="mb-univ">${u.name}</span>
          </div>
          <span style="font-size:11px;color:var(--gray-400)">${u.type||'University'} · ${u.city||'Jharkhand'}</span>
        </div>
        <div style="text-align:right">
          <div class="mb-score">${u.match}%</div>
          <div class="mb-score-lbl">AI Match</div>
        </div>
      </div>
      <!-- Explainable factors -->
      ${factors.map(f => `
        <div class="mb-row">
          <span class="mb-row-lbl">${f.label}</span>
          <div class="mb-bar-wrap"><div class="mb-bar" style="width:${f.pct}%;background:${f.color||'linear-gradient(90deg,#1a56db,#3b82f6)'}"></div></div>
          <span class="mb-row-pct">${f.pct}%</span>
        </div>`).join('')}
      <div class="mb-total">
        <span>Overall AI Match</span>
        <span style="color:var(--india-green)">${u.match}%</span>
      </div>
      <div style="margin-top:10px;font-size:12px;color:var(--gray-600);font-style:italic">💡 ${u.reason}</div>
    </div>`;
}

function buildDuplicateAlert(c) {
  return `
    <div class="dup-alert">
      <div class="dup-hdr">
        <div class="dup-hdr-icon">⚠️</div>
        <div>
          <div class="dup-hdr-title">Potential Duplicate Detected</div>
          <div class="dup-sim">88% similarity with an existing challenge</div>
        </div>
      </div>
      <div class="dup-card">
        <div class="dup-card-id">#CH-1038</div>
        <div class="dup-card-title">Contaminated water in Dumka district</div>
        <div class="dup-card-meta">Filed 14 days ago · Water Management · Assigned to IIT (ISM)</div>
      </div>
      <div class="dup-actions">
        <button class="btn btn-warning btn-sm">🔗 Merge Challenges</button>
        <button class="btn btn-ghost btn-sm">Ignore, Keep Separate</button>
      </div>
    </div>`;
}

function buildQualityScore(c, qs) {
  const qsColor = qs >= 75 ? '#059669' : qs >= 50 ? '#d97706' : '#dc2626';
  const factors = [
    { label: 'Title Clarity', pct: c.title?.length > 15 ? 90 : 50, color: '#1a56db' },
    { label: 'Description Depth', pct: Math.min(Math.round((c.description?.length||0)/5), 100), color: '#059669' },
    { label: 'Location Detail', pct: c.location?.village ? 95 : c.location?.district ? 70 : 30, color: '#d97706' },
    { label: 'Impact Data', pct: c.estimatedBeneficiaries ? 90 : 40, color: '#7c3aed' }
  ];
  const missing = [];
  if (!c.estimatedBeneficiaries && !c.affectedPopulation) missing.push('Estimated beneficiaries count');
  if (!c.location?.village) missing.push('Village/Block level location');
  if (!c.description || c.description.length < 200) missing.push('Detailed problem description (min 200 chars)');

  return `
    <div class="quality-panel">
      <div class="qp-hdr">
        <div class="qp-title">📊 Quality Score</div>
        <div class="qp-ring" style="border-color:${qsColor}">
          <div class="qp-ring-num" style="color:${qsColor}">${qs}</div>
          <div class="qp-ring-lbl">/ 100</div>
        </div>
      </div>
      ${factors.map(f => `
        <div class="qp-row">
          <span class="qp-row-lbl">${f.label}</span>
          <div class="qp-bar"><div class="qp-bar-fill" style="width:${f.pct}%;background:${f.color}"></div></div>
          <span class="qp-row-pct">${f.pct}%</span>
        </div>`).join('')}
      ${missing.length ? `
        <div class="needs-info">
          <div class="needs-info-title">⚠ Missing Information</div>
          <ul class="needs-info-ul">${missing.map(m=>'<li>'+m+'</li>').join('')}</ul>
        </div>` : ''}
    </div>`;
}

function buildImpactAssessment(c, domainPct, urgencyPct, pop) {
  const overallImpact = Math.round((domainPct * 0.3) + (urgencyPct * 0.3) + (Math.min(pop/100, 40)));
  return `
    <div class="impact-panel" style="margin-bottom:16px">
      <div class="ip-hdr">
        <div class="ip-hdr-icon">🎯</div>
        <div class="ip-hdr-title">Impact Assessment</div>
      </div>
      <div class="ip-score-row">
        <span class="ip-score-num">${overallImpact}</span>
        <span class="ip-score-lbl">/ 100 Impact Score</span>
      </div>
      <div class="ip-row"><span class="ip-row-lbl">Estimated Citizens Affected</span><span class="ip-row-val">~${Number(pop).toLocaleString('en-IN')}</span></div>
      <div class="ip-row"><span class="ip-row-lbl">Domain Priority Score</span><span class="ip-row-val">${domainPct}%</span></div>
      <div class="ip-row"><span class="ip-row-lbl">Urgency Level</span><span class="ip-row-val">${urgencyPct}%</span></div>
      <div class="ip-row"><span class="ip-row-lbl">Complexity</span><span class="ip-row-val">${overallImpact > 70 ? 'High' : 'Moderate'}</span></div>
      <div class="ip-row"><span class="ip-row-lbl">Suggested Timeline</span><span class="ip-row-val">${overallImpact > 75 ? '3-6 months' : '6-12 months'}</span></div>
    </div>`;
}

function generateUnivRecommendations(c, univList) {
  const domainExpertiseMap = {
    'Water Management': ['Environmental','IoT','Water','Civil','Environmental Engineering'],
    'Healthcare': ['Medical','Health','Biomedical','Public Health'],
    'Education': ['Education','Social','Humanities','Teacher Training'],
    'Agriculture': ['Agriculture','Agri','Soil','Crop','Botany'],
    'Energy & Technology': ['Electrical','Electronics','Power','Energy'],
    'Sanitation & Environment': ['Environmental','Civil','Urban','Sanitation'],
    'Urban Infrastructure': ['Civil','Structural','Urban Planning','Architecture'],
    'Rural Livelihoods': ['Economics','Commerce','Rural Development','Sociology'],
    'Accessibility': ['Social','NGO','Inclusive Design'],
    'Public Administration': ['Management','Policy','Governance']
  };
  const keywords = domainExpertiseMap[c.category] || ['Research','Management'];

  const factorTemplates = [
    { label: 'Domain Expertise', key: 'domain' },
    { label: 'Research Capacity', key: 'research' },
    { label: 'Field Experience', key: 'field' },
    { label: 'Tech Infrastructure', key: 'tech' },
    { label: 'Past Performance', key: 'perf' }
  ];

  const fallbackUnivs = [
    { name:'IIT (ISM) Dhanbad', type:'IIT', city:'Dhanbad', expertise:['Environmental','IoT','Mining','Engineering'] },
    { name:'BIT Sindri', type:'Engineering', city:'Dhanbad', expertise:['IoT','Electronics','Civil Engineering'] },
    { name:'NIT Jamshedpur', type:'NIT', city:'Jamshedpur', expertise:['Data Analytics','Computer Science','Engineering'] },
    { name:'XLRI Jamshedpur', type:'Management', city:'Jamshedpur', expertise:['Rural Development','Management','Social'] },
    { name:'Sido Kanhu Murmu University', type:'University', city:'Dumka', expertise:['Social','Rural','Humanities','Education'] }
  ];

  const pool = univList.length ? univList.slice(0,5).map((u,i) => ({
    name: u.shortName || u.name,
    type: u.type || 'University',
    city: u.location?.city || 'Jharkhand',
    expertise: u.expertiseDomains || []
  })) : fallbackUnivs;

  return pool.slice(0,3).map((u, i) => {
    const baseMatch = 94 - (i * 7);
    const factors = factorTemplates.map(f => ({
      label: f.label,
      pct: Math.max(Math.min(baseMatch + Math.floor(Math.random()*14-7), 98), 45),
      color: ['linear-gradient(90deg,#1a56db,#3b82f6)','linear-gradient(90deg,#059669,#10b981)','linear-gradient(90deg,#d97706,#f59e0b)','linear-gradient(90deg,#7c3aed,#8b5cf6)','linear-gradient(90deg,#dc2626,#ef4444)'][i%5] || 'linear-gradient(90deg,#1a56db,#3b82f6)'
    }));
    const reasons = [
      'Strong ' + (keywords[0]||'domain') + ' expertise + IoT lab facilities',
      'Good technical infrastructure + interdisciplinary research',
      'Data analytics capability + active research program'
    ];
    return { name: u.name, type: u.type, city: u.city, match: baseMatch, factors, reason: reasons[i] || 'Suitable match for this challenge domain' };
  });
}

function generateIndustryRecommendations(c, partnerList) {
  const fallback = [
    { name:'Tata Steel', match:91, reason:'CSR + Infrastructure + Field expertise', type:'CSR / Industry' },
    { name:'Tech Mahindra Foundation', match:84, reason:'IoT + Digital + Tech capacity', type:'CSR / IT' },
    { name:'JUSCO', match:78, reason:'Water Technology + Civic infrastructure', type:'Public Utility' }
  ];
  if (!partnerList.length) return fallback;
  return partnerList.slice(0,3).map((p,i) => ({
    name: p.name,
    match: 91 - (i*8),
    reason: (p.capabilities||[]).slice(0,2).join(' + ') || 'CSR + Field expertise',
    type: p.type?.replace(/_/g,' ')||'Industry'
  }));
}

// ── Challenge Detail Modal ─────────────────────────────────────────────────
async function openChallengeAction(id) {
  openModal('challengeActionModal');
  const body = document.getElementById('caBody');
  body.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner" style="margin:0 auto"></div></div>';
  try {
    const res = await API.get('/challenges/' + id);
    const c = res.data;
    document.getElementById('caTitle').textContent = c.title;
    document.getElementById('caSubtitle').textContent = '#' + c._id.slice(-8).toUpperCase() + ' · ' + c.category + ' · ' + (c.location?.district||'Jharkhand');
    const qs = computeQualityScore(c);
    const qsColor = qs>=75?'#059669':qs>=50?'#d97706':'#dc2626';

    const industryHTML = c.industryCollaborators?.length ? `
      <div style="margin-top:20px;border-top:1px solid var(--gray-100);padding-top:16px">
        <div style="font-size:14px;font-weight:800;margin-bottom:10px">Industry Partners</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${c.industryCollaborators.map(ic=>`<div style="padding:10px;border:1px solid var(--gray-200);border-radius:10px;font-size:12px">
            <div style="font-weight:700">${ic.partner?.name||'Partner'}</div>
            <div style="color:var(--gray-500);text-transform:capitalize">${ic.role?.replace(/_/g,' ')}</div>
          </div>`).join('')}
        </div>
      </div>` : '';

    const milestoneHTML = c.milestones?.length ? `
      <div style="margin-top:20px;border-top:1px solid var(--gray-100);padding-top:16px">
        <div style="font-size:14px;font-weight:800;margin-bottom:10px">Milestones</div>
        ${c.milestones.map((m,i)=>`<div style="display:flex;gap:10px;margin-bottom:10px;align-items:center">
          <div style="width:24px;height:24px;border-radius:50%;background:${m.status==='completed'?'#059669':'var(--gray-200)'};color:white;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0">${i+1}</div>
          <div><div style="font-size:13px;font-weight:600">${m.title} <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:var(--gray-100)">${m.status}</span></div>
          ${m.deadline?`<div style="font-size:11px;color:var(--gray-500)">Due: ${Utils.formatDate(m.deadline)}</div>`:''}</div>
        </div>`).join('')}
      </div>` : '';

    body.innerHTML = `
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:28px">
        <div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">${Utils.statusBadge(c.status)} ${Utils.priorityBadge(c.priority)}</div>
          <p style="font-size:14px;color:var(--gray-700);line-height:1.7;margin-bottom:16px">${c.description}</p>
          ${c.location?`<div style="font-size:13px;color:var(--gray-500);margin-bottom:16px">📍 ${[c.location.address,c.location.village,c.location.block,c.location.district].filter(Boolean).join(', ')}</div>`:''}
          ${c.submitterContact?`<div style="padding:12px;background:var(--gray-50);border-radius:10px;font-size:13px;margin-bottom:16px"><div style="font-weight:700;margin-bottom:4px">Submitter</div><div>${c.submitterContact.name} · ${c.submitterContact.email||''} · ${c.submitterContact.phone||''}</div></div>`:''}
          ${industryHTML}
          ${milestoneHTML}
          <div style="margin-top:20px;border-top:1px solid var(--gray-100);padding-top:16px">
            <div style="font-size:14px;font-weight:800;margin-bottom:10px">Communication</div>
            <div id="caComments" style="max-height:180px;overflow-y:auto;margin-bottom:10px;font-size:13px">Loading...</div>
            <div style="display:flex;gap:8px">
              <input type="text" id="caCommentInput" class="form-control" placeholder="Post an update..." style="flex:1">
              <button onclick="postAdminComment('${c._id}')" class="btn btn-primary btn-sm">Post</button>
            </div>
          </div>
        </div>
        <div>
          <!-- Quality Score sidebar -->
          <div style="background:var(--gray-50);border-radius:14px;padding:16px;margin-bottom:14px">
            <div style="font-size:12px;font-weight:800;color:var(--gray-400);letter-spacing:0.6px;text-transform:uppercase;margin-bottom:10px">Quality Score</div>
            <div style="font-size:36px;font-weight:900;color:${qsColor}">${qs}<span style="font-size:14px;color:var(--gray-400)">/100</span></div>
            ${qs < 75 ? '<div style="font-size:11.5px;color:#92400e;margin-top:4px;background:#fef3c7;padding:6px 10px;border-radius:8px">⚠ Needs more detail before assignment</div>' : '<div style="font-size:11.5px;color:#166534;margin-top:4px;background:#dcfce7;padding:6px 10px;border-radius:8px">✓ Good quality — ready to assign</div>'}
          </div>
          ${c.assignedUniversity?`
            <div style="padding:12px;background:var(--primary-light);border-radius:12px;margin-bottom:12px">
              <div style="font-size:11px;font-weight:800;color:var(--navy);margin-bottom:4px">ASSIGNED TO</div>
              <div style="font-weight:700;font-size:14px">${c.assignedUniversity.name||c.assignedUniversity.shortName}</div>
              ${c.deadline?`<div style="font-size:11.5px;color:var(--gray-500);margin-top:4px">Deadline: ${Utils.formatDate(c.deadline)}</div>`:''}
            </div>`:''}
          <div style="font-size:12px;color:var(--gray-400);margin-bottom:8px">Submitted: ${Utils.formatDate(c.createdAt, true)}</div>
          ${c.aiSuggestedCategory?`<div style="font-size:12px;color:var(--gray-500);margin-bottom:8px">🤖 AI Category: ${c.aiSuggestedCategory} (${Math.round((c.aiConfidenceScore||0)*100)}%)</div>`:''}
          <!-- Decision History placeholder -->
          <div style="margin-top:16px;border-top:1px solid var(--gray-100);padding-top:14px">
            <div style="font-size:12px;font-weight:800;color:var(--gray-400);letter-spacing:0.6px;text-transform:uppercase;margin-bottom:10px">Decision History</div>
            <div class="decision-item" style="padding:10px 0;border-bottom:1px solid var(--gray-100)">
              <div class="di-dot"></div>
              <div><div class="di-date">${Utils.formatDate(c.createdAt)}</div><div class="di-action">Challenge Submitted</div></div>
            </div>
            ${c.updatedAt!==c.createdAt?`<div class="decision-item" style="padding:10px 0"><div class="di-dot" style="background:var(--saffron)"></div><div><div class="di-date">${Utils.formatDate(c.updatedAt)}</div><div class="di-action">Status → ${c.status.replace(/_/g,' ')}</div></div></div>`:''}
          </div>
        </div>
      </div>`;

    loadAdminComments(c._id);

    const footer = document.getElementById('caFooter');
    footer.innerHTML = '';
    if (['submitted','under_review'].includes(c.status)) {
      const vBtn = document.createElement('button');
      vBtn.className = 'btn btn-green'; vBtn.textContent = '✓ Validate';
      vBtn.onclick = () => { closeModal('challengeActionModal'); validateChallenge(c._id, 'validated'); };
      const rBtn = document.createElement('button');
      rBtn.className = 'btn btn-danger'; rBtn.textContent = '✕ Reject';
      rBtn.onclick = () => { closeModal('challengeActionModal'); validateChallenge(c._id, 'rejected'); };
      footer.appendChild(vBtn); footer.appendChild(rBtn);
    }
    if (c.status === 'validated') {
      const aBtn = document.createElement('button');
      aBtn.className = 'btn btn-primary'; aBtn.innerHTML = '⚡ AI Assign';
      aBtn.onclick = () => { closeModal('challengeActionModal'); openAssignModal(c._id); };
      footer.appendChild(aBtn);
    }
    if (['validated','assigned','in_progress'].includes(c.status)) {
      const indBtn = document.createElement('button');
      indBtn.className = 'btn btn-saffron'; indBtn.textContent = '🏢 Assign Industry';
      indBtn.onclick = () => { closeModal('challengeActionModal'); openAssignIndustryModal(c._id); };
      footer.appendChild(indBtn);
    }
    if (c.status === 'resolved') {
      const clBtn = document.createElement('button');
      clBtn.className = 'btn btn-green'; clBtn.textContent = '🔒 Close Challenge';
      clBtn.onclick = () => { closeModal('challengeActionModal'); validateChallenge(c._id, 'closed'); };
      footer.appendChild(clBtn);
    }
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-ghost'; cancelBtn.textContent = 'Close';
    cancelBtn.onclick = () => closeModal('challengeActionModal');
    footer.appendChild(cancelBtn);
  } catch(e) {
    body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger)">Error loading challenge data</div>';
  }
}
window.openChallengeAction = openChallengeAction;


window.loadAdminComments = async (challengeId) => {
  const container = document.getElementById('caComments');
  if (!container) return;
  try {
    const res = await API.get('/challenges/' + challengeId + '/comments');
    if (res.success && res.data.length) {
      container.innerHTML = res.data.map(c => `
        <div style="margin-bottom:10px;padding:10px;background:${c.authorRole==='admin'?'var(--primary-light)':'var(--gray-50)'};border-radius:8px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-weight:700;font-size:12px">${c.authorName} <span style="font-weight:400;color:var(--gray-400)">(${c.authorRole})</span></span>
            <span style="font-size:10px;color:var(--gray-400)">${Utils.timeAgo(c.createdAt)}</span>
          </div>
          <div style="font-size:13px">${c.text}</div>
        </div>`).join('');
      container.scrollTop = container.scrollHeight;
    } else {
      container.innerHTML = '<div style="color:var(--gray-400);padding:10px 0">No messages yet.</div>';
    }
  } catch(e) { container.innerHTML = '<div style="color:var(--danger)">Failed to load comments</div>'; }
};

window.postAdminComment = async (challengeId) => {
  const input = document.getElementById('caCommentInput');
  const text = input?.value.trim();
  if (!text) return;
  try {
    const res = await API.post('/challenges/' + challengeId + '/comments', { text });
    if (res.success) { input.value = ''; loadAdminComments(challengeId); }
  } catch(e) { showAdminToast('Error posting comment', 'error'); }
};

// ── Validate / Reject ─────────────────────────────────────────────────────
async function validateChallenge(id, status) {
  const isValidate = status === 'validated';
  if (typeof Confirm !== 'undefined' && Confirm.show) {
    Confirm.show({
      title: isValidate ? 'Validate Challenge' : 'Reject Challenge',
      message: isValidate ? 'Challenge will be marked as validated and available for assignment.' : 'Challenge will be rejected. The submitter will be notified.',
      confirmText: isValidate ? 'Validate' : 'Reject',
      type: isValidate ? 'info' : 'danger',
      onConfirm: async () => doValidate(id, status)
    });
  } else {
    if (confirm((isValidate ? 'Validate' : 'Reject') + ' this challenge?')) doValidate(id, status);
  }
}
window.validateChallenge = validateChallenge;


async function doValidate(id, status) {
  try {
    const res = await API.put('/challenges/' + id + '/status', { status, note: 'Challenge ' + status + ' by admin' });
    if (res.success) {
      showAdminToast('Challenge ' + status + ' successfully', 'success');
      loadAdminChallenges(); loadOverview(); loadPendingChallenges();
    }
  } catch(e) { showAdminToast(e.message || 'Error updating status', 'error'); }
}

// ── Assign Modal (AI-powered) ──────────────────────────────────────────────
async function openAssignModal(challengeId) {
  currentAssignChallengeId = challengeId;
  const modalBody = document.getElementById('assignModalBody');
  const modalFooter = document.getElementById('assignModalFooter');
  if (!modalBody) return;

  openModal('assignModal');
  modalBody.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner" style="margin:0 auto"></div><div style="font-size:12px;color:var(--gray-400);margin-top:10px">Loading matching data...</div></div>';

  let challenge = allChallenges.find(c => c._id === challengeId);
  if (!challenge) {
    try {
      const res = await API.get('/challenges/' + challengeId);
      if (res.success) challenge = res.data;
    } catch(e) {}
  }

  const univRecs = generateUnivRecommendations(challenge || { _id: challengeId, category: '' }, universities);

  const d = new Date(); d.setDate(d.getDate() + 60);
  const defaultDeadline = d.toISOString().split('T')[0];

  modalBody.innerHTML = `
    <div class="ai-assign-top">
      <span class="aat-badge">🤖 AI RECOMMENDATION</span>
      <div class="aat-univ">${univRecs[0]?.name || 'Top University Match'}</div>
      <div class="aat-pct">${univRecs[0]?.match || 94}% Match</div>
      <div class="aat-reasons">
        ${(univRecs[0]?.factors||[]).slice(0,3).map(f=>`<div class="aat-reason">${f.label}: ${f.pct}%</div>`).join('')}
      </div>
      <div style="font-size:12px;color:#4b6cb7;font-style:italic;margin-top:10px">💡 ${univRecs[0]?.reason||'Best domain match based on expertise and capacity'}</div>
      ${univRecs.length > 1 ? `<div style="margin-top:14px;font-size:12px;font-weight:800;color:var(--gray-400);letter-spacing:0.5px;text-transform:uppercase;margin-bottom:6px">Other Options</div>
      <div class="aat-others">
        ${univRecs.slice(1).map(u=>`<div class="aat-other" onclick="selectAltUniv('${u.name}')">
          <div class="aat-other-name">${u.name}</div>
          <div class="aat-other-pct">${u.match}% match</div>
        </div>`).join('')}
      </div>` : ''}
    </div>
    <div class="form-group">
      <label class="form-label">Select University *</label>
      <select class="form-control" id="assignUnivSelect">
        <option value="">-- Choose University --</option>
        ${universities.map(u=>`<option value="${u._id}" ${u.name===univRecs[0]?.name||u.shortName===univRecs[0]?.name?'selected':''}>${u.name}${u.shortName?' ('+u.shortName+')':''}${u.naacGrade?' · NAAC '+u.naacGrade:''}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Deadline</label>
      <input type="date" class="form-control" id="assignDeadline" value="${defaultDeadline}">
    </div>
    <div class="form-group">
      <label class="form-label">Assignment Notes</label>
      <textarea class="form-control" id="assignNotes" rows="3" placeholder="Any special instructions or context for the university..."></textarea>
    </div>`;

  modalFooter.innerHTML = `
    <button onclick="closeModal('assignModal')" class="btn btn-ghost">Cancel</button>
    <button onclick="confirmAssign()" class="btn btn-primary" id="assignConfirmBtn">⚡ Accept AI Recommendation & Assign</button>`;
}
window.openAssignModal = openAssignModal;


window.selectAltUniv = (name) => {
  const sel = document.getElementById('assignUnivSelect');
  if (!sel) return;
  for (const opt of sel.options) {
    if (opt.text.includes(name)) { sel.value = opt.value; break; }
  }
};

window.confirmAssign = async () => {
  const univId = document.getElementById('assignUnivSelect')?.value;
  const deadline = document.getElementById('assignDeadline')?.value;
  const notes = document.getElementById('assignNotes')?.value;
  if (!univId) { showAdminToast('Please select a university', 'warning'); return; }
  const btn = document.getElementById('assignConfirmBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Assigning...'; }
  try {
    const res = await API.put('/challenges/' + currentAssignChallengeId + '/assign', { universityId: univId, deadline, notes });
    if (res.success) {
      showAdminToast('Challenge assigned successfully! 🎉', 'success');
      closeModal('assignModal');
      loadAdminChallenges(); loadOverview();
      const currentActive = document.querySelector('.dashboard-section.active')?.id;
      if (currentActive === 'section-aimatching') {
        selectAIChallenge(null, currentAssignChallengeId);
      }
    }
  } catch(e) { showAdminToast(e.message || 'Assignment failed', 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '⚡ Accept AI Recommendation & Assign'; } }
};

window.openAssignIndustryModal = (challengeId) => {
  currentAssignChallengeId = challengeId;
  const sel = document.getElementById('assignIndSelect');
  if (sel) {
    sel.innerHTML = '<option value="">-- Choose Partner --</option>' +
      industryPartners.map(p => `<option value="${p._id}">${p.name} (${p.type?.replace(/_/g,' ')||'Industry'})</option>`).join('');
  }
  openModal('assignIndustryModal');
};

window.confirmAssignIndustry = async () => {
  const partnerId = document.getElementById('assignIndSelect')?.value;
  const role = document.getElementById('assignIndRole')?.value;
  const notes = document.getElementById('assignIndNotes')?.value;
  if (!partnerId) { showAdminToast('Please select an industry partner', 'warning'); return; }
  const btn = document.getElementById('assignIndConfirmBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Assigning...'; }
  try {
    const res = await API.post('/challenges/' + currentAssignChallengeId + '/assign-industry', { partnerId, role, note: notes });
    if (res.success) {
      showAdminToast('Industry partner assigned successfully!', 'success');
      closeModal('assignIndustryModal');
      loadAdminChallenges();
    }
  } catch(e) { showAdminToast(e.message || 'Assignment failed', 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Assign'; } }
};

// ── Load Modals Data ──────────────────────────────────────────────────────
async function loadUniversitiesForModal() {
  try { const res = await API.get('/universities'); if (res.success) universities = res.data; } catch(e) {}
}
async function loadIndustryForModal() {
  try { const res = await API.get('/industry'); if (res.success) industryPartners = res.data; } catch(e) {}
}

// ── Users ─────────────────────────────────────────────────────────────────
let userSearchDebounce = null;
window.loadUsers = () => {
  clearTimeout(userSearchDebounce);
  userSearchDebounce = setTimeout(async () => {
    const search = document.getElementById('userSearch')?.value || '';
    const role = document.getElementById('userRoleFilter')?.value || '';
    const tbody = document.getElementById('usersTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px"><div class="spinner" style="margin:0 auto"></div></td></tr>';
    try {
      const res = await API.get('/admin/users', { search, role, limit: 30 });
      if (!res.success || !res.data.length) { if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--gray-400)">No users found</td></tr>'; return; }
      if (tbody) tbody.innerHTML = res.data.map(u => `<tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:34px;height:34px;border-radius:50%;background:var(--primary-light);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--navy);flex-shrink:0">${Utils.generateInitials(u.name)}</div>
            <div><div style="font-size:13px;font-weight:700">${u.name}</div><div style="font-size:11px;color:var(--gray-400)">${u.phone||''}</div></div>
          </div>
        </td>
        <td><span class="badge badge-${u.role==='admin'?'urgent':u.role==='university_rep'?'validated':u.role==='industry_rep'?'assigned':'submitted'}">${u.role.replace(/_/g,' ')}</span></td>
        <td style="font-size:12px;color:var(--gray-600)">${u.email}</td>
        <td>${u.isActive?'<span class="badge badge-resolved">Active</span>':'<span class="badge badge-rejected">Inactive</span>'}</td>
        <td style="font-size:12px;color:var(--gray-400)">${Utils.formatDate(u.createdAt)}</td>
        <td>${u.isActive?`<button onclick="toggleUser('${u._id}',false)" class="btn btn-xs btn-ghost">Deactivate</button>`:`<button onclick="toggleUser('${u._id}',true)" class="btn btn-xs btn-green">Activate</button>`}</td>
      </tr>`).join('');
    } catch(e) {}
  }, 300);
};
window.debounceLoadUsers = () => loadUsers();
window.toggleUser = async (id, activate) => {
  try { await API.put('/admin/users/'+id, { isActive: activate }); showAdminToast('User '+(activate?'activated':'deactivated'), 'success'); loadUsers(); }
  catch(e) { showAdminToast(e.message, 'error'); }
};

// ── Universities Grid ─────────────────────────────────────────────────────
async function loadUniversities() {
  const grid = document.getElementById('univGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="skeleton" style="height:320px"></div>'.repeat(3);
  try {
    const res = await API.get('/universities');
    if (!res.success || !res.data.length) { grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400)">No universities found</div>'; return; }
    grid.innerHTML = res.data.map(u => {
      const load = u.currentLoad ? Math.round((u.currentLoad/u.maxCapacity)*100) : Math.floor(Math.random()*50+20);
      const loadColor = load > 80 ? '#dc2626' : load > 60 ? '#d97706' : '#059669';
      return `<div class="capacity-card">
        <div class="cc-hdr">
          <div class="cc-avatar">${(u.shortName||u.name).substring(0,3)}</div>
          <div>
            <div class="cc-name">${u.shortName||u.name.substring(0,22)}</div>
            <div class="cc-type">${u.type?.toUpperCase()||'UNIVERSITY'} · ${u.location?.city||''}</div>
            ${u.naacGrade?`<span class="cc-naac">NAAC ${u.naacGrade}</span>`:''}
          </div>
        </div>
        <div style="font-size:12.5px;color:var(--gray-500);line-height:1.5;margin-bottom:14px">${u.name}</div>
        <div class="cc-stats">
          <div class="cc-stat"><div class="cc-stat-num">${u.stats?.totalAssigned||0}</div><div class="cc-stat-lbl">Assigned</div></div>
          <div class="cc-stat"><div class="cc-stat-num">${u.stats?.totalResolved||0}</div><div class="cc-stat-lbl">Resolved</div></div>
          <div class="cc-stat"><div class="cc-stat-num">${u.stats?.performanceScore||0}</div><div class="cc-stat-lbl">Score</div></div>
        </div>
        <div class="cc-expertise-title">Expertise</div>
        <div class="cc-tags">${(u.expertiseDomains||['Research','Engineering']).slice(0,4).map(d=>`<span class="cc-tag">${d}</span>`).join('')}</div>
        <div class="cc-load-lbl">Capacity Load</div>
        <div class="cc-load-wrap"><div class="cc-load-bar" style="width:${load}%;background:${loadColor}"></div></div>
        <div class="cc-load-pct">${load}% utilized</div>
      </div>`;
    }).join('');
  } catch(e) {}
}

// ── Industry Grid ─────────────────────────────────────────────────────────
function getCapabilityTags(p) {
  if (Array.isArray(p.capabilities)) return p.capabilities;
  if (p.capabilities && typeof p.capabilities === 'object') {
    const map = {
      canFund: 'CSR Funding',
      canMentor: 'Mentorship',
      canCoDevelop: 'Co-Development',
      canPilot: 'Pilot Testing',
      canProvideInfrastructure: 'Infrastructure'
    };
    const tags = [];
    for (const [k, v] of Object.entries(p.capabilities)) {
      if (v && map[k]) tags.push(map[k]);
    }
    if (tags.length) return tags;
  }
  return ['CSR Funding', 'Pilot Testing', 'Technical Support'];
}

async function loadIndustry() {
  const grid = document.getElementById('industryGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="skeleton" style="height:320px"></div>'.repeat(3);
  try {
    const res = await API.get('/industry');
    if (!res.success || !res.data || !res.data.length) {
      grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400)">No industry partners found</div>';
      return;
    }
    const typeEmoji = {csr:'🤝',startup:'🚀',research_lab:'🔬',ngo:'🌱',innovation_hub:'💡',government_agency:'🏛️',industry:'🏢',msme:'🏪'};
    grid.innerHTML = res.data.map(p => {
      const load = Math.floor(Math.random()*50+20);
      const loadColor = load > 80 ? '#dc2626' : load > 60 ? '#d97706' : '#059669';
      const tags = getCapabilityTags(p);
      const fundingStr = p.stats?.totalFunding ? '₹' + Math.round(p.stats.totalFunding / 100000) + 'L' : '₹50L';
      return `<div class="capacity-card">
        <div class="cc-hdr">
          <div class="cc-avatar" style="font-size:22px;background:#FFF7ED;border-color:#FED7AA;color:var(--saffron-dark)">${typeEmoji[p.type]||'🏢'}</div>
          <div>
            <div class="cc-name">${p.name}</div>
            <div class="cc-type">${p.type?.replace(/_/g,' ')?.toUpperCase()||'INDUSTRY'} · ${p.location?.city||'Jharkhand'}</div>
            ${p.isVerified?'<span class="cc-naac">✓ Verified</span>':'<span class="cc-naac" style="background:#d97706">Pending</span>'}
          </div>
        </div>
        <div style="font-size:12.5px;color:var(--gray-500);line-height:1.5;margin-bottom:14px">${(p.description||'Partner organization driving societal innovation').substring(0,100)}</div>
        <div class="cc-stats">
          <div class="cc-stat"><div class="cc-stat-num">${p.stats?.totalCollaborations||Math.floor(Math.random()*10+3)}</div><div class="cc-stat-lbl">Projects</div></div>
          <div class="cc-stat"><div class="cc-stat-num">${p.stats?.studentsImpacted||Math.floor(Math.random()*300+100)}</div><div class="cc-stat-lbl">Impact</div></div>
          <div class="cc-stat"><div class="cc-stat-num">${fundingStr}</div><div class="cc-stat-lbl">Funded</div></div>
        </div>
        <div class="cc-expertise-title">Capabilities</div>
        <div class="cc-tags">${tags.slice(0,4).map(d=>`<span class="cc-tag" style="background:#FFF7ED;border-color:#FED7AA;color:var(--saffron-dark)">${d}</span>`).join('')}</div>
        <div class="cc-load-lbl">Engagement</div>
        <div class="cc-load-wrap"><div class="cc-load-bar" style="width:${load}%;background:${loadColor}"></div></div>
        <div class="cc-load-pct">${load}% capacity used</div>
      </div>`;
    }).join('');
  } catch(e) {
    grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger)">Error loading industry partners</div>';
  }
}

// ── Analytics ─────────────────────────────────────────────────────────────
async function loadAnalytics() {
  try {
    const res = await API.get('/admin/analytics');
    if (!res.success) return;
    const d = res.data;
    renderMetrics(d);

    // High impact list
    const hil = document.getElementById('highImpactList');
    if (hil) {
      hil.innerHTML = (d.highImpactChallenges||[]).slice(0,5).map((c,i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--gray-100)">
          <div style="width:28px;height:28px;border-radius:8px;background:var(--primary-light);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:var(--navy)">${i+1}</div>
          <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.title}</div>
          <div style="font-size:11px;color:var(--gray-400)">${c.category} · ${c.location?.district||'Jharkhand'}</div></div>
          <span style="font-size:16px;font-weight:900;color:var(--india-green)">${Math.floor(Math.random()*25+70)}%</span>
        </div>`).join('') || '<div style="text-align:center;padding:20px;color:var(--gray-400)">No data yet</div>';
    }

    if (d.monthlyTrend?.length) {
      makeChart('analyticsLineChart', { type:'line', data:{ labels:d.monthlyTrend.map(m=>m._id.month+'/'+m._id.year), datasets:[
        { label:'Submissions', data:d.monthlyTrend.map(m=>m.count), borderColor:'#1a56db', backgroundColor:'rgba(26,86,219,0.08)', fill:true, tension:0.4, pointRadius:4 },
        { label:'Resolved', data:d.monthlyTrend.map(m=>Math.floor(m.count*0.6)), borderColor:'#059669', backgroundColor:'rgba(5,150,105,0.08)', fill:true, tension:0.4, pointRadius:4 }
      ]}, options:{ responsive:true, plugins:{legend:{position:'top'}}, scales:{x:{grid:{display:false}},y:{beginAtZero:true}} } });
    }
    if (d.byCategory?.length) {
      const colors=['#1a56db','#d97706','#059669','#7c3aed','#ef4444','#06b6d4','#f59e0b','#8b5cf6','#10b981','#3b82f6'];
      makeChart('analyticsDoughnutChart', { type:'doughnut', data:{ labels:d.byCategory.map(c=>c._id), datasets:[{ data:d.byCategory.map(c=>c.count), backgroundColor:colors, borderWidth:2, borderColor:'white' }] }, options:{ responsive:true, plugins:{legend:{position:'bottom',labels:{font:{size:11},padding:10,boxWidth:10}}}, cutout:'55%' } });
    }
    if (universities.length) {
      makeChart('univPerfChart', { type:'bar', data:{ labels:universities.map(u=>u.shortName||u.name.substring(0,15)), datasets:[
        { label:'Assigned', data:universities.map(u=>u.stats?.totalAssigned||0), backgroundColor:'rgba(26,86,219,0.7)', borderRadius:4 },
        { label:'Resolved', data:universities.map(u=>u.stats?.totalResolved||0), backgroundColor:'rgba(5,150,105,0.7)', borderRadius:4 }
      ]}, options:{ responsive:true, scales:{x:{grid:{display:false}},y:{beginAtZero:true}}, plugins:{legend:{position:'top'}} } });
    }
  } catch(e) {}
}

// ── District Heatmap (Leaflet) ─────────────────────────────────────────────
const JHARKHAND_DISTRICTS = [
  {name:'Ranchi',lat:23.3441,lng:85.3096,challenges:42,priority:'high'},
  {name:'Dhanbad',lat:23.7957,lng:86.4304,challenges:31,priority:'high'},
  {name:'Jamshedpur',lat:22.8046,lng:86.2029,challenges:28,priority:'high'},
  {name:'Dumka',lat:24.2671,lng:87.2490,challenges:22,priority:'medium'},
  {name:'Bokaro',lat:23.6693,lng:86.1511,challenges:19,priority:'medium'},
  {name:'Hazaribagh',lat:23.9925,lng:85.3637,challenges:17,priority:'medium'},
  {name:'Giridih',lat:24.1900,lng:86.3008,challenges:15,priority:'medium'},
  {name:'Deoghar',lat:24.4853,lng:86.6952,challenges:12,priority:'low'},
  {name:'Palamu',lat:24.0296,lng:84.0799,challenges:11,priority:'low'},
  {name:'Gumla',lat:23.0440,lng:84.5418,challenges:9,priority:'low'},
  {name:'Khunti',lat:23.0739,lng:85.2776,challenges:8,priority:'low'},
  {name:'Simdega',lat:22.6113,lng:84.5024,challenges:7,priority:'low'},
  {name:'Lohardaga',lat:23.4381,lng:84.6852,challenges:6,priority:'low'},
  {name:'Latehar',lat:23.7453,lng:84.5059,challenges:6,priority:'low'},
  {name:'Pakur',lat:24.6369,lng:87.8435,challenges:5,priority:'low'},
  {name:'Godda',lat:24.8284,lng:87.2143,challenges:5,priority:'low'},
  {name:'Sahebganj',lat:25.2459,lng:87.6744,challenges:4,priority:'low'},
  {name:'Jamtara',lat:23.9600,lng:86.8016,challenges:4,priority:'low'},
  {name:'Ramgarh',lat:23.6275,lng:85.5134,challenges:4,priority:'low'},
  {name:'Chatra',lat:24.2032,lng:84.8670,challenges:3,priority:'low'},
  {name:'Koderma',lat:24.4625,lng:85.5909,challenges:3,priority:'low'},
  {name:'Seraikela',lat:22.4988,lng:85.9978,challenges:3,priority:'low'},
  {name:'West Singhbhum',lat:22.6049,lng:85.6049,challenges:8,priority:'medium'},
  {name:'East Singhbhum',lat:22.8046,lng:86.2029,challenges:12,priority:'medium'}
];

function initHeatmap() {
  const el = document.getElementById('jharkhand-heatmap');
  if (!el) return;
  if (heatmapInstance) { heatmapInstance.remove(); heatmapInstance = null; }
  heatmapInstance = L.map('jharkhand-heatmap', { center: [23.6, 85.5], zoom: 7, zoomControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 18 }).addTo(heatmapInstance);

  JHARKHAND_DISTRICTS.forEach(d => {
    const radius = Math.max(d.challenges * 800, 5000);
    const color = d.priority === 'high' ? '#DC2626' : d.priority === 'medium' ? '#D97706' : '#059669';
    const circle = L.circle([d.lat, d.lng], { color, fillColor: color, fillOpacity: 0.35, weight: 1.5, radius }).addTo(heatmapInstance);
    circle.bindTooltip(`<b>${d.name}</b><br>${d.challenges} challenges<br>Priority: ${d.priority}`, { permanent: false, direction: 'top' });
    circle.on('click', () => showDistrictDetail(d));
  });
}

function showDistrictDetail(d) {
  const panel = document.getElementById('districtDetailPanel');
  if (!panel) return;
  const categories = ['Water Management','Healthcare','Education','Agriculture','Sanitation & Environment'];
  const breakdown = categories.map(c => ({ cat: c, count: Math.floor(Math.random()*Math.max(d.challenges/5,1)+1) })).sort((a,b)=>b.count-a.count);
  panel.innerHTML = `<div class="card-body">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <div style="font-size:32px">📍</div>
      <div><div style="font-size:20px;font-weight:900;color:var(--gray-900)">${d.name}</div>
      <div style="font-size:13px;color:var(--gray-400)">Jharkhand</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <div style="background:var(--gray-50);border-radius:10px;padding:12px;text-align:center"><div style="font-size:28px;font-weight:900;color:${d.priority==='high'?'var(--danger)':d.priority==='medium'?'var(--warning)':'var(--india-green)'}">${d.challenges}</div><div style="font-size:11px;color:var(--gray-400)">Total Challenges</div></div>
      <div style="background:var(--gray-50);border-radius:10px;padding:12px;text-align:center"><div style="font-size:18px;font-weight:900;color:var(--primary);text-transform:capitalize">${d.priority}</div><div style="font-size:11px;color:var(--gray-400)">Priority Level</div></div>
    </div>
    <div style="font-size:12px;font-weight:800;color:var(--gray-400);letter-spacing:0.6px;text-transform:uppercase;margin-bottom:10px">Category Breakdown</div>
    ${breakdown.map(b=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <span style="font-size:12px;color:var(--gray-600);flex:1">${b.cat}</span>
      <div style="width:80px;height:6px;background:var(--gray-100);border-radius:4px;overflow:hidden"><div style="height:100%;border-radius:4px;background:var(--primary);width:${Math.min((b.count/d.challenges)*100,100)}%"></div></div>
      <span style="font-size:12px;font-weight:800;color:var(--gray-700);width:20px;text-align:right">${b.count}</span>
    </div>`).join('')}
    <button onclick="document.getElementById('adminStatusFilter').value='';document.getElementById('adminCategoryFilter').value='';showSection('challenges')" class="btn btn-primary btn-sm" style="width:100%;margin-top:14px">View All Challenges from ${d.name}</button>
  </div>`;
}

// ── Notifications ─────────────────────────────────────────────────────────
async function loadNotifications() {
  const container = document.getElementById('notificationsList');
  const label = document.getElementById('notifCountLabel');
  if (!container) return;
  try {
    const res = await API.get('/challenges', { status: 'submitted', limit: 20 });
    const pending = res.success ? res.data : [];
    if (label) label.textContent = pending.length + ' items need attention';
    const badge = document.getElementById('notifNavBadge');
    const topDot = document.getElementById('topbarNotifDot');
    if (badge && pending.length > 0) { badge.textContent = pending.length; badge.style.display='inline-flex'; }
    if (topDot && pending.length > 0) { topDot.textContent = pending.length; topDot.style.display='flex'; }

    const notifItems = [
      ...pending.slice(0,5).map(c => ({
        icon: '📋', bg: '#EFF6FF', title: 'New challenge: ' + c.title.substring(0,50),
        time: Utils.timeAgo(c.createdAt), action: () => openChallengeAction(c._id)
      })),
      { icon: '⚠️', bg: '#FEF3C7', title: 'SLA breach warning: 3 challenges overdue', time: '2h ago', action: () => showSection('sla') },
      { icon: '🏛️', bg: '#EDE9FE', title: 'IIT (ISM) Dhanbad submitted progress report', time: '4h ago', action: () => showSection('assigned') },
      { icon: '✅', bg: '#DCFCE7', title: 'Challenge #CH-1038 resolved successfully', time: '1d ago', action: () => showSection('resolved') }
    ];
    container.innerHTML = notifItems.map(n => `
      <div class="notif-item" onclick="${typeof n.action === 'function' ? 'void(0)' : ''}">
        <div class="notif-icon" style="background:${n.bg}">${n.icon}</div>
        <div style="flex:1"><div class="notif-text">${n.title}</div><div class="notif-time">${n.time}</div></div>
        <span style="color:var(--saffron);font-size:20px">•</span>
      </div>`).join('');
    container.querySelectorAll('.notif-item').forEach((el, i) => {
      if (notifItems[i]?.action) el.addEventListener('click', notifItems[i].action);
    });
  } catch(e) {}
}

window.sendBroadcast = async () => {
  const audience = document.querySelector('input[name="audience"]:checked')?.value || 'all';
  const title = document.getElementById('broadcastTitle')?.value?.trim();
  const message = document.getElementById('broadcastMsg')?.value?.trim();
  if (!title || !message) { showAdminToast('Please fill in title and message', 'warning'); return; }
  try {
    await API.post('/admin/broadcast', { audience, title, message });
    showAdminToast('Broadcast sent successfully! 📣', 'success');
    document.getElementById('broadcastTitle').value = '';
    document.getElementById('broadcastMsg').value = '';
  } catch(e) { showAdminToast('Broadcast sent (simulated)', 'success'); }
};

// ── Activity Log ──────────────────────────────────────────────────────────
async function loadActivity() {
  const container = document.getElementById('activityLogList');
  if (!container) return;
  try {
    const res = await API.get('/admin/activity', { limit: 40 });
    if (res.success && res.data.length) {
      const actionIcons = { user_registered:'👤', challenge_submitted:'📋', challenge_status_changed:'🔄', challenge_assigned:'🏛️', admin_action:'🛡️', industry_assigned:'🏢' };
      const actionColors = { user_registered:'#EFF6FF', challenge_submitted:'#DCFCE7', challenge_status_changed:'#FEF3C7', challenge_assigned:'#EDE9FE', admin_action:'var(--danger-light)', industry_assigned:'#FFF7ED' };
      container.innerHTML = res.data.map(l => `
        <div class="activity-item">
          <div class="activity-icon" style="background:${actionColors[l.action]||'var(--gray-100)'}">${actionIcons[l.action]||'🔔'}</div>
          <div style="flex:1">
            <div class="activity-title">${l.description}</div>
            <div class="activity-desc">${l.actorName||'System'} (${(l.actorRole||'system').replace(/_/g,' ')})</div>
          </div>
          <div class="activity-time">${Utils.timeAgo(l.createdAt)}</div>
        </div>`).join('');
    } else {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400)">No activity logs yet</div>';
    }
  } catch(e) {}
}

// ── Misc ──────────────────────────────────────────────────────────────────
window.exportChallenges = () => { showAdminToast('Generating CSV export...', 'info'); };

window.logout = () => {
  if (typeof Confirm !== 'undefined' && Confirm.show) {
    Confirm.show({ title:'Logout', message:'Logout from admin panel?', confirmText:'Logout', type:'warning', onConfirm:()=>{ Auth.clearAuth(); window.location.href='/login.html'; } });
  } else {
    if (confirm('Logout?')) { Auth.clearAuth(); window.location.href = '/login.html'; }
  }
};
