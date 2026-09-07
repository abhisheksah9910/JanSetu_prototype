// university.js — University Dashboard Logic

let currentUser = null;
let assignedChallenges = [];
let univInfo = null;
let currentUpdateChallengeId = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAuth()) return;
  currentUser = Auth.getUser();
  if (!Auth.requireRole(['university_rep'])) return;

  initUI();
  await loadData();
  NotifManager.startPolling();

  const hash = window.location.hash.replace('#', '');
  if (hash) showSection(hash);
});

function initUI() {
  if (!currentUser) return;
  const initials = Utils.generateInitials(currentUser.name);
  document.getElementById('sidebarAvatar').textContent = initials;
  document.getElementById('topbarAvatar').textContent = initials;
  document.getElementById('sidebarName').textContent = currentUser.name;
  document.getElementById('topbarName').textContent = currentUser.name;
  document.getElementById('welcomeName').textContent = `Welcome, ${currentUser.name.split(' ')[0]}!`;

  const handleResize = () => {
    document.getElementById('mobileSidebarBtn').style.display = window.innerWidth <= 900 ? 'flex' : 'none';
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
    overview: ['University Overview', 'Overview'],
    assigned: ['Assigned Challenges', 'Assigned'],
    milestones: ['Milestone Tracker', 'Milestones'],
    notifications: ['Notifications', 'Notifications'],
    profile: ['University Profile', 'Profile']
  };
  const [title, crumb] = titles[section] || ['Dashboard', section];
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('pageBreadcrumb').textContent = crumb;
  window.location.hash = section;
  closeMobileSidebar();

  if (section === 'assigned') loadAssigned();
  if (section === 'milestones') loadMilestones();
  if (section === 'notifications') loadNotifications();
  if (section === 'profile') loadProfile();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
  document.getElementById('mainContent').classList.toggle('collapsed');
}
function openMobileSidebar() { document.getElementById('sidebar').classList.add('mobile-open'); document.getElementById('sidebarOverlay').classList.add('show'); }
function closeMobileSidebar() { document.getElementById('sidebar').classList.remove('mobile-open'); document.getElementById('sidebarOverlay').classList.remove('show'); }

async function loadData() {
  try {
    const res = await API.get('/challenges', { limit: 50 });
    if (res.success) {
      assignedChallenges = res.data.filter(c => ['assigned','in_progress','testing','resolved'].includes(c.status));
      updateMetrics();
      renderRecentAssigned();
      initChart();
    }
  } catch(e) {}
}

function updateMetrics() {
  const statuses = assignedChallenges.map(c => c.status);
  Utils.animateCounter(document.getElementById('m-assigned'), assignedChallenges.length);
  Utils.animateCounter(document.getElementById('m-inprogress'), statuses.filter(s => ['in_progress','testing'].includes(s)).length);
  Utils.animateCounter(document.getElementById('m-resolved'), statuses.filter(s => s === 'resolved').length);
  document.getElementById('m-score').textContent = '88';

  const activeCount = assignedChallenges.filter(c => ['assigned','in_progress'].includes(c.status)).length;
  if (activeCount > 0) {
    const badge = document.getElementById('assignedBadge');
    if (badge) { badge.textContent = activeCount; badge.style.display = 'flex'; }
  }
}

