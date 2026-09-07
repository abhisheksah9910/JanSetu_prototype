// admin.js — Admin Dashboard Logic

let currentUser = null;
let allChallenges = [];
let universities = [];
let currentAssignChallengeId = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAuth()) return;
  currentUser = Auth.getUser();
  if (!Auth.requireRole(['admin'])) return;

  initUI();
  await Promise.all([loadOverview(), loadUniversitiesForModal()]);

  const hash = window.location.hash.replace('#', '');
  if (hash) showSection(hash);
});

function initUI() {
  const initials = Utils.generateInitials(currentUser.name);
  document.getElementById('sidebarAvatar').textContent = initials;
  document.getElementById('topbarAvatar').textContent = initials;
  document.getElementById('sidebarName').textContent = currentUser.name;
  document.getElementById('topbarName').textContent = currentUser.name;
  document.getElementById('welcomeName').textContent = `Welcome, ${currentUser.name.split(' ')[0]}`;

  const handleResize = () => {
    const isMobile = window.innerWidth <= 900;
    document.getElementById('mobileSidebarBtn').style.display = isMobile ? 'flex' : 'none';
  };
  window.addEventListener('resize', handleResize);
  handleResize();
}

function showSection(section) {
  document.querySelectorAll('.dashboard-section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));

  const sectionEl = document.getElementById(`section-${section}`);
  const navEl = document.getElementById(`nav-${section}`);
  if (sectionEl) sectionEl.style.display = 'block';
  if (navEl) navEl.classList.add('active');

  const titles = {
    overview: ['Admin Overview', 'Overview'],
    challenges: ['Challenges Management', 'Challenges'],
    users: ['User Management', 'Users'],
    universities: ['Universities', 'Universities'],
    industry: ['Industry Partners', 'Industry'],
    analytics: ['Analytics', 'Analytics'],
    activity: ['Activity Log', 'Activity']
  };
  const [title, crumb] = titles[section] || ['Admin', section];
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('pageBreadcrumb').textContent = crumb;
  window.location.hash = section;
  closeMobileSidebar();

  if (section === 'challenges') loadAdminChallenges();
  if (section === 'users') loadUsers();
  if (section === 'universities') loadUniversities();
  if (section === 'industry') loadIndustry();
  if (section === 'analytics') loadAnalytics();
  if (section === 'activity') loadActivity();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
  document.getElementById('mainContent').classList.toggle('collapsed');
}

function openMobileSidebar() {
  document.getElementById('sidebar').classList.add('mobile-open');
  document.getElementById('sidebarOverlay').classList.add('show');
}

function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

// ── Load Overview ──
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
  } catch(e) {
    console.error('Overview load error:', e);
  }
}

