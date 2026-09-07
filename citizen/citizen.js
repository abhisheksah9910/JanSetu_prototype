// citizen.js — Citizen Dashboard Logic

let currentUser = null;
let myChallenges = [];
let allChallenges = [];
let activityChart = null;
let categoryChart = null;
let currentFeedbackChallengeId = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAuth()) return;
  const user = Auth.getUser();
  if (user && user.role !== 'citizen') {
    Auth.redirectToDashboard(user.role);
    return;
  }

  currentUser = user;
  initUI();
  await loadData();
  NotifManager.startPolling();
  initFileUpload();
  initSubmitForm();
  initProfileForm();

  // Check URL hash for initial section
  const hash = window.location.hash.replace('#', '');
  if (hash) showSection(hash);
});

// ── UI Init ──
function initUI() {
  if (!currentUser) return;
  const initials = Utils.generateInitials(currentUser.name);

  // Set avatar initials (all possible locations)
  ['sidebarAvatar', 'topbarAvatar', 'profileAvatarLg', 'dashCommentUserAv'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = initials;
  });

  // Set name elements
  const sidebarName = document.getElementById('sidebarName');
  if (sidebarName) sidebarName.textContent = currentUser.name;

  const topbarName = document.getElementById('topbarName');
  if (topbarName) topbarName.textContent = currentUser.name;

  const welcomeEl = document.getElementById('welcomeGreeting') || document.getElementById('welcomeName');
  if (welcomeEl) welcomeEl.textContent = `Welcome back, ${currentUser.name.split(' ')[0]}!`;

  // Profile form
  const pfName = document.getElementById('pfName'); if (pfName) pfName.value = currentUser.name || '';
  const pfPhone = document.getElementById('pfPhone'); if (pfPhone) pfPhone.value = currentUser.phone || '';
  const pfCity = document.getElementById('pfCity'); if (pfCity) pfCity.value = currentUser.address?.city || '';
  const pfDist = document.getElementById('pfDistrict'); if (pfDist) pfDist.value = currentUser.address?.district || '';
  const profileName = document.getElementById('profileName'); if (profileName) profileName.textContent = currentUser.name;
  const profileEmail = document.getElementById('profileEmail'); if (profileEmail) profileEmail.textContent = currentUser.email;
  const profilePhone = document.getElementById('profilePhone'); if (profilePhone) profilePhone.textContent = currentUser.phone || '—';
  const contactName = document.getElementById('contactName'); if (contactName) contactName.value = currentUser.name || '';
  const contactPhone = document.getElementById('contactPhone'); if (contactPhone) contactPhone.value = currentUser.phone || '';

  // Responsive sidebar
  const handleResize = () => {
    const isMobile = window.innerWidth <= 900;
    const mobileBtn = document.getElementById('mobileSidebarBtn');
    if (mobileBtn) mobileBtn.style.display = isMobile ? 'flex' : 'none';
  };
  window.addEventListener('resize', handleResize);
  handleResize();
  initMiniIndiaMap();
}

// ── Mini India Leaflet Map ──
function initMiniIndiaMap() {
  const mapEl = document.getElementById('miniIndiaMap');
  if (!mapEl || typeof L === 'undefined') return;

  try {
    if (window.IndiaHeatmap && typeof window.IndiaHeatmap.create === 'function') {
      window.IndiaHeatmap.create('miniIndiaMap', { isMini: true, center: [22.8, 80.5], zoom: 3.5 });
    }
  } catch (e) {
    console.warn('Mini India map init note:', e);
  }
}


// ── Load All Data ──
async function loadData() {
  await Promise.all([
    loadMyChallenges(),
    loadPublicFeed(false),
    loadDashSidebarWidgets(),
    loadNotifications(),
    loadSidebarNotifications()
  ]);
  initCharts();
}


// ── Public Feed State for Dashboard ──
let dashFeedPage = 1;
let dashFeedTotal = 0;
let dashFeedSort = 'recent';
let dashFeedState = '';
let dashFeedCat = '';
let dashFeedStatus = '';
let dashSearchQuery = '';

async function loadPublicFeed(append = false) {
  const container = document.getElementById('recentChallengesList');
  const loadMoreBtn = document.getElementById('dashFeedLoadMore');
  const spinner = document.getElementById('dashFeedSpinner');

  if (!container) return;

  if (!append) {
    dashFeedPage = 1;
    container.innerHTML = '<div class="hfc-skeleton"></div><div class="hfc-skeleton"></div><div class="hfc-skeleton"></div>';
  } else {
    if (spinner) spinner.style.display = 'block';
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
  }

  try {
    const params = {
      page: dashFeedPage,
      limit: 5,
      sort: dashFeedSort === 'supported' ? '-supportCount' : '-createdAt'
    };
    if (dashFeedState) params.state = dashFeedState;
    if (dashFeedCat) params.category = dashFeedCat;
    if (dashFeedStatus) params.status = dashFeedStatus;
    if (dashSearchQuery) params.search = dashSearchQuery;

    const res = await API.get('/challenges', params);
    if (spinner) spinner.style.display = 'none';

    if (res.success) {
      const challenges = res.data || [];
      dashFeedTotal = res.pagination?.total || challenges.length;

      if (!append) {
        if (!challenges.length) {
          container.innerHTML = `
            <div class="empty-state" style="background:white;border-radius:var(--radius-2xl);padding:48px 24px;border:1.5px solid var(--border);text-align:center">
              <div style="font-size:36px;margin-bottom:12px">🔍</div>
              <div style="font-weight:700;font-size:16px;color:var(--gray-900);margin-bottom:4px">No challenges found</div>
              <div style="font-size:13px;color:var(--gray-500);margin-bottom:16px">Try clearing filters or search terms</div>
              <button onclick="resetDashFeedFilters()" class="btn btn-blue btn-sm">Reset Filters</button>
            </div>`;
          if (loadMoreBtn) loadMoreBtn.style.display = 'none';
          return;
        }
        container.innerHTML = challenges.map(c => challengeListItem(c)).join('');
      } else {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = challenges.map(c => challengeListItem(c)).join('');
        while (tempDiv.firstChild) {
          container.appendChild(tempDiv.firstChild);
        }
      }

      // Check if more pages exist
      const loadedCount = container.querySelectorAll('.dash-feed-card').length;
      if (loadMoreBtn) {
        loadMoreBtn.style.display = loadedCount < dashFeedTotal ? 'inline-flex' : 'none';
      }
    }
  } catch(e) {
    if (spinner) spinner.style.display = 'none';
    if (!append) {
      container.innerHTML = '<div class="empty-state" style="padding:40px;color:var(--gray-400)">Could not load feed. Please try again.</div>';
    }
  }
}

window.loadMoreDashFeed = () => {
  dashFeedPage++;
  loadPublicFeed(true);
};