function renderRecentAssigned() {
  const container = document.getElementById('recentAssigned');
  if (!container) return;
  const recent = assignedChallenges.slice(0, 4);

  if (!recent.length) {
    container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--gray-400)">No challenges assigned yet</div>';
    return;
  }

  container.innerHTML = recent.map(c => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--gray-100);cursor:pointer" onclick="openUpdateModal('${c._id}','${c.title.replace(/'/g,"\\'")}')">
      <div class="task-priority-bar ${c.priority}" style="width:4px;height:40px;border-radius:2px;flex-shrink:0"></div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--gray-900)">${Utils.truncate(c.title, 50)}</div>
        <div style="font-size:11px;color:var(--gray-400);margin-top:2px">${c.category} · ${c.location?.district || 'Jharkhand'}</div>
      </div>
      ${Utils.statusBadge(c.status)}
    </div>`).join('');
}

function initChart() {
  const ctx = document.getElementById('univChart')?.getContext('2d');
  if (!ctx) return;

  const statusCounts = { assigned: 0, in_progress: 0, testing: 0, resolved: 0 };
  assignedChallenges.forEach(c => { if (statusCounts.hasOwnProperty(c.status)) statusCounts[c.status]++; });

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Assigned', 'In Progress', 'Testing', 'Resolved'],
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: ['#3b82f6', '#f59e0b', '#8b5cf6', '#059669'],
        borderWidth: 2,
        borderColor: 'white',
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 12 }, padding: 12, boxWidth: 12 } } },
      cutout: '55%'
    }
  });
}

window.loadAssigned = async () => {
  const status = document.getElementById('univStatusFilter')?.value || '';
  const container = document.getElementById('assignedList');
  const filtered = status ? assignedChallenges.filter(c => c.status === status) : assignedChallenges;

  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state" style="padding:60px;background:white;border-radius:var(--radius-xl);border:1.5px solid var(--gray-100)"><div class="empty-title">No challenges found</div><div class="empty-desc">No challenges match the selected filter</div></div>';
    return;
  }

  container.innerHTML = filtered.map(c => `
    <div class="task-card" onclick="openUpdateModal('${c._id}','${c.title.replace(/'/g,"\\'")}')">
      <div class="task-priority-bar ${c.priority}"></div>
      <div class="task-card-header">
        <div>
          <div class="task-card-id">#${c._id.slice(-8).toUpperCase()}</div>
          <div class="task-card-title">${c.title}</div>
          <div class="task-card-category">${c.category} · ${c.location?.district || 'Jharkhand'}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
          ${Utils.statusBadge(c.status)}
          ${Utils.priorityBadge(c.priority)}
        </div>
      </div>
      <p style="font-size:13px;color:var(--gray-500);line-height:1.6;margin-bottom:12px">${Utils.truncate(c.description, 120)}</p>
      <div class="task-card-footer">
        <div style="font-size:12px;color:var(--gray-400)">
          Assigned: ${Utils.formatDate(c.assignedAt || c.updatedAt)}
          ${c.deadline ? ` · Deadline: ${Utils.formatDate(c.deadline)}` : ''}
        </div>
        ${c.milestones?.length ? `<div style="font-size:12px;color:var(--primary);font-weight:600">${c.milestones.filter(m=>m.status==='completed').length}/${c.milestones.length} milestones done</div>` : ''}
      </div>
    </div>`).join('');
};

async function loadMilestones() {
  const container = document.getElementById('milestonesList');
  const withMilestones = assignedChallenges.filter(c => c.milestones?.length);

  if (!withMilestones.length) {
    container.innerHTML = '<div class="empty-state" style="padding:60px;background:white;border-radius:var(--radius-xl);border:1.5px solid var(--gray-100)"><div class="empty-title">No milestones yet</div><div class="empty-desc">Milestones will appear once challenges have been set up</div></div>';
    return;
  }

  container.innerHTML = withMilestones.map(c => `
    <div class="card">
      <div class="card-body">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div>
            <div style="font-weight:700;font-size:15px;color:var(--gray-900)">${c.title}</div>
            <div style="font-size:12px;color:var(--gray-400);margin-top:2px">${c.category}</div>
          </div>
          ${Utils.statusBadge(c.status)}
        </div>
        <div style="margin-bottom:12px">
          <div style="font-size:12px;color:var(--gray-500);margin-bottom:8px">Progress: ${c.milestones.filter(m=>m.status==='completed').length}/${c.milestones.length} milestones</div>
          <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(c.milestones.filter(m=>m.status==='completed').length/c.milestones.length*100)}%"></div></div>
        </div>
        <div class="milestone-list">
          ${c.milestones.map(m => `
            <div class="milestone-item ${m.status}">
              <div class="milestone-icon">${m.status==='completed'?'✓':m.status==='in_progress'?'⟳':'○'}</div>
              <div style="flex:1">
                <div class="milestone-title">${m.title}</div>
                <div class="milestone-desc">${m.description}</div>
                <div class="milestone-date">${Utils.formatDate(m.deadline)}</div>
              </div>
              <span class="badge ${m.status==='completed'?'badge-resolved':m.status==='in_progress'?'badge-in_progress':'badge-submitted'}">${m.status.replace('_',' ')}</span>
            </div>`).join('')}
        </div>
      </div>
    </div>`).join('');
}

async function loadNotifications() {
  const container = document.getElementById('notifList');
  try {
    const res = await API.get('/notifications', { limit: 20 });
    if (res.success && res.data.length) {
      const typeIcons = { welcome:'🎉', challenge_assigned:'🏛️', challenge_status_update:'🔄', challenge_resolved:'✅', feedback_received:'⭐' };
      container.innerHTML = res.data.map(n => `
        <div class="notif-item ${n.isRead?'':'unread'}" onclick="markRead('${n._id}',this)">
          <div style="width:32px;height:32px;border-radius:50%;background:${n.isRead?'var(--gray-100)':'var(--secondary-50)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px">${typeIcons[n.type]||'🔔'}</div>
          <div class="notif-item-content">
            <div class="notif-item-title">${n.title}</div>
            <div class="notif-item-msg">${n.message}</div>
            <div class="notif-item-time">${Utils.timeAgo(n.createdAt)}</div>
          </div>
        </div>`).join('');
    } else {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400)">No notifications</div>';
    }
  } catch(e) {}
}

async function markRead(id, el) {
  el.classList.remove('unread');
  try { await API.put(`/notifications/${id}/read`); } catch(e) {}
}

async function loadProfile() {
  const card = document.getElementById('univProfileCard');
  try {
    if (!currentUser.universityId) {
      card.querySelector('.card-body').innerHTML = `
        <div style="text-align:center;padding:40px">
          <div style="font-size:48px;margin-bottom:16px">🏛️</div>
          <div style="font-size:18px;font-weight:700;color:var(--gray-900);margin-bottom:8px">University Profile</div>
          <div style="font-size:14px;color:var(--gray-500)">Contact your administrator to link your university profile.</div>
        </div>`;
      return;
    }
    const res = await API.get(`/universities/${currentUser.universityId}`);
    if (res.success) {
      const u = res.data;
      card.querySelector('.card-body').innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:20px;margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid var(--gray-100)">
          <div style="width:70px;height:70px;border-radius:14px;background:var(--primary-50);border:2px solid var(--primary-100);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:var(--primary);flex-shrink:0">${u.shortName?.substring(0,3)||u.name.substring(0,3)}</div>
          <div>
            <div style="font-size:20px;font-weight:800;color:var(--gray-900)">${u.name}</div>
            <div style="font-size:13px;color:var(--gray-400);margin-top:4px">${u.type?.toUpperCase()} · Established ${u.establishedYear||'—'}</div>
            <div style="display:flex;gap:12px;margin-top:10px">
              ${u.naacGrade?`<span class="badge badge-resolved">NAAC ${u.naacGrade}</span>`:''}
              ${u.isVerified?'<span class="badge badge-resolved">✓ Verified</span>':''}
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--gray-400);text-transform:uppercase;margin-bottom:8px">Location</div>
            <div style="font-size:14px;color:var(--gray-700)">${u.location?.address||''}<br>${u.location?.city}, ${u.location?.state}</div>
          </div>
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--gray-400);text-transform:uppercase;margin-bottom:8px">Contact</div>
            <div style="font-size:14px;color:var(--gray-700)">${u.contact?.email||''}<br>${u.contact?.phone||''}</div>
          </div>
        </div>
        <div style="margin-bottom:20px">
          <div style="font-size:12px;font-weight:700;color:var(--gray-400);text-transform:uppercase;margin-bottom:8px">Expertise Domains</div>
          <div class="tag-list">${(u.expertiseDomains||[]).map(d=>`<span class="tag">${d}</span>`).join('')}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:20px;padding-top:20px;border-top:1px solid var(--gray-100)">
          <div style="text-align:center"><div style="font-size:28px;font-weight:800;color:var(--primary);font-family:var(--font-display)">${u.stats?.totalAssigned||0}</div><div style="font-size:12px;color:var(--gray-400)">Assigned</div></div>
          <div style="text-align:center"><div style="font-size:28px;font-weight:800;color:var(--accent);font-family:var(--font-display)">${u.stats?.totalResolved||0}</div><div style="font-size:12px;color:var(--gray-400)">Resolved</div></div>
          <div style="text-align:center"><div style="font-size:28px;font-weight:800;color:#7c3aed;font-family:var(--font-display)">${u.stats?.performanceScore||0}</div><div style="font-size:12px;color:var(--gray-400)">Score</div></div>
        </div>`;
    }
  } catch(e) {}
}

// ── Update Modal ──
window.openUpdateModal = (id, title) => {
  currentUpdateChallengeId = id;
  document.getElementById('updateChallengeTitle').textContent = title;
  openModal('updateModal');
};

window.confirmUpdate = async () => {
  const status = document.getElementById('updateStatus').value;
  const note = document.getElementById('updateNote').value;
  try {
    await API.put(`/challenges/${currentUpdateChallengeId}/status`, { status, note });
    Toast.success('Updated!', 'Challenge status updated successfully.');
    closeModal('updateModal');
    await loadData();
    loadAssigned();
  } catch(e) { Toast.error('Error', e.message); }
};

window.openModal = (id) => document.getElementById(id).classList.add('open');
window.closeModal = (id) => document.getElementById(id).classList.remove('open');
document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if(e.target===o) o.classList.remove('open'); }));

window.logout = () => {
  Confirm.show({
    title: 'Logout', message: 'Are you sure?', confirmText: 'Logout', type: 'warning',
    onConfirm: () => { Auth.clearAuth(); window.location.replace('/login.html'); }
  });
};