function renderMetrics(data) {
  const grid = document.getElementById('adminMetrics');
  const metrics = [
    { label: 'Total Challenges', value: data.totalChallenges || 0, color: 'var(--primary)', icon: '📋', bg: 'var(--primary-50)', trend: `+${data.thisMonth || 0} this month` },
    { label: 'Pending Review', value: data.pendingChallenges || 0, color: '#d97706', icon: '⏳', bg: '#fef3c7', trend: 'Needs attention' },
    { label: 'Active Projects', value: data.activeChallenges || 0, color: '#7c3aed', icon: '⚡', bg: '#f3e8ff', trend: 'In progress' },
    { label: 'Resolved', value: data.resolvedChallenges || 0, color: 'var(--accent)', icon: '✅', bg: 'var(--accent-50)', trend: `${data.resolutionRate || 0}% rate` },
    { label: 'Total Users', value: data.totalUsers || 0, color: '#0e7490', icon: '👥', bg: '#cffafe', trend: '' },
    { label: 'Universities Active', value: data.activeUniversities || 0, color: '#c2410c', icon: '🏛️', bg: '#ffedd5', trend: '' },
    { label: 'Industry Partners', value: data.industryPartners || 0, color: '#be185d', icon: '🏭', bg: '#fce7f3', trend: '' },
    { label: 'Avg Resolution Days', value: data.avgResolutionDays || 0, color: '#1d4ed8', icon: '📅', bg: 'var(--primary-50)', trend: 'days avg' }
  ];

  grid.innerHTML = metrics.slice(0,4).map(m => `
    <div class="metric-card">
      <div class="metric-header">
        <div class="metric-icon" style="background:${m.bg}"><span style="font-size:20px">${m.icon}</span></div>
        ${m.trend ? `<span class="metric-trend trend-up" style="font-size:11px">${m.trend}</span>` : ''}
      </div>
      <div class="metric-value" id="adminMetric-${m.label.replace(/ /g,'-')}">${m.value}</div>
      <div class="metric-label" style="color:${m.color};font-weight:600">${m.label}</div>
    </div>`).join('');

  // Animate
  metrics.slice(0,4).forEach(m => {
    const el = document.getElementById(`adminMetric-${m.label.replace(/ /g,'-')}`);
    if (el && typeof m.value === 'number') Utils.animateCounter(el, m.value);
  });

  // Update pending badge
  if (data.pendingChallenges > 0) {
    const badge = document.getElementById('pendingCountBadge');
    if (badge) { badge.textContent = data.pendingChallenges; badge.style.display = 'flex'; }
  }
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
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:var(--gray-900)">${c.title}</div>
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
  const rankClasses = ['gold', 'silver', 'bronze'];

  container.innerHTML = sorted.slice(0,5).map((u, i) => `
    <div class="leaderboard-item">
      <div class="leaderboard-rank ${rankClasses[i] || 'other'}">${i+1}</div>
      <div class="leaderboard-info">
        <div class="leaderboard-name">${u.shortName || u.name.substring(0,20)}</div>
        <div class="leaderboard-meta">${u.stats?.totalResolved || 0} resolved · ${u.location?.city || ''}</div>
      </div>
      <div class="leaderboard-score">
        <div class="leaderboard-score-num">${u.stats?.performanceScore || 0}</div>
        <div class="leaderboard-score-lbl">Score</div>
      </div>
    </div>`).join('');
}

async function loadOverviewCharts() {
  try {
    const res = await API.get('/admin/analytics');
    if (!res.success) return;
    const data = res.data;

    // Trend Chart
    const trendCtx = document.getElementById('trendChart')?.getContext('2d');
    if (trendCtx && data.monthlyTrend?.length) {
      const labels = data.monthlyTrend.map(m => `${m._id.month}/${m._id.year}`);
      new Chart(trendCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Submitted',
            data: data.monthlyTrend.map(m => m.count),
            backgroundColor: 'rgba(26,86,219,0.8)',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' } } }
        }
      });
    }

    // Status Donut
    const statusCtx = document.getElementById('statusChart')?.getContext('2d');
    if (statusCtx && data.byStatus?.length) {
      const statusColors = { submitted:'#3b82f6', under_review:'#f59e0b', validated:'#8b5cf6', assigned:'#06b6d4', in_progress:'#f97316', testing:'#10b981', resolved:'#059669', rejected:'#ef4444', closed:'#9ca3af' };
      new Chart(statusCtx, {
        type: 'doughnut',
        data: {
          labels: data.byStatus.map(s => s._id.replace(/_/g,' ')),
          datasets: [{ data: data.byStatus.map(s => s.count), backgroundColor: data.byStatus.map(s => statusColors[s._id] || '#9ca3af'), borderWidth: 2, borderColor: 'white' }]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'right', labels: { font: { family: 'Inter', size: 11 }, padding: 10, boxWidth: 12 } } },
          cutout: '55%'
        }
      });
    }

    // Category Bar
    const catCtx = document.getElementById('categoryBarChart')?.getContext('2d');
    if (catCtx && data.byCategory?.length) {
      const catColors = ['#1a56db','#d97706','#059669','#7c3aed','#ef4444','#06b6d4','#f59e0b','#8b5cf6','#10b981','#3b82f6'];
      new Chart(catCtx, {
        type: 'bar',
        data: {
          labels: data.byCategory.map(c => c._id),
          datasets: [{ label: 'Challenges', data: data.byCategory.map(c => c.count), backgroundColor: catColors, borderRadius: 6 }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { x: { grid: { display: false }, ticks: { font: { size: 11 } } }, y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' } } }
        }
      });
    }
  } catch(e) {}
}