window.handleFeedTab = (btn, sort) => {
  document.querySelectorAll('#dashFeedTabs .feed-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  dashFeedSort = sort;
  loadPublicFeed(false);
};

window.toggleDashFilters = () => {
  const panel = document.getElementById('dashFiltersPanel');
  if (panel) {
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  }
};

window.applyDashFeedFilters = () => {
  dashFeedState = document.getElementById('dashFilterState')?.value || '';
  dashFeedCat = document.getElementById('dashFilterCat')?.value || '';
  dashFeedStatus = document.getElementById('dashFilterStatus')?.value || '';
  loadPublicFeed(false);
};

window.resetDashFeedFilters = () => {
  if (document.getElementById('dashFilterState')) document.getElementById('dashFilterState').value = '';
  if (document.getElementById('dashFilterCat')) document.getElementById('dashFilterCat').value = '';
  if (document.getElementById('dashFilterStatus')) document.getElementById('dashFilterStatus').value = '';
  if (document.getElementById('dashSearchInput')) document.getElementById('dashSearchInput').value = '';
  dashFeedState = '';
  dashFeedCat = '';
  dashFeedStatus = '';
  dashSearchQuery = '';
  loadPublicFeed(false);
};

window.handleDashSearch = Utils.debounce((val) => {
  dashSearchQuery = val ? val.trim() : '';
  loadPublicFeed(false);
}, 300);

// ── Populate Sidebar Widgets ──
async function loadDashSidebarWidgets() {
  // 1. Trending Categories
  const catEl = document.getElementById('dashTrendingCats');
  if (catEl) {
    const cats = [
      { name: 'Roads & Infrastructure', icon: '🚗', count: 1245, pct: 90 },
      { name: 'Waste Management', icon: '♻️', count: 1023, pct: 75 },
      { name: 'Water Supply', icon: '💧', count: 876, pct: 65 },
      { name: 'Public Safety', icon: '🛡️', count: 654, pct: 50 },
      { name: 'Street Lights', icon: '💡', count: 512, pct: 40 }
    ];
    catEl.innerHTML = cats.map(c => `
      <div class="tcat-item" onclick="filterByCat('${c.name}')" style="cursor:pointer">
        <span class="tcat-icon">${c.icon}</span>
        <div class="tcat-info">
          <div class="tcat-name">${c.name}</div>
          <div class="tcat-bar-bg"><div class="tcat-bar-fill" style="width:${c.pct}%"></div></div>
        </div>
        <span class="tcat-count">${c.count.toLocaleString()}</span>
      </div>
    `).join('');
  }

  // 2. Top Cities
  const cityEl = document.getElementById('dashTopCities');
  if (cityEl) {
    const cities = [
      { rank: 1, name: 'Mumbai', count: 2341, color: '#dc2626' },
      { rank: 2, name: 'Delhi', count: 2105, color: '#dc2626' },
      { rank: 3, name: 'Bengaluru', count: 1245, color: '#f59e0b' },
      { rank: 4, name: 'Lucknow', count: 912, color: '#f59e0b' },
      { rank: 5, name: 'Pune', count: 654, color: '#16a34a' }
    ];
    cityEl.innerHTML = cities.map(c => `
      <div class="tcity-item">
        <span class="tcity-rank">${c.rank}</span>
        <span class="tcity-dot" style="background:${c.color}"></span>
        <span class="tcity-name">${c.name}</span>
        <span class="tcity-count">${c.count.toLocaleString()}</span>
      </div>
    `).join('');
  }

  // 3. Top Supporters
  const supEl = document.getElementById('dashTopSupporters');
  if (supEl) {
    const supporters = [
      { name: 'Rahul Verma', supports: 142, av: 'R', color: '#1a56db' },
      { name: 'Aarav Sharma', supports: 128, av: 'A', color: '#7c3aed' },
      { name: 'Aman Singh', supports: 112, av: 'A', color: '#059669' },
      { name: 'Neha Patel', supports: 98, av: 'N', color: '#d97706' },
      { name: 'Karan Mehta', supports: 86, av: 'K', color: '#dc2626' }
    ];
    supEl.innerHTML = supporters.map(s => `
      <div class="tsup-item">
        <div class="tsup-av-placeholder" style="background:${s.color}">${s.av}</div>
        <div class="tsup-info">
          <div class="tsup-name">${s.name}</div>
          <div class="tsup-count">${s.supports} Supports</div>
        </div>
        <span class="tsup-rank-badge">Top</span>
      </div>
    `).join('');
  }
}

window.filterByCat = (catName) => {
  dashFeedCat = catName;
  const sel = document.getElementById('dashFilterCat');
  if (sel) sel.value = catName;
  const panel = document.getElementById('dashFiltersPanel');
  if (panel) panel.style.display = 'flex';
  loadPublicFeed(false);
};


// ── Section Navigation ──
function showSection(section) {
  document.querySelectorAll('.dashboard-section').forEach(s => s.style.display = 'none');
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));

  const sectionEl = document.getElementById(`section-${section}`);
  const navEl = document.getElementById(`nav-${section}`);
  if (sectionEl) sectionEl.style.display = 'block';
  if (navEl) navEl.classList.add('active');

  const titles = {
    overview: ['Dashboard Overview', 'Overview'],
    'my-challenges': ['My Challenges', 'My Challenges'],
    submit: ['Submit Challenge', 'Submit'],
    notifications: ['Notifications', 'Notifications'],
    explore: ['Explore All Challenges', 'Explore'],
    profile: ['My Profile', 'Profile']
  };
  const [title, crumb] = titles[section] || ['Dashboard', section];
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('pageBreadcrumb').textContent = crumb;

  window.location.hash = section;
  closeMobileSidebar();

  // Lazy load section content
  if (section === 'my-challenges') renderMyChallenges();
  if (section === 'notifications') loadAllNotifications();
  if (section === 'explore') loadExplore();
}

// ── Sidebar ──
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

// ── Load My Challenges ──
async function loadMyChallenges() {
  try {
    const res = await API.get('/challenges', { limit: 100 });
    if (res.success) {
      myChallenges = res.data;
      updateMetrics();
      renderRecentChallenges();
    }
  } catch (e) {
    Toast.error('Error', 'Could not load your challenges.');
  }
}

function updateMetrics() {
  const statuses = myChallenges.map(c => c.status);
  const total = myChallenges.length;
  const resolved = statuses.filter(s => s === 'resolved').length;
  const active = statuses.filter(s => ['assigned', 'in_progress', 'testing'].includes(s)).length;
  const awaiting = statuses.filter(s => s === 'submitted').length;
  const totalSupportGiven = myChallenges.reduce((acc, c) => acc + (c.supportCount || 0), 0);

  // Main stats cards
  const animEl = (id, val) => { const el = document.getElementById(id); if (el) Utils.animateCounter(el, val); };
  animEl('m-total', total);
  animEl('m-pending', active);
  animEl('m-active', resolved);
  animEl('m-resolved', awaiting);

  // Overview sidebar impact
  animEl('impTotal', total);
  animEl('impResolved', resolved);
  animEl('impSupported', totalSupportGiven);
  animEl('impProjects', active);

  // My Impact section
  animEl('ei-total', total);
  animEl('ei-resolved', resolved);
  animEl('ei-supported', totalSupportGiven);
  animEl('ei-projects', active);
}

// Curated high quality India civic/community images pool
const DASH_INDIA_IMAGES = [
  'https://images.unsplash.com/photo-1599930113854-d6d7fd521f10?w=800&q=75&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=800&q=75&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=75&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1605300060680-72f22e77017c?w=800&q=75&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=75&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1608234808654-2a8875faa7fd?w=800&q=75&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&q=75&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=800&q=75&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=75&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1602496065013-a03f43977b0e?w=800&q=75&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1546961342-ea5f62d4d81b?w=800&q=75&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=800&q=75&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1519222970733-f546218fa6d7?w=800&q=75&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=800&q=75&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=75&auto=format&fit=crop'
];

