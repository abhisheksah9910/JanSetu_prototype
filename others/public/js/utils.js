/* ============================================================
   utils.js — Shared helpers, API wrapper, Toast, Auth
   ============================================================ */

// ── API Base URL ──
const API_BASE = '/api';

// ── Auth Token Management ──
var Auth = {
  getToken: () => localStorage.getItem('is_token') || localStorage.getItem('token'),

  getUser: () => {
    try {
      const u = localStorage.getItem('is_user') || localStorage.getItem('user');
      return u ? JSON.parse(u) : null;
    } catch { return null; }
  },
  setAuth: (token, user) => {
    localStorage.setItem('is_token', token);
    localStorage.setItem('token', token);
    localStorage.setItem('is_user', JSON.stringify(user));
    localStorage.setItem('user', JSON.stringify(user));
  },
  clearAuth: () => {
    localStorage.removeItem('is_token');
    localStorage.removeItem('token');
    localStorage.removeItem('is_user');
    localStorage.removeItem('user');
    localStorage.removeItem('user_role');
    try { sessionStorage.clear(); } catch(e) {}
  },
  isLoggedIn: () => !!(localStorage.getItem('is_token') || localStorage.getItem('token')),
  redirectToDashboard: (role) => {
    const routes = {
      citizen: '/dashboard/citizen.html',
      university_rep: '/dashboard/university.html',
      industry_rep: '/dashboard/industry.html',
      admin: '/dashboard/admin.html'
    };
    window.location.replace(routes[role] || '/dashboard/citizen.html');
  },
  requireAuth: () => {
    if (!Auth.isLoggedIn()) {
      window.location.replace('/login.html');
      return false;
    }
    return true;
  },
  requireRole: (allowedRoles) => {
    const user = Auth.getUser();
    if (!user || !allowedRoles.includes(user.role)) {
      Toast.error('Access Denied', 'You do not have permission to view this page.');
      setTimeout(() => window.location.replace('/login.html'), 1500);
      return false;
    }
    return true;
  }
};

// ── API Wrapper ──
var API = {
  async request(method, endpoint, data = null, options = {}) {
    const config = {
      method,
      headers: {},
    };

    const token = Auth.getToken();
    if (token) config.headers['Authorization'] = `Bearer ${token}`;

    if (data && !(data instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(data);
    } else if (data instanceof FormData) {
      config.body = data; // Let browser set content-type for FormData
    }

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, config);
      const json = await res.json();

      if (!res.ok) {
        if (res.status === 401 && !options.noAuthRedirect) {
          // Only redirect if this was a protected dashboard page
          if (window.location.pathname.includes('/dashboard/')) {
            Auth.clearAuth();
            window.location.href = '/login.html';
            return;
          }
        }
        throw new Error(json.message || 'Request failed');
      }

      return json;
    } catch (error) {
      if (options.silent) return null;
      throw error;
    }
  },

  get: (endpoint, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return API.request('GET', `${endpoint}${qs ? '?' + qs : ''}`);
  },
  post: (endpoint, data) => API.request('POST', endpoint, data),
  put: (endpoint, data) => API.request('PUT', endpoint, data),
  delete: (endpoint) => API.request('DELETE', endpoint),
  upload: (endpoint, formData) => API.request('POST', endpoint, formData),
  uploadPut: (endpoint, formData) => API.request('PUT', endpoint, formData),
};

// ── Toast Notifications ──
var Toast = {
  _container: null,

  _getContainer() {
    if (!this._container) {
      this._container = document.getElementById('toast-container');
      if (!this._container) {
        this._container = document.createElement('div');
        this._container.id = 'toast-container';
        document.body.appendChild(this._container);
      }
    }
    return this._container;
  },

  _icons: {
    success: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    error: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  },

  show(type, title, message, duration = 4000) {
    const container = this._getContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${this._icons[type]}</div>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${title}</div>` : ''}
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      <div class="toast-close" onclick="this.parentElement.remove()">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </div>
    `;
    container.appendChild(toast);
    if (duration > 0) {
      setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }
    return toast;
  },

  success: (title, message, duration) => Toast.show('success', title, message, duration),
  error: (title, message, duration) => Toast.show('error', title, message, duration),
  warning: (title, message, duration) => Toast.show('warning', title, message, duration),
  info: (title, message, duration) => Toast.show('info', title, message, duration),
};

// ── Confirm Dialog ──
var Confirm = {
  show({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'danger', onConfirm, onCancel }) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:420px">
        <div class="modal-body" style="text-align:center;padding:36px 28px">
          <div class="confirm-modal-icon ${type}">
            ${type === 'danger' ? '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' : ''}
          </div>
          <div class="confirm-modal-title">${title}</div>
          <div class="confirm-modal-message">${message}</div>
          <div style="display:flex;gap:10px;justify-content:center">
            <button id="confirm-cancel" class="btn btn-ghost">${cancelText}</button>
            <button id="confirm-ok" class="btn btn-${type === 'danger' ? 'red' : 'blue'}">${confirmText}</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('open'), 10);

    const close = () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 300);
    };

    overlay.querySelector('#confirm-cancel').onclick = () => { close(); onCancel?.(); };
    overlay.querySelector('#confirm-ok').onclick = () => { close(); onConfirm?.(); };
    overlay.onclick = (e) => { if (e.target === overlay) { close(); onCancel?.(); } };
  }
};