// ── Admin Challenges Table ──
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
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px"><div class="spinner" style="margin:0 auto"></div></td></tr>';

    try {
      const res = await API.get('/challenges', { search, status, category, priority, page: adminChallengePage, limit: 20 });
      if (res.success) {
        allChallenges = res.data;
        renderChallengesTable(res.data);
        if (res.pagination) {
          Utils.buildPagination(document.getElementById('adminChallengesPagination'), res.pagination, (p) => { adminChallengePage = p; loadAdminChallenges(); });
        }
      }
    } catch(e) {}
  }, 300);
};

function renderChallengesTable(challenges) {
  const tbody = document.getElementById('challengesTableBody');
  if (!challenges.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--gray-400)">No challenges found</td></tr>';
    return;
  }

  tbody.innerHTML = challenges.map(c => `
    <tr>
      <td>
        <div style="font-size:10px;color:var(--gray-400);font-weight:700;letter-spacing:0.5px">#${c._id.slice(-8).toUpperCase()}</div>
        <div style="font-size:13px;font-weight:600;color:var(--gray-900);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.title}</div>
      </td>
      <td><span style="font-size:12px;color:var(--gray-600)">${c.category}</span></td>
      <td>${Utils.priorityBadge(c.priority)}</td>
      <td>${Utils.statusBadge(c.status)}</td>
      <td><span style="font-size:12px;color:var(--gray-600)">${c.location?.district || '—'}</span></td>
      <td><span style="font-size:12px;color:var(--gray-600)">${c.submittedBy?.name || c.submitterContact?.name || '—'}</span></td>
      <td><span style="font-size:12px;color:${c.assignedUniversity?'var(--primary)':'var(--gray-400)'}">${c.assignedUniversity?.shortName || c.assignedUniversity?.name?.substring(0,15) || 'Unassigned'}</span></td>
      <td><span style="font-size:12px;color:var(--gray-400)">${Utils.formatDate(c.createdAt)}</span></td>
      <td>
        <div style="display:flex;gap:4px">
          <button onclick="openChallengeAction('${c._id}')" class="btn btn-sm btn-ghost" title="View">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          ${['submitted','under_review'].includes(c.status) ? `
            <button onclick="validateChallenge('${c._id}','validated')" class="btn btn-sm btn-green" title="Validate">✓</button>
            <button onclick="validateChallenge('${c._id}','rejected')" class="btn btn-sm btn-red" title="Reject">✕</button>
          ` : ''}
          ${c.status === 'validated' ? `
            <button onclick="openAssignModal('${c._id}')" class="btn btn-sm btn-blue" title="Assign">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              Assign
            </button>
          ` : ''}
        </div>
      </td>
    </tr>`).join('');
}