const DASH_CAT_META = {
  'Education': { emoji: '📚', color: '#dbeafe' },
  'Healthcare': { emoji: '🏥', color: '#fce7f3' },
  'Agriculture': { emoji: '🌾', color: '#d1fae5' },
  'Water Management': { emoji: '💧', color: '#cffafe' },
  'Sanitation & Environment': { emoji: '♻️', color: '#dcfce7' },
  'Rural Livelihoods': { emoji: '🏘️', color: '#fef3c7' },
  'Urban Infrastructure': { emoji: '🏗️', color: '#e0e7ff' },
  'Energy & Technology': { emoji: '⚡', color: '#fef9c3' },
  'Accessibility': { emoji: '♿', color: '#f3e8ff' },
  'Public Administration': { emoji: '🏛️', color: '#f0f9ff' }
};

function renderRecentChallenges() {
  // Use new element ID for the overview list
  const container = document.getElementById('recentReportsList') || document.getElementById('recentChallengesList');
  if (!container) return;
  const recent = myChallenges.slice(0, 3); // show only 3 like in reference image

  // Render Active Report Card (most recent non-resolved)
  renderActiveReportCard();

  if (!recent.length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">📋</div><div class="empty-title">No reports yet</div><div style="font-size:12px;margin-bottom:12px">Submit your first challenge</div><button class="btn btn-purple" onclick="showSection('submit')" style="font-size:12px;padding:8px 14px">Report a Problem</button></div>`;
    return;
  }

  const INDIA_IMGS = DASH_INDIA_IMAGES;
  container.innerHTML = recent.map((c, i) => {
    const loc = c.location || {};
    const locStr = [loc.district, loc.state].filter(Boolean).join(', ') || 'India';
    const timeAgo = Utils.timeAgo(c.createdAt);
    const idx = parseInt(c._id?.slice(-4) || String(i), 16) || i;
    const img = INDIA_IMGS[idx % INDIA_IMGS.length];
    const badgeHtml = getJanSetuStatusBadge(c.status);
    const idShort = '#' + (c._id?.slice(-8).toUpperCase() || 'N/A');
    const uniLabel = c.assignedUniversity ? `<span class="badge-uni">University Assigned</span>` : '';
    return `<div class="report-item" onclick="openChallengeDetail('${c._id}')">
      <img class="ri-thumb" src="${img}" alt="" onerror="this.style.background='#f3f4f6'">
      <div class="ri-info">
        <div class="ri-title">${Utils.escapeHtml(c.title)}</div>
        <div class="ri-loc">${Utils.escapeHtml(locStr)}</div>
        <div class="ri-id">ID: ${idShort} ${uniLabel}</div>
      </div>
      <div class="ri-right">
        <div>${badgeHtml}</div>
        <div class="ri-time">${timeAgo}</div>
        <div class="ri-chevron">›</div>
      </div>
    </div>`;
  }).join('');
}

function getJanSetuStatusBadge(status) {
  const map = {
    submitted: '<span class="badge-sub">Submitted</span>',
    under_review: '<span class="badge-sub">Under Review</span>',
    validated: '<span class="badge-sub">Validated</span>',
    assigned: '<span class="badge-uni">Assigned</span>',
    in_progress: '<span class="badge-prog">In Progress</span>',
    testing: '<span class="badge-prog">Testing</span>',
    resolved: '<span class="badge-res">Resolved</span>'
  };
  return map[status] || `<span class="badge-sub">${Utils.capitalize(status)}</span>`;
}

function renderActiveReportCard() {
  const container = document.getElementById('activeReportContainer');
  if (!container) return;

  const active = myChallenges.find(c => c.status !== 'resolved') || myChallenges[0];
  if (!active) return;

  const loc = active.location || {};
  const locStr = [loc.district, loc.state].filter(Boolean).join(', ') || 'India';
  const idx = parseInt(active._id?.slice(-4) || '0', 16) || 0;
  const img = DASH_INDIA_IMAGES[idx % DASH_INDIA_IMAGES.length];
  const idShort = '#' + (active._id?.slice(-8).toUpperCase() || 'N/A');
  const timeAgo = Utils.timeAgo(active.updatedAt || active.createdAt);

  // Timeline steps matching the image exactly
  const tlSteps = [
    { label: 'Submitted', key: 'submitted' },
    { label: 'Verified', key: 'under_review' },
    { label: 'In Progress', key: 'in_progress' },
    { label: 'Resolution', key: 'testing' },
    { label: 'Closed', key: 'resolved' }
  ];
  const statusOrder = ['submitted','under_review','validated','assigned','in_progress','testing','resolved'];
  const currentIdx = statusOrder.indexOf(active.status);

  // Map step keys to status indices
  const stepIdxMap = { submitted:0, under_review:1, in_progress:4, testing:5, resolved:6 };

  const tlHtml = tlSteps.map((step, i) => {
    const stepIdx = stepIdxMap[step.key] ?? i;
    const done = currentIdx > stepIdx;
    const isActive = currentIdx === stepIdx || (i === 2 && currentIdx >= 3 && currentIdx <= 5);
    const dotClass = done ? 'done' : isActive ? 'done' : 'pending';
    const checkmark = (done || isActive) ? '✓' : '';
    return `
      <div class="tl-step">
        <div class="tl-dot ${dotClass}">${checkmark}</div>
        <div class="tl-label">${step.label}</div>
        <div class="tl-date">${done || isActive ? '28 Aug 2026' : 'Pending'}</div>
      </div>
      ${i < tlSteps.length - 1 ? `<div class="tl-line ${done ? 'done' : ''}"></div>` : ''}`;
  }).join('');

  const statusLabel = active.status === 'in_progress' || active.status === 'assigned' ? 'In Progress'
    : active.status === 'submitted' ? 'Submitted'
    : Utils.capitalize(active.status);

  container.innerHTML = `
    <div class="active-card">
      <div class="arc-body">
        <img class="arc-thumb" src="${img}" alt="" onerror="this.style.background='#f3f4f6'">
        <div class="arc-details">
          <div class="arc-top-row">
            <span class="badge-inprogress">${statusLabel}</span>
            <div class="arc-update">Last Update<br/>${timeAgo}</div>
          </div>
          <div class="arc-title" onclick="openChallengeDetail('${active._id}')">${Utils.escapeHtml(active.title)}</div>
          <div class="arc-location">📍 ${Utils.escapeHtml(locStr)}</div>
          <div class="arc-id-row">
            <span class="arc-id">Report ID: ${idShort}</span>
            ${active.status !== 'submitted' ? '<span class="badge-verified">✓ Verified</span>' : ''}
          </div>
        </div>
      </div>
      <div class="timeline">${tlHtml}</div>
    </div>`;
}