// ── Helpers ──
var Utils = {
  escapeHtml(str) {

    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  async copyToClipboard(text) {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
    } catch(e) {}
  },

  formatDate(dateStr, includeTime = false) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    if (includeTime) { options.hour = '2-digit'; options.minute = '2-digit'; }
    return d.toLocaleDateString('en-IN', options);
  },


  timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return Utils.formatDate(dateStr);
  },

  statusBadge(status) {
    const labels = {
      submitted: 'Submitted', under_review: 'Under Review', validated: 'Validated',
      assigned: 'Assigned', in_progress: 'In Progress', testing: 'Testing',
      resolved: 'Resolved', rejected: 'Rejected', closed: 'Closed', draft: 'Draft'
    };
    return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
  },

  priorityBadge(priority) {
    const icons = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
    return `<span class="badge badge-${priority}">${priority?.toUpperCase() || '—'}</span>`;
  },

  truncate(str, length = 80) {
    if (!str) return '';
    return str.length > length ? str.substring(0, length) + '...' : str;
  },

  generateInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  },

  avatarEl(user, size = 36) {
    const initials = Utils.generateInitials(user?.name || '?');
    if (user?.avatar) {
      return `<img src="${user.avatar}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover" alt="${initials}">`;
    }
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,var(--primary-100),var(--primary-200));display:flex;align-items:center;justify-content:center;font-size:${Math.floor(size * 0.36)}px;font-weight:700;color:var(--primary);font-family:var(--font-display)">${initials}</div>`;
  },

  animateCounter(el, target, duration = 1500) {
    const start = 0;
    const startTime = performance.now();
    const update = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target).toLocaleString('en-IN');
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  },

  debounce(func, wait = 300) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },

  capitalize(str) {
    if (!str) return '';
    return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  },

  setLoading(btn, isLoading, loadingText = 'Loading...') {
    if (!btn) return;
    if (isLoading) {
      btn.disabled = true;
      btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = `<div class="spinner spinner-sm" style="border-color:rgba(255,255,255,0.3);border-top-color:white;margin:0 auto"></div>`;
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalText || loadingText;
    }
  },

  buildPagination(container, pagination, onPageChange) {
    if (!container || !pagination) return;
    const { page, pages } = pagination;
    if (pages <= 1) { container.innerHTML = ''; return; }

    let html = '<div class="pagination">';
    if (page > 1) html += `<button class="page-btn" onclick="(${onPageChange.toString()})(${page - 1})">←</button>`;

    for (let i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || (i >= page - 1 && i <= page + 1)) {
        html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="(${onPageChange.toString()})(${i})">${i}</button>`;
      } else if (i === page - 2 || i === page + 2) {
        html += `<span style="padding:0 4px;color:var(--gray-400)">...</span>`;
      }
    }

    if (page < pages) html += `<button class="page-btn" onclick="(${onPageChange.toString()})(${page + 1})">→</button>`;
    html += '</div>';
    container.innerHTML = html;
  },

  showSkeleton(container, count = 3, type = 'card') {
    container.innerHTML = Array(count).fill(`
      <div class="card" style="padding:20px">
        <div class="skeleton skeleton-text medium mb-8"></div>
        <div class="skeleton skeleton-text short mb-16"></div>
        <div class="skeleton" style="height:60px;border-radius:8px"></div>
      </div>
    `).join('');
  }
};

// ── Notification Polling ──
let notifPollInterval = null;

const NotifManager = {
  count: 0,

  async fetchCount() {
    if (!Auth.isLoggedIn()) return;
    try {
      const res = await API.get('/notifications/unread-count', {}, { silent: true });
      if (res?.success) {
        this.count = res.count;
        this.updateBadge();
      }
    } catch (e) {}
  },

  updateBadge() {
    const badges = document.querySelectorAll('.notif-badge-count');
    badges.forEach(b => {
      b.textContent = this.count;
      b.style.display = this.count > 0 ? 'flex' : 'none';
    });
  },

  startPolling(interval = 30000) {
    this.fetchCount();
    notifPollInterval = setInterval(() => this.fetchCount(), interval);
  },

  stopPolling() {
    if (notifPollInterval) clearInterval(notifPollInterval);
  }
};

// ── Make global ──
window.Auth = Auth;
window.API = API;
window.Toast = Toast;
window.Confirm = Confirm;
window.Utils = Utils;
window.NotifManager = NotifManager;