async function openChallengeAction(id) {
  openModal('challengeActionModal');
  const body = document.getElementById('caBody');
  body.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner" style="margin:0 auto"></div></div>';
  try {
    const res = await API.get(`/challenges/${id}`);
    const c = res.data;
    document.getElementById('caTitle').textContent = c.title;
    document.getElementById('caSubtitle').textContent = `#${c._id.slice(-8).toUpperCase()} · ${c.category} · ${c.location?.district || 'Jharkhand'}`;
    body.innerHTML = `
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:28px">
        <div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">${Utils.statusBadge(c.status)} ${Utils.priorityBadge(c.priority)}</div>
          <p style="font-size:15px;color:var(--gray-700);line-height:1.7;margin-bottom:16px">${c.description}</p>
          ${c.location ? `<div style="font-size:13px;color:var(--gray-500);margin-bottom:16px">📍 ${[c.location.address,c.location.village,c.location.block,c.location.district].filter(Boolean).join(', ')}</div>` : ''}
          ${c.submitterContact ? `<div style="padding:12px;background:var(--gray-50);border-radius:10px;font-size:13px">
            <div style="font-weight:700;margin-bottom:4px">Submitter Contact</div>
            <div>${c.submitterContact.name} · ${c.submitterContact.email} · ${c.submitterContact.phone || ''}</div>
          </div>` : ''}
        </div>
        <div>
          ${c.assignedUniversity ? `<div style="padding:12px;background:var(--primary-50);border-radius:10px;margin-bottom:12px">
            <div style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:4px">Assigned To</div>
            <div style="font-weight:700">${c.assignedUniversity.name || c.assignedUniversity.shortName}</div>
            ${c.deadline ? `<div style="font-size:12px;color:var(--gray-500)">Deadline: ${Utils.formatDate(c.deadline)}</div>` : ''}
          </div>` : ''}
          <div style="font-size:12px;color:var(--gray-500)">Submitted: ${Utils.formatDate(c.createdAt, true)}</div>
          ${c.aiSuggestedCategory ? `<div style="margin-top:8px;font-size:12px;color:var(--gray-500)">AI Category: ${c.aiSuggestedCategory} (${Math.round((c.aiConfidenceScore||0)*100)}%)</div>` : ''}
        </div>
      </div>`;

    const footer = document.getElementById('caFooter');
    footer.innerHTML = '';
    if (['submitted','under_review'].includes(c.status)) {
      const vBtn = document.createElement('button');
      vBtn.className = 'btn btn-green';
      vBtn.innerHTML = '✓ Validate';
      vBtn.onclick = () => { closeModal('challengeActionModal'); validateChallenge(c._id, 'validated'); };
      const rBtn = document.createElement('button');
      rBtn.className = 'btn btn-red';
      rBtn.innerHTML = '✕ Reject';
      rBtn.onclick = () => { closeModal('challengeActionModal'); validateChallenge(c._id, 'rejected'); };
      footer.appendChild(vBtn);
      footer.appendChild(rBtn);
    }
    if (c.status === 'validated') {
      const aBtn = document.createElement('button');
      aBtn.className = 'btn btn-blue';
      aBtn.innerHTML = '→ Assign to University';
      aBtn.onclick = () => { closeModal('challengeActionModal'); openAssignModal(c._id); };
      footer.appendChild(aBtn);
    }
    const cBtn = document.createElement('button');
    cBtn.className = 'btn btn-ghost';
    cBtn.textContent = 'Close';
    cBtn.onclick = () => closeModal('challengeActionModal');
    footer.appendChild(cBtn);
  } catch(e) {
    body.innerHTML = `<div class="empty-state"><div class="empty-title">Error loading challenge</div></div>`;
  }
}

async function validateChallenge(id, status) {
  Confirm.show({
    title: status === 'validated' ? 'Validate Challenge' : 'Reject Challenge',
    message: status === 'validated' ? 'This challenge will be marked as validated and made available for university assignment.' : 'This challenge will be rejected and the submitter will be notified.',
    confirmText: status === 'validated' ? 'Validate' : 'Reject',
    type: status === 'rejected' ? 'danger' : 'info',
    onConfirm: async () => {
      try {
        const res = await API.put(`/challenges/${id}/status`, { status, note: `Challenge ${status} by admin` });
        if (res.success) {
          Toast.success('Updated!', `Challenge ${status} successfully.`);
          loadAdminChallenges();
          loadOverview();
        }
      } catch(e) { Toast.error('Error', e.message); }
    }
  });
}

function openAssignModal(challengeId) {
  currentAssignChallengeId = challengeId;
  const sel = document.getElementById('assignUnivSelect');
  sel.innerHTML = '<option value="">-- Choose University --</option>' +
    universities.map(u => `<option value="${u._id}">${u.name}</option>`).join('');
  const d = new Date();
  d.setDate(d.getDate() + 60);
  document.getElementById('assignDeadline').value = d.toISOString().split('T')[0];
  openModal('assignModal');
}