function challengeListItem(c) {
  const authorName = c.submittedBy?.name || c.submitterContact?.name || currentUser?.name || 'Citizen Reporter';
  const initial = authorName.charAt(0).toUpperCase();
  const loc = c.location || {};
  const locStr = [loc.village, loc.district, loc.state].filter(Boolean).join(', ') || 'India';
  const catMeta = DASH_CAT_META[c.category] || { emoji: '📋', color: '#f1f5f9' };
  const timeAgo = Utils.timeAgo(c.createdAt);
  const supported = currentUser && Array.isArray(c.supports) && c.supports.includes(currentUser._id);
  const supportCount = c.supportCount || (Array.isArray(c.supports) ? c.supports.length : 0);
  const commentCount = c.commentCount || 0;

  // Real photos or curated 3-photo India gallery matching CivicVoice layout
  const realImgs = (c.attachments || [])
    .filter(a => a.mimetype && a.mimetype.startsWith('image/'))
    .map(a => a.url || `/uploads/${a.filename}`);

  const idx = parseInt(c._id?.slice(-4) || '0', 16) || 0;
  const img1 = DASH_INDIA_IMAGES[idx % DASH_INDIA_IMAGES.length];
  const img2 = DASH_INDIA_IMAGES[(idx + 3) % DASH_INDIA_IMAGES.length];
  const img3 = DASH_INDIA_IMAGES[(idx + 7) % DASH_INDIA_IMAGES.length];
  const displayImgs = realImgs.length >= 2 ? realImgs : [img1, img2, img3];


  // Register in global gallery cache
  window.DASH_FEED_GALLERIES = window.DASH_FEED_GALLERIES || {};
  window.DASH_FEED_GALLERIES[c._id] = displayImgs;

  // Gallery HTML
  let galleryHtml = '';
  if (displayImgs.length === 1) {
    galleryHtml = `
      <div class="dfc-gallery">
        <div class="dfc-img-single" onclick="openDashLightbox('${c._id}', 0)">
          <img src="${displayImgs[0]}" alt="Evidence" loading="lazy">
        </div>
      </div>`;
  } else if (displayImgs.length === 2) {
    galleryHtml = `
      <div class="dfc-gallery">
        <div class="dfc-img-two">
          <div class="dfc-img-cell" onclick="openDashLightbox('${c._id}', 0)"><img src="${displayImgs[0]}" alt="Evidence 1" loading="lazy"></div>
          <div class="dfc-img-cell" onclick="openDashLightbox('${c._id}', 1)"><img src="${displayImgs[1]}" alt="Evidence 2" loading="lazy"></div>
        </div>
      </div>`;
  } else {
    const more = displayImgs.length - 3;
    galleryHtml = `
      <div class="dfc-gallery">
        <div class="dfc-img-three">
          <div class="dfc-img-cell" onclick="openDashLightbox('${c._id}', 0)"><img src="${displayImgs[0]}" alt="Evidence 1" loading="lazy"></div>
          <div class="dfc-img-cell" onclick="openDashLightbox('${c._id}', 1)"><img src="${displayImgs[1]}" alt="Evidence 2" loading="lazy"></div>
          <div class="dfc-img-cell" onclick="openDashLightbox('${c._id}', 2)">
            <img src="${displayImgs[2]}" alt="Evidence 3" loading="lazy">
            ${more > 0 ? `<div class="dfc-img-more-badge">+${more}</div>` : ''}
          </div>
        </div>
      </div>`;
  }


  const verBadge = c.status === 'resolved'
    ? `<span class="dfc-verified-badge">✓ Verified & Resolved</span>`
    : c.status === 'submitted'
    ? `<span class="dfc-pending-badge">⏳ Pending Verification</span>`
    : '';

  const uniBadge = c.assignedUniversity
    ? `<div class="dfc-uni-badge">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m2 7 10-5 10 5-10 5z"/><path d="M6 9.5v5a6 6 0 0 0 12 0v-5"/></svg>
        Being solved by ${c.assignedUniversity.shortName || c.assignedUniversity.name}
      </div>`
    : '';

  return `
    <div class="dash-feed-card" id="dfc-${c._id}">
      <div class="dfc-header">
        <div class="dfc-author-group">
          <div class="dfc-avatar">${initial}</div>
          <div>
            <div class="dfc-author-name">
              ${Utils.escapeHtml(authorName)}
              ${supportCount > 20 ? '<span class="dfc-top-tag">⭐ Top Reporter</span>' : ''}
            </div>
            <div class="dfc-meta-row">
              <span>${timeAgo}</span>
              <span class="dot"></span>
              <span>${Utils.escapeHtml(loc.state || 'India')}</span>
            </div>
          </div>
        </div>
        <div class="dfc-badges-right">
          ${Utils.statusBadge(c.status)}
          ${Utils.priorityBadge(c.priority)}
        </div>
      </div>

      <div class="dfc-body">
        <div class="dfc-cat-pill" style="background:${catMeta.color}">
          ${catMeta.emoji} ${Utils.escapeHtml(c.category)}
        </div>
        <h3 class="dfc-title" onclick="openChallengeDetail('${c._id}')">${Utils.escapeHtml(c.title)}</h3>
        <p class="dfc-desc" id="dfc-desc-${c._id}">${Utils.escapeHtml(c.description)}</p>
        <button class="dfc-read-more-btn" onclick="toggleDashDesc('${c._id}')">Read more</button>
        <div class="dfc-location-bar">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>${Utils.escapeHtml(locStr)}</span>
          ${verBadge}
        </div>
        ${uniBadge}
      </div>

      ${galleryHtml}

      <div class="dfc-footer">
        <div class="dfc-actions">
          <button class="dfc-btn btn-support ${supported ? 'supported' : ''}" onclick="handleDashSupport('${c._id}', this)">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="${supported ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span class="dfc-sup-count">${supportCount}</span> Supports
          </button>
          <button class="dfc-btn btn-comment" onclick="openDashComments('${c._id}')">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span class="dfc-cmt-count">${commentCount}</span> Comments
          </button>
          <button class="dfc-btn btn-share" onclick="handleDashShare('${c._id}')">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Share
          </button>
        </div>
        <button class="dfc-view-details" onclick="openChallengeDetail('${c._id}')">View Details →</button>
      </div>
    </div>`;

}

// ── Description Expand Toggle ──
window.toggleDashDesc = (id) => {
  const desc = document.getElementById(`dfc-desc-${id}`);
  if (!desc) return;
  const exp = desc.classList.toggle('expanded');
  const btn = desc.nextElementSibling;
  if (btn) btn.textContent = exp ? 'Show less' : 'Read more';
};

// ── Render My Challenges with Filters ──
function renderMyChallenges() {
  const search = document.getElementById('challengeSearch').value.toLowerCase();
  const status = document.getElementById('statusFilter').value;
  const category = document.getElementById('categoryFilter').value;

  let filtered = myChallenges.filter(c => {
    const matchSearch = !search || c.title.toLowerCase().includes(search) || c.description.toLowerCase().includes(search);
    const matchStatus = !status || c.status === status;
    const matchCat = !category || c.category === category;
    return matchSearch && matchStatus && matchCat;
  });

  const container = document.getElementById('challengesGrid');
  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state" style="padding:60px 0;background:white;border-radius:var(--radius-xl);border:1.5px solid var(--gray-100)"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><div class="empty-title">No challenges found</div><div class="empty-desc">Try adjusting your filters</div></div>`;
    return;
  }

  container.innerHTML = filtered.map(c => challengeListItem(c)).join('');
}


window.filterChallenges = Utils.debounce(() => renderMyChallenges(), 200);

// ── Load Explore ──
let exploreDebounce = null;
window.loadExplore = async () => {
  clearTimeout(exploreDebounce);
  exploreDebounce = setTimeout(async () => {
    const search = document.getElementById('exploreSearch')?.value || '';
    const category = document.getElementById('exploreCategoryFilter')?.value || '';
    const district = document.getElementById('exploreDistrictFilter')?.value || '';
    const container = document.getElementById('exploreGrid');
    container.innerHTML = '<div class="skeleton skeleton-card" style="height:100px;margin-bottom:12px"></div>'.repeat(3);
    try {
      const res = await API.get('/challenges', { search, category, district: district, limit: 20 });
      if (res.success) {
        allChallenges = res.data;
        container.innerHTML = res.data.length ? res.data.map(c => challengeListItem(c)).join('') : '<div class="empty-state" style="background:white;border-radius:var(--radius-xl);border:1.5px solid var(--gray-100);padding:60px"><div class="empty-title">No challenges found</div></div>';
      }
    } catch(e) {}
  }, 300);
};

