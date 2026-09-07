// industry.js — Industry Dashboard Logic

let currentUser = null;
let allProjects = [];
let currentPartnerChallengeId = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAuth()) return;
  currentUser = Auth.getUser();
  if (!Auth.requireRole(['industry_rep'])) return;

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
    overview: ['Industry Overview', 'Overview'],
    explore: ['Explore Projects', 'Explore'],
    collaborations: ['My Collaborations', 'Collaborations'],
    notifications: ['Notifications', 'Notifications'],
    profile: ['Partner Profile', 'Profile']
  };
  const [title, crumb] = titles[section] || ['Dashboard', section];
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('pageBreadcrumb').textContent = crumb;
  window.location.hash = section;
  closeMobileSidebar();

  if (section === 'explore') loadExploreChallenges();
  if (section === 'collaborations') loadCollaborations();
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
      allProjects = res.data;
      Utils.animateCounter(document.getElementById('m-total-projects'), allProjects.length);
      renderFeaturedProjects();
      initChart();
    }
  } catch(e) {}
}

function renderFeaturedProjects() {
  const container = document.getElementById('featuredProjects');
  if (!container) return;
  const featured = allProjects.slice(0, 4);

  if (!featured.length) {
    container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--gray-400)">No active projects</div>';
    return;
  }

  container.innerHTML = featured.map(c => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--gray-100);cursor:pointer" onclick="openPartnerModal('${c._id}','${c.title.replace(/'/g,"\\'")}')">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--gray-900)">${Utils.truncate(c.title, 45)}</div>
        <div style="font-size:11px;color:var(--gray-400);margin-top:2px">${c.category} · ${c.assignedUniversity?.shortName || 'Open for assignment'}</div>
      </div>
      <button class="btn btn-sm btn-outline-primary">Partner</button>
    </div>`).join('');
}

function initChart() {
  const ctx = document.getElementById('industryCatChart')?.getContext('2d');
  if (!ctx) return;

  const catCounts = {};
  allProjects.forEach(c => { catCounts[c.category] = (catCounts[c.category] || 0) + 1; });
  const labels = Object.keys(catCounts);
  const data = Object.values(catCounts);
  const colors = ['#059669', '#10b981', '#1a56db', '#3b82f6', '#d97706', '#f59e0b', '#7c3aed', '#8b5cf6'];

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 2,
        borderColor: 'white'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 11 }, padding: 10, boxWidth: 10 } } },
      cutout: '55%'
    }
  });
}

window.loadExploreChallenges = async () => {
  const search = document.getElementById('indSearch')?.value.toLowerCase() || '';
  const category = document.getElementById('indCategoryFilter')?.value || '';
  const container = document.getElementById('indChallengesGrid');

  const filtered = allProjects.filter(c => {
    const matchSearch = !search || c.title.toLowerCase().includes(search) || c.description.toLowerCase().includes(search);
    const matchCat = !category || c.category === category;
    return matchSearch && matchCat;
  });

  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state" style="padding:60px;background:white;border-radius:var(--radius-xl);border:1.5px solid var(--gray-100)"><div class="empty-title">No projects found</div></div>';
    return;
  }

  container.innerHTML = filtered.map(c => `
    <div class="task-card">
      <div class="task-priority-bar ${c.priority}"></div>
      <div class="task-card-header">
        <div>
          <div class="task-card-id">#${c._id.slice(-8).toUpperCase()}</div>
          <div class="task-card-title">${c.title}</div>
          <div class="task-card-category">${c.category} · ${c.location?.district || 'Jharkhand'}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          ${Utils.statusBadge(c.status)}
          ${Utils.priorityBadge(c.priority)}
        </div>
      </div>
      <p style="font-size:13px;color:var(--gray-600);line-height:1.6;margin-bottom:14px">${Utils.truncate(c.description, 140)}</p>
      <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--gray-100);padding-top:12px">
        <div style="font-size:12px;color:var(--gray-500)">
          ${c.assignedUniversity ? `<strong>HEI:</strong> ${c.assignedUniversity.name || c.assignedUniversity.shortName}` : '<span style="color:var(--warning)">Awaiting HEI assignment</span>'}
        </div>
        <button onclick="openPartnerModal('${c._id}','${c.title.replace(/'/g,"\\'")}')" class="btn btn-sm btn-blue">
          🤝 Express Interest
        </button>
      </div>
    </div>`).join('');
};

async function loadCollaborations() {
  const container = document.getElementById('collabList');
  const collabs = allProjects.slice(0, 3);

  container.innerHTML = collabs.map(c => `
    <div class="card">
      <div class="card-body">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div>
            <div style="font-weight:700;font-size:15px;color:var(--gray-900)">${c.title}</div>
            <div style="font-size:12px;color:var(--gray-400);margin-top:2px">${c.category} · Partner: ${c.assignedUniversity?.shortName || 'NIT Jamshedpur'}</div>
          </div>
          <span class="badge badge-resolved">Active Partnership</span>
        </div>
        <div style="font-size:13px;color:var(--gray-600);margin-bottom:12px">Providing technical mentorship, student internship stipends, and field deployment support in ${c.location?.district || 'Ranchi'} district.</div>
        <div class="progress-bar" style="margin-bottom:8px"><div class="progress-fill" style="width:65%"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--gray-400)">
          <span>Phase: Pilot Prototype</span>
          <span>65% Completed</span>
        </div>
      </div>
    </div>`).join('');
}

async function loadNotifications() {
  const container = document.getElementById('indNotifList');
  try {
    const res = await API.get('/notifications', { limit: 20 });
    if (res.success && res.data.length) {
      container.innerHTML = res.data.map(n => `
        <div class="notif-item ${n.isRead?'':'unread'}">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--accent-50);display:flex;align-items:center;justify-content:center;flex-shrink:0">🔔</div>
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