window.confirmAssign = async () => {
  const univId = document.getElementById('assignUnivSelect').value;
  const deadline = document.getElementById('assignDeadline').value;
  const notes = document.getElementById('assignNotes').value;
  if (!univId) { Toast.warning('Select University', 'Please select a university'); return; }

  const btn = document.getElementById('assignConfirmBtn');
  Utils.setLoading(btn, true);
  try {
    const res = await API.put(`/challenges/${currentAssignChallengeId}/assign`, { universityId: univId, deadline, notes });
    if (res.success) {
      Toast.success('Assigned!', 'Challenge assigned to university successfully.');
      closeModal('assignModal');
      loadAdminChallenges();
    }
  } catch(e) { Toast.error('Error', e.message); }
  finally { Utils.setLoading(btn, false); }
};

async function loadUniversitiesForModal() {
  try {
    const res = await API.get('/universities');
    if (res.success) universities = res.data;
  } catch(e) {}
}

// ── Users ──
let userSearchDebounce = null;
window.loadUsers = () => {
  clearTimeout(userSearchDebounce);
  userSearchDebounce = setTimeout(async () => {
    const search = document.getElementById('userSearch')?.value || '';
    const role = document.getElementById('userRoleFilter')?.value || '';
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px"><div class="spinner" style="margin:0 auto"></div></td></tr>';
    try {
      const res = await API.get('/admin/users', { search, role, limit: 20 });
      if (res.success) {
        if (!res.data.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--gray-400)">No users found</td></tr>'; return; }
        tbody.innerHTML = res.data.map(u => `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:34px;height:34px;border-radius:50%;background:var(--primary-100);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--primary);flex-shrink:0">${Utils.generateInitials(u.name)}</div>
                <div>
                  <div style="font-size:13px;font-weight:600;color:var(--gray-900)">${u.name}</div>
                  <div style="font-size:11px;color:var(--gray-400)">${u.phone || ''}</div>
                </div>
              </div>
            </td>
            <td><span class="badge ${u.role==='admin'?'badge-urgent':u.role==='university_rep'?'badge-validated':u.role==='industry_rep'?'badge-assigned':'badge-submitted'}">${u.role.replace(/_/g,' ')}</span></td>
            <td style="font-size:13px;color:var(--gray-600)">${u.email}</td>
            <td>${u.isActive ? '<span class="badge badge-resolved">Active</span>' : '<span class="badge badge-rejected">Inactive</span>'}</td>
            <td style="font-size:12px;color:var(--gray-400)">${Utils.formatDate(u.createdAt)}</td>
            <td>
              <div style="display:flex;gap:4px">
                ${u.isActive ? `<button onclick="toggleUser('${u._id}',false)" class="btn btn-sm btn-ghost" style="font-size:11px">Deactivate</button>` : `<button onclick="toggleUser('${u._id}',true)" class="btn btn-sm btn-green" style="font-size:11px">Activate</button>`}
              </div>
            </td>
          </tr>`).join('');
      }
    } catch(e) {}
  }, 300);
};

window.toggleUser = async (id, activate) => {
  try {
    await API.put(`/admin/users/${id}`, { isActive: activate });
    Toast.success('Done', `User ${activate ? 'activated' : 'deactivated'}`);
    loadUsers();
  } catch(e) { Toast.error('Error', e.message); }
};