// ── Challenge Detail Modal ──
async function openChallengeDetail(id) {
  openModal('challengeDetailModal');
  const body = document.getElementById('cDetailBody');
  body.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner" style="margin:0 auto"></div></div>';

  try {
    const res = await API.get(`/challenges/${id}`);
    if (res.success) {
      const c = res.data;
      document.getElementById('cDetailTitle').textContent = c.title;
      document.getElementById('cDetailId').textContent = `#${c._id.slice(-8).toUpperCase()} · ${c.category}`;

      // Status timeline
      const statusOrder = ['submitted', 'under_review', 'validated', 'assigned', 'in_progress', 'testing', 'resolved'];
      const currentIdx = statusOrder.indexOf(c.status);
      const statusTimeline = statusOrder.map((s, i) => `
        <div class="status-timeline-item ${i < currentIdx ? 'completed' : i === currentIdx ? 'active' : ''}">
          <div class="status-timeline-dot"></div>
          <div class="status-timeline-content">
            <div class="status-timeline-label">${s.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</div>
            ${c.statusHistory?.find(h=>h.status===s)?.changedAt ? `<div class="status-timeline-date">${Utils.formatDate(c.statusHistory.find(h=>h.status===s).changedAt, true)}</div>` : ''}
          </div>
        </div>`).join('');

      body.innerHTML = `
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:28px">
          <div>
            <div style="margin-bottom:16px">
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
                ${Utils.statusBadge(c.status)} ${Utils.priorityBadge(c.priority)}
                ${c.aiConfidenceScore ? `<span class="badge" style="background:#f3e8ff;color:#7c3aed">🤖 AI: ${Math.round(c.aiConfidenceScore*100)}%</span>` : ''}
              </div>
              <p style="font-size:15px;color:var(--gray-700);line-height:1.7">${c.description}</p>
            </div>

            ${c.location ? `<div style="display:flex;align-items:center;gap:8px;padding:12px;background:var(--gray-50);border-radius:10px;font-size:13px;color:var(--gray-600);margin-bottom:16px">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${[c.location.address, c.location.village, c.location.block, c.location.district].filter(Boolean).join(', ')}
            </div>` : ''}

            ${c.assignedUniversity ? `<div style="padding:14px;background:var(--primary-50);border-radius:10px;margin-bottom:16px">
              <div style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Assigned University</div>
              <div style="font-weight:700;color:var(--gray-900)">${c.assignedUniversity.name || c.assignedUniversity.shortName}</div>
              ${c.deadline ? `<div style="font-size:12px;color:var(--gray-500);margin-top:4px">Deadline: ${Utils.formatDate(c.deadline)}</div>` : ''}
            </div>` : ''}

            ${c.milestones?.length ? `<div style="margin-bottom:16px">
              <div style="font-weight:700;font-size:14px;color:var(--gray-900);margin-bottom:12px">Project Milestones</div>
              <div class="milestone-list">${c.milestones.map(m => `
                <div class="milestone-item ${m.status}">
                  <div class="milestone-icon">${m.status==='completed'?'✓':m.status==='in_progress'?'⟳':'○'}</div>
                  <div>
                    <div class="milestone-title">${m.title}</div>
                    <div class="milestone-desc">${m.description}</div>
                    <div class="milestone-date">${Utils.formatDate(m.deadline)}</div>
                  </div>
                </div>`).join('')}
              </div>
            </div>` : ''}

            ${c.feedback ? `<div style="padding:14px;background:var(--accent-50);border-radius:10px;border:1px solid var(--accent-100)">
              <div style="font-size:12px;font-weight:700;color:var(--accent-dark);margin-bottom:8px">Your Feedback</div>
              <div style="display:flex;gap:3px;margin-bottom:6px">${Array(5).fill(0).map((_,i)=>`<span style="color:${i<c.feedback.rating?'var(--warning)':'var(--gray-300)'}">★</span>`).join('')}</div>
              <div style="font-size:13px;color:var(--gray-700)">${c.feedback.review || 'No review provided'}</div>
            </div>` : ''}
          </div>

          <div>
            <div style="margin-bottom:20px">
              <div style="font-weight:700;font-size:14px;color:var(--gray-900);margin-bottom:12px">Progress Timeline</div>
              <div class="status-timeline">${statusTimeline}</div>
            </div>
            <div style="font-size:12px;color:var(--gray-400);font-weight:500">
              Submitted: ${Utils.formatDate(c.createdAt, true)}<br>
              Last Updated: ${Utils.timeAgo(c.updatedAt)}
            </div>
          </div>
        </div>`;

      // Footer actions
      const footer = document.getElementById('cDetailFooter');
      footer.innerHTML = '';
      if (c.status === 'resolved' && !c.feedback) {
        const rateBtn = document.createElement('button');
        rateBtn.className = 'btn btn-green';
        rateBtn.innerHTML = '★ Rate this Solution';
        rateBtn.onclick = () => { closeModal('challengeDetailModal'); openFeedbackModal(c._id); };
        footer.appendChild(rateBtn);
      }
      const closeBtn = document.createElement('button');
      closeBtn.className = 'btn btn-ghost';
      closeBtn.textContent = 'Close';
      closeBtn.onclick = () => closeModal('challengeDetailModal');
      footer.appendChild(closeBtn);
    }
  } catch(e) {
    body.innerHTML = `<div class="empty-state"><div class="empty-title">Could not load challenge details</div><div class="empty-desc">${e.message}</div></div>`;
  }
}

// ── Submit Challenge Form ──
function initSubmitForm() {
  const form = document.getElementById('challengeForm');
  if (!form) return;

  // Character counter
  document.getElementById('chalDescription').addEventListener('input', (e) => {
    document.getElementById('charCount').textContent = `${e.target.value.length} characters`;
    if (e.target.value.length >= 50) {
      debounceAIClassify(e.target.value);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    clearSubmitErrors();

    const title = document.getElementById('chalTitle').value.trim();
    const description = document.getElementById('chalDescription').value.trim();
    const category = document.getElementById('chalCategory').value;
    const priority = document.getElementById('chalPriority').value;
    const district = document.getElementById('chalDistrict').value;

    let valid = true;
    if (!title || title.length < 10) { showFieldError('titleError', 'Please enter a meaningful title (min 10 chars)'); valid = false; }
    if (!description || description.length < 50) { showFieldError('descError', 'Description must be at least 50 characters'); valid = false; }
    if (!district) { showFieldError('districtError', 'Please select a district'); valid = false; }
    if (!valid) return;

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('category', category || '');
    formData.append('priority', priority);
    formData.append('location[district]', district);
    formData.append('location[block]', document.getElementById('chalBlock').value);
    formData.append('location[village]', document.getElementById('chalVillage').value);
    formData.append('location[pincode]', document.getElementById('chalPincode').value);
    formData.append('location[address]', document.getElementById('chalAddress').value);
    formData.append('submitterContact[name]', document.getElementById('contactName').value || currentUser.name);
    formData.append('submitterContact[phone]', document.getElementById('contactPhone').value || currentUser.phone || '');
    formData.append('submitterContact[email]', currentUser.email);

    const files = document.getElementById('chalAttachments').files;
    for (const file of files) formData.append('attachments', file);

    Utils.setLoading(btn, true);
    try {
      const res = await API.upload('/challenges', formData);
      if (res.success) {
        Toast.success('Challenge Submitted!', 'Your challenge is now under review.');
        form.reset();
        document.getElementById('filePreviewList').innerHTML = '';
        document.getElementById('aiSuggestion').style.display = 'none';
        await loadMyChallenges();
        showSection('my-challenges');
      }
    } catch(err) {
      document.getElementById('submitAlert').className = 'auth-alert auth-alert-error';
      document.getElementById('submitAlert').innerHTML = `✕ ${err.message}`;
      document.getElementById('submitAlert').style.display = 'flex';
    } finally {
      Utils.setLoading(btn, false);
    }
  });
}

// AI classification debounce
const debounceAIClassify = Utils.debounce(async (text) => {
  try {
    const res = await API.post('/challenges/classify', { description: text });
    if (res.success && res.data?.category) {
      const { category, confidence } = res.data;
      document.getElementById('aiSuggestion').style.display = 'block';
      document.getElementById('aiSuggestionText').innerHTML = `Detected Category: <strong>${category}</strong> (${Math.round(confidence*100)}% confidence). <a href="#" onclick="applyAISuggestion('${category}');return false">Apply suggestion</a>`;
      const select = document.getElementById('chalCategory');
      if (!select.value) select.value = category;
    }
  } catch(e) {}
}, 1000);

window.applyAISuggestion = (cat) => {
  document.getElementById('chalCategory').value = cat;
};

// ── File Upload ──
function initFileUpload() {
  const area = document.getElementById('fileUploadArea');
  area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('drag-over'); });
  area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('drag-over');
    handleFileSelect(e.dataTransfer.files);
  });
}