async function loadProfile() {
  const card = document.getElementById('indProfileCard');
  card.querySelector('.card-body').innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:20px;margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid var(--gray-100)">
      <div style="width:70px;height:70px;border-radius:14px;background:var(--accent-50);border:2px solid var(--accent-100);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0">🏭</div>
      <div>
        <div style="font-size:20px;font-weight:800;color:var(--gray-900)">Industry Collaborator</div>
        <div style="font-size:13px;color:var(--gray-400);margin-top:4px">${currentUser.email} · Verified Partner</div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <span class="badge badge-resolved">✓ CSR Verified</span>
          <span class="badge badge-assigned">Jharkhand Ecosystem</span>
        </div>
      </div>
    </div>
    <div style="font-size:14px;color:var(--gray-600);line-height:1.7">
      Supporting higher education institutions and innovators in Jharkhand through corporate social responsibility, mentorship programs, student funding, and direct deployment partnerships.
    </div>`;
}

window.openPartnerModal = (id, title) => {
  currentPartnerChallengeId = id;
  document.getElementById('partnerProjectTitle').textContent = title;
  openModal('partnerModal');
};

window.submitPartnerInterest = async () => {
  const type = document.getElementById('partnerType').value;
  const msg = document.getElementById('partnerMessage').value;
  Toast.success('Proposal Sent!', `Your ${type} interest proposal has been submitted to the team and admin.`);
  closeModal('partnerModal');
};

window.openModal = (id) => document.getElementById(id).classList.add('open');
window.closeModal = (id) => document.getElementById(id).classList.remove('open');
document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if(e.target===o) o.classList.remove('open'); }));

window.logout = () => {
  Confirm.show({
    title: 'Logout', message: 'Are you sure you want to logout?', confirmText: 'Logout', type: 'warning',
    onConfirm: () => { Auth.clearAuth(); window.location.replace('/login.html'); }
  });
};