// ── Universities ──
async function loadUniversities() {
  const grid = document.getElementById('univGrid');
  grid.innerHTML = '<div class="skeleton skeleton-card" style="height:200px"></div>'.repeat(3);
  try {
    const res = await API.get('/universities');
    if (res.success) {
      grid.innerHTML = res.data.map(u => `
        <div class="worker-card">
          <div class="worker-card-header">
            <div class="worker-avatar" style="background:var(--primary-50);color:var(--primary);border-color:var(--primary-100)">${u.shortName?.substring(0,3) || u.name.substring(0,3)}</div>
            <div>
              <div class="worker-info-name">${u.shortName || u.name.substring(0,20)}</div>
              <div class="worker-info-dept">${u.type?.toUpperCase()} · ${u.location?.city}</div>
              ${u.naacGrade ? `<div class="worker-availability available">NAAC ${u.naacGrade}</div>` : ''}
            </div>
          </div>
          <div style="font-size:13px;color:var(--gray-500);line-height:1.5;margin-bottom:14px">${u.name}</div>
          <div style="font-size:12px;color:var(--gray-400);margin-bottom:12px">Expertise: ${u.expertiseDomains?.slice(0,2).join(', ') || 'Multiple domains'}</div>
          <div class="worker-stats">
            <div class="worker-stat"><div class="worker-stat-num">${u.stats?.totalAssigned||0}</div><div class="worker-stat-lbl">Assigned</div></div>
            <div class="worker-stat"><div class="worker-stat-num">${u.stats?.totalResolved||0}</div><div class="worker-stat-lbl">Resolved</div></div>
            <div class="worker-stat"><div class="worker-stat-num">${u.stats?.performanceScore||0}</div><div class="worker-stat-lbl">Score</div></div>
          </div>
        </div>`).join('');
    }
  } catch(e) {}
}

// ── Industry ──
async function loadIndustry() {
  const grid = document.getElementById('industryGrid');
  grid.innerHTML = '<div class="skeleton skeleton-card" style="height:200px"></div>'.repeat(3);
  try {
    const res = await API.get('/industry');
    if (res.success) {
      const typeEmoji = { csr:'🤝', startup:'🚀', research_lab:'🔬', ngo:'🌱', innovation_hub:'💡', government_agency:'🏛️', industry:'🏢', msme:'🏪' };
      grid.innerHTML = res.data.map(p => `
        <div class="worker-card">
          <div class="worker-card-header">
            <div class="worker-avatar" style="font-size:22px;background:var(--accent-50);border-color:var(--accent-100)">${typeEmoji[p.type]||'🏢'}</div>
            <div>
              <div class="worker-info-name">${p.name}</div>
              <div class="worker-info-dept">${p.type?.replace(/_/g,' ')?.toUpperCase()} · ${p.location?.city||''}</div>
              ${p.isVerified ? '<div class="worker-availability available">Verified</div>' : '<div class="worker-availability busy">Pending</div>'}
            </div>
          </div>
          <div style="font-size:13px;color:var(--gray-500);line-height:1.5;margin-bottom:12px">${(p.description||'').substring(0,100)}...</div>
          <div class="worker-stats">
            <div class="worker-stat"><div class="worker-stat-num">${p.stats?.totalCollaborations||0}</div><div class="worker-stat-lbl">Projects</div></div>
            <div class="worker-stat"><div class="worker-stat-num">${p.stats?.studentsImpacted||0}</div><div class="worker-stat-lbl">Students</div></div>
            <div class="worker-stat"><div class="worker-stat-num">₹${p.stats?.totalFunding?Math.round(p.stats.totalFunding/100000)+'L':0}</div><div class="worker-stat-lbl">Funding</div></div>
          </div>
        </div>`).join('');
    }
  } catch(e) {}
}