window.handleFileSelect = (files) => {
  const list = document.getElementById('filePreviewList');
  Array.from(files).forEach(file => {
    const item = document.createElement('div');
    item.className = 'file-preview-item';
    item.innerHTML = `
      <div class="file-preview-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg></div>
      <div class="file-preview-info"><div class="file-preview-name">${file.name}</div><div class="file-preview-size">${(file.size/1024).toFixed(1)} KB</div></div>
      <button class="file-preview-remove" onclick="this.parentElement.remove()">✕</button>`;
    list.appendChild(item);
  });
};

// ── Notifications ──
async function loadNotifications() {
  try {
    const res = await API.get('/notifications', { limit: 5 });
    // Support both old 'notifList' and new 'notifPanelList'
    if (res.success) {
      renderNotifList(res.data, 'notifPanelList', false);
      renderNotifList(res.data, 'notifList', false);
    }
  } catch(e) {}
}

async function loadSidebarNotifications() {
  const container = document.getElementById('sidebarNotifItems') || document.getElementById('sidebarNotifList');
  if (!container) return;
  try {
    const res = await API.get('/notifications', { limit: 3 });
    if (!res.success || !res.data.length) {
      container.innerHTML = '<div style="padding:12px;text-align:center;color:#9ca3af;font-size:12px">No notifications yet</div>';
      return;
    }
    const typeColors = {
      challenge_resolved: 'green',
      challenge_status_update: 'blue',
      challenge_assigned: 'blue',
      feedback_received: 'orange',
      welcome: 'green',
    };
    const typeIcons = {
      welcome: '🎉', challenge_submitted: '📋', challenge_status_update: '🔄',
      challenge_assigned: '🏛️', challenge_resolved: '✅', feedback_received: '⭐',
      new_notification: '🔔'
    };
    container.innerHTML = res.data.slice(0, 3).map(n => `
      <div class="notif-item">
        <div class="notif-dot-icon ${typeColors[n.type] || 'blue'}">${typeIcons[n.type] || '🔔'}</div>
        <div class="notif-item-content">
          <div class="notif-item-title">${n.title || 'Notification'}</div>
          <div class="notif-item-msg">${n.message || ''}</div>
          <div class="notif-item-time">${Utils.timeAgo(n.createdAt)}</div>
        </div>
      </div>`).join('');
  } catch(e) {
    container.innerHTML = '<div style="padding:12px;text-align:center;color:#9ca3af;font-size:12px">Could not load notifications</div>';
  }
}


async function loadAllNotifications() {
  const container = document.getElementById('allNotifsList');
  container.innerHTML = '<div class="skeleton skeleton-card" style="height:70px;margin-bottom:10px"></div>'.repeat(5);
  try {
    const res = await API.get('/notifications', { limit: 20 });
    if (res.success) {
      renderNotifList(res.data, 'allNotifsList', true);
      NotifManager.count = 0;
      NotifManager.updateBadge();
    }
  } catch(e) {}
}

