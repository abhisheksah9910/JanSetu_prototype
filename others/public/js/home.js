/* =============================================
   HOME.JS — Feed Logic for Landing Page
   InnovateSphere India Platform
   ============================================= */

(function() {
  'use strict';

  // ── STATE ──
  let page = 1;
  let totalPages = 1;
  let loading = false;
  let currentUser = null;
  let sort = 'recent';
  let filters = { state: '', category: '', status: '' };
  let openChallengeId = null;
  let lbImages = [], lbIdx = 0;
  let searchTimer = null;

  // ── HIGH-QUALITY INDIA IMAGE POOL ──
  // These are real Unsplash images relevant to India & civic themes
  const INDIA_IMAGES = [
    'https://images.unsplash.com/photo-1599930113854-d6d7fd521f10?w=800&q=75&auto=format&fit=crop', // water supply india
    'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=800&q=75&auto=format&fit=crop', // india rural road
    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=75&auto=format&fit=crop', // india village women
    'https://images.unsplash.com/photo-1605300060680-72f22e77017c?w=800&q=75&auto=format&fit=crop', // india farmer
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=75&auto=format&fit=crop', // india city traffic
    'https://images.unsplash.com/photo-1608234808654-2a8875faa7fd?w=800&q=75&auto=format&fit=crop', // india school classroom
    'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&q=75&auto=format&fit=crop', // india landmark
    'https://images.unsplash.com/photo-1532375810709-75b1da00537c?w=800&q=75&auto=format&fit=crop', // india people community
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=75&auto=format&fit=crop', // india mountains
    'https://images.unsplash.com/photo-1602496065013-a03f43977b0e?w=800&q=75&auto=format&fit=crop', // india healthcare
    'https://images.unsplash.com/photo-1546961342-ea5f62d4d81b?w=800&q=75&auto=format&fit=crop', // india sanitation
    'https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=800&q=75&auto=format&fit=crop', // india electricity solar
    'https://images.unsplash.com/photo-1519222970733-f546218fa6d7?w=800&q=75&auto=format&fit=crop', // india community meeting
    'https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=800&q=75&auto=format&fit=crop', // india forest environment
    'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=75&auto=format&fit=crop', // india crop agriculture
  ];

  // Category → emoji + color
  const CAT_META = {
    'Education': { emoji: '📚', color: '#dbeafe', icon: '🎓' },
    'Healthcare': { emoji: '🏥', color: '#fce7f3', icon: '💊' },
    'Agriculture': { emoji: '🌾', color: '#d1fae5', icon: '🌿' },
    'Water Management': { emoji: '💧', color: '#cffafe', icon: '🚰' },
    'Sanitation & Environment': { emoji: '♻️', color: '#dcfce7', icon: '🌍' },
    'Rural Livelihoods': { emoji: '🏘️', color: '#fef3c7', icon: '🌻' },
    'Urban Infrastructure': { emoji: '🏗️', color: '#e0e7ff', icon: '🏙️' },
    'Energy & Technology': { emoji: '⚡', color: '#fef9c3', icon: '🔋' },
    'Accessibility': { emoji: '♿', color: '#f3e8ff', icon: '🦽' },
    'Public Administration': { emoji: '🏛️', color: '#f0f9ff', icon: '📋' },
  };

  // ── INIT ──
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    await checkAuth();
    setupNav();
    setupSidebar();
    setupTabs();
    setupFilters();
    setupSearch();
    setupCommentDrawer();
    setupLightbox();
    loadFeed(true);
    loadRightSidebar();
  }

  // ── AUTH ──
  async function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        currentUser = d.data;
        updateUIForUser();
      } else {
        localStorage.removeItem('token');
      }
    } catch (e) {}
  }

  function updateUIForUser() {
    if (!currentUser) return;
    const roleMap = { admin: 'admin', university_rep: 'university', industry_rep: 'industry', citizen: 'citizen' };
    const dashUrl = `/dashboard/${roleMap[currentUser.role] || 'citizen'}`;
    const initial = currentUser.name.charAt(0).toUpperCase();

    // Top nav user area
    const navArea = document.getElementById('nav-user-area');
    if (navArea) {
      navArea.innerHTML = `
        <a href="${dashUrl}" class="nav-user-chip" style="text-decoration:none">
          <div class="nav-user-av">${initial}</div>
          <span class="nav-user-name">${currentUser.name.split(' ')[0]}</span>
        </a>
      `;
    }

    // Sidebar user
    const sbUser = document.getElementById('sidebar-user');
    if (sbUser) {
      sbUser.style.display = 'flex';
      document.getElementById('sidebar-user-av').textContent = initial;
      document.getElementById('sidebar-user-name').textContent = currentUser.name;
      document.getElementById('sidebar-user-role').textContent = currentUser.role.replace('_', ' ');
    }

    // Dashboard link
    const slDash = document.getElementById('sl-dashboard');
    if (slDash) slDash.href = dashUrl;
    const slReports = document.getElementById('sl-reports');
    if (slReports) slReports.href = dashUrl;
    const slNotifs = document.getElementById('sl-notifs');
    if (slNotifs) slNotifs.href = dashUrl;

    // Comment area
    const inputArea = document.getElementById('hcd-input-area');
    const loginPrompt = document.getElementById('hcd-login-prompt');
    if (inputArea) inputArea.style.display = 'block';
    if (loginPrompt) loginPrompt.style.display = 'none';
    const av = document.getElementById('hcd-user-av');
    if (av) av.textContent = initial;

    // Logout
    const logoutBtn = document.getElementById('sidebar-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.reload();
      });
    }

    // Notifications
    loadNotifCount();
  }

  async function loadNotifCount() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('/api/notifications/unread-count', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const d = await res.json();
      const count = d.data?.count || 0;
      if (count > 0) {
        const badge = document.getElementById('notif-count');
        if (badge) { badge.textContent = count; badge.style.display = 'flex'; }
        const sb = document.getElementById('sb-notif');
        if (sb) { sb.textContent = count; sb.style.display = 'inline'; }
      }
    } catch (e) {}
  }

  // ── NAV ──
  function setupNav() {
    if (!currentUser) {
      const inputArea = document.getElementById('hcd-input-area');
      const loginPrompt = document.getElementById('hcd-login-prompt');
      if (inputArea) inputArea.style.display = 'none';
      if (loginPrompt) loginPrompt.style.display = 'block';
    }
  }

  // ── SIDEBAR TOGGLE ──
  function setupSidebar() {
    const toggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('left-sidebar');
    if (toggle && sidebar) {
      toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    }
  }

  // ── TABS ──
  function setupTabs() {
    document.querySelectorAll('.feed-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.feed-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        sort = tab.dataset.sort || 'recent';
        reloadFeed();
      });
    });
  }

  // ── FILTERS ──
  function setupFilters() {
    const filterToggle = document.getElementById('filter-toggle-btn');
    const filterPanel = document.getElementById('feed-filters-panel');
    if (filterToggle && filterPanel) {
      filterToggle.addEventListener('click', () => {
        filterPanel.style.display = filterPanel.style.display === 'none' ? 'flex' : 'none';
      });
    }

    document.getElementById('fp-state')?.addEventListener('change', e => { filters.state = e.target.value; reloadFeed(); });
    document.getElementById('fp-category')?.addEventListener('change', e => { filters.category = e.target.value; reloadFeed(); });
    document.getElementById('fp-status')?.addEventListener('change', e => { filters.status = e.target.value; reloadFeed(); });
    document.getElementById('fp-reset')?.addEventListener('click', () => {
      filters = { state: '', category: '', status: '' };
      document.getElementById('fp-state').value = '';
      document.getElementById('fp-category').value = '';
      document.getElementById('fp-status').value = '';
      reloadFeed();
    });

    document.getElementById('btn-load-more-home')?.addEventListener('click', () => loadFeed(false));
  }

  // ── SEARCH ──
  function setupSearch() {
    document.getElementById('global-search')?.addEventListener('input', e => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        filters.search = e.target.value;
        reloadFeed();
      }, 400);
    });
  }

  // ── RELOAD FEED ──
  function reloadFeed() {
    page = 1;
    totalPages = 1;
    loadFeed(true);
  }

  // ── LOAD FEED ──
  async function loadFeed(reset = false) {
    if (loading) return;
    loading = true;

    const spinner = document.getElementById('home-spinner');
    const btnMore = document.getElementById('btn-load-more-home');
    const endMsg = document.getElementById('home-feed-end');

    if (reset) {
      document.getElementById('home-feed-cards').innerHTML = `
        <div class="hfc-skeleton"></div>
        <div class="hfc-skeleton"></div>
        <div class="hfc-skeleton"></div>
      `;
    } else {
      spinner.style.display = 'flex';
      btnMore.style.display = 'none';
    }

    const params = new URLSearchParams({ page, limit: 8, sort });
    if (filters.state) params.set('state', filters.state);
    if (filters.category) params.set('category', filters.category);
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);

    try {
      const res = await fetch(`/api/challenges/feed?${params}`);
      const data = await res.json();

      spinner.style.display = 'none';

      if (!data.success) throw new Error(data.message);

      totalPages = data.pagination.pages;

      if (reset) document.getElementById('home-feed-cards').innerHTML = '';

      if (reset && data.data.length === 0) {
        document.getElementById('home-feed-cards').innerHTML = `
          <div style="text-align:center;padding:4rem 2rem;color:#94a3b8;background:#fff;border-radius:20px;border:1px solid #e2e8f0">
            <div style="font-size:2.5rem;margin-bottom:.75rem">🔍</div>
            <p style="font-size:1rem;font-weight:700;color:#64748b;margin-bottom:.4rem">No challenges found</p>
            <p style="font-size:.85rem">Try adjusting your filters or search</p>
          </div>
        `;
        return;
      }

      data.data.forEach((c, i) => {
        const card = createCard(c);
        card.style.animationDelay = `${i * 60}ms`;
        document.getElementById('home-feed-cards').appendChild(card);
      });

      page++;

      if (page <= totalPages) {
        btnMore.style.display = 'inline-flex';
        endMsg.style.display = 'none';
      } else {
        btnMore.style.display = 'none';
        if (!reset) endMsg.style.display = 'flex';
      }
    } catch (e) {
      spinner.style.display = 'none';
      if (reset) document.getElementById('home-feed-cards').innerHTML = `
        <div style="text-align:center;padding:2rem;color:#dc2626;background:#fff;border-radius:20px;border:1px solid #fecaca">
          <p style="font-weight:600">Failed to load feed</p>
          <button onclick="location.reload()" style="margin-top:.5rem;padding:.4rem 1rem;background:#1a56db;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.8rem">Retry</button>
        </div>
      `;
    } finally {
      loading = false;
    }
  }

  // ── CREATE CARD ──
  function createCard(challenge) {
    const el = document.createElement('div');
    el.className = 'hfc';
    el.id = `hfc-${challenge._id}`;

    const authorName = challenge.submittedBy?.name || challenge.submitterContact?.name || 'Anonymous';
    const initial = authorName.charAt(0).toUpperCase();
    const loc = challenge.location || {};
    const locStr = [loc.district, loc.state].filter(Boolean).join(', ') || 'India';
    const catMeta = CAT_META[challenge.category] || { emoji: '📋', color: '#f1f5f9', icon: '📌' };
    const timeAgo = fmtTime(challenge.createdAt);
    const priClass = challenge.priority || 'medium';
    const statusClass = `status-${challenge.status}`;
    const statusLabel = (challenge.status || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const supported = currentUser && Array.isArray(challenge.supports) && challenge.supports.includes(currentUser._id);

    // Get real images from attachments or fallback to India stock
    const imgs = (challenge.attachments || [])
      .filter(a => a.mimetype && a.mimetype.startsWith('image/'))
      .map(a => a.url || `/uploads/${a.filename}`);

    // If no real images, assign India stock images deterministically based on challenge ID
    const stockImg = INDIA_IMAGES[parseInt(challenge._id?.slice(-3) || '0', 16) % INDIA_IMAGES.length];
    const displayImgs = imgs.length > 0 ? imgs : [stockImg];

    // Build gallery
    const galleryHtml = buildGallery(displayImgs, challenge._id);

    // University note
    const uniNote = challenge.assignedUniversity
      ? `<div class="hfc-uni-note">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m2 7 10-5 10 5-10 5z"/><path d="M6 9.5v5a6 6 0 0 0 12 0v-5"/></svg>
          Being solved by ${challenge.assignedUniversity.shortName || challenge.assignedUniversity.name}
        </div>`
      : '';

    const verBadge = challenge.status === 'resolved'
      ? `<span class="hfc-verify-badge">✓ Verified & Resolved</span>`
      : challenge.status === 'submitted'
      ? `<span class="hfc-pending-badge">⏳ Pending Verification</span>`
      : '';

    el.innerHTML = `
      <div class="hfc-header">
        <div class="hfc-author">
          <div class="hfc-av">${initial}</div>
          <div>
            <div class="hfc-author-name">
              ${esc(authorName)}
              ${challenge.supportCount > 50 ? '<span class="hfc-top-supporter">⭐ Top Reporter</span>' : ''}
            </div>
            <div class="hfc-author-loc">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${esc(locStr)}
            </div>
          </div>
        </div>
        <div class="hfc-meta-right">
          <span class="hfc-time">${timeAgo}</span>
          <div class="hfc-badges">
            <span class="hfc-badge ${statusClass}">${statusLabel}</span>
          </div>
        </div>
      </div>

      <div class="hfc-body">
        <div class="hfc-cat-row">
          <span class="hfc-cat-chip" style="background:${catMeta.color}">
            ${catMeta.emoji} ${esc(challenge.category)}
          </span>
          <span class="hfc-badge ${priClass}">${priClass.charAt(0).toUpperCase() + priClass.slice(1)}</span>
        </div>
        <h2 class="hfc-title" data-id="${challenge._id}">${esc(challenge.title)}</h2>
        <p class="hfc-desc" id="desc-${challenge._id}">${esc(challenge.description)}</p>
        <button class="hfc-read-more" data-id="${challenge._id}">Read more</button>
        <div class="hfc-loc-row">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${esc(locStr)}
          ${verBadge}
        </div>
        ${uniNote}
      </div>

      ${galleryHtml}

      <div class="hfc-footer">
        <div class="hfc-actions">
          <button class="hfc-action-btn hfc-btn-support ${supported ? 'supported' : ''}" data-id="${challenge._id}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="${supported ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span class="sup-count">${fmtNum(challenge.supportCount || 0)}</span> Supports
          </button>
          <button class="hfc-action-btn hfc-btn-comment" data-id="${challenge._id}" data-title="${esc(challenge.title)}" data-count="${challenge.commentCount || 0}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span class="cmt-count">${fmtNum(challenge.commentCount || 0)}</span> Comments
          </button>
          <button class="hfc-action-btn hfc-btn-share" data-id="${challenge._id}" data-title="${esc(challenge.title)}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Share
          </button>
        </div>
        <button class="hfc-view-detail" data-id="${challenge._id}">View Details →</button>
      </div>
    `;

    // Attach events
    el.querySelector('.hfc-title').addEventListener('click', () => goToDetail(challenge._id));
    el.querySelector('.hfc-view-detail').addEventListener('click', () => goToDetail(challenge._id));
    el.querySelector('.hfc-read-more').addEventListener('click', function() {
      const desc = el.querySelector(`#desc-${challenge._id}`);
      const exp = desc.classList.toggle('expanded');
      this.textContent = exp ? 'Show less' : 'Read more';
    });
    el.querySelector('.hfc-btn-support').addEventListener('click', () => handleSupport(challenge._id, el));
    el.querySelector('.hfc-btn-comment').addEventListener('click', () => openCommentDrawer(challenge._id, challenge.title, challenge.commentCount || 0));
    el.querySelector('.hfc-btn-share').addEventListener('click', () => handleShare(challenge));

    // Gallery lightbox
    setTimeout(() => {
      el.querySelectorAll('[data-lb-imgs]').forEach(wrap => {
        wrap.addEventListener('click', () => {
          const imgs = JSON.parse(wrap.dataset.lbImgs);
          const idx = parseInt(wrap.dataset.lbIdx || '0');
          openLightbox(imgs, idx);
        });
      });
    }, 0);

    return el;
  }

  // ── BUILD GALLERY ──
  function buildGallery(imgs, id) {
    if (!imgs || imgs.length === 0) return '';

    const allUrls = JSON.stringify(imgs);
    let inner = '';

    if (imgs.length === 1) {
      inner = `<div class="hfc-img-single" data-lb-imgs='${allUrls}' data-lb-idx="0">
        <img src="${imgs[0]}" alt="Report evidence" loading="lazy" />
      </div>`;
      return `<div class="hfc-gallery">${inner}</div>`;
    }

    if (imgs.length === 2) {
      inner = `<div class="hfc-img-two">
        ${imgs.map((url, i) => `
          <div class="hfc-img-cell" data-lb-imgs='${allUrls}' data-lb-idx="${i}">
            <img src="${url}" alt="Evidence ${i+1}" loading="lazy" />
          </div>
        `).join('')}
      </div>`;
      return `<div class="hfc-gallery">${inner}</div>`;
    }

    // 3+ images: big left + 2 stacked right
    const moreCount = imgs.length - 3;
    inner = `<div class="hfc-img-three">
      <div class="hfc-img-cell" data-lb-imgs='${allUrls}' data-lb-idx="0">
        <img src="${imgs[0]}" alt="Evidence 1" loading="lazy" />
      </div>
      <div class="hfc-img-cell" data-lb-imgs='${allUrls}' data-lb-idx="1">
        <img src="${imgs[1]}" alt="Evidence 2" loading="lazy" />
      </div>
      <div class="hfc-img-cell" data-lb-imgs='${allUrls}' data-lb-idx="2" style="position:relative">
        <img src="${imgs[2]}" alt="Evidence 3" loading="lazy" />
        ${moreCount > 0 ? `<div class="hfc-img-more-overlay">+${moreCount} more</div>` : ''}
      </div>
    </div>`;
    return `<div class="hfc-gallery">${inner}</div>`;
  }

  function goToDetail(id) {
    if (currentUser) {
      const roleMap = { admin: 'admin', university_rep: 'university', industry_rep: 'industry', citizen: 'citizen' };
      window.location.href = `/dashboard/${roleMap[currentUser.role] || 'citizen'}?challenge=${id}`;
    } else {
      window.location.href = `/login?next=/`;
    }
  }

  // ── SUPPORT ──
  async function handleSupport(id, card) {
    const token = localStorage.getItem('token');
    if (!token) { showToast('Login to support this challenge', 'error'); return; }

    const btn = card.querySelector('.hfc-btn-support');
    try {
      const res = await fetch(`/api/challenges/${id}/support`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      const countEl = btn.querySelector('.sup-count');
      if (countEl) countEl.textContent = fmtNum(data.data.supportCount);

      if (data.data.supported) {
        btn.classList.add('supported');
        btn.querySelector('svg').setAttribute('fill', 'currentColor');
      } else {
        btn.classList.remove('supported');
        btn.querySelector('svg').setAttribute('fill', 'none');
      }
    } catch (e) {
      showToast(e.message || 'Failed to support', 'error');
    }
  }

  // ── SHARE ──
  function handleShare(challenge) {
    const url = `${window.location.origin}/?c=${challenge._id}`;
    if (navigator.share) {
      navigator.share({ title: challenge.title, url }).catch(() => copyLink(url));
    } else {
      copyLink(url);
    }
  }
  function copyLink(url) {
    navigator.clipboard.writeText(url).then(() => showToast('Link copied!', 'success'));
  }

  // ── COMMENT DRAWER ──
  function setupCommentDrawer() {
    document.getElementById('hcd-close')?.addEventListener('click', closeDrawer);
    document.getElementById('hco')?.addEventListener('click', closeDrawer);

    const textarea = document.getElementById('hcd-text');
    textarea?.addEventListener('input', () => {
      document.getElementById('hcd-char').textContent = `${textarea.value.length}/1000`;
    });

    document.getElementById('hcd-post-btn')?.addEventListener('click', postComment);
  }

  function openCommentDrawer(id, title, count) {
    openChallengeId = id;
    document.getElementById('hcd-challenge-title').textContent = title;
    document.getElementById('hcd-count').textContent = count;
    document.getElementById('hco').classList.add('open');
    document.getElementById('hcd').classList.add('open');
    document.body.style.overflow = 'hidden';
    loadComments(id);
  }

  function closeDrawer() {
    openChallengeId = null;
    document.getElementById('hco').classList.remove('open');
    document.getElementById('hcd').classList.remove('open');
    document.body.style.overflow = '';
  }

  async function loadComments(id) {
    const list = document.getElementById('hcd-comments-list');
    list.innerHTML = '<div class="hcd-loading"><div class="spin-ring"></div></div>';
    try {
      const res = await fetch(`/api/challenges/${id}/comments?limit=50`);
      const data = await res.json();
      list.innerHTML = '';
      if (!data.success || data.data.length === 0) {
        list.innerHTML = '<div class="hcd-no-comments">No comments yet. Be the first!</div>';
        return;
      }
      data.data.forEach(c => list.appendChild(buildCommentEl(c, id)));
    } catch (e) {
      list.innerHTML = '<div class="hcd-no-comments" style="color:#dc2626">Failed to load comments.</div>';
    }
  }

  function buildCommentEl(c, challengeId) {
    const el = document.createElement('div');
    el.className = 'hcd-comment-item';
    if (c.isDeleted) {
      el.innerHTML = `<div class="hcd-comment-av">—</div><div class="hcd-comment-body"><em style="color:#94a3b8;font-size:.8rem">[Comment deleted]</em></div>`;
      return el;
    }
    const name = c.author?.name || 'Anonymous';
    const own = currentUser && c.author?._id === currentUser._id;
    let repliesHtml = '';
    if (c.replies?.length) {
      repliesHtml = `<div class="hcd-replies">` +
        c.replies.map(r => {
          if (r.isDeleted) return '';
          const rn = r.author?.name || 'Anonymous';
          return `<div class="hcd-comment-item">
            <div class="hcd-comment-av" style="width:24px;height:24px;font-size:.65rem">${rn.charAt(0)}</div>
            <div class="hcd-comment-body">
              <span class="hcd-comment-name">${esc(rn)}</span><span class="hcd-comment-time">${fmtTime(r.createdAt)}</span>
              <p class="hcd-comment-text">${esc(r.text)}</p>
            </div>
          </div>`;
        }).join('') +
      `</div>`;
    }

    el.innerHTML = `
      <div class="hcd-comment-av">${name.charAt(0).toUpperCase()}</div>
      <div class="hcd-comment-body" style="flex:1">
        <span class="hcd-comment-name">${esc(name)}</span>
        <span class="hcd-comment-time">${fmtTime(c.createdAt)}</span>
        <p class="hcd-comment-text">${esc(c.text)}</p>
        <div class="hcd-comment-actions">
          <button class="hcd-comment-action" data-reply="${c._id}">Reply</button>
          ${own ? `<button class="hcd-comment-action" data-delete="${c._id}" style="color:#dc2626">Delete</button>` : ''}
        </div>
        <div class="reply-area-${c._id}"></div>
        ${repliesHtml}
      </div>
    `;

    el.querySelector(`[data-reply="${c._id}"]`)?.addEventListener('click', () => toggleReply(c._id, challengeId));
    el.querySelector(`[data-delete="${c._id}"]`)?.addEventListener('click', () => deleteComment(c._id, challengeId));
    return el;
  }

  function toggleReply(commentId, challengeId) {
    const area = document.querySelector(`.reply-area-${commentId}`);
    if (!area) return;
    if (area.innerHTML) { area.innerHTML = ''; return; }
    if (!currentUser) { showToast('Login to reply', 'error'); return; }
    area.innerHTML = `
      <div class="hcd-reply-wrap">
        <textarea class="hcd-reply-input" placeholder="Write a reply..." rows="2"></textarea>
        <button class="hcd-reply-btn">Reply</button>
      </div>
    `;
    area.querySelector('.hcd-reply-btn').addEventListener('click', async () => {
      const text = area.querySelector('.hcd-reply-input').value.trim();
      if (!text) return;
      await postCommentAPI(challengeId, text, commentId);
      area.innerHTML = '';
      loadComments(challengeId);
    });
    area.querySelector('.hcd-reply-input').focus();
  }

  async function postComment() {
    if (!currentUser || !openChallengeId) return;
    const textarea = document.getElementById('hcd-text');
    const text = textarea.value.trim();
    if (!text) { showToast('Write a comment first', 'error'); return; }
    const btn = document.getElementById('hcd-post-btn');
    btn.disabled = true; btn.textContent = 'Posting...';
    await postCommentAPI(openChallengeId, text, null);
    textarea.value = '';
    document.getElementById('hcd-char').textContent = '0/1000';
    btn.disabled = false; btn.textContent = 'Post Comment';
    loadComments(openChallengeId);
  }

  async function postCommentAPI(challengeId, text, parentId) {
    const token = localStorage.getItem('token');
    try {
      const body = { text };
      if (parentId) body.parentCommentId = parentId;
      const res = await fetch(`/api/challenges/${challengeId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      // Update counts
      const card = document.getElementById(`hfc-${challengeId}`);
      if (card) {
        const el = card.querySelector('.cmt-count');
        if (el) el.textContent = fmtNum((parseInt(el.textContent) || 0) + 1);
      }
      const drawerCount = document.getElementById('hcd-count');
      if (drawerCount) drawerCount.textContent = (parseInt(drawerCount.textContent) || 0) + 1;
      return data.data;
    } catch (e) {
      showToast(e.message || 'Failed to post', 'error');
    }
  }

  async function deleteComment(commentId, challengeId) {
    if (!confirm('Delete comment?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      showToast('Comment deleted', 'success');
      loadComments(challengeId);
    } catch (e) {
      showToast(e.message || 'Failed to delete', 'error');
    }
  }

  // ── LIGHTBOX ──
  function setupLightbox() {
    document.getElementById('home-lightbox')?.addEventListener('click', e => {
      if (e.target === document.getElementById('home-lightbox')) closeLightbox();
    });
    document.getElementById('hlb-close')?.addEventListener('click', closeLightbox);
    document.getElementById('hlb-prev')?.addEventListener('click', () => navLightbox(-1));
    document.getElementById('hlb-next')?.addEventListener('click', () => navLightbox(1));
    document.addEventListener('keydown', e => {
      if (!document.getElementById('home-lightbox')?.classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navLightbox(-1);
      if (e.key === 'ArrowRight') navLightbox(1);
    });
  }

  function openLightbox(imgs, idx) {
    lbImages = imgs; lbIdx = idx;
    renderLB();
    document.getElementById('home-lightbox').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    document.getElementById('home-lightbox').classList.remove('open');
    document.body.style.overflow = '';
  }
  function navLightbox(dir) { lbIdx = (lbIdx + dir + lbImages.length) % lbImages.length; renderLB(); }
  function renderLB() {
    document.getElementById('hlb-content').innerHTML = `<img src="${lbImages[lbIdx]}" alt="Evidence" />`;
    document.getElementById('hlb-counter').textContent = `${lbIdx + 1} / ${lbImages.length}`;
    document.getElementById('hlb-prev').style.display = lbImages.length > 1 ? 'flex' : 'none';
    document.getElementById('hlb-next').style.display = lbImages.length > 1 ? 'flex' : 'none';
  }

  // ── RIGHT SIDEBAR ──
  async function loadRightSidebar() {
    try {
      const res = await fetch('/api/challenges/map-data');
      const data = await res.json();
      if (!data.success) return;

      renderTrendingCats(data.data);
      renderTopCities(data.data);
    } catch (e) {}
    renderTopSupporters();
  }

  function renderTrendingCats(stateData) {
    const cats = {};
    stateData.forEach(s => {
      if (s.categories) {
        Object.entries(s.categories).forEach(([cat, count]) => {
          cats[cat] = (cats[cat] || 0) + count;
        });
      }
    });

    // Fallback with totals
    if (Object.keys(cats).length === 0) {
      Object.assign(cats, {
        'Urban Infrastructure': 18, 'Healthcare': 15, 'Water Management': 13,
        'Sanitation & Environment': 12, 'Agriculture': 10, 'Education': 9
      });
    }

    const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxCat = sorted[0]?.[1] || 1;
    const container = document.getElementById('trending-cats');
    if (!container) return;

    container.innerHTML = sorted.map(([cat, count]) => {
      const meta = CAT_META[cat] || { emoji: '📌', color: '#f1f5f9' };
      const pct = (count / maxCat) * 100;
      return `
        <div class="tcat-item">
          <div class="tcat-icon" style="background:${meta.color}">${meta.emoji}</div>
          <div class="tcat-info">
            <div class="tcat-name">${cat}</div>
            <div class="tcat-bar-bg"><div class="tcat-bar-fill" style="width:${pct}%"></div></div>
          </div>
          <div class="tcat-count">${count.toLocaleString('en-IN')}</div>
        </div>
      `;
    }).join('');
  }

  function renderTopCities(stateData) {
    const cityEmojis = ['🔴', '🟠', '🟡', '🟢', '🔵'];
    const sorted = [...stateData].sort((a, b) => b.active - a.active).slice(0, 5);
    const container = document.getElementById('top-cities');
    if (!container) return;

    // Use state capitals/cities
    const stateToCity = {
      'Jharkhand': 'Ranchi', 'Maharashtra': 'Mumbai', 'Uttar Pradesh': 'Lucknow',
      'Delhi': 'New Delhi', 'Bihar': 'Patna', 'Rajasthan': 'Jaipur',
      'West Bengal': 'Kolkata', 'Karnataka': 'Bengaluru', 'Tamil Nadu': 'Chennai',
      'Gujarat': 'Ahmedabad', 'Telangana': 'Hyderabad', 'Madhya Pradesh': 'Bhopal',
      'Andhra Pradesh': 'Vijayawada', 'Odisha': 'Bhubaneswar', 'Assam': 'Guwahati',
      'Punjab': 'Amritsar', 'Haryana': 'Gurugram', 'Kerala': 'Kochi',
      'Chhattisgarh': 'Raipur', 'Uttarakhand': 'Dehradun'
    };

    container.innerHTML = sorted.map((s, i) => `
      <div class="tcity-item">
        <span class="tcity-rank">${i + 1}</span>
        <div class="tcity-dot">${cityEmojis[i] || '📍'}</div>
        <span class="tcity-name">${stateToCity[s.state] || s.state}</span>
        <span class="tcity-count">${(s.active || 0).toLocaleString('en-IN')}</span>
      </div>
    `).join('');
  }

  function renderTopSupporters() {
    // Static leaderboard (would be dynamic from DB in production)
    const supporters = [
      { name: 'Rahul Verma', city: 'Delhi', count: 142 },
      { name: 'Aarav Sharma', city: 'Mumbai', count: 128 },
      { name: 'Arjun Singh', city: 'Lucknow', count: 112 },
      { name: 'Neha Patel', city: 'Ahmedabad', count: 98 },
      { name: 'Karan Mehta', city: 'Bengaluru', count: 88 },
    ];
    const container = document.getElementById('top-supporters');
    if (!container) return;

    container.innerHTML = supporters.map((s, i) => `
      <div class="tsup-item">
        <div class="tsup-av-placeholder">${s.name.charAt(0)}</div>
        <div class="tsup-info">
          <div class="tsup-name">${s.name}</div>
          <div class="tsup-count">${s.count} Supports</div>
        </div>
        <span class="tsup-rank-badge">#${i + 1}</span>
      </div>
    `).join('');
  }

  // ── TOAST ──
  function showToast(msg, type = 'info') {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);
      background:${type === 'error' ? '#dc2626' : type === 'success' ? '#059669' : '#1a56db'};
      color:#fff;padding:.6rem 1.2rem;border-radius:10px;font-size:.82rem;font-weight:700;
      z-index:1000;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,0.2);
      animation:toastIn .3s ease;`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 3000);
  }

  // ── UTILS ──
  function fmtTime(d) {
    const diff = (Date.now() - new Date(d)) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return `${Math.floor(diff / 2592000)}mo ago`;
  }
  function fmtNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }
  function esc(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

})();