// ── Analytics ──
async function loadAnalytics() {
  try {
    const res = await API.get('/admin/analytics');
    if (!res.success) return;
    const data = res.data;

    const grid = document.getElementById('analyticsMetrics');
    const metrics = [
      { label: 'Total Challenges', value: data.totalChallenges || 0, bg: 'var(--primary-50)', color: 'var(--primary)' },
      { label: 'Resolution Rate', value: `${data.resolutionRate || 0}%`, bg: 'var(--accent-50)', color: 'var(--accent)' },
      { label: 'Avg Resolution Days', value: data.avgResolutionDays || 0, bg: '#fef3c7', color: 'var(--warning)' },
      { label: 'Active Universities', value: data.activeUniversities || 0, bg: '#f3e8ff', color: '#7c3aed' }
    ];

    grid.innerHTML = metrics.map(m => `
      <div class="metric-card">
        <div class="metric-icon" style="background:${m.bg};margin-bottom:12px"></div>
        <div class="metric-value" style="color:${m.color}">${m.value}</div>
        <div class="metric-label">${m.label}</div>
      </div>`).join('');

    // Line Chart
    const lineCtx = document.getElementById('analyticsLineChart')?.getContext('2d');
    if (lineCtx && data.monthlyTrend?.length) {
      new Chart(lineCtx, {
        type: 'line',
        data: {
          labels: data.monthlyTrend.map(m => `${m._id.month}/${m._id.year}`),
          datasets: [{
            label: 'Submissions',
            data: data.monthlyTrend.map(m => m.count),
            borderColor: '#1a56db',
            backgroundColor: 'rgba(26,86,219,0.08)',
            fill: true,
            tension: 0.4,
            pointRadius: 4
          }]
        },
        options: { responsive: true, plugins: { legend: { display: true } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } }
      });
    }

    // Doughnut Chart
    const donutCtx = document.getElementById('analyticsDoughnutChart')?.getContext('2d');
    if (donutCtx && data.byCategory?.length) {
      const colors = ['#1a56db','#d97706','#059669','#7c3aed','#ef4444','#06b6d4','#f59e0b','#8b5cf6','#10b981','#3b82f6'];
      new Chart(donutCtx, {
        type: 'doughnut',
        data: {
          labels: data.byCategory.map(c => c._id),
          datasets: [{ data: data.byCategory.map(c => c.count), backgroundColor: colors, borderWidth: 2, borderColor: 'white' }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10, boxWidth: 10 } } }, cutout: '55%' }
      });
    }

    // University Performance Bar
    const univCtx = document.getElementById('univPerfChart')?.getContext('2d');
    if (univCtx && universities.length) {
      new Chart(univCtx, {
        type: 'bar',
        data: {
          labels: universities.map(u => u.shortName || u.name.substring(0,15)),
          datasets: [
            { label: 'Assigned', data: universities.map(u => u.stats?.totalAssigned||0), backgroundColor: 'rgba(26,86,219,0.7)', borderRadius: 4 },
            { label: 'Resolved', data: universities.map(u => u.stats?.totalResolved||0), backgroundColor: 'rgba(5,150,105,0.7)', borderRadius: 4 }
          ]
        },
        options: {
          responsive: true,
          scales: { x: { grid: { display: false } }, y: { beginAtZero: true } },
          plugins: { legend: { position: 'top' } }
        }
      });
    }
  } catch(e) {}
}

// ── Activity Log ──
async function loadActivity() {
  const container = document.getElementById('activityLogList');
  try {
    const res = await API.get('/admin/activity', { limit: 30 });
    if (res.success && res.data.length) {
      const actionIcons = { user_registered:'👤', challenge_submitted:'📋', challenge_status_changed:'🔄', challenge_assigned:'🏛️', admin_action:'🛡️' };
      const actionColors = { user_registered:'var(--primary)', challenge_submitted:'var(--accent)', challenge_status_changed:'var(--warning)', challenge_assigned:'#7c3aed', admin_action:'var(--danger)' };
      container.innerHTML = res.data.map(l => `
        <div class="activity-item">
          <div class="activity-icon" style="background:${actionColors[l.action] || 'var(--gray-100)'}22;font-size:16px">${actionIcons[l.action] || '🔔'}</div>
          <div class="activity-content">
            <div class="activity-title">${l.description}</div>
            <div class="activity-desc">${l.actorName} (${l.actorRole?.replace(/_/g,' ')})</div>
          </div>
          <div class="activity-time">${Utils.timeAgo(l.createdAt)}</div>
        </div>`).join('');
    } else {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400)">No activity logs yet</div>';
    }
  } catch(e) {}
}

window.exportChallenges = () => {
  Toast.info('Export', 'CSV export is being generated...');
};

// ── Modal helpers ──
window.openModal = (id) => document.getElementById(id).classList.add('open');
window.closeModal = (id) => document.getElementById(id).classList.remove('open');
document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if(e.target===o) o.classList.remove('open'); }));

window.logout = () => {
  Confirm.show({
    title: 'Logout',
    message: 'Are you sure you want to logout from admin panel?',
    confirmText: 'Logout',
    type: 'warning',
    onConfirm: () => { Auth.clearAuth(); window.location.replace('/login.html'); }
  });
};