function renderNotifList(notifs, containerId, full = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!notifs.length) {
    container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--gray-400)">No notifications yet</div>';
    return;
  }

  const typeIcons = {
    welcome: '🎉', challenge_submitted: '📋', challenge_status_update: '🔄',
    challenge_assigned: '🏛️', challenge_resolved: '✅', feedback_received: '⭐',
    new_notification: '🔔'
  };

  container.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.isRead ? '' : 'unread'}" onclick="markNotifRead('${n._id}', this)">
      <div style="width:32px;height:32px;border-radius:50%;background:${n.isRead?'var(--gray-100)':'var(--primary-50)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px">${typeIcons[n.type] || '🔔'}</div>
      <div class="notif-item-content">
        <div class="notif-item-title">${n.title}</div>
        <div class="notif-item-msg">${n.message}</div>
        <div class="notif-item-time">${Utils.timeAgo(n.createdAt)}</div>
      </div>
      ${!n.isRead ? '<div style="width:8px;height:8px;border-radius:50%;background:var(--primary);flex-shrink:0"></div>' : ''}
    </div>`).join('');
}

async function markNotifRead(id, el) {
  try {
    el.classList.remove('unread');
    el.querySelector('[style*="border-radius:50%"]')?.remove?.();
    await API.put(`/notifications/${id}/read`);
    if (NotifManager.count > 0) { NotifManager.count--; NotifManager.updateBadge(); }
  } catch(e) {}
}

window.markAllRead = async () => {
  try {
    await API.put('/notifications/read-all');
    document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
    NotifManager.count = 0;
    NotifManager.updateBadge();
    Toast.success('Done', 'All notifications marked as read');
  } catch(e) {}
};

function toggleNotifPanel() {
  const p = document.getElementById('notifPanel');
  if (!p) return;
  // Support both class-based (old) and style-based (new) toggle
  if (p.classList.contains('open')) {
    p.classList.remove('open');
    p.style.display = 'none';
  } else {
    p.classList.add('open');
    p.style.display = 'block';
    loadNotifications();
  }
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('#notifBtn') && !e.target.closest('#notifPanel')) {
    const p = document.getElementById('notifPanel');
    if (p) { p.classList.remove('open'); p.style.display = 'none'; }
  }
});

// ── Charts ──
function initCharts() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toLocaleDateString('en-IN', { month: 'short' }));
  }

  const monthCounts = months.map((_, i) => {
    const targetMonth = new Date(now.getFullYear(), now.getMonth() - (5-i), 1);
    return myChallenges.filter(c => {
      const d = new Date(c.createdAt);
      return d.getMonth() === targetMonth.getMonth() && d.getFullYear() === targetMonth.getFullYear();
    }).length;
  });

  const ctx1 = document.getElementById('activityChart')?.getContext('2d');
  if (ctx1) {
    activityChart = new Chart(ctx1, {
      type: 'line',
      data: {
        labels: months,
        datasets: [{
          label: 'Challenges',
          data: monthCounts,
          fill: true,
          backgroundColor: 'rgba(26,86,219,0.08)',
          borderColor: '#1a56db',
          borderWidth: 2.5,
          pointBackgroundColor: '#1a56db',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 12 }, color: '#9ca3af' } },
          y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'Inter', size: 12 }, color: '#9ca3af' }, grid: { color: 'rgba(0,0,0,0.04)' } }
        }
      }
    });
  }

  // Category distribution donut chart
  const catCount = {};
  myChallenges.forEach(c => { catCount[c.category] = (catCount[c.category] || 0) + 1; });
  const catLabels = Object.keys(catCount);
  const catData = Object.values(catCount);
  const catColors = ['#1a56db','#d97706','#059669','#7c3aed','#ef4444','#06b6d4','#f59e0b','#8b5cf6','#10b981','#3b82f6'];

  const ctx2 = document.getElementById('categoryChart')?.getContext('2d');
  if (ctx2 && catLabels.length > 0) {
    categoryChart = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: catLabels,
        datasets: [{
          data: catData,
          backgroundColor: catColors.slice(0, catLabels.length),
          borderWidth: 2,
          borderColor: 'white',
          hoverBorderColor: 'white',
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 12 }, padding: 12, boxWidth: 12 } }
        },
        cutout: '60%'
      }
    });
  } else if (ctx2) {
    ctx2.canvas.parentElement.innerHTML = `<div class="empty-state" style="padding:40px"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg></div><div class="empty-title">No data yet</div><div class="empty-desc">Submit challenges to see distribution</div></div>`;
  }
}

window.updatePeriod = (btn, period) => {
  document.querySelectorAll('.chart-period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};

// ── Feedback Modal ──
function openFeedbackModal(challengeId) {
  currentFeedbackChallengeId = challengeId;
  document.getElementById('ratingValue').value = '0';
  document.getElementById('reviewText').value = '';
  document.querySelectorAll('.star-btn').forEach(s => s.style.color = 'var(--gray-300)');
  openModal('feedbackModal');
}

window.setRating = (rating) => {
  document.getElementById('ratingValue').value = rating;
  document.querySelectorAll('.star-btn').forEach((s, i) => {
    s.style.color = i < rating ? 'var(--warning)' : 'var(--gray-300)';
  });
};

window.submitFeedback = async () => {
  const rating = parseInt(document.getElementById('ratingValue').value);
  const review = document.getElementById('reviewText').value;
  if (!rating) { Toast.warning('Rate first', 'Please select a rating'); return; }
  try {
    await API.post(`/challenges/${currentFeedbackChallengeId}/feedback`, { rating, review });
    Toast.success('Thank you!', 'Your feedback has been submitted.');
    closeModal('feedbackModal');
    loadMyChallenges();
  } catch(e) {
    Toast.error('Error', e.message);
  }
};

// ── Profile Form ──
function initProfileForm() {
  const form = document.getElementById('profileForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const res = await API.put('/auth/profile', {
        name: document.getElementById('pfName').value,
        phone: document.getElementById('pfPhone').value,
        address: { city: document.getElementById('pfCity').value, district: document.getElementById('pfDistrict').value }
      });
      if (res.success) {
        Auth.setAuth(Auth.getToken(), res.user);
        Toast.success('Profile Updated', 'Your changes have been saved.');
        currentUser = res.user;
        initUI();
      }
    } catch(e) { Toast.error('Error', e.message); }
  });
}

// ── Modal helpers ──
function openModal(id) { document.getElementById(id).classList.add('open'); }
window.closeModal = (id) => { document.getElementById(id).classList.remove('open'); };

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });
});

// ── Helpers ──
function clearSubmitErrors() {
  document.querySelectorAll('.form-error').forEach(el => el.style.display = 'none');
  document.getElementById('submitAlert').style.display = 'none';
}

function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'flex'; }
}

// ── Logout ──
window.logout = () => {
  Confirm.show({
    title: 'Logout',
    message: 'Are you sure you want to logout?',
    confirmText: 'Logout',
    type: 'warning',
    onConfirm: () => {
      Auth.clearAuth();
      window.location.replace('/login.html');
    }
  });
};

// ── Description expand/collapse ──
window.toggleDashDesc = (id) => {
  const el = document.getElementById(`dfc-desc-${id}`);
  if (el) {
    el.classList.toggle('expanded');
    const btn = el.parentElement.querySelector('.dfc-read-more-btn');
    if (btn) btn.textContent = el.classList.contains('expanded') ? 'Show less' : 'Read more';
  }
};

// ── Dashboard Support Toggle ──
window.handleDashSupport = async (challengeId, btn) => {

  const token = Auth.getToken();
  if (!token) { Toast.warning('Login required', 'Please login to support'); return; }

  try {
    const res = await API.post(`/challenges/${challengeId}/support`);
    if (res.success) {
      const countEl = btn.querySelector('.dfc-sup-count');
      if (countEl) countEl.textContent = res.data.supportCount;

      if (res.data.supported) {
        btn.classList.add('supported');
        btn.querySelector('svg').setAttribute('fill', '#dc2626');
        btn.querySelector('svg').setAttribute('stroke', '#dc2626');
        Toast.success('Supported!', 'You supported this challenge.');
      } else {
        btn.classList.remove('supported');
        btn.querySelector('svg').setAttribute('fill', 'none');
        btn.querySelector('svg').setAttribute('stroke', 'currentColor');
      }
    }
  } catch(e) {
    Toast.error('Error', e.message || 'Failed to update support');
  }
};

// ── Dashboard Share Handler ──
window.handleDashShare = (challengeId) => {
  const card = document.getElementById(`dfc-${challengeId}`);
  const title = card?.querySelector('.dfc-title')?.textContent || 'Challenge on InnovateSphere';
  const url = `${window.location.origin}/?c=${challengeId}`;
  if (navigator.share) {
    navigator.share({ title: title, url: url }).catch(() => Utils.copyToClipboard(url));
  } else {
    Utils.copyToClipboard(url);
    Toast.success('Copied!', 'Challenge link copied to clipboard.');
  }
};

// ── Dashboard Comment Drawer ──
let dashOpenChallengeId = null;

window.openDashComments = async (challengeId) => {
  dashOpenChallengeId = challengeId;
  const card = document.getElementById(`dfc-${challengeId}`);
  const title = card?.querySelector('.dfc-title')?.textContent || 'Challenge Discussion';
  const count = card?.querySelector('.dfc-cmt-count')?.textContent || '0';

  const titleEl = document.getElementById('dashCommentTitle');
  const countEl = document.getElementById('dashCommentCount');
  if (titleEl) titleEl.textContent = title;
  if (countEl) countEl.textContent = count;

  const overlay = document.getElementById('dashCommentOverlay');
  const drawer = document.getElementById('dashCommentDrawer');
  if (overlay) overlay.classList.add('open');
  if (drawer) drawer.classList.add('open');
  document.body.style.overflow = 'hidden';

  const userAv = document.getElementById('dashCommentUserAv');
  if (userAv && currentUser) userAv.textContent = Utils.generateInitials(currentUser.name);

  loadDashComments(challengeId);
};


window.closeDashComments = () => {
  dashOpenChallengeId = null;
  document.getElementById('dashCommentOverlay').classList.remove('open');
  document.getElementById('dashCommentDrawer').classList.remove('open');
  document.body.style.overflow = '';
};

async function loadDashComments(challengeId) {
  const list = document.getElementById('dashCommentsList');
  list.innerHTML = '<div class="hcd-loading"><div class="spin-ring"></div></div>';

  try {
    const res = await API.get(`/challenges/${challengeId}/comments?limit=50`);
    list.innerHTML = '';
    if (!res.success || !res.data.length) {
      list.innerHTML = '<div class="hcd-no-comments">No comments yet. Share your thoughts!</div>';
      return;
    }

    res.data.forEach(c => {
      list.appendChild(createDashCommentEl(c, challengeId));
    });
  } catch(e) {
    list.innerHTML = '<div class="hcd-no-comments" style="color:#dc2626">Failed to load comments.</div>';
  }
}

function createDashCommentEl(c, challengeId) {
  const el = document.createElement('div');
  el.className = 'hcd-comment-item';
  if (c.isDeleted) {
    el.innerHTML = `<div class="hcd-comment-av">—</div><div class="hcd-comment-body"><em style="color:#94a3b8;font-size:12px">[Comment deleted]</em></div>`;
    return el;
  }
  const name = c.author?.name || 'Anonymous';
  const isOwn = currentUser && c.author?._id === currentUser._id;

  let repliesHtml = '';
  if (c.replies?.length) {
    repliesHtml = `<div class="hcd-replies">` +
      c.replies.map(r => {
        if (r.isDeleted) return '';
        const rn = r.author?.name || 'Anonymous';
        return `<div class="hcd-comment-item">
          <div class="hcd-comment-av" style="width:24px;height:24px;font-size:11px">${rn.charAt(0)}</div>
          <div class="hcd-comment-body">
            <span class="hcd-comment-name">${Utils.escapeHtml(rn)}</span><span class="hcd-comment-time">${Utils.timeAgo(r.createdAt)}</span>
            <p class="hcd-comment-text">${Utils.escapeHtml(r.text)}</p>
          </div>
        </div>`;
      }).join('') + `</div>`;
  }

  el.innerHTML = `
    <div class="hcd-comment-av">${name.charAt(0).toUpperCase()}</div>
    <div class="hcd-comment-body" style="flex:1">
      <span class="hcd-comment-name">${Utils.escapeHtml(name)}</span>
      <span class="hcd-comment-time">${Utils.timeAgo(c.createdAt)}</span>
      <p class="hcd-comment-text">${Utils.escapeHtml(c.text)}</p>
      <div class="hcd-comment-actions">
        <button class="hcd-comment-action" onclick="toggleDashReply('${c._id}', '${challengeId}')">Reply</button>
        ${isOwn ? `<button class="hcd-comment-action" onclick="deleteDashComment('${c._id}', '${challengeId}')" style="color:#dc2626">Delete</button>` : ''}
      </div>
      <div id="dash-reply-area-${c._id}"></div>
      ${repliesHtml}
    </div>
  `;
  return el;
}

window.toggleDashReply = (commentId, challengeId) => {
  const area = document.getElementById(`dash-reply-area-${commentId}`);
  if (!area) return;
  if (area.innerHTML) { area.innerHTML = ''; return; }

  area.innerHTML = `
    <div class="hcd-reply-wrap">
      <textarea class="hcd-reply-input" id="reply-input-${commentId}" placeholder="Write a reply..." rows="2"></textarea>
      <button class="hcd-reply-btn" onclick="submitDashReply('${commentId}', '${challengeId}')">Reply</button>
    </div>
  `;
  document.getElementById(`reply-input-${commentId}`)?.focus();
};

window.submitDashReply = async (parentId, challengeId) => {
  const input = document.getElementById(`reply-input-${parentId}`);
  const text = input?.value.trim();
  if (!text) return;

  try {
    const res = await API.post(`/challenges/${challengeId}/comments`, { text, parentCommentId: parentId });
    if (res.success) {
      Toast.success('Reply posted', 'Your reply has been added.');
      loadDashComments(challengeId);
    }
  } catch(e) {
    Toast.error('Error', e.message);
  }
};

window.postDashComment = async () => {
  if (!dashOpenChallengeId) return;
  const textarea = document.getElementById('dashCommentText');
  const text = textarea?.value.trim();
  if (!text) { Toast.warning('Empty comment', 'Please type a comment'); return; }

  const btn = document.getElementById('dashPostCommentBtn');
  btn.disabled = true;
  btn.textContent = 'Posting...';

  try {
    const res = await API.post(`/challenges/${dashOpenChallengeId}/comments`, { text });
    if (res.success) {
      textarea.value = '';
      Toast.success('Comment posted', 'Your comment has been added.');
      loadDashComments(dashOpenChallengeId);

      // Update card counter
      const card = document.getElementById(`dfc-${dashOpenChallengeId}`);
      if (card) {
        const cmtEl = card.querySelector('.dfc-cmt-count');
        if (cmtEl) cmtEl.textContent = parseInt(cmtEl.textContent || '0') + 1;
      }
    }
  } catch(e) {
    Toast.error('Error', e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Post Comment';
  }
};

window.deleteDashComment = async (commentId, challengeId) => {
  Confirm.show({
    title: 'Delete Comment',
    message: 'Are you sure you want to delete this comment?',
    confirmText: 'Delete',
    type: 'danger',
    onConfirm: async () => {
      try {
        const res = await API.delete(`/comments/${commentId}`);
        if (res.success) {
          Toast.success('Deleted', 'Comment deleted.');
          loadDashComments(challengeId);
        }
      } catch(e) {
        Toast.error('Error', e.message);
      }
    }
  });
};

// ── Dashboard Lightbox ──
let dashLbImgs = [];
let dashLbIdx = 0;

window.openDashLightbox = (target, idx = 0) => {
  if (typeof target === 'string' && window.DASH_FEED_GALLERIES && window.DASH_FEED_GALLERIES[target]) {
    dashLbImgs = window.DASH_FEED_GALLERIES[target];
  } else if (Array.isArray(target)) {
    dashLbImgs = target;
  } else if (typeof target === 'string' && target.startsWith('http')) {
    dashLbImgs = [target];
  } else {
    try { dashLbImgs = JSON.parse(target); } catch(e) { dashLbImgs = []; }
  }

  if (!dashLbImgs || !dashLbImgs.length) return;

  dashLbIdx = Math.max(0, Math.min(idx, dashLbImgs.length - 1));
  renderDashLightbox();
  const lb = document.getElementById('dashLightbox');
  if (lb) {
    lb.classList.add('open');
    lb.style.display = 'flex';
  }
  document.body.style.overflow = 'hidden';
};

window.closeDashLightbox = () => {
  const lb = document.getElementById('dashLightbox');
  if (lb) {
    lb.classList.remove('open');
    lb.style.display = 'none';
  }
  document.body.style.overflow = '';
};

window.navDashLightbox = (dir, e) => {
  if (e && e.stopPropagation) e.stopPropagation();
  if (!dashLbImgs || !dashLbImgs.length) return;
  dashLbIdx = (dashLbIdx + dir + dashLbImgs.length) % dashLbImgs.length;
  renderDashLightbox();
};

function renderDashLightbox() {
  const content = document.getElementById('dashLightboxContent');
  const counter = document.getElementById('dashLightboxCounter');
  if (content && dashLbImgs[dashLbIdx]) {
    content.innerHTML = `<img src="${dashLbImgs[dashLbIdx]}" alt="Evidence photo" style="max-width:90vw;max-height:85vh;border-radius:12px;object-fit:contain;box-shadow:0 10px 40px rgba(0,0,0,0.5)">`;
  }
  if (counter) {
    counter.textContent = `${dashLbIdx + 1} / ${dashLbImgs.length}`;
  }
}


