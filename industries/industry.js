// industry.js — Industry Dashboard Logic

let currentUser = null;
let allProjects = [];
let currentPartnerChallengeId = null;
let currentSelectedChallenge = null;
const COLLAB_REQUESTS_KEY = 'industryCollaborationRequests';
let selectedModalContributions = new Set();
let selectedModalMentorshipAreas = new Set();
let selectedModalDuration = '1–3 Months';

function getCollaborationRequests() {
  try {
    const raw = localStorage.getItem(COLLAB_REQUESTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to parse collaboration requests:', e);
    return [];
  }
}

function saveCollaborationRequests(reqs) {
  try {
    localStorage.setItem(COLLAB_REQUESTS_KEY, JSON.stringify(reqs));
  } catch (e) {
    console.error('Failed to save collaboration requests:', e);
  }
}

function hasSubmittedInterest(challengeId) {
  const reqs = getCollaborationRequests();
  return reqs.some(r => r.challengeId === challengeId);
}


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
  if (section === 'challenge-details') {
    document.getElementById('nav-explore')?.classList.add('active');
  }
  if (section === 'roi') {
    document.getElementById('nav-roi')?.classList.add('active');
  }
  if (section === 'project-workspace') {
    document.getElementById('nav-collaborations')?.classList.add('active');
  }
  if (section === 'impact') {
    document.getElementById('nav-impact')?.classList.add('active');
  }

  const titles = {
    overview: ['Industry Overview', 'Overview'],
    explore: ['Explore Projects', 'Explore'],
    'challenge-details': ['Challenge Details', 'Explore / Details'],
    roi: ['Industry Opportunity & ROI Center', 'Opportunity & ROI'],
    collaborations: ['My Collaborations', 'Collaborations'],
    'project-workspace': ['Project Collaboration Workspace', 'Collaborations / Workspace'],
    impact: ['Industry Impact & Analytics', 'Impact & Analytics'],
    notifications: ['Notifications', 'Notifications'],
    profile: ['Partner Profile', 'Profile']
  };
  const [title, crumb] = titles[section] || ['Dashboard', section];
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('pageBreadcrumb').textContent = crumb;
  window.location.hash = section;
  closeMobileSidebar();

  if (section === 'explore') loadExploreChallenges();
  if (section === 'roi') loadOpportunityRoiCenter();
  if (section === 'challenge-details') {
    if (!currentSelectedChallenge && allProjects.length > 0) {
      currentSelectedChallenge = enrichChallengeData(allProjects[0]);
    }
    if (currentSelectedChallenge) {
      renderChallengeDetailsPage(currentSelectedChallenge);
    }
  }
  if (section === 'collaborations') loadCollaborations();
  if (section === 'project-workspace') {
    if (!currentActiveWorkspace) {
      openProjectWorkspace('PRJ-001');
    }
  }
  if (section === 'impact') loadImpactAnalytics();
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

  container.innerHTML = featured.map(c => {
    const isInterested = hasSubmittedInterest(c._id);
    const escapedTitle = (c.title || '').replace(/'/g, "\\'");
    return `
    <div style="display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid var(--gray-100)">
      <div style="flex:1;cursor:pointer" onclick="openChallengeDetails('${c._id}')">
        <div style="font-size:13px;font-weight:650;color:var(--gray-900);line-height:1.3">${Utils.truncate(c.title, 50)}</div>
        <div style="font-size:11.5px;color:var(--gray-500);margin-top:3px">${c.category} · ${c.assignedUniversity?.shortName || c.assignedUniversity?.name || 'Open for assignment'}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn btn-sm btn-outline-primary" onclick="openChallengeDetails('${c._id}')" title="View Details" style="padding:5px 8px;font-size:11px">
          👁️ Details
        </button>
        ${isInterested ? `
          <button class="btn btn-sm" onclick="showAlreadySubmittedToast('${escapedTitle}')" style="background:var(--accent-50);color:var(--accent-dark);border:1px solid var(--accent-200);font-size:11.5px;font-weight:600;padding:5px 10px">
            ✓ Sent
          </button>
        ` : `
          <button class="btn btn-sm btn-primary" onclick="openPartnerModal('${c._id}','${escapedTitle}')" style="font-size:11.5px;padding:5px 10px">
            Partner
          </button>
        `}
      </div>
    </div>`;
  }).join('');
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
  if (!container) return;

  const filtered = allProjects.filter(c => {
    const matchSearch = !search || c.title.toLowerCase().includes(search) || c.description.toLowerCase().includes(search);
    const matchCat = !category || c.category === category;
    return matchSearch && matchCat;
  });

  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state" style="padding:60px;background:white;border-radius:var(--radius-xl);border:1.5px solid var(--gray-100)"><div class="empty-title">No projects found</div></div>';
    return;
  }

  container.innerHTML = filtered.map(c => {
    const isInterested = hasSubmittedInterest(c._id);
    const escapedTitle = (c.title || '').replace(/'/g, "\\'");
    return `
    <div class="task-card">
      <div class="task-priority-bar ${c.priority}"></div>
      <div class="task-card-header">
        <div>
          <div class="task-card-id">#${c._id.slice(-8).toUpperCase()}</div>
          <div class="task-card-title" onclick="openChallengeDetails('${c._id}')" style="cursor:pointer">${c.title}</div>
          <div class="task-card-category">${c.category} · ${c.location?.district || 'Jharkhand'}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          ${Utils.statusBadge(c.status)}
          ${Utils.priorityBadge(c.priority)}
        </div>
      </div>
      <p style="font-size:13px;color:var(--gray-600);line-height:1.6;margin-bottom:14px">${Utils.truncate(c.description, 140)}</p>
      <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--gray-100);padding-top:12px;flex-wrap:wrap;gap:10px">
        <div style="font-size:12px;color:var(--gray-500)">
          ${c.assignedUniversity ? `<strong>HEI:</strong> ${c.assignedUniversity.name || c.assignedUniversity.shortName}` : '<span style="color:var(--warning)">Awaiting HEI assignment</span>'}
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button onclick="openChallengeDetails('${c._id}')" class="btn btn-sm btn-outline-primary" style="display:inline-flex;align-items:center;gap:5px">
            <span>👁️</span> View Details
          </button>
          ${isInterested ? `
            <button onclick="showAlreadySubmittedToast('${escapedTitle}')" class="btn btn-sm" style="background:var(--accent-50);color:var(--accent-dark);border:1px solid var(--accent-200);cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:5px">
              <span>✓</span> Interest Sent
            </button>
          ` : `
            <button onclick="openPartnerModal('${c._id}','${escapedTitle}')" class="btn btn-sm btn-primary" style="display:inline-flex;align-items:center;gap:5px">
              <span>🤝</span> Express Interest
            </button>
          `}
        </div>
      </div>
    </div>`;
  }).join('');
};

async function loadCollaborations() {
  renderPendingCollaborations();
  const container = document.getElementById('collabList');
  if (!container) return;

  let collabs = [
    {
      _id: 'PRJ-001',
      challengeId: '7229B7B8',
      title: 'Smart Irrigation System for Water-Stressed Farms',
      category: 'Agriculture',
      location: { district: 'Ranchi' },
      assignedUniversity: { name: 'Xavier Institute of Social Service', shortName: 'XISS' },
      industry: { name: 'ABC Technologies' }
    },
    { _id: 'proj-solar-001', title: 'No Solar Energy Access for Off-Grid Villages in Latehar District', category: 'Energy & Technology', location: { district: 'Latehar' }, assignedUniversity: { shortName: 'XISS' } },
    { _id: 'proj-water-002', title: 'Arsenic and Fluoride Groundwater Contamination in Sahebganj Hamlets', category: 'Water Management', location: { district: 'Sahebganj' }, assignedUniversity: { shortName: 'NIT Jamshedpur' } }
  ];

  container.innerHTML = collabs.map(c => {
    const ws = getProjectWorkspace(c._id);
    const progress = ws?.completionPercentage || ws?.progress || 65;
    const stage = ws?.prototype?.status ? 'Prototype Development' : 'In Progress';
    const univName = (typeof ws?.university === 'object' ? ws?.university?.name : ws?.university) || c.assignedUniversity?.name || c.assignedUniversity?.shortName || 'Xavier Institute of Social Service';
    const industryName = (typeof ws?.industry === 'object' ? ws?.industry?.name : ws?.industry) || c.industry?.name || 'ABC Technologies';

    return `
    <div class="card" style="cursor:pointer;transition:all 0.2s ease" onclick="openProjectWorkspace('${c._id}')">
      <div class="card-body" style="padding:20px 24px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:10px">
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">
              ID: #${(c._id || '').slice(-8).toUpperCase()} · ${c.category}
            </div>
            <div style="font-weight:800;font-size:16px;color:var(--gray-900);line-height:1.3">${c.title}</div>
            <div style="font-size:12.5px;color:var(--gray-500);margin-top:4px">
              <strong>University:</strong> ${univName} &nbsp;|&nbsp; <strong>Industry Partner:</strong> ${industryName}
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <span class="badge badge-resolved" style="padding:6px 12px;font-size:12px">✓ Active Partnership</span>
            <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); openProjectWorkspace('${c._id}')" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;font-size:12px;box-shadow:var(--shadow-sm)">
              <span>🚀</span> Open Workspace →
            </button>
          </div>
        </div>

        <p style="font-size:13px;color:var(--gray-600);line-height:1.6;margin-bottom:14px">
          Active collaborative innovation program in ${c.location?.district || 'Jharkhand'} district focusing on rapid prototyping, lab validation, and community field trials.
        </p>

        <div style="background:#f8fafc;padding:12px 16px;border-radius:var(--radius-md);border:1px solid var(--gray-200);margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:12px;font-weight:700;color:var(--gray-700)">Stage: <span style="color:var(--primary)">${stage}</span></span>
            <span style="font-size:12.5px;font-weight:800;color:var(--primary)">${progress}% Completed</span>
          </div>
          <div class="progress-bar" style="height:7px"><div class="progress-fill" style="width:${progress}%"></div></div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--gray-500);flex-wrap:wrap;gap:8px">
          <span>📍 <strong>Location:</strong> ${c.location?.district || 'Latehar'}, Jharkhand</span>
          <span style="color:var(--primary);font-weight:600">Click to view milestones, team, prototype & field tests →</span>
        </div>
      </div>
    </div>`;
  }).join('');
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

// ── Industry Partner Capability Profile Logic ──

const PROFILE_STORAGE_KEY = 'industryPartnerProfile';

const SUGGESTED_EXPERTISE = [
  'AI / Machine Learning', 'IoT', 'Embedded Systems', 'Hardware',
  'Software Development', 'Data Analytics', 'GIS', 'Robotics',
  'Cloud Computing', 'Cybersecurity', 'Renewable Energy', 'Water Technology',
  'Agriculture Technology', 'Healthcare Technology', 'Manufacturing', 'Automation'
];

const CAPABILITIES_LIST = [
  { id: 'Technical Mentorship', icon: '👨‍🏫' },
  { id: 'Funding / CSR Support', icon: '💰' },
  { id: 'Prototype Development', icon: '🛠️' },
  { id: 'Hardware / Equipment', icon: '🖥️' },
  { id: 'Software Development', icon: '💻' },
  { id: 'Field Testing', icon: '🧪' },
  { id: 'Deployment Support', icon: '🚀' },
  { id: 'Research Collaboration', icon: '🔬' },
  { id: 'Student Mentorship', icon: '🎓' },
  { id: 'Internship Opportunities', icon: '💼' },
  { id: 'Manufacturing / Scale-up', icon: '🏭' }
];

const CSR_FOCUS_LIST = [
  'Education', 'Healthcare', 'Agriculture', 'Rural Development',
  'Water & Sanitation', 'Environment', 'Renewable Energy',
  'Accessibility', 'Livelihoods', 'Public Infrastructure', 'Digital Inclusion'
];

const GEOGRAPHIC_OPTIONS = [
  'Anywhere in Jharkhand', 'Selected Districts', 'Remote / Online', 'On-site only', 'Hybrid'
];

const JHARKHAND_DISTRICTS = [
  'Ranchi', 'Dhanbad', 'East Singhbhum (Jamshedpur)', 'Bokaro', 'Hazaribagh',
  'Deoghar', 'Giridih', 'Ramgarh', 'Palamu', 'Gumla',
  'West Singhbhum (Chaibasa)', 'Dumka', 'Simdega', 'Khunti',
  'Sahebganj', 'Godda', 'Pakur', 'Koderma', 'Chatra',
  'Latehar', 'Garhwa', 'Jamtara', 'Saraikela Kharsawan', 'Lohardaga'
];

const PREFERRED_PARTNERS_LIST = [
  'Universities', 'Startups', 'MSMEs',
  'Government Departments', 'Research Institutions', 'NGOs / Community Organizations'
];

const PREFERRED_STAGES_LIST = [
  'Research', 'Ideation', 'Prototype', 'Pilot Testing', 'Deployment', 'Scale-up'
];

let activeProfileData = null;

function getDefaultProfile() {
  const isTata = currentUser && currentUser.email === 'tata@steel.com';
  return {
    companyName: isTata ? 'Tata Steel Foundation' : (currentUser?.name ? `${currentUser.name} Technologies` : 'ABC Technologies'),
    industryType: isTata ? 'CSR Organization' : 'Technology',
    location: isTata ? 'Jamshedpur, Jharkhand' : 'Ranchi, Jharkhand',
    website: isTata ? 'https://www.tatasteel.com' : 'https://example.com',
    description: isTata
      ? 'Supporting higher education institutions and innovators in Jharkhand through corporate social responsibility, mentorship programs, student funding, and direct deployment partnerships.'
      : 'Technology partner supporting regional innovation through IoT, AI, hardware solutions, and clean water engineering.',
    expertise: ['IoT', 'AI / Machine Learning', 'Renewable Energy', 'Manufacturing'],
    capabilities: ['Technical Mentorship', 'Funding / CSR Support', 'Field Testing', 'Deployment Support'],
    fundingCapacity: '₹10–50 Lakh',
    prototypingCapability: 'Advanced',
    fieldTestingCapability: 'Yes',
    deploymentCapability: 'Yes',
    csrFocus: ['Education', 'Healthcare', 'Rural Development', 'Water & Sanitation', 'Environment'],
    geographicPreference: 'Anywhere in Jharkhand',
    districts: ['East Singhbhum (Jamshedpur)', 'Ranchi', 'West Singhbhum (Chaibasa)'],
    preferredPartners: ['Universities', 'Research Institutions', 'Startups'],
    preferredProjectStages: ['Prototype', 'Pilot Testing', 'Deployment', 'Scale-up']
  };
}

function getStoredProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    console.error('Error reading saved industry profile:', e);
  }
  return null;
}

function calculateProfileCompletion(data) {
  if (!data) return 0;
  let score = 0;

  // 1. Organization Information (20%)
  if (data.companyName && data.companyName.trim()) score += 5;
  if (data.industryType && data.industryType.trim()) score += 5;
  if (data.location && data.location.trim()) score += 5;
  if (data.description && data.description.trim().length >= 10) score += 5;

  // 2. Technical Expertise (20%)
  const expCount = (data.expertise || []).length;
  if (expCount >= 3) score += 20;
  else if (expCount === 2) score += 15;
  else if (expCount === 1) score += 10;

  // 3. Capabilities (20%)
  const capCount = (data.capabilities || []).length;
  if (capCount >= 3) score += 20;
  else if (capCount === 2) score += 15;
  else if (capCount === 1) score += 10;

  // 4. Resources (15%)
  if (data.fundingCapacity && data.fundingCapacity !== 'Not Available') score += 5;
  else if (data.fundingCapacity) score += 2;
  if (data.prototypingCapability && data.prototypingCapability !== 'None') score += 4;
  else if (data.prototypingCapability) score += 1;
  if (data.fieldTestingCapability && data.fieldTestingCapability !== 'No') score += 3;
  else if (data.fieldTestingCapability) score += 1;
  if (data.deploymentCapability && data.deploymentCapability !== 'No') score += 3;
  else if (data.deploymentCapability) score += 1;

  // 5. CSR Focus (10%)
  const csrCount = (data.csrFocus || []).length;
  if (csrCount >= 2) score += 10;
  else if (csrCount === 1) score += 6;

  // 6. Geographic Preference (5%)
  if (data.geographicPreference) {
    if (data.geographicPreference === 'Selected Districts') {
      if ((data.districts || []).length > 0) score += 5;
      else score += 2;
    } else {
      score += 5;
    }
  }

  // 7. Collaboration Preferences (10%)
  if ((data.preferredPartners || []).length > 0) score += 5;
  if ((data.preferredProjectStages || []).length > 0) score += 5;

  return Math.min(100, Math.round(score));
}

function updateCompletionUI(completion) {
  const percentText = document.getElementById('identityCompletionText');
  const progressBar = document.getElementById('identityProgressBar');
  const hintText = document.getElementById('identityCompletionHint');

  if (percentText) percentText.textContent = `${completion}%`;
  if (progressBar) progressBar.style.width = `${completion}%`;
  if (hintText) {
    if (completion >= 80) {
      hintText.textContent = '✓ Ready for AI-based challenge matching';
      hintText.style.color = 'var(--accent)';
      hintText.style.fontWeight = '600';
    } else if (completion >= 50) {
      hintText.textContent = 'Good progress · Complete remaining fields for best match score';
      hintText.style.color = 'var(--primary)';
      hintText.style.fontWeight = '500';
    } else {
      hintText.textContent = 'Complete all sections for AI matching';
      hintText.style.color = 'var(--gray-500)';
      hintText.style.fontWeight = 'normal';
    }
  }
}

function updateIdentityCardUI(data) {
  const nameEl = document.getElementById('identityCompanyName');
  const typeEl = document.getElementById('identityIndustryType');
  const locEl = document.getElementById('identityLocation');
  const descEl = document.getElementById('identityDescription');

  if (nameEl) nameEl.textContent = data.companyName || 'Organization Name';
  if (typeEl) typeEl.textContent = data.industryType || 'Industry Partner';
  if (locEl) {
    const span = locEl.querySelector('span');
    if (span) span.textContent = data.location || 'Jharkhand';
  }
  if (descEl) descEl.textContent = data.description || 'Supporting university innovation and societal challenges across Jharkhand.';
}

function renderExpertiseTags() {
  const container = document.getElementById('expertiseTagsContainer');
  const suggestionsContainer = document.getElementById('suggestedExpertiseContainer');
  if (!container || !activeProfileData) return;

  const currentTags = activeProfileData.expertise || [];

  if (currentTags.length === 0) {
    container.innerHTML = '<span style="font-size:13px;color:var(--gray-400);font-style:italic">No expertise tags added yet. Choose from suggested areas below or type your own.</span>';
  } else {
    container.innerHTML = currentTags.map(tag => `
      <span class="tag-chip">
        <span>${Utils.escapeHtml(tag)}</span>
        <button type="button" class="tag-chip-remove" onclick="removeExpertiseTag('${tag.replace(/'/g, "\\'")}')" title="Remove tag">×</button>
      </span>
    `).join('');
  }

  if (suggestionsContainer) {
    const unselected = SUGGESTED_EXPERTISE.filter(s => !currentTags.includes(s));
    if (unselected.length === 0) {
      suggestionsContainer.innerHTML = '<span style="font-size:12px;color:var(--gray-400)">All suggested domains selected.</span>';
    } else {
      suggestionsContainer.innerHTML = unselected.map(s => `
        <span class="suggestion-chip" onclick="addSuggestedExpertise('${s.replace(/'/g, "\\'")}')">
          <span style="color:var(--primary);font-weight:700">+</span> ${Utils.escapeHtml(s)}
        </span>
      `).join('');
    }
  }
}

function renderCapabilities() {
  const container = document.getElementById('capabilitiesGrid');
  if (!container || !activeProfileData) return;

  const selected = activeProfileData.capabilities || [];
  container.innerHTML = CAPABILITIES_LIST.map(cap => {
    const isSelected = selected.includes(cap.id);
    return `
      <div class="selectable-card ${isSelected ? 'selected' : ''}" onclick="toggleCapability('${cap.id.replace(/'/g, "\\'")}')">
        <div class="selectable-card-checkbox">${isSelected ? '✓' : ''}</div>
        <span style="font-size:17px">${cap.icon}</span>
        <div class="selectable-card-title">${Utils.escapeHtml(cap.id)}</div>
      </div>
    `;
  }).join('');
}

function renderCsrFocus() {
  const container = document.getElementById('csrFocusGrid');
  if (!container || !activeProfileData) return;

  const selected = activeProfileData.csrFocus || [];
  container.innerHTML = CSR_FOCUS_LIST.map(item => {
    const isSelected = selected.includes(item);
    return `
      <div class="selectable-pill ${isSelected ? 'selected' : ''}" onclick="toggleCsrFocus('${item.replace(/'/g, "\\'")}')">
        ${isSelected ? '✓ ' : ''}${Utils.escapeHtml(item)}
      </div>
    `;
  }).join('');
}

function renderGeographicPreferences() {
  const container = document.getElementById('geographicPrefGrid');
  if (!container || !activeProfileData) return;

  const current = activeProfileData.geographicPreference || 'Anywhere in Jharkhand';
  container.innerHTML = GEOGRAPHIC_OPTIONS.map(opt => {
    const isSelected = current === opt;
    return `
      <div class="radio-box ${isSelected ? 'selected' : ''}" onclick="setGeographicPreference('${opt.replace(/'/g, "\\'")}')">
        ${isSelected ? '● ' : '○ '}${Utils.escapeHtml(opt)}
      </div>
    `;
  }).join('');

  const districtBox = document.getElementById('districtsContainer');
  if (districtBox) {
    districtBox.style.display = current === 'Selected Districts' ? 'block' : 'none';
  }

  renderDistricts();
}

function renderDistricts() {
  const container = document.getElementById('districtsGrid');
  const countLabel = document.getElementById('districtCount');
  if (!container || !activeProfileData) return;

  const selected = activeProfileData.districts || [];
  if (countLabel) countLabel.textContent = selected.length;

  container.innerHTML = JHARKHAND_DISTRICTS.map(dist => {
    const isSelected = selected.includes(dist);
    return `
      <div class="district-pill ${isSelected ? 'selected' : ''}" onclick="toggleDistrict('${dist.replace(/'/g, "\\'")}')">
        ${isSelected ? '✓ ' : ''}${Utils.escapeHtml(dist)}
      </div>
    `;
  }).join('');
}

function renderCollaborationPreferences() {
  const partnersContainer = document.getElementById('preferredPartnersGrid');
  const stagesContainer = document.getElementById('preferredStagesGrid');
  if (!activeProfileData) return;

  if (partnersContainer) {
    const selectedPartners = activeProfileData.preferredPartners || [];
    partnersContainer.innerHTML = PREFERRED_PARTNERS_LIST.map(p => {
      const isSelected = selectedPartners.includes(p);
      return `
        <div class="selectable-card ${isSelected ? 'selected' : ''}" onclick="togglePreferredPartner('${p.replace(/'/g, "\\'")}')">
          <div class="selectable-card-checkbox">${isSelected ? '✓' : ''}</div>
          <div class="selectable-card-title">${Utils.escapeHtml(p)}</div>
        </div>
      `;
    }).join('');
  }

  if (stagesContainer) {
    const selectedStages = activeProfileData.preferredProjectStages || [];
    stagesContainer.innerHTML = PREFERRED_STAGES_LIST.map(s => {
      const isSelected = selectedStages.includes(s);
      return `
        <div class="selectable-card ${isSelected ? 'selected' : ''}" onclick="togglePreferredStage('${s.replace(/'/g, "\\'")}')">
          <div class="selectable-card-checkbox">${isSelected ? '✓' : ''}</div>
          <div class="selectable-card-title">${Utils.escapeHtml(s)}</div>
        </div>
      `;
    }).join('');
  }
}

function syncInputsFromActiveData() {
  if (!activeProfileData) return;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };

  setVal('profCompanyName', activeProfileData.companyName);
  setVal('profIndustryType', activeProfileData.industryType);
  setVal('profLocation', activeProfileData.location);
  setVal('profWebsite', activeProfileData.website);
  setVal('profDescription', activeProfileData.description);
  setVal('resFundingCapacity', activeProfileData.fundingCapacity || 'Not Available');
  setVal('resPrototypingCapability', activeProfileData.prototypingCapability || 'None');
  setVal('resFieldTestingCapability', activeProfileData.fieldTestingCapability || 'No');
  setVal('resDeploymentCapability', activeProfileData.deploymentCapability || 'No');
}

function syncActiveDataFromInputs() {
  if (!activeProfileData) activeProfileData = {};
  const getVal = (id) => document.getElementById(id)?.value?.trim() || '';

  activeProfileData.companyName = getVal('profCompanyName');
  activeProfileData.industryType = getVal('profIndustryType');
  activeProfileData.location = getVal('profLocation');
  activeProfileData.website = getVal('profWebsite');
  activeProfileData.description = getVal('profDescription');
  activeProfileData.fundingCapacity = getVal('resFundingCapacity');
  activeProfileData.prototypingCapability = getVal('resPrototypingCapability');
  activeProfileData.fieldTestingCapability = getVal('resFieldTestingCapability');
  activeProfileData.deploymentCapability = getVal('resDeploymentCapability');
}

async function loadProfile() {
  let stored = getStoredProfile();
  if (!stored) {
    stored = getDefaultProfile();
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(stored));
    } catch(e) {}
  }

  activeProfileData = JSON.parse(JSON.stringify(stored));

  syncInputsFromActiveData();
  renderExpertiseTags();
  renderCapabilities();
  renderCsrFocus();
  renderGeographicPreferences();
  renderCollaborationPreferences();
  updateIdentityCardUI(activeProfileData);

  const completion = calculateProfileCompletion(activeProfileData);
  updateCompletionUI(completion);
}

// ── Interactive Actions ──

function onProfileFieldChange() {
  syncActiveDataFromInputs();
  updateIdentityCardUI(activeProfileData);
  const completion = calculateProfileCompletion(activeProfileData);
  updateCompletionUI(completion);

  // Clear errors if field has value
  if (activeProfileData.companyName) {
    const err = document.getElementById('errCompanyName');
    const input = document.getElementById('profCompanyName');
    if (err) err.style.display = 'none';
    if (input) input.classList.remove('error');
  }
  if (activeProfileData.industryType) {
    const err = document.getElementById('errIndustryType');
    const input = document.getElementById('profIndustryType');
    if (err) err.style.display = 'none';
    if (input) input.classList.remove('error');
  }
  if (activeProfileData.location) {
    const err = document.getElementById('errLocation');
    const input = document.getElementById('profLocation');
    if (err) err.style.display = 'none';
    if (input) input.classList.remove('error');
  }
  if (activeProfileData.description) {
    const err = document.getElementById('errDescription');
    const input = document.getElementById('profDescription');
    if (err) err.style.display = 'none';
    if (input) input.classList.remove('error');
  }
}

function addCustomExpertise() {
  const input = document.getElementById('customExpertiseInput');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;

  if (!activeProfileData.expertise) activeProfileData.expertise = [];
  if (!activeProfileData.expertise.includes(val)) {
    activeProfileData.expertise.push(val);
    renderExpertiseTags();
    const completion = calculateProfileCompletion(activeProfileData);
    updateCompletionUI(completion);
  }
  input.value = '';
}

function addSuggestedExpertise(skill) {
  if (!activeProfileData.expertise) activeProfileData.expertise = [];
  if (!activeProfileData.expertise.includes(skill)) {
    activeProfileData.expertise.push(skill);
    renderExpertiseTags();
    const completion = calculateProfileCompletion(activeProfileData);
    updateCompletionUI(completion);
  }
}

function removeExpertiseTag(skill) {
  if (!activeProfileData.expertise) return;
  activeProfileData.expertise = activeProfileData.expertise.filter(s => s !== skill);
  renderExpertiseTags();
  const completion = calculateProfileCompletion(activeProfileData);
  updateCompletionUI(completion);
}

function toggleCapability(capId) {
  if (!activeProfileData.capabilities) activeProfileData.capabilities = [];
  const idx = activeProfileData.capabilities.indexOf(capId);
  if (idx > -1) activeProfileData.capabilities.splice(idx, 1);
  else activeProfileData.capabilities.push(capId);

  renderCapabilities();
  const completion = calculateProfileCompletion(activeProfileData);
  updateCompletionUI(completion);
}

function toggleCsrFocus(item) {
  if (!activeProfileData.csrFocus) activeProfileData.csrFocus = [];
  const idx = activeProfileData.csrFocus.indexOf(item);
  if (idx > -1) activeProfileData.csrFocus.splice(idx, 1);
  else activeProfileData.csrFocus.push(item);

  renderCsrFocus();
  const completion = calculateProfileCompletion(activeProfileData);
  updateCompletionUI(completion);
}

function setGeographicPreference(opt) {
  activeProfileData.geographicPreference = opt;
  renderGeographicPreferences();
  const completion = calculateProfileCompletion(activeProfileData);
  updateCompletionUI(completion);
}

function toggleDistrict(dist) {
  if (!activeProfileData.districts) activeProfileData.districts = [];
  const idx = activeProfileData.districts.indexOf(dist);
  if (idx > -1) activeProfileData.districts.splice(idx, 1);
  else activeProfileData.districts.push(dist);

  renderDistricts();
  const completion = calculateProfileCompletion(activeProfileData);
  updateCompletionUI(completion);
}

function toggleAllDistricts(selectAll) {
  if (!activeProfileData) return;
  activeProfileData.districts = selectAll ? [...JHARKHAND_DISTRICTS] : [];
  renderDistricts();
  const completion = calculateProfileCompletion(activeProfileData);
  updateCompletionUI(completion);
}

function togglePreferredPartner(partner) {
  if (!activeProfileData.preferredPartners) activeProfileData.preferredPartners = [];
  const idx = activeProfileData.preferredPartners.indexOf(partner);
  if (idx > -1) activeProfileData.preferredPartners.splice(idx, 1);
  else activeProfileData.preferredPartners.push(partner);

  renderCollaborationPreferences();
  const completion = calculateProfileCompletion(activeProfileData);
  updateCompletionUI(completion);
}

function togglePreferredStage(stage) {
  if (!activeProfileData.preferredProjectStages) activeProfileData.preferredProjectStages = [];
  const idx = activeProfileData.preferredProjectStages.indexOf(stage);
  if (idx > -1) activeProfileData.preferredProjectStages.splice(idx, 1);
  else activeProfileData.preferredProjectStages.push(stage);

  renderCollaborationPreferences();
  const completion = calculateProfileCompletion(activeProfileData);
  updateCompletionUI(completion);
}

function validateProfileForm() {
  syncActiveDataFromInputs();
  let isValid = true;

  const checkRequired = (fieldId, errId, val) => {
    const input = document.getElementById(fieldId);
    const err = document.getElementById(errId);
    if (!val || !val.trim()) {
      if (input) input.classList.add('error');
      if (err) err.style.display = 'flex';
      isValid = false;
    } else {
      if (input) input.classList.remove('error');
      if (err) err.style.display = 'none';
    }
  };

  checkRequired('profCompanyName', 'errCompanyName', activeProfileData.companyName);
  checkRequired('profIndustryType', 'errIndustryType', activeProfileData.industryType);
  checkRequired('profLocation', 'errLocation', activeProfileData.location);
  checkRequired('profDescription', 'errDescription', activeProfileData.description);

  return isValid;
}

function saveIndustryProfile() {
  if (!validateProfileForm()) {
    Toast.error('Validation Error', 'Please fill in all required organization fields marked with *.');
    return;
  }

  syncActiveDataFromInputs();

  // Clean structured payload ready for AI matching
  const profilePayload = {
    companyName: activeProfileData.companyName,
    industryType: activeProfileData.industryType,
    location: activeProfileData.location,
    website: activeProfileData.website,
    description: activeProfileData.description,
    expertise: activeProfileData.expertise || [],
    capabilities: activeProfileData.capabilities || [],
    fundingCapacity: activeProfileData.fundingCapacity || 'Not Available',
    prototypingCapability: activeProfileData.prototypingCapability || 'None',
    fieldTestingCapability: activeProfileData.fieldTestingCapability || 'No',
    deploymentCapability: activeProfileData.deploymentCapability || 'No',
    csrFocus: activeProfileData.csrFocus || [],
    geographicPreference: activeProfileData.geographicPreference || 'Anywhere in Jharkhand',
    districts: activeProfileData.geographicPreference === 'Selected Districts' ? (activeProfileData.districts || []) : [],
    preferredPartners: activeProfileData.preferredPartners || [],
    preferredProjectStages: activeProfileData.preferredProjectStages || [],
    updatedAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profilePayload));
    activeProfileData = profilePayload;
    updateIdentityCardUI(profilePayload);
    const completion = calculateProfileCompletion(profilePayload);
    updateCompletionUI(completion);

    Toast.success('Profile updated successfully.');
  } catch (err) {
    console.error('Failed to save profile to localStorage:', err);
    Toast.error('Save Failed', 'Unable to save profile to browser storage.');
  }
}

function cancelProfileEdit() {
  const saved = getStoredProfile();
  if (saved) {
    activeProfileData = JSON.parse(JSON.stringify(saved));
    syncInputsFromActiveData();
    renderExpertiseTags();
    renderCapabilities();
    renderCsrFocus();
    renderGeographicPreferences();
    renderCollaborationPreferences();
    updateIdentityCardUI(activeProfileData);
    const completion = calculateProfileCompletion(activeProfileData);
    updateCompletionUI(completion);
    Toast.info('Profile Reset', 'Reverted to last saved profile data.');
  } else {
    loadProfile();
  }
}

// Window bindings
window.saveIndustryProfile = saveIndustryProfile;
window.cancelProfileEdit = cancelProfileEdit;
window.addCustomExpertise = addCustomExpertise;
window.addSuggestedExpertise = addSuggestedExpertise;
window.removeExpertiseTag = removeExpertiseTag;
window.toggleCapability = toggleCapability;
window.toggleCsrFocus = toggleCsrFocus;
window.setGeographicPreference = setGeographicPreference;
window.toggleDistrict = toggleDistrict;
window.toggleAllDistricts = toggleAllDistricts;
window.togglePreferredPartner = togglePreferredPartner;
window.togglePreferredStage = togglePreferredStage;
window.onProfileFieldChange = onProfileFieldChange;

// ── Challenge Details & Industry Collaboration Logic ──

const MODAL_CONTRIBUTIONS = [
  { id: 'Technical Mentorship', icon: '👨‍🏫', label: 'Technical Mentorship' },
  { id: 'Prototype Development', icon: '🛠️', label: 'Prototype Development' },
  { id: 'Funding / CSR Support', icon: '💰', label: 'Funding / CSR Support' },
  { id: 'Hardware / Equipment', icon: '🖥️', label: 'Hardware / Equipment' },
  { id: 'Field Testing', icon: '🧪', label: 'Field Testing' },
  { id: 'Deployment Support', icon: '🚀', label: 'Deployment Support' },
  { id: 'Student Mentorship', icon: '🎓', label: 'Student Mentorship' },
  { id: 'Internship Opportunities', icon: '💼', label: 'Internship Opportunities' },
  { id: 'Manufacturing / Scale-up', icon: '🏭', label: 'Manufacturing / Scale-up' }
];

const MODAL_MENTOR_AREAS = [
  'IoT', 'AI/ML', 'Hardware', 'Software', 'Embedded Systems', 'Project Management'
];

const MODAL_DURATIONS = [
  '< 1 Month', '1–3 Months', '3–6 Months', '6–12 Months', '12+ Months'
];

const LIFECYCLE_STAGES = [
  'Problem Submitted',
  'Validated',
  'University Assigned',
  'Solution Development',
  'Industry Collaboration',
  'Prototype',
  'Field Testing',
  'Deployment'
];

function enrichChallengeData(c) {
  if (!c) return null;

  const isSolar = (c.title || '').toLowerCase().includes('solar') || c.category === 'Energy & Technology';
  const isWater = (c.title || '').toLowerCase().includes('water') || c.category === 'Water Management';
  const isAgri = (c.title || '').toLowerCase().includes('agri') || c.category === 'Agriculture';
  const isHealth = (c.title || '').toLowerCase().includes('health') || c.category === 'Healthcare';

  const defaultExpertise = isSolar
    ? ['Solar Energy', 'IoT', 'Hardware', 'Embedded Systems', 'Field Testing']
    : isWater
    ? ['Water Technology', 'IoT Sensors', 'Filtration', 'Solar Power', 'Field Testing']
    : isAgri
    ? ['Agriculture Technology', 'IoT', 'Mobile Apps', 'Soil Chemistry', 'Automation']
    : isHealth
    ? ['Healthcare Technology', 'Biomedical Sensors', 'Telemedicine', 'Cloud Computing', 'Data Analytics']
    : ['IoT', 'Software Development', 'Hardware', 'Field Testing', 'Data Analytics'];

  const defaultSupport = [
    'Technical Mentorship',
    'Prototype Development',
    'Funding / CSR',
    'Hardware / Equipment',
    'Field Testing',
    'Deployment Support'
  ];

  const defaultWhy = isSolar
    ? 'Absence of reliable grid electricity deprives remote forest villages of basic night lighting, cold storage for medicines at sub-health posts, and study hours for schoolchildren.'
    : isWater
    ? 'Excess fluoride and seasonal contamination in groundwater sources causes chronic bone fluorosis and recurring gastrointestinal outbreaks across tribal hamlets.'
    : 'Directly tackles acute socio-economic bottlenecks by providing sustainable, low-cost technological interventions tailored to regional conditions.';

  const defaultWho = isSolar
    ? 'Over 18,000 tribal and rural residents across 200+ off-grid hamlets, primary healthcare workers, and village school students.'
    : isWater
    ? 'Over 8,500 rural citizens, women who travel kilometers daily for potable water, and local public schools.'
    : 'Local agrarian households, smallholder farmers, and marginalized rural communities.';

  const defaultSit = isSolar
    ? 'Villagers presently depend on hazardous kerosene wick lamps and noisy, erratic diesel gen-sets with prohibitively expensive operating fuel costs.'
    : isWater
    ? 'Communities rely on shallow unlined open wells and intermittent handpumps that run dry or test positive for contaminants during summer months.'
    : 'Communities currently rely on arduous manual labor with limited access to modern technological tools or organized institutional support.';

  const defaultHei = c.assignedUniversity?.name || c.assignedUniversity?.shortName || (isSolar ? 'Xavier Institute of Social Service (XISS)' : 'NIT Jamshedpur');
  const defaultDept = isSolar
    ? 'Department of Rural Management & Tech Innovation'
    : isWater
    ? 'Department of Civil & Environmental Engineering'
    : 'Department of Electrical & Computer Engineering';

  const defaultFaculty = isSolar
    ? 'Dr. Arvind Sharma (Professor & Lead Coordinator)'
    : isWater
    ? 'Dr. Manisha Kispotta (Associate Professor, Environmental Sciences)'
    : 'Dr. Rajesh Verma (Lead Faculty Mentor)';

  const defaultStage = c.status === 'in_progress' ? 'Solution Development' : (c.status === 'assigned' ? 'University Assigned' : 'Prototype');
  const defaultProgress = c.status === 'in_progress' ? 65 : (c.status === 'assigned' ? 35 : 50);

  return {
    ...c,
    domain: c.category || 'Technology',
    location: {
      district: c.location?.district || 'Latehar',
      state: c.location?.state || 'Jharkhand',
      block: c.location?.block || 'Rural Cluster'
    },
    whyItMatters: c.whyItMatters || defaultWhy,
    whoIsAffected: c.whoIsAffected || defaultWho,
    currentSituation: c.currentSituation || defaultSit,
    affectedPopulation: c.affectedPopulation || (isSolar ? '200+ villages' : (isWater ? '45 hamlets' : '1,200+ families')),
    problemSeverity: c.priority === 'urgent' ? 'Critical' : (c.priority === 'high' ? 'High' : 'Moderate'),
    urgency: c.priority === 'urgent' ? 'Immediate' : (c.priority === 'high' ? 'High' : 'Normal'),
    heiName: defaultHei,
    heiDepartment: defaultDept,
    facultyMentor: defaultFaculty,
    projectStage: c.projectStage || defaultStage,
    progressPercent: c.progressPercent || defaultProgress,
    requiredExpertise: Array.isArray(c.requiredExpertise) && c.requiredExpertise.length ? c.requiredExpertise : defaultExpertise,
    supportNeeded: Array.isArray(c.supportNeeded) && c.supportNeeded.length ? c.supportNeeded : defaultSupport
  };
}

function renderTimelineSteps(currentStage) {
  let activeIdx = LIFECYCLE_STAGES.findIndex(s => s.toLowerCase() === (currentStage || '').toLowerCase());
  if (activeIdx === -1) {
    const stageLower = (currentStage || '').toLowerCase();
    if (stageLower.includes('deploy')) activeIdx = 7;
    else if (stageLower.includes('test') || stageLower.includes('field')) activeIdx = 6;
    else if (stageLower.includes('prototype')) activeIdx = 5;
    else if (stageLower.includes('collab') || stageLower.includes('industry')) activeIdx = 4;
    else if (stageLower.includes('develop') || stageLower.includes('solution')) activeIdx = 3;
    else if (stageLower.includes('assign') || stageLower.includes('univ')) activeIdx = 2;
    else if (stageLower.includes('valid')) activeIdx = 1;
    else activeIdx = 3;
  }

  return LIFECYCLE_STAGES.map((st, idx) => {
    const isCompleted = idx < activeIdx;
    const isActive = idx === activeIdx;
    const statusClass = isCompleted ? 'completed' : (isActive ? 'active' : '');
    const circleContent = isCompleted ? '✓' : (idx + 1);

    return `
      <div class="timeline-step ${statusClass}">
        <div class="timeline-dot">${circleContent}</div>
        <div class="timeline-label">${st}</div>
      </div>
    `;
  }).join('');
}

function showAlreadySubmittedToast(title) {
  Toast.info('Request Submitted', 'Collaboration request already submitted.');
}

function openChallengeDetails(challengeId) {
  const raw = allProjects.find(c => c._id === challengeId);
  if (!raw) {
    Toast.error('Challenge Not Found', 'Could not locate project details.');
    return;
  }
  const enriched = enrichChallengeData(raw);
  currentSelectedChallenge = enriched;
  renderChallengeDetailsPage(enriched);
  showSection('challenge-details');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderChallengeDetailsPage(c) {
  const container = document.getElementById('challengeDetailsContainer');
  if (!container) return;

  const isSubmitted = hasSubmittedInterest(c._id);
  const escapedTitle = (c.title || '').replace(/'/g, "\\'");

  container.innerHTML = `
    <!-- Header Card -->
    <div class="challenge-header-card" style="margin-bottom: 24px;">
      <div class="challenge-top-nav">
        <button onclick="showSection('explore')" class="btn btn-ghost" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border:1px solid var(--gray-200);border-radius:var(--radius-md)">
          <span>←</span> Back to Explore Challenges
        </button>
        <div style="display:flex;gap:10px;align-items:center">
          ${isSubmitted ? `
            <button onclick="showAlreadySubmittedToast('${escapedTitle}')" class="btn" style="background:var(--accent-50);color:var(--accent-dark);border:1.5px solid var(--accent-200);font-weight:700;display:inline-flex;align-items:center;gap:6px;padding:9px 18px">
              <span>✓</span> Interest Sent
            </button>
          ` : `
            <button onclick="openPartnerModal('${c._id}','${escapedTitle}')" class="btn btn-primary" style="font-weight:750;display:inline-flex;align-items:center;gap:6px;padding:9px 20px;font-size:14px;box-shadow:var(--shadow-md)">
              <span>🤝</span> Express Interest
            </button>
          `}
        </div>
      </div>

      <div class="challenge-meta-row" style="margin-bottom: 8px;">
        <span style="font-size:12px;font-weight:750;color:var(--primary);background:var(--primary-50);padding:3px 10px;border-radius:var(--radius-full);border:1px solid var(--primary-100)">
          #${(c._id || '').slice(-8).toUpperCase()}
        </span>
        <span>•</span>
        <span style="font-weight:650;color:var(--gray-800)">${c.category || 'Domain'}</span>
        <span>•</span>
        <span>📍 ${c.location?.district || 'Latehar'}, ${c.location?.state || 'Jharkhand'}</span>
        <span>•</span>
        ${Utils.priorityBadge(c.priority)}
        ${Utils.statusBadge(c.status)}
      </div>

      <h1 class="challenge-title-large">${c.title}</h1>
    </div>

    <div style="display:flex;flex-direction:column;gap:24px">

      <!-- SECTION 1: PROBLEM OVERVIEW -->
      <div class="card">
        <div class="card-header" style="padding:20px 24px 14px;border-bottom:1px solid var(--gray-100)">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:20px">🔍</span>
            <h2 style="font-size:18px;font-weight:800;color:var(--gray-900);margin:0">The Problem</h2>
          </div>
        </div>
        <div class="card-body" style="padding:22px 24px">
          <div style="font-size:14.5px;color:var(--gray-700);line-height:1.7;margin-bottom:20px">
            ${c.description}
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;background:#fafbfc;border:1px solid var(--gray-200);border-radius:var(--radius-lg);padding:18px 20px">
            <div>
              <div style="font-size:11.5px;font-weight:750;color:var(--primary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px">Why It Matters</div>
              <div style="font-size:13px;color:var(--gray-700);line-height:1.6">${c.whyItMatters}</div>
            </div>
            <div>
              <div style="font-size:11.5px;font-weight:750;color:var(--primary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px">Who is Affected</div>
              <div style="font-size:13px;color:var(--gray-700);line-height:1.6">${c.whoIsAffected}</div>
            </div>
            <div>
              <div style="font-size:11.5px;font-weight:750;color:var(--primary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px">Location & Setting</div>
              <div style="font-size:13px;color:var(--gray-700);line-height:1.6">${c.location?.district || 'Latehar'}, Jharkhand (${c.location?.block || 'Rural Hamlets'})</div>
            </div>
            <div>
              <div style="font-size:11.5px;font-weight:750;color:var(--primary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px">Current Situation</div>
              <div style="font-size:13px;color:var(--gray-700);line-height:1.6">${c.currentSituation}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- SECTION 2: COMMUNITY IMPACT -->
      <div class="card">
        <div class="card-header" style="padding:20px 24px 14px;border-bottom:1px solid var(--gray-100)">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:20px">👥</span>
            <h2 style="font-size:18px;font-weight:800;color:var(--gray-900);margin:0">Community Impact</h2>
          </div>
        </div>
        <div class="card-body" style="padding:22px 24px">
          <div class="impact-cards-grid">
            <div class="impact-card">
              <div class="impact-icon-box" style="background:#ecfdf5;color:#059669">🏘️</div>
              <div>
                <div class="impact-value">${c.affectedPopulation}</div>
                <div class="impact-label">Affected Communities / People</div>
              </div>
            </div>
            <div class="impact-card">
              <div class="impact-icon-box" style="background:#eff6ff;color:#1d4ed8">📍</div>
              <div>
                <div class="impact-value">${c.location?.district || 'Latehar'}</div>
                <div class="impact-label">District, Jharkhand</div>
              </div>
            </div>
            <div class="impact-card">
              <div class="impact-icon-box" style="background:#fef2f2;color:#b91c1c">⚠️</div>
              <div>
                <div class="impact-value">${c.problemSeverity}</div>
                <div class="impact-label">Problem Severity</div>
              </div>
            </div>
            <div class="impact-card">
              <div class="impact-icon-box" style="background:#fffbeb;color:#b45309">⏱️</div>
              <div>
                <div class="impact-value">${c.urgency}</div>
                <div class="impact-label">Urgency Level</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- SECTION 3: UNIVERSITY / HEI INFORMATION -->
      <div class="card">
        <div class="card-header" style="padding:20px 24px 14px;border-bottom:1px solid var(--gray-100)">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:20px">🏛️</span>
            <h2 style="font-size:18px;font-weight:800;color:var(--gray-900);margin:0">University / HEI Information</h2>
          </div>
        </div>
        <div class="card-body" style="padding:22px 24px">
          <div class="hei-info-box">
            <div class="hei-avatar">🎓</div>
            <div style="flex:1;min-width:240px">
              <div style="font-size:17px;font-weight:800;color:var(--gray-900)">${c.heiName}</div>
              <div style="font-size:13px;color:var(--gray-600);margin-top:3px">${c.heiDepartment}</div>
              <div style="font-size:12px;color:var(--gray-500);margin-top:2">Faculty Mentor: <strong>${c.facultyMentor}</strong></div>
            </div>
            <div style="min-width:220px;background:white;padding:14px 18px;border-radius:var(--radius-md);border:1px solid var(--gray-200)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <span style="font-size:12px;font-weight:700;color:var(--gray-600)">Stage: ${c.projectStage}</span>
                <span style="font-size:13px;font-weight:800;color:var(--primary)">${c.progressPercent}%</span>
              </div>
              <div class="progress-bar" style="height:7px"><div class="progress-fill" style="width:${c.progressPercent}%"></div></div>
              <div style="font-size:11px;color:var(--gray-400);margin-top:4px;text-align:right">Current Milestone Progress</div>
            </div>
          </div>
        </div>
      </div>

      <!-- SECTION 4: REQUIRED EXPERTISE -->
      <div class="card">
        <div class="card-header" style="padding:20px 24px 14px;border-bottom:1px solid var(--gray-100)">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:20px">💡</span>
              <h2 style="font-size:18px;font-weight:800;color:var(--gray-900);margin:0">Required Expertise</h2>
            </div>
            <span style="font-size:11.5px;color:var(--gray-400)">Structured capability requirements</span>
          </div>
        </div>
        <div class="card-body" style="padding:22px 24px">
          <div style="display:flex;flex-wrap:wrap;gap:10px">
            ${(c.requiredExpertise || []).map(exp => `
              <div style="display:inline-flex;align-items:center;gap:6px;background:#f1f5f9;border:1px solid #cbd5e1;padding:8px 14px;border-radius:var(--radius-full);font-size:13px;font-weight:600;color:#334155">
                <span>🔹</span> ${exp}
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- SECTION 5: INDUSTRY SUPPORT NEEDED -->
      <div class="card">
        <div class="card-header" style="padding:20px 24px 14px;border-bottom:1px solid var(--gray-100)">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:20px">🤝</span>
              <h2 style="font-size:18px;font-weight:800;color:var(--gray-900);margin:0">Industry Support Needed</h2>
            </div>
            <span style="font-size:11.5px;color:var(--gray-400)">Key collaboration avenues</span>
          </div>
        </div>
        <div class="card-body" style="padding:22px 24px">
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(220px, 1fr));gap:12px">
            ${(c.supportNeeded || []).map(sup => `
              <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:#f8fafc;border:1px solid var(--gray-200);border-radius:var(--radius-md);font-size:13px;font-weight:650;color:var(--gray-800)">
                <span style="color:var(--primary);font-size:15px">✓</span>
                <span>${sup}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- SECTION 6: PROJECT TIMELINE -->
      <div class="card">
        <div class="card-header" style="padding:20px 24px 14px;border-bottom:1px solid var(--gray-100)">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:20px">📈</span>
              <h2 style="font-size:18px;font-weight:800;color:var(--gray-900);margin:0">Project Lifecycle Timeline</h2>
            </div>
            <span style="font-size:11.5px;color:var(--primary);font-weight:600">Active Stage: ${c.projectStage}</span>
          </div>
        </div>
        <div class="card-body" style="padding:24px 24px 18px">
          <div class="timeline-steps">
            ${renderTimelineSteps(c.projectStage)}
          </div>
        </div>
      </div>

      <!-- Bottom Action Banner -->
      <div style="background:linear-gradient(135deg, var(--primary-50), #ecfdf5);border:1.5px solid var(--primary-200);border-radius:var(--radius-xl);padding:24px 28px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px">
        <div>
          <div style="font-size:16px;font-weight:800;color:var(--gray-900)">Ready to support this innovation?</div>
          <div style="font-size:13px;color:var(--gray-600);margin-top:2px">Submit your collaboration proposal or mentorship offer directly to the university team.</div>
        </div>
        ${isSubmitted ? `
          <button onclick="showAlreadySubmittedToast('${escapedTitle}')" class="btn" style="background:white;color:var(--accent-dark);border:1.5px solid var(--accent-300);font-weight:750;padding:12px 22px;box-shadow:var(--shadow-sm)">
            ✓ Interest Sent
          </button>
        ` : `
          <button onclick="openPartnerModal('${c._id}','${escapedTitle}')" class="btn btn-primary" style="font-weight:800;padding:12px 24px;font-size:14.5px;box-shadow:var(--shadow-md);display:inline-flex;align-items:center;gap:6px">
            <span>🤝</span> Express Interest
          </button>
        `}
      </div>

    </div>
  `;
}

function openPartnerModal(id, title) {
  currentPartnerChallengeId = id;
  const rawChallenge = allProjects.find(c => c._id === id);
  const challenge = enrichChallengeData(rawChallenge) || {
    _id: id,
    title: title || 'Innovation Challenge',
    heiName: 'University Partner'
  };

  if (hasSubmittedInterest(id)) {
    showAlreadySubmittedToast(challenge.title);
    return;
  }

  const cidEl = document.getElementById('collabModalChallengeId');
  const titleEl = document.getElementById('partnerProjectTitle');
  const univEl = document.getElementById('collabModalUniversity');
  if (cidEl) cidEl.textContent = `#${(challenge._id || '').slice(-8).toUpperCase()}`;
  if (titleEl) titleEl.textContent = challenge.title;
  if (univEl) univEl.textContent = challenge.heiName || 'University Partner';

  // Reset modal state
  selectedModalContributions.clear();
  selectedModalMentorshipAreas.clear();
  selectedModalDuration = '1–3 Months';

  // Prefill contact person from stored profile or currentUser
  const stored = getStoredProfile() || {};
  const contactNameInput = document.getElementById('collabContactName');
  const contactDesigInput = document.getElementById('collabContactDesignation');
  const contactEmailInput = document.getElementById('collabContactEmail');
  const contactPhoneInput = document.getElementById('collabContactPhone');
  const messageInput = document.getElementById('partnerMessage');
  const fundingAmtInput = document.getElementById('collabFundingAmount');

  if (contactNameInput) contactNameInput.value = stored.primaryContactName || currentUser?.name || '';
  if (contactDesigInput) contactDesigInput.value = stored.primaryContactDesignation || 'CSR & Partnerships Lead';
  if (contactEmailInput) contactEmailInput.value = stored.primaryContactEmail || currentUser?.email || '';
  if (contactPhoneInput) contactPhoneInput.value = stored.primaryContactPhone || '';
  if (messageInput) messageInput.value = '';
  if (fundingAmtInput) fundingAmtInput.value = '';

  // Clear errors
  ['errContributions', 'errFundingAmount', 'errPartnerMessage', 'errContactName', 'errContactEmail'].forEach(eid => {
    const el = document.getElementById(eid);
    if (el) el.style.display = 'none';
  });

  renderModalContributions();
  renderModalMentorshipAreas();
  renderModalDurations();
  updateConditionalPanels();

  openModal('partnerModal');
}

function renderModalContributions() {
  const container = document.getElementById('modalContributionGrid');
  if (!container) return;

  container.innerHTML = MODAL_CONTRIBUTIONS.map(item => {
    const isSelected = selectedModalContributions.has(item.id);
    const escapedId = item.id.replace(/'/g, "\\'");
    return `
      <div class="collab-card ${isSelected ? 'selected' : ''}" onclick="toggleModalContribution('${escapedId}')">
        <input type="checkbox" class="collab-card-checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleModalContribution('${escapedId}')">
        <span style="font-size:18px">${item.icon}</span>
        <div class="collab-card-text">${item.label}</div>
      </div>
    `;
  }).join('');
}

function toggleModalContribution(capId) {
  if (selectedModalContributions.has(capId)) {
    selectedModalContributions.delete(capId);
  } else {
    selectedModalContributions.add(capId);
  }
  renderModalContributions();
  updateConditionalPanels();
  const errEl = document.getElementById('errContributions');
  if (errEl && selectedModalContributions.size > 0) {
    errEl.style.display = 'none';
  }
}

function renderModalMentorshipAreas() {
  const container = document.getElementById('modalMentorshipPills');
  if (!container) return;

  container.innerHTML = MODAL_MENTOR_AREAS.map(area => {
    const isSelected = selectedModalMentorshipAreas.has(area);
    const escapedArea = area.replace(/'/g, "\\'");
    return `
      <div class="pill ${isSelected ? 'selected' : ''}" onclick="toggleModalMentorshipArea('${escapedArea}')">
        ${isSelected ? '✓ ' : '+ '}${area}
      </div>
    `;
  }).join('');
}

function toggleModalMentorshipArea(domain) {
  if (selectedModalMentorshipAreas.has(domain)) {
    selectedModalMentorshipAreas.delete(domain);
  } else {
    selectedModalMentorshipAreas.add(domain);
  }
  renderModalMentorshipAreas();
}

function renderModalDurations() {
  const container = document.getElementById('modalDurationGrid');
  if (!container) return;

  container.innerHTML = MODAL_DURATIONS.map(dur => {
    const isSelected = selectedModalDuration === dur;
    const escapedDur = dur.replace(/'/g, "\\'");
    return `
      <div class="duration-pill ${isSelected ? 'selected' : ''}" onclick="setModalDuration('${escapedDur}')">
        ${dur}
      </div>
    `;
  }).join('');
}

function setModalDuration(dur) {
  selectedModalDuration = dur;
  renderModalDurations();
}

function updateConditionalPanels() {
  const fundingPanel = document.getElementById('conditionalFundingPanel');
  const mentorPanel = document.getElementById('conditionalMentorshipPanel');

  const needsFunding = selectedModalContributions.has('Funding / CSR Support');
  const needsMentorship = selectedModalContributions.has('Technical Mentorship') || selectedModalContributions.has('Student Mentorship');

  if (fundingPanel) fundingPanel.style.display = needsFunding ? 'block' : 'none';
  if (mentorPanel) mentorPanel.style.display = needsMentorship ? 'block' : 'none';
}

function submitPartnerInterest() {
  let hasError = false;

  // 1. Contributions check
  const errContrib = document.getElementById('errContributions');
  if (selectedModalContributions.size === 0) {
    if (errContrib) errContrib.style.display = 'block';
    hasError = true;
  } else if (errContrib) {
    errContrib.style.display = 'none';
  }

  // 2. Funding check if Funding selected
  const needsFunding = selectedModalContributions.has('Funding / CSR Support');
  const fundingAmtInput = document.getElementById('collabFundingAmount');
  const errFunding = document.getElementById('errFundingAmount');
  const fundingVal = Number(fundingAmtInput?.value) || 0;
  if (needsFunding && (!fundingVal || fundingVal <= 0)) {
    if (errFunding) errFunding.style.display = 'block';
    hasError = true;
  } else if (errFunding) {
    errFunding.style.display = 'none';
  }

  // 3. Message check
  const msgInput = document.getElementById('partnerMessage');
  const errMessage = document.getElementById('errPartnerMessage');
  const msgVal = msgInput?.value.trim() || '';
  if (!msgVal) {
    if (errMessage) errMessage.style.display = 'block';
    hasError = true;
  } else if (errMessage) {
    errMessage.style.display = 'none';
  }

  // 4. Contact person checks
  const nameInput = document.getElementById('collabContactName');
  const errName = document.getElementById('errContactName');
  const nameVal = nameInput?.value.trim() || '';
  if (!nameVal) {
    if (errName) errName.style.display = 'block';
    hasError = true;
  } else if (errName) {
    errName.style.display = 'none';
  }

  const emailInput = document.getElementById('collabContactEmail');
  const errEmail = document.getElementById('errContactEmail');
  const emailVal = emailInput?.value.trim() || '';
  if (!emailVal || !emailVal.includes('@')) {
    if (errEmail) errEmail.style.display = 'block';
    hasError = true;
  } else if (errEmail) {
    errEmail.style.display = 'none';
  }

  if (hasError) return;

  const rawChallenge = allProjects.find(c => c._id === currentPartnerChallengeId);
  const challenge = enrichChallengeData(rawChallenge) || {
    _id: currentPartnerChallengeId,
    title: document.getElementById('partnerProjectTitle')?.textContent || 'Challenge'
  };
  const storedProfile = getStoredProfile() || {};

  const reqId = `REQ-${Date.now().toString().slice(-6)}`;
  const requestPayload = {
    id: reqId,
    challengeId: currentPartnerChallengeId,
    challengeTitle: challenge.title,
    industryName: storedProfile.companyName || currentUser?.name || 'Industry Partner',
    contributions: Array.from(selectedModalContributions),
    fundingAmount: needsFunding ? fundingVal : 0,
    fundingType: needsFunding ? (document.getElementById('collabFundingType')?.value || 'CSR') : '',
    mentorshipAreas: (selectedModalContributions.has('Technical Mentorship') || selectedModalContributions.has('Student Mentorship'))
      ? Array.from(selectedModalMentorshipAreas)
      : [],
    message: msgVal,
    duration: selectedModalDuration || '1–3 Months',
    contactPerson: {
      name: nameVal,
      designation: document.getElementById('collabContactDesignation')?.value.trim() || 'CSR & Partnerships Lead',
      email: emailVal,
      phone: document.getElementById('collabContactPhone')?.value.trim() || ''
    },
    status: 'Pending',
    createdAt: new Date().toISOString()
  };

  const requests = getCollaborationRequests();
  requests.unshift(requestPayload);
  saveCollaborationRequests(requests);

  closeModal('partnerModal');
  Toast.success('Collaboration request sent successfully.');

  // Refresh current views
  if (currentSelectedChallenge && currentSelectedChallenge._id === currentPartnerChallengeId) {
    renderChallengeDetailsPage(currentSelectedChallenge);
  }
  loadExploreChallenges();
  renderFeaturedProjects();
  renderPendingCollaborations();
}

function renderPendingCollaborations() {
  const pendingContainer = document.getElementById('pendingCollabList');
  const badge = document.getElementById('pendingRequestsCountBadge');
  if (!pendingContainer) return;

  const requests = getCollaborationRequests();
  if (badge) {
    badge.textContent = `${requests.length} Pending`;
    badge.style.display = requests.length ? 'inline-block' : 'none';
  }

  if (!requests.length) {
    pendingContainer.innerHTML = `
      <div style="padding:24px;background:#f8fafc;border:1.5px dashed var(--gray-200);border-radius:var(--radius-lg);text-align:center">
        <div style="font-size:24px;margin-bottom:6px">📋</div>
        <div style="font-size:13.5px;font-weight:600;color:var(--gray-700)">No Pending Collaboration Proposals</div>
        <div style="font-size:12px;color:var(--gray-500);margin-top:2px">Propose technical mentorship or CSR support from the <a href="javascript:void(0)" onclick="showSection('explore')" style="color:var(--primary);font-weight:600;text-decoration:underline">Explore Challenges</a> section.</div>
      </div>
    `;
    return;
  }

  pendingContainer.innerHTML = requests.map(req => {
    const timeAgoStr = req.createdAt ? Utils.timeAgo(req.createdAt) : 'Recently';
    const contribBadges = (req.contributions || []).map(c => `<span class="badge badge-assigned" style="font-size:11px">${c}</span>`).join(' ');
    const fundingBadge = req.fundingAmount > 0 ? `<span class="badge" style="background:#ecfdf5;color:#065f46;border-color:#a7f3d0;font-size:11px">₹${Number(req.fundingAmount).toLocaleString('en-IN')} (${req.fundingType || 'Grant'})</span>` : '';
    const mentorBadges = (req.mentorshipAreas || []).length ? `<div style="font-size:11.5px;color:var(--gray-500);margin-top:4px"><strong>Mentorship Areas:</strong> ${req.mentorshipAreas.join(', ')}</div>` : '';

    return `
      <div class="card" style="border-left:4px solid #f59e0b">
        <div class="card-body" style="padding:16px 20px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px">
            <div style="flex:1;min-width:240px">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="font-size:11px;font-weight:700;color:var(--gray-500)">ID: ${req.id}</span>
                <span class="badge" style="background:#fef3c7;color:#92400e;border-color:#fde68a;font-size:11px">⏳ Proposal Pending Review</span>
                <span style="font-size:11px;color:var(--gray-400)">• Submitted ${timeAgoStr}</span>
              </div>
              <div style="font-size:15px;font-weight:750;color:var(--gray-900);cursor:pointer" onclick="openChallengeDetails('${req.challengeId}')">
                ${req.challengeTitle || 'University Innovation Challenge'}
              </div>
            </div>
            <button onclick="openChallengeDetails('${req.challengeId}')" class="btn btn-sm btn-ghost" style="border:1px solid var(--gray-200);font-size:12px">
              View Challenge →
            </button>
          </div>

          <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px">
            <span style="font-size:12px;color:var(--gray-500);font-weight:600">Proposed Contributions:</span>
            ${contribBadges}
            ${fundingBadge}
          </div>
          ${mentorBadges}

          ${req.message ? `<div style="font-size:12.5px;color:var(--gray-600);background:#f8fafc;padding:10px 12px;border-radius:var(--radius-md);border:1px solid var(--gray-200);margin:8px 0;font-style:italic">"${req.message}"</div>` : ''}

          <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--gray-100);padding-top:10px;font-size:12px;color:var(--gray-500);flex-wrap:wrap;gap:8px">
            <div>
              <strong>Contact:</strong> ${req.contactPerson?.name || 'Representative'} (${req.contactPerson?.email || 'N/A'}${req.contactPerson?.phone ? ` · ${req.contactPerson.phone}` : ''})
            </div>
            <div>
              <strong>Duration:</strong> ${req.duration || 'Flexible'}
            </div>
          </div>
      </div>
    `;
  }).join('');
}

// ── Upgraded Project Collaboration Workspace Logic (SIH 2026 Problem 26043) ──

const STORAGE_WORKSPACE_KEY = 'janSetu_project_workspace';
const STORAGE_FEEDBACK_KEY = 'janSetu_project_feedback';
const STORAGE_UPDATES_KEY = 'janSetu_project_updates';

// 10-step full collaboration lifecycle from Challenge identification to Impact Tracking
const WORKSPACE_10_LIFECYCLE_STAGES = [
  'Challenge',
  'University Accepts',
  'Project Workspace',
  'Industry Contribution',
  'Milestones',
  'Prototype',
  'Field Testing',
  'Feedback',
  'Deployment',
  'Impact Analytics'
];

// Centralized Default Mock Data Structure for the Smart Irrigation Project
const DEFAULT_JANSETU_PROJECT = {
  projectId: 'PRJ-001',
  challengeId: '7229B7B8',
  title: 'Smart Irrigation System for Water-Stressed Farms',
  domain: 'Agriculture',
  district: 'Ranchi',
  status: 'In Progress',
  completionPercentage: 65,
  priority: 'High',

  overview: {
    problemStatement: 'Farmers in water-stressed regions face inefficient irrigation and limited access to real-time soil and water information.',
    proposedSolution: 'An IoT-enabled smart irrigation monitoring and control system.',
    projectObjective: 'Reduce water wastage and improve irrigation efficiency through affordable technology.'
  },

  university: {
    name: 'Xavier Institute of Social Service',
    facultyMentor: {
      name: 'Dr. Ananya Sharma',
      role: 'Faculty Mentor & Principal Investigator',
      department: 'Dept. of Rural Management & Agri-Tech',
      avatar: '👩‍🏫'
    },
    students: [
      { name: 'Rahul Kumar', role: 'Student Team Lead (IoT & Firmware)', avatar: '👨‍🎓' },
      { name: 'Priya Singh', role: 'Sensor Integration & Calibration', avatar: '👩‍🎓' },
      { name: 'Aman Verma', role: 'Embedded Systems & Cloud Sync', avatar: '👨‍🎓' },
      { name: 'Neha Gupta', role: 'Field Testing & Data Analysis', avatar: '👩‍🎓' }
    ]
  },

  industry: {
    name: 'ABC Technologies',
    mentor: {
      name: 'Vikram Sinha',
      role: 'Industry Mentor & CSR Director',
      org: 'ABC Technologies',
      avatar: '👨‍💼'
    },
    technicalExpert: {
      name: 'Arjun Mehta',
      role: 'Technical Expert & Senior IoT Architect',
      org: 'ABC Technologies Hardware Lab',
      avatar: '👨‍💻'
    }
  },

  contributions: [
    { id: 'CONT-1', icon: '💰', title: 'Funding', value: '₹5,00,000', desc: 'Direct CSR financial grant for component procurement & fabrication', status: 'Active' },
    { id: 'CONT-2', icon: '👨‍🏫', title: 'Mentorship', value: 'Technical mentorship', desc: 'Technical mentorship on LoRaWAN protocol and firmware reliability', status: 'Active' },
    { id: 'CONT-3', icon: '🛠️', title: 'Technical Support', value: 'IoT hardware and engineering support', desc: 'IoT hardware gateways, microcontrollers, and engineering test benches', status: 'Active' },
    { id: 'CONT-4', icon: '🧪', title: 'Testing', value: 'Access to testing facilities', desc: 'Access to environmental chamber and rapid prototyping facilities', status: 'Active' },
    { id: 'CONT-5', icon: '🚀', title: 'Deployment', value: 'Field deployment assistance', desc: 'Field deployment assistance, sahayak training, and farmer onboarding', status: 'Pending' }
  ],

  milestones: [
    {
      id: 'M1',
      title: 'Problem Validation',
      status: 'Completed',
      startedDate: '01 Jul 2026',
      expectedDate: '20 Jul 2026',
      description: 'On-ground surveys with 100+ farmers across Ranchi to identify water scarcity patterns and irrigation frequency bottlenecks.',
      progress: 100
    },
    {
      id: 'M2',
      title: 'Research & Planning',
      status: 'Completed',
      startedDate: '22 Jul 2026',
      expectedDate: '08 Aug 2026',
      description: 'Literature review on soil permittivity, LoRaWAN range in rural terrain, and solar power budgeting for field sensors.',
      progress: 100
    },
    {
      id: 'M3',
      title: 'Solution Design',
      status: 'Completed',
      startedDate: '10 Aug 2026',
      expectedDate: '25 Aug 2026',
      description: 'Circuit schematic drafting, microcontroller selection, and industrial casing CAD models with ingress protection.',
      progress: 100
    },
    {
      id: 'M4',
      title: 'Prototype Development',
      status: 'In Progress',
      startedDate: '12 Aug 2026',
      expectedDate: '20 Sep 2026',
      description: 'Assembling v1.0 prototype units, calibrating capacitive moisture probes, and testing local telemetry dashboards.',
      progress: 70
    },
    {
      id: 'M5',
      title: 'Field Testing',
      status: 'Pending',
      startedDate: '22 Sep 2026',
      expectedDate: '15 Oct 2026',
      description: 'Deploying 3 pilot test beds across Ranchi farm clusters with 500 target farmers for live validation.',
      progress: 0
    },
    {
      id: 'M6',
      title: 'Community Feedback',
      status: 'Pending',
      startedDate: '16 Oct 2026',
      expectedDate: '05 Nov 2026',
      description: 'Structured farmer interviews, usability evaluations of SMS alerts, and valve actuation timing adjustments.',
      progress: 0
    },
    {
      id: 'M7',
      title: 'Deployment',
      status: 'Pending',
      startedDate: '10 Nov 2026',
      expectedDate: '30 Nov 2026',
      description: 'Handover of production-ready smart irrigation units with Krishi Vigyan Kendra extension team training.',
      progress: 0
    },
    {
      id: 'M8',
      title: 'Impact Measurement',
      status: 'Pending',
      startedDate: '01 Dec 2026',
      expectedDate: '31 Dec 2026',
      description: 'Auditing water savings, crop yield improvements, and telemetry data for CSR sustainability report.',
      progress: 0
    }
  ],

  progressBreakdown: [
    { phase: 'Research', percent: 100 },
    { phase: 'Design', percent: 100 },
    { phase: 'Prototype', percent: 70 },
    { phase: 'Field Testing', percent: 0 },
    { phase: 'Deployment', percent: 0 },
    { phase: 'Impact Tracking', percent: 0 }
  ],

  health: {
    timeline: { status: 'On Track', icon: '🟢' },
    budget: { status: 'On Track', icon: '🟢' },
    prototype: { status: 'Needs Attention', icon: '🟡' },
    fieldTesting: { status: 'Not Started', icon: '⚪' },
    deployment: { status: 'Not Started', icon: '⚪' }
  },

  prototype: {
    version: 'v1.0',
    status: 'Testing',
    lastUpdated: '04 Sept 2026',
    features: [
      { name: 'Sensor Monitoring', icon: '✓', completed: true },
      { name: 'Dashboard', icon: '✓', completed: true },
      { name: 'Data Collection', icon: '✓', completed: true },
      { name: 'Alert System', icon: '✓', completed: true },
      { name: 'Automated Control', icon: '⏳', completed: false }
    ],
    notes: 'Microcontroller telemetry integrated with MPPT solar charge controller. Capacitive soil moisture sensors calibrated across Ranchi sandy-loam soil. Automated solenoid valve bench-tested.'
  },

  fieldTesting: {
    location: 'Ranchi District',
    status: 'Not Started',
    plannedSites: 3,
    targetUsers: 500,
    checklist: [
      { id: 'chk-1', text: 'Hardware Installation', completed: false },
      { id: 'chk-2', text: 'Sensor Calibration', completed: false },
      { id: 'chk-3', text: 'Data Collection', completed: false },
      { id: 'chk-4', text: 'User Testing', completed: false },
      { id: 'chk-5', text: 'Performance Evaluation', completed: false }
    ]
  },

  feedback: [
    {
      id: 'FB-01',
      author: 'Vikram Sinha',
      role: 'Industry Mentor & Technical Lead (ABC Technologies)',
      rating: 4,
      date: '02 Sept 2026',
      comment: 'The prototype demonstrates promising sensor integration. Improve battery efficiency before field deployment.'
    }
  ],

  activities: [
    {
      id: 'ACT-01',
      date: '04 Sept 2026',
      actor: 'University Team',
      role: 'Student Innovation Team',
      avatar: '🎓',
      action: 'Prototype v1.0 submitted for industry review.'
    },
    {
      id: 'ACT-02',
      date: '02 Sept 2026',
      actor: 'Industry Mentor',
      role: 'Vikram Sinha, ABC Tech',
      avatar: '👨‍🏫',
      action: 'Technical feedback added.'
    },
    {
      id: 'ACT-03',
      date: '28 Aug 2026',
      actor: 'Industry Partner',
      role: 'ABC Technologies',
      avatar: '🏭',
      action: 'Testing equipment support confirmed.'
    },
    {
      id: 'ACT-04',
      date: '25 Aug 2026',
      actor: 'Faculty Mentor',
      role: 'Dr. Ananya Sharma',
      avatar: '👩‍🏫',
      action: 'Research phase completed.'
    }
  ],

  documents: [
    { id: 'DOC-01', title: 'Project Proposal', updated: '25 Aug 2026', type: 'Project Proposal', size: '2.4 MB', icon: '📄' },
    { id: 'DOC-02', title: 'Technical Documentation', updated: '02 Sept 2026', type: 'Technical Spec', size: '3.8 MB', icon: '📄' },
    { id: 'DOC-03', title: 'Prototype Report', updated: '04 Sept 2026', type: 'Prototype Report', size: '1.9 MB', icon: '📄' },
    { id: 'DOC-04', title: 'Testing Plan', updated: '04 Sept 2026', type: 'Testing Plan', size: '1.2 MB', icon: '📄' }
  ],

  upcomingActions: [
    { id: 'ACT-U1', title: 'Complete prototype testing', due: '20 Sept', priority: 'High', status: 'In Progress' },
    { id: 'ACT-U2', title: 'Review technical documentation', due: '18 Sept', priority: 'Medium', status: 'Pending' },
    { id: 'ACT-U3', title: 'Prepare field testing', due: '25 Sept', priority: 'High', status: 'Scheduled' },
    { id: 'ACT-U4', title: 'Schedule university-industry review', due: '28 Sept', priority: 'Medium', status: 'Upcoming' }
  ],

  messages: [
    {
      id: 'MSG-01',
      sender: 'Industry Mentor (Vikram Sinha)',
      role: 'ABC Technologies',
      time: '02 Sept 2026, 11:30 AM',
      text: 'Please share the updated prototype documentation.',
      isIndustry: true
    },
    {
      id: 'MSG-02',
      sender: 'University Team (Rahul Kumar)',
      role: 'Student Lead, XISS',
      time: '02 Sept 2026, 02:15 PM',
      text: 'Updated documentation has been uploaded.',
      isIndustry: false
    }
  ],

  expectedImpact: {
    targetFarmers: 500,
    expectedWaterEfficiency: '25%',
    targetVillages: 3,
    expectedDeployment: 'Q4 2026'
  }
};

let currentActiveWorkspace = null;

// LocalStorage helpers
function getStoredProjectWorkspace(projectId) {
  try {
    const raw = localStorage.getItem(STORAGE_WORKSPACE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.projectId === projectId || (!projectId && parsed.projectId === 'PRJ-001'))) {
        return parsed;
      }
      if (typeof parsed === 'object' && parsed[projectId]) {
        return parsed[projectId];
      }
    }
  } catch (e) {
    console.error('Failed to parse stored workspace:', e);
  }
  return null;
}

function saveStoredProjectWorkspace(ws) {
  if (!ws) return;
  try {
    localStorage.setItem(STORAGE_WORKSPACE_KEY, JSON.stringify(ws));
  } catch (e) {
    console.error('Failed to save project workspace to localStorage:', e);
  }
}

function getStoredFeedbackList() {
  try {
    const raw = localStorage.getItem(STORAGE_FEEDBACK_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveStoredFeedbackList(list) {
  try {
    localStorage.setItem(STORAGE_FEEDBACK_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save feedback to localStorage:', e);
  }
}

function getStoredUpdatesList() {
  try {
    const raw = localStorage.getItem(STORAGE_UPDATES_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveStoredUpdatesList(list) {
  try {
    localStorage.setItem(STORAGE_UPDATES_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save updates to localStorage:', e);
  }
}

// Main loader for project workspace
function getProjectWorkspace(projectId) {
  // Try retrieving from localStorage
  const stored = getStoredProjectWorkspace(projectId);
  let ws = stored ? JSON.parse(JSON.stringify(stored)) : JSON.parse(JSON.stringify(DEFAULT_JANSETU_PROJECT));

  // If a specific non-PRJ-001 project is requested, adapt basic metadata while keeping full workspace capability
  if (projectId && projectId !== 'PRJ-001') {
    const matched = (allProjects || []).find(p => p._id === projectId);
    if (matched) {
      ws.projectId = matched._id;
      ws.challengeId = (matched._id || '').slice(-8).toUpperCase();
      ws.title = matched.title || ws.title;
      ws.domain = matched.category || ws.domain;
      ws.district = matched.location?.district || ws.district;
      if (matched.assignedUniversity) {
        ws.university.name = matched.assignedUniversity.name || matched.assignedUniversity.shortName || ws.university.name;
      }
    }
  }

  // Merge stored feedback if present
  const storedFeedback = getStoredFeedbackList();
  if (storedFeedback && Array.isArray(storedFeedback)) {
    ws.feedback = storedFeedback;
  }

  // Merge stored updates if present
  const storedUpdates = getStoredUpdatesList();
  if (storedUpdates && Array.isArray(storedUpdates)) {
    ws.messages = storedUpdates;
  }

  return ws;
}

function openProjectWorkspace(projectId) {
  const ws = getProjectWorkspace(projectId || 'PRJ-001');
  if (!ws) {
    Toast.error('Workspace Not Found', 'Unable to load project collaboration workspace.');
    return;
  }
  currentActiveWorkspace = ws;
  renderProjectWorkspace(ws);
  showSection('project-workspace');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Render 10-step lifecycle bar
function renderWorkspaceLifecycle(currentStage) {
  const activeStageIndex = 5; // Stage 6: Prototype Development (0-indexed: 5)
  return WORKSPACE_10_LIFECYCLE_STAGES.map((stage, idx) => {
    const isCompleted = idx < activeStageIndex;
    const isCurrent = idx === activeStageIndex;
    const statusClass = isCompleted ? 'completed' : (isCurrent ? 'in-progress' : 'upcoming');
    const dotContent = isCompleted ? '✓' : (isCurrent ? '●' : '○');
    const statusText = isCompleted ? 'Completed' : (isCurrent ? 'In Progress' : 'Pending');

    return `
      <div class="lifecycle-10-step ${statusClass}" title="${stage}: ${statusText}">
        <div class="lifecycle-10-dot">${dotContent}</div>
        <div class="lifecycle-10-label">${stage}</div>
        <div class="lifecycle-10-status">${statusText}</div>
      </div>
    `;
  }).join('');
}

// Master Render Function for Upgraded Workspace
function renderProjectWorkspace(ws) {
  const container = document.getElementById('projectWorkspaceContainer');
  if (!container || !ws) return;

  const checkedChecklistCount = (ws.fieldTesting.checklist || []).filter(c => c.completed).length;
  const totalChecklistCount = (ws.fieldTesting.checklist || []).length;

  container.innerHTML = `
    <!-- Top Navigation -->
    <div class="workspace-top-nav">
      <button onclick="showSection('collaborations')" class="btn btn-ghost" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:1px solid var(--gray-200);border-radius:var(--radius-md);font-weight:600">
        <span>←</span> Back to Collaborations
      </button>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button onclick="openProjectReportModal()" class="btn btn-outline-primary" style="display:inline-flex;align-items:center;gap:6px;font-weight:700">
          <span>📄</span> Project Report
        </button>
        <button onclick="navigateToImpactAnalytics()" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:6px;font-weight:700;box-shadow:var(--shadow-sm)">
          <span>📊</span> View Impact & Analytics →
        </button>
      </div>
    </div>

    <!-- 1. PROJECT HEADER -->
    <div class="workspace-header-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:8px">
        <div>
          <h1 class="workspace-title" style="margin:0 0 6px 0">${ws.title}</h1>
          <div class="workspace-meta-row">
            <span style="font-weight:750;font-size:14px;color:var(--gray-800)">${ws.domain} • ${ws.district}</span>
            <span>•</span>
            <span class="badge badge-assigned" style="font-size:12px;padding:3px 10px;font-weight:750">Status: ${ws.status}</span>
            <span>•</span>
            <span class="badge" style="font-size:12px;padding:3px 10px;font-weight:800;background:#eff6ff;color:var(--primary);border:1px solid #bfdbfe">Completion: ${ws.completionPercentage}%</span>
            <span>•</span>
            <span style="font-size:12px;font-weight:800;color:var(--primary);background:var(--primary-50);padding:3px 10px;border-radius:var(--radius-full);border:1px solid var(--primary-100)">
              Challenge ID: #${(ws.challengeId || '7229B7B8')}
            </span>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button onclick="showSection('collaborations')" class="btn btn-sm btn-ghost" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border:1px solid var(--gray-200);border-radius:var(--radius-md);font-weight:700">
            <span>←</span> Back to Collaborations
          </button>
          <button onclick="openProjectReportModal()" class="btn btn-sm btn-outline-primary" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;font-weight:700">
            <span>📄</span> Project Report
          </button>
        </div>
      </div>

      <!-- University and Industry Parties Bar -->
      <div class="workspace-parties-bar">
        <div class="workspace-party-pill">
          <span style="font-size:18px">🏛️</span>
          <span><strong>University:</strong> ${ws.university.name}</span>
        </div>
        <span style="color:var(--gray-300)">|</span>
        <div class="workspace-party-pill">
          <span style="font-size:18px">🏭</span>
          <span><strong>Industry Partner:</strong> ${ws.industry.name}</span>
        </div>
        <span style="color:var(--gray-300)">|</span>
        <div class="workspace-party-pill">
          <span style="font-size:16px">📍</span>
          <span><strong>Location:</strong> ${ws.district}, Jharkhand</span>
        </div>
      </div>

      <!-- Header Completion Bar -->
      <div class="workspace-progress-panel">
        <div style="flex:1;min-width:260px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:13px;font-weight:750;color:var(--gray-800)">
              Current Milestone: <span style="color:var(--primary)">Prototype Development</span>
            </span>
            <span style="font-size:15px;font-weight:850;color:var(--primary)">${ws.completionPercentage}% Complete</span>
          </div>
          <div class="progress-bar" style="height:9px">
            <div class="progress-fill" style="width:${ws.completionPercentage}%"></div>
          </div>
        </div>
        <button onclick="openAddFeedbackModal()" class="btn btn-sm btn-outline-primary" style="font-weight:700;display:inline-flex;align-items:center;gap:6px">
          <span>⭐</span> Add Industry Review
        </button>
      </div>
    </div>

    <!-- Visual Collaboration Lifecycle Tracker (10 Stages) -->
    <div class="workspace-lifecycle-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:18px">🔄</span>
          <div style="font-size:15px;font-weight:800;color:var(--gray-900)">Industry-University Collaboration Lifecycle</div>
        </div>
        <div style="font-size:12px;color:var(--gray-500)">
          Stage <strong>6 of 10</strong>: <span style="color:var(--primary);font-weight:700">Prototype Development</span> (Active)
        </div>
      </div>
      <div class="lifecycle-10-track">
        ${renderWorkspaceLifecycle('Prototype')}
      </div>
    </div>

    <!-- ── 2-COLUMN DASHBOARD GRID ── -->
    <div class="workspace-dashboard-grid">

      <!-- ════════ LEFT COLUMN: Primary Execution Stream ════════ -->
      <div class="workspace-col">

        <!-- 2. PROJECT OVERVIEW -->
        <div class="card">
          <div class="card-header" style="padding:18px 24px 12px;border-bottom:1px solid var(--gray-100)">
            <h2 style="font-size:16px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
              <span>📋</span> Project Overview
            </h2>
          </div>
          <div class="card-body" style="padding:20px 24px;display:flex;flex-direction:column;gap:14px">
            <div style="background:#fafbfc;border:1px solid var(--gray-200);border-radius:var(--radius-md);padding:14px 16px">
              <div style="font-size:11px;font-weight:800;color:var(--primary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">
                Problem Statement
              </div>
              <div style="font-size:13.5px;color:var(--gray-800);line-height:1.5">
                ${ws.overview.problemStatement}
              </div>
            </div>

            <div style="background:#fafbfc;border:1px solid var(--gray-200);border-radius:var(--radius-md);padding:14px 16px">
              <div style="font-size:11px;font-weight:800;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">
                Proposed Solution
              </div>
              <div style="font-size:13.5px;color:var(--gray-800);line-height:1.5">
                ${ws.overview.proposedSolution}
              </div>
            </div>

            <div style="background:#fafbfc;border:1px solid var(--gray-200);border-radius:var(--radius-md);padding:14px 16px">
              <div style="font-size:11px;font-weight:800;color:#d97706;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">
                Project Objective
              </div>
              <div style="font-size:13.5px;color:var(--gray-800);line-height:1.5">
                ${ws.overview.projectObjective}
              </div>
            </div>
          </div>
        </div>

        <!-- 5. MILESTONE TRACKER -->
        <div class="card">
          <div class="card-header" style="padding:18px 24px 12px;border-bottom:1px solid var(--gray-100)">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
              <h2 style="font-size:16px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
                <span>🎯</span> Project Milestones Roadmap
              </h2>
              <span class="badge badge-assigned" style="font-size:11.5px">3 Completed • 1 In Progress • 4 Pending</span>
            </div>
          </div>
          <div class="card-body" style="padding:20px 24px">
            <div class="milestone-roadmap">
              ${ws.milestones.map((m, idx) => {
                const isDone = m.status === 'Completed';
                const isInProg = m.status === 'In Progress';
                const statusClass = isDone ? 'completed' : (isInProg ? 'in-progress' : 'pending');
                const badgeClass = isDone ? 'badge-resolved' : (isInProg ? 'badge-assigned' : 'badge-submitted');
                const badgeIcon = isDone ? '✓' : (isInProg ? '●' : '○');

                return `
                  <div class="milestone-item ${statusClass}">
                    <div class="milestone-header">
                      <div>
                        <span style="font-size:11px;font-weight:800;color:var(--primary);letter-spacing:0.5px">STAGE ${idx + 1}</span>
                        <div class="milestone-title-text">${m.title}</div>
                      </div>
                      <span class="badge ${badgeClass}" style="font-size:11px">${badgeIcon} ${m.status}</span>
                    </div>
                    <div class="milestone-dates">
                      <span><strong>Started:</strong> ${m.startedDate}</span>
                      <span>•</span>
                      <span><strong>Expected:</strong> ${m.expectedDate}</span>
                    </div>
                    <p style="font-size:12.5px;color:var(--gray-600);line-height:1.45;margin:0 0 10px 0">
                      ${m.description}
                    </p>
                    <div class="progress-bar" style="height:5px">
                      <div class="progress-fill" style="width:${m.progress}%"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- 7. PROTOTYPE STATUS -->
        <div class="card">
          <div class="card-header" style="padding:18px 24px 12px;border-bottom:1px solid var(--gray-100)">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
              <h2 style="font-size:16px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
                <span>🛠️</span> Prototype Development
              </h2>
              <span class="badge badge-assigned" style="font-size:11.5px">● Status: ${ws.prototype.status}</span>
            </div>
          </div>
          <div class="card-body" style="padding:20px 24px">
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));gap:12px;margin-bottom:16px">
              <div style="padding:12px 14px;background:#f8fafc;border:1px solid var(--gray-200);border-radius:var(--radius-md)">
                <div style="font-size:11px;color:var(--gray-500);font-weight:600">PROTOTYPE VERSION</div>
                <div style="font-size:18px;font-weight:850;color:var(--primary);margin-top:3px">${ws.prototype.version}</div>
              </div>
              <div style="padding:12px 14px;background:#f8fafc;border:1px solid var(--gray-200);border-radius:var(--radius-md)">
                <div style="font-size:11px;color:var(--gray-500);font-weight:600">STATUS</div>
                <div style="font-size:18px;font-weight:850;color:var(--accent);margin-top:3px">${ws.prototype.status}</div>
              </div>
              <div style="padding:12px 14px;background:#f8fafc;border:1px solid var(--gray-200);border-radius:var(--radius-md)">
                <div style="font-size:11px;color:var(--gray-500);font-weight:600">LAST UPDATED</div>
                <div style="font-size:14px;font-weight:800;color:var(--gray-800);margin-top:6px">${ws.prototype.lastUpdated}</div>
              </div>
            </div>

            <div style="font-size:12.5px;font-weight:750;color:var(--gray-800);margin-bottom:8px">Engineered Capabilities & Features:</div>
            <div class="prototype-features-grid">
              ${ws.prototype.features.map(f => `
                <div class="prototype-feature-chip ${f.completed ? 'done' : 'pending'}">
                  <span>${f.icon}</span>
                  <span>${f.name}</span>
                </div>
              `).join('')}
            </div>

            <div style="background:#fafbfc;border:1px solid var(--gray-200);border-radius:var(--radius-md);padding:14px;margin-bottom:16px;font-size:12.5px;color:var(--gray-700);line-height:1.5">
              <strong>Architecture Note:</strong> ${ws.prototype.notes}
            </div>

            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button onclick="openPrototypePreviewModal()" class="btn btn-sm btn-primary" style="display:inline-flex;align-items:center;gap:6px;font-weight:700">
                <span>👁️</span> View Prototype
              </button>
              <button onclick="viewDocument('Technical Documentation')" class="btn btn-sm btn-ghost" style="border:1px solid var(--gray-200);display:inline-flex;align-items:center;gap:6px;font-weight:600">
                <span>📑</span> View Documentation
              </button>
            </div>
          </div>
        </div>

        <!-- 8. FIELD TESTING -->
        <div class="card">
          <div class="card-header" style="padding:18px 24px 12px;border-bottom:1px solid var(--gray-100)">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
              <h2 style="font-size:16px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
                <span>🧪</span> Field Testing
              </h2>
              <span class="badge ${checkedChecklistCount === totalChecklistCount ? 'badge-resolved' : 'badge-pending'}" id="fieldTestingStatusBadge" style="font-size:11.5px">
                ${checkedChecklistCount === totalChecklistCount ? 'Completed' : (checkedChecklistCount > 0 ? `${checkedChecklistCount}/${totalChecklistCount} In Progress` : ws.fieldTesting.status)}
              </span>
            </div>
          </div>
          <div class="card-body" style="padding:20px 24px">
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:12px;margin-bottom:16px">
              <div style="padding:12px 14px;background:#f8fafc;border:1px solid var(--gray-200);border-radius:var(--radius-md)">
                <div style="font-size:11px;color:var(--gray-500);font-weight:600">TESTING LOCATION</div>
                <div style="font-size:15px;font-weight:800;color:var(--gray-900);margin-top:3px">${ws.fieldTesting.location}</div>
              </div>
              <div style="padding:12px 14px;background:#f8fafc;border:1px solid var(--gray-200);border-radius:var(--radius-md)">
                <div style="font-size:11px;color:var(--gray-500);font-weight:600">PLANNED SITES</div>
                <div style="font-size:18px;font-weight:850;color:var(--primary);margin-top:3px">${ws.fieldTesting.plannedSites} Test Sites</div>
              </div>
              <div style="padding:12px 14px;background:#f8fafc;border:1px solid var(--gray-200);border-radius:var(--radius-md)">
                <div style="font-size:11px;color:var(--gray-500);font-weight:600">TARGET USERS</div>
                <div style="font-size:18px;font-weight:850;color:var(--accent);margin-top:3px">${ws.fieldTesting.targetUsers} Farmers</div>
              </div>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span style="font-size:12.5px;font-weight:750;color:var(--gray-800)">On-Ground Testing Checklist:</span>
              <span style="font-size:12px;color:var(--primary);font-weight:700" id="checklistProgressText">
                ${checkedChecklistCount} of ${totalChecklistCount} Completed
              </span>
            </div>

            <!-- Interactive Checkbox UI with LocalStorage Persistence -->
            <div class="field-checklist">
              ${ws.fieldTesting.checklist.map(item => `
                <label class="field-checklist-item ${item.completed ? 'checked' : ''}" onclick="toggleFieldTestChecklist('${item.id}')">
                  <input type="checkbox" class="field-checklist-checkbox" ${item.completed ? 'checked' : ''} onchange="event.stopPropagation()">
                  <span class="task-text" style="font-size:13px;font-weight:650;color:var(--gray-800)">${item.text}</span>
                </label>
              `).join('')}
            </div>
            <div style="font-size:11px;color:var(--gray-400);margin-top:8px">
              💡 Interactive prototype: click items to toggle completion. State is saved in browser storage.
            </div>
          </div>
        </div>

        <!-- 10. INDUSTRY REVIEW -->
        <div class="card">
          <div class="card-header" style="padding:18px 24px 12px;border-bottom:1px solid var(--gray-100)">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
              <h2 style="font-size:16px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
                <span>⭐</span> Industry Review
              </h2>
              <button onclick="openAddFeedbackModal()" class="btn btn-sm btn-primary" style="display:inline-flex;align-items:center;gap:6px">
                <span>+</span> Add Feedback
              </button>
            </div>
          </div>
          <div class="card-body" style="padding:20px 24px">
            <div style="display:flex;flex-direction:column;gap:14px" id="wsFeedbackContainer">
              ${ws.feedback.map(fb => `
                <div style="padding:16px 18px;background:#fafbfc;border:1px solid var(--gray-200);border-radius:var(--radius-lg)">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;flex-wrap:wrap;gap:8px">
                    <div>
                      <div style="font-size:14px;font-weight:800;color:var(--gray-900)">Technical Review</div>
                      <div style="font-size:12px;color:var(--gray-500);margin-top:2px">${fb.author} • ${fb.role}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px">
                      <span style="font-size:15px;color:#f59e0b;letter-spacing:1px">
                        ${'★'.repeat(fb.rating || 4)}${'☆'.repeat(5 - (fb.rating || 4))}
                      </span>
                      <span style="font-size:13px;font-weight:800;color:var(--gray-700)">${fb.rating || 4}/5</span>
                    </div>
                  </div>
                  <div style="font-size:13px;color:var(--gray-700);line-height:1.55;font-style:italic;background:white;padding:12px 14px;border-radius:var(--radius-md);border:1px solid var(--gray-200);margin-top:6px">
                    "${fb.comment}"
                  </div>
                  <div style="font-size:11px;color:var(--gray-400);margin-top:8px;text-align:right">
                    Reviewed on ${fb.date}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- 15 & 16. EXPECTED IMPACT (Outcome Preview & Connection) -->
        <div class="expected-impact-banner">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px">
            <div>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:20px">📈</span>
                <h3 style="font-size:17px;font-weight:850;color:var(--gray-900);margin:0">Expected Impact</h3>
                <span class="badge" style="background:#dbeafe;color:#1e40af;border-color:#bfdbfe;font-size:11px;font-weight:800">
                  Target / Expected Outcomes
                </span>
              </div>
              <div style="font-size:12.5px;color:var(--gray-600);margin-top:4px">
                Anticipated field metrics upon deployment across Ranchi tribal clusters. (Target benchmarks, not yet achieved results).
              </div>
            </div>
            <button onclick="navigateToImpactAnalytics()" class="btn btn-sm btn-primary" style="display:inline-flex;align-items:center;gap:6px;font-weight:700">
              <span>📊</span> View Impact & Analytics
            </button>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:12px">
            <div style="background:white;border:1px solid #bfdbfe;padding:14px;border-radius:var(--radius-md);text-align:center">
              <div style="font-size:11px;font-weight:700;color:var(--gray-500)">TARGET FARMERS</div>
              <div style="font-size:20px;font-weight:850;color:var(--primary);margin-top:4px">${ws.expectedImpact.targetFarmers}</div>
              <div style="font-size:11px;color:var(--gray-400);margin-top:2px">Smallholder beneficiaries</div>
            </div>
            <div style="background:white;border:1px solid #bfdbfe;padding:14px;border-radius:var(--radius-md);text-align:center">
              <div style="font-size:11px;font-weight:700;color:var(--gray-500)">WATER EFFICIENCY</div>
              <div style="font-size:20px;font-weight:850;color:var(--accent);margin-top:4px">${ws.expectedImpact.expectedWaterEfficiency}</div>
              <div style="font-size:11px;color:var(--gray-400);margin-top:2px">Expected conservation</div>
            </div>
            <div style="background:white;border:1px solid #bfdbfe;padding:14px;border-radius:var(--radius-md);text-align:center">
              <div style="font-size:11px;font-weight:700;color:var(--gray-500)">TARGET VILLAGES</div>
              <div style="font-size:20px;font-weight:850;color:#d97706;margin-top:4px">${ws.expectedImpact.targetVillages}</div>
              <div style="font-size:11px;color:var(--gray-400);margin-top:2px">Ranchi District</div>
            </div>
            <div style="background:white;border:1px solid #bfdbfe;padding:14px;border-radius:var(--radius-md);text-align:center">
              <div style="font-size:11px;font-weight:700;color:var(--gray-500)">EXPECTED DEPLOYMENT</div>
              <div style="font-size:18px;font-weight:850;color:var(--gray-900);margin-top:4px">${ws.expectedImpact.expectedDeployment}</div>
              <div style="font-size:11px;color:var(--gray-400);margin-top:2px">Field rollout target</div>
            </div>
          </div>
        </div>

      </div>

      <!-- ════════ RIGHT COLUMN: Governance, Health & Comms Stream ════════ -->
      <div class="workspace-col">

        <!-- 14. PROJECT HEALTH -->
        <div class="card">
          <div class="card-header" style="padding:18px 20px 12px;border-bottom:1px solid var(--gray-100)">
            <h2 style="font-size:15.5px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
              <span>🩺</span> Project Health
            </h2>
          </div>
          <div class="card-body" style="padding:16px 20px">
            <div class="health-matrix">
              <div class="health-item">
                <span class="health-label">Timeline</span>
                <span class="health-status" style="color:#059669">${ws.health.timeline.icon} ${ws.health.timeline.status}</span>
              </div>
              <div class="health-item">
                <span class="health-label">Budget</span>
                <span class="health-status" style="color:#059669">${ws.health.budget.icon} ${ws.health.budget.status}</span>
              </div>
              <div class="health-item">
                <span class="health-label">Prototype</span>
                <span class="health-status" style="color:#b45309">${ws.health.prototype.icon} ${ws.health.prototype.status}</span>
              </div>
              <div class="health-item">
                <span class="health-label">Field Testing</span>
                <span class="health-status" style="color:var(--gray-500)">${ws.health.fieldTesting.icon} ${ws.health.fieldTesting.status}</span>
              </div>
              <div class="health-item">
                <span class="health-label">Deployment</span>
                <span class="health-status" style="color:var(--gray-500)">${ws.health.deployment.icon} ${ws.health.deployment.status}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 6. OVERALL PROJECT PROGRESS -->
        <div class="card">
          <div class="card-header" style="padding:18px 20px 12px;border-bottom:1px solid var(--gray-100)">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <h2 style="font-size:15.5px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
                <span>📊</span> Overall Project Progress
              </h2>
              <span style="font-size:15px;font-weight:850;color:var(--primary)">${ws.completionPercentage}% Complete</span>
            </div>
          </div>
          <div class="card-body" style="padding:18px 20px">
            <div class="progress-bar" style="height:9px;margin-bottom:16px">
              <div class="progress-fill" style="width:${ws.completionPercentage}%"></div>
            </div>

            <div class="progress-breakdown-list">
              ${ws.progressBreakdown.map(b => `
                <div class="progress-breakdown-item">
                  <div class="progress-breakdown-header">
                    <span>${b.phase}</span>
                    <span style="color:${b.percent > 0 ? (b.percent === 100 ? 'var(--accent)' : 'var(--primary)') : 'var(--gray-400)'}">
                      ${b.percent}%
                    </span>
                  </div>
                  <div class="progress-bar" style="height:6px">
                    <div class="progress-fill" style="width:${b.percent}%;background:${b.percent === 100 ? 'var(--accent)' : 'var(--primary)'}"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- 4. INDUSTRY CONTRIBUTION -->
        <div class="card">
          <div class="card-header" style="padding:18px 20px 12px;border-bottom:1px solid var(--gray-100)">
            <h2 style="font-size:15.5px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
              <span>🤝</span> Industry Contribution
            </h2>
          </div>
          <div class="card-body" style="padding:16px 20px">
            <div style="display:flex;flex-direction:column;gap:10px">
              ${ws.contributions.map(c => `
                <div class="contribution-card">
                  <div class="contribution-top">
                    <div class="contribution-title">
                      <span>${c.icon}</span>
                      <span>${c.title}</span>
                    </div>
                    <span class="badge ${c.status === 'Active' ? 'badge-resolved' : 'badge-pending'}" style="font-size:10.5px">
                      ${c.status}
                    </span>
                  </div>
                  <div class="contribution-val">${c.value}</div>
                  <div class="contribution-desc">${c.desc}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- 3. COLLABORATION TEAM -->
        <div class="card">
          <div class="card-header" style="padding:18px 20px 12px;border-bottom:1px solid var(--gray-100)">
            <h2 style="font-size:15.5px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
              <span>👥</span> Project Team
            </h2>
          </div>
          <div class="card-body" style="padding:16px 20px;display:flex;flex-direction:column;gap:16px">
            <!-- University Participants -->
            <div>
              <div style="font-size:12px;font-weight:800;color:var(--primary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">
                🏛️ UNIVERSITY (XISS)
              </div>
              <div style="display:flex;flex-direction:column;gap:8px">
                <div class="team-member-box" style="background:#eff6ff;border-color:#bfdbfe">
                  <span style="font-size:20px">${ws.university.facultyMentor.avatar}</span>
                  <div>
                    <div style="font-size:13.5px;font-weight:800;color:var(--gray-900)">${ws.university.facultyMentor.name}</div>
                    <div style="font-size:11.5px;color:var(--primary);font-weight:650">Faculty Mentor</div>
                  </div>
                </div>
                ${ws.university.students.map(s => `
                  <div class="team-member-box">
                    <span style="font-size:18px">${s.avatar}</span>
                    <div>
                      <div style="font-size:13px;font-weight:750;color:var(--gray-900)">${s.name}</div>
                      <div style="font-size:11px;color:var(--gray-500)">Student Team • ${s.role}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Industry Participants -->
            <div>
              <div style="font-size:12px;font-weight:800;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">
                🏭 INDUSTRY (ABC TECHNOLOGIES)
              </div>
              <div style="display:flex;flex-direction:column;gap:8px">
                <div class="team-member-box" style="background:#ecfdf5;border-color:#a7f3d0">
                  <span style="font-size:20px">${ws.industry.mentor.avatar}</span>
                  <div>
                    <div style="font-size:13.5px;font-weight:800;color:var(--gray-900)">${ws.industry.mentor.name}</div>
                    <div style="font-size:11.5px;color:#047857;font-weight:650">Industry Mentor</div>
                  </div>
                </div>
                <div class="team-member-box">
                  <span style="font-size:20px">${ws.industry.technicalExpert.avatar}</span>
                  <div>
                    <div style="font-size:13.5px;font-weight:800;color:var(--gray-900)">${ws.industry.technicalExpert.name}</div>
                    <div style="font-size:11.5px;color:var(--gray-600);font-weight:650">Technical Expert</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 12. UPCOMING ACTIONS -->
        <div class="card">
          <div class="card-header" style="padding:18px 20px 12px;border-bottom:1px solid var(--gray-100)">
            <h2 style="font-size:15.5px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
              <span>⏰</span> Upcoming Actions
            </h2>
          </div>
          <div class="card-body" style="padding:16px 20px">
            <div class="actions-list">
              ${ws.upcomingActions.map(act => `
                <div class="action-item-card">
                  <div>
                    <div style="font-size:13px;font-weight:750;color:var(--gray-900)">${act.title}</div>
                    <div style="font-size:11.5px;color:var(--gray-500);margin-top:2px">Due: <strong>${act.due}</strong></div>
                  </div>
                  <div style="display:flex;align-items:center;gap:6px">
                    <span class="badge ${act.priority === 'High' ? 'badge-urgent' : 'badge-assigned'}" style="font-size:10.5px">${act.priority}</span>
                    <span class="badge badge-submitted" style="font-size:10.5px">${act.status}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- 9. FEEDBACK & UPDATES (PROJECT ACTIVITY) -->
        <div class="card">
          <div class="card-header" style="padding:18px 20px 12px;border-bottom:1px solid var(--gray-100)">
            <h2 style="font-size:15.5px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
              <span>📜</span> Project Activity
            </h2>
          </div>
          <div class="card-body" style="padding:16px 20px">
            <div class="activity-feed-list" id="wsActivityList">
              ${ws.activities.map(act => `
                <div class="activity-feed-item">
                  <div class="activity-avatar">${act.avatar || '📌'}</div>
                  <div style="flex:1">
                    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
                      <span style="font-size:13px;font-weight:750;color:var(--gray-900)">${act.actor}</span>
                      <span style="font-size:11px;color:var(--gray-400)">${act.date}</span>
                    </div>
                    <div style="font-size:11.5px;color:var(--primary);font-weight:600">${act.role}</div>
                    <div style="font-size:12.5px;color:var(--gray-700);margin-top:3px">${act.action}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- 11. DOCUMENTS -->
        <div class="card">
          <div class="card-header" style="padding:18px 20px 12px;border-bottom:1px solid var(--gray-100)">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
              <h2 style="font-size:15.5px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
                <span>📁</span> Project Documents
              </h2>
              <button onclick="openUploadDocModal()" class="btn btn-sm btn-ghost" style="border:1px solid var(--gray-200);font-size:11.5px">
                + Upload
              </button>
            </div>
          </div>
          <div class="card-body" style="padding:16px 20px">
            <div style="display:flex;flex-direction:column;gap:10px">
              ${ws.documents.map(d => `
                <div class="doc-item-row" style="padding:10px 12px">
                  <div style="display:flex;align-items:center;gap:10px;min-width:180px">
                    <span style="font-size:20px">${d.icon}</span>
                    <div>
                      <div style="font-size:13px;font-weight:750;color:var(--gray-900)">${d.title}</div>
                      <div style="font-size:11px;color:var(--gray-500)">Updated ${d.updated} • ${d.size}</div>
                    </div>
                  </div>
                  <div style="display:flex;gap:6px">
                    <button class="btn btn-sm btn-ghost" style="padding:4px 10px;font-size:11.5px;border:1px solid var(--gray-200)" onclick="viewDocument('${d.title.replace(/'/g,"\\'")}')">
                      View
                    </button>
                    <button class="btn btn-sm btn-outline-primary" style="padding:4px 10px;font-size:11.5px" onclick="downloadDocument('${d.title.replace(/'/g,"\\'")}')">
                      Download
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- 13. COMMUNICATION -->
        <div class="card">
          <div class="card-header" style="padding:18px 20px 12px;border-bottom:1px solid var(--gray-100)">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
              <h2 style="font-size:15.5px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
                <span>💬</span> Project Communication
              </h2>
              <button onclick="openPostUpdateModal()" class="btn btn-sm btn-primary" style="display:inline-flex;align-items:center;gap:6px;font-size:12px">
                <span>+</span> Post Update
              </button>
            </div>
          </div>
          <div class="card-body" style="padding:16px 20px">
            <div class="discussion-stream" id="wsMessageList">
              ${ws.messages.map(m => `
                <div class="discussion-msg-item ${m.isIndustry ? 'industry' : 'university'}">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;gap:8px">
                    <span style="font-weight:800;font-size:11px">${m.sender}</span>
                    <span style="font-size:10px;opacity:0.8">${m.time}</span>
                  </div>
                  <div style="font-size:12.5px">${m.text}</div>
                  ${m.attachment ? `<div style="font-size:10.5px;margin-top:4px;opacity:0.9">📎 ${m.attachment}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        </div>

      </div>

    </div>
  `;
}

// ── Interactive Checklist Toggle ──
function toggleFieldTestChecklist(checkId) {
  if (!currentActiveWorkspace || !currentActiveWorkspace.fieldTesting) return;
  const item = currentActiveWorkspace.fieldTesting.checklist.find(c => c.id === checkId);
  if (!item) return;

  item.completed = !item.completed;

  const total = currentActiveWorkspace.fieldTesting.checklist.length;
  const done = currentActiveWorkspace.fieldTesting.checklist.filter(c => c.completed).length;

  if (done === total) {
    currentActiveWorkspace.fieldTesting.status = 'Completed';
    currentActiveWorkspace.health.fieldTesting.status = 'Completed';
    currentActiveWorkspace.health.fieldTesting.icon = '🟢';
  } else if (done > 0) {
    currentActiveWorkspace.fieldTesting.status = 'In Progress';
    currentActiveWorkspace.health.fieldTesting.status = 'In Progress';
    currentActiveWorkspace.health.fieldTesting.icon = '🟡';
  } else {
    currentActiveWorkspace.fieldTesting.status = 'Not Started';
    currentActiveWorkspace.health.fieldTesting.status = 'Not Started';
    currentActiveWorkspace.health.fieldTesting.icon = '⚪';
  }

  saveStoredProjectWorkspace(currentActiveWorkspace);
  renderProjectWorkspace(currentActiveWorkspace);

  Toast.info(
    'Checklist Updated',
    `"${item.text}" marked as ${item.completed ? 'Completed' : 'Pending'}. (${done}/${total} done)`
  );
}

// ── Industry Review & Feedback Modal Handlers ──
function openAddFeedbackModal() {
  const commentInput = document.getElementById('feedCommentText');
  const err = document.getElementById('errFeedComment');
  if (commentInput) commentInput.value = '';
  if (err) err.style.display = 'none';
  openModal('addIndustryFeedbackModal');
}

function submitIndustryFeedback() {
  if (!currentActiveWorkspace) return;
  const nameInput = document.getElementById('feedReviewerName');
  const roleInput = document.getElementById('feedReviewerRole');
  const ratingSelect = document.getElementById('feedRatingSelect');
  const commentInput = document.getElementById('feedCommentText');
  const err = document.getElementById('errFeedComment');

  const commentVal = commentInput?.value.trim();
  if (!commentVal) {
    if (err) err.style.display = 'block';
    return;
  }
  if (err) err.style.display = 'none';

  const newFeedback = {
    id: `FB-0${(currentActiveWorkspace.feedback || []).length + 1}`,
    author: nameInput?.value.trim() || 'Vikram Sinha',
    role: roleInput?.value.trim() || 'Industry Mentor (ABC Technologies)',
    rating: Number(ratingSelect?.value) || 4,
    date: 'Just now',
    comment: commentVal
  };

  if (!currentActiveWorkspace.feedback) currentActiveWorkspace.feedback = [];
  currentActiveWorkspace.feedback.unshift(newFeedback);

  // Add to activities timeline
  currentActiveWorkspace.activities.unshift({
    id: `ACT-${Date.now().toString().slice(-4)}`,
    date: 'Just now',
    actor: newFeedback.author,
    role: newFeedback.role,
    avatar: '⭐',
    action: `Industry feedback added (${newFeedback.rating}/5 stars): "${commentVal.slice(0, 60)}..."`
  });

  saveStoredFeedbackList(currentActiveWorkspace.feedback);
  saveStoredProjectWorkspace(currentActiveWorkspace);

  closeModal('addIndustryFeedbackModal');
  renderProjectWorkspace(currentActiveWorkspace);

  Toast.success('Feedback Submitted', 'Industry technical review recorded and saved to project workspace.');
}

// ── Project Communication Post Update Handlers ──
function openPostUpdateModal() {
  const msgInput = document.getElementById('updateMessageText');
  const attInput = document.getElementById('updateAttachmentName');
  const err = document.getElementById('errUpdateMessage');
  if (msgInput) msgInput.value = '';
  if (attInput) attInput.value = '';
  if (err) err.style.display = 'none';
  openModal('postProjectUpdateModal');
}

function submitProjectUpdate() {
  if (!currentActiveWorkspace) return;
  const senderSelect = document.getElementById('updateSenderSelect');
  const msgInput = document.getElementById('updateMessageText');
  const attInput = document.getElementById('updateAttachmentName');
  const err = document.getElementById('errUpdateMessage');

  const textVal = msgInput?.value.trim();
  if (!textVal) {
    if (err) err.style.display = 'block';
    return;
  }
  if (err) err.style.display = 'none';

  const senderVal = senderSelect?.value || 'Industry Mentor (Vikram Sinha)';
  const attVal = attInput?.value.trim() || '';

  const newMsg = {
    id: `MSG-${Date.now().toString().slice(-4)}`,
    sender: senderVal,
    role: 'ABC Technologies',
    time: 'Just now',
    text: textVal,
    attachment: attVal,
    isIndustry: true
  };

  if (!currentActiveWorkspace.messages) currentActiveWorkspace.messages = [];
  currentActiveWorkspace.messages.push(newMsg);

  currentActiveWorkspace.activities.unshift({
    id: `ACT-${Date.now().toString().slice(-4)}`,
    date: 'Just now',
    actor: senderVal.split('(')[0].trim(),
    role: 'Industry Mentor',
    avatar: '💬',
    action: `Posted communication update: "${textVal.slice(0, 60)}..."`
  });

  saveStoredUpdatesList(currentActiveWorkspace.messages);
  saveStoredProjectWorkspace(currentActiveWorkspace);

  closeModal('postProjectUpdateModal');
  renderProjectWorkspace(currentActiveWorkspace);

  Toast.success('Update Posted', 'Communication note posted to university project team.');
}

// ── Project Report Modal Handler ──
function openProjectReportModal() {
  if (!currentActiveWorkspace) return;
  const ws = currentActiveWorkspace;
  const printArea = document.getElementById('projectReportPrintArea');
  if (!printArea) return;

  printArea.innerHTML = `
    <div style="font-family:var(--font-sans);color:var(--gray-900);line-height:1.6">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid var(--primary);padding-bottom:14px;margin-bottom:20px">
        <div>
          <div style="font-size:11px;font-weight:800;color:var(--primary);text-transform:uppercase;letter-spacing:1px">JanSetu Industry-University Collaboration Audit</div>
          <h2 style="font-size:22px;font-weight:850;color:var(--gray-900);margin:4px 0">${ws.title}</h2>
          <div style="font-size:13px;color:var(--gray-600)">Challenge ID: #${ws.challengeId} • Domain: ${ws.domain} • District: ${ws.district}, Jharkhand</div>
        </div>
        <div style="text-align:right">
          <span class="badge badge-resolved" style="font-size:12px">✓ Active Collaboration</span>
          <div style="font-size:11.5px;color:var(--gray-500);margin-top:4px">Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>
      </div>

      <!-- Parties Matrix -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;background:#f8fafc;border:1px solid var(--gray-200);border-radius:var(--radius-md);padding:16px;margin-bottom:20px">
        <div>
          <div style="font-size:11px;font-weight:750;color:var(--gray-500)">UNIVERSITY / HEI PARTNER</div>
          <div style="font-size:15px;font-weight:800;color:var(--gray-900);margin-top:2px">${ws.university.name}</div>
          <div style="font-size:12.5px;color:var(--gray-700);margin-top:2px">Faculty Mentor: ${ws.university.facultyMentor.name}</div>
          <div style="font-size:12px;color:var(--gray-500);margin-top:2px">Student Team: ${ws.university.students.map(s => s.name).join(', ')}</div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:750;color:var(--gray-500)">INDUSTRY PARTNER</div>
          <div style="font-size:15px;font-weight:800;color:var(--gray-900);margin-top:2px">${ws.industry.name}</div>
          <div style="font-size:12.5px;color:var(--gray-700);margin-top:2px">Industry Mentor: ${ws.industry.mentor.name}</div>
          <div style="font-size:12px;color:var(--gray-500);margin-top:2px">Technical Expert: ${ws.industry.technicalExpert.name}</div>
        </div>
      </div>

      <!-- Core Metrics & Health -->
      <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:12px;margin-bottom:20px">
        <div style="padding:12px;border:1px solid var(--gray-200);border-radius:var(--radius-md);text-align:center">
          <div style="font-size:11px;color:var(--gray-500)">Overall Completion</div>
          <div style="font-size:20px;font-weight:850;color:var(--primary);margin-top:2px">${ws.completionPercentage}%</div>
        </div>
        <div style="padding:12px;border:1px solid var(--gray-200);border-radius:var(--radius-md);text-align:center">
          <div style="font-size:11px;color:var(--gray-500)">Funding Committed</div>
          <div style="font-size:20px;font-weight:850;color:#059669;margin-top:2px">₹${Number(500000).toLocaleString('en-IN')}</div>
        </div>
        <div style="padding:12px;border:1px solid var(--gray-200);border-radius:var(--radius-md);text-align:center">
          <div style="font-size:11px;color:var(--gray-500)">Prototype Status</div>
          <div style="font-size:16px;font-weight:850;color:var(--gray-900);margin-top:4px">${ws.prototype.version} (${ws.prototype.status})</div>
        </div>
        <div style="padding:12px;border:1px solid var(--gray-200);border-radius:var(--radius-md);text-align:center">
          <div style="font-size:11px;color:var(--gray-500)">Target Farmers</div>
          <div style="font-size:20px;font-weight:850;color:#d97706;margin-top:2px">${ws.expectedImpact.targetFarmers}</div>
        </div>
      </div>

      <!-- Problem and Objective Summary -->
      <div style="margin-bottom:20px">
        <div style="font-size:13.5px;font-weight:800;color:var(--gray-900);margin-bottom:4px">Problem & Scope</div>
        <div style="font-size:13px;color:var(--gray-700)">${ws.overview.problemStatement}</div>
        <div style="font-size:13px;color:var(--gray-700);margin-top:6px"><strong>Objective:</strong> ${ws.overview.projectObjective}</div>
      </div>

      <!-- Milestones Summary -->
      <div style="margin-bottom:20px">
        <div style="font-size:13.5px;font-weight:800;color:var(--gray-900);margin-bottom:8px">Milestones Execution Status</div>
        <table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead>
            <tr style="background:#f1f5f9;text-align:left">
              <th style="padding:8px 10px;border:1px solid var(--gray-200)">Stage</th>
              <th style="padding:8px 10px;border:1px solid var(--gray-200)">Milestone</th>
              <th style="padding:8px 10px;border:1px solid var(--gray-200)">Timeline</th>
              <th style="padding:8px 10px;border:1px solid var(--gray-200)">Status</th>
            </tr>
          </thead>
          <tbody>
            ${ws.milestones.map((m, idx) => `
              <tr>
                <td style="padding:7px 10px;border:1px solid var(--gray-200);font-weight:700">M${idx + 1}</td>
                <td style="padding:7px 10px;border:1px solid var(--gray-200)">${m.title}</td>
                <td style="padding:7px 10px;border:1px solid var(--gray-200);color:var(--gray-600)">${m.startedDate} – ${m.expectedDate}</td>
                <td style="padding:7px 10px;border:1px solid var(--gray-200);font-weight:700;color:${m.status === 'Completed' ? '#059669' : (m.status === 'In Progress' ? '#1a56db' : '#9ca3af')}">${m.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Expected Outcomes -->
      <div style="background:#f0f9ff;border:1px solid #bfdbfe;border-radius:var(--radius-md);padding:14px">
        <div style="font-size:12px;font-weight:800;color:var(--primary);text-transform:uppercase">Target / Expected Outcomes</div>
        <div style="font-size:13px;color:var(--gray-800);margin-top:4px">
          Deployment planned across <strong>${ws.expectedImpact.targetVillages} villages</strong> in Ranchi targeting <strong>${ws.expectedImpact.targetFarmers} tribal farmers</strong> with an expected <strong>${ws.expectedImpact.expectedWaterEfficiency} water efficiency improvement</strong> by ${ws.expectedImpact.expectedDeployment}.
        </div>
      </div>
    </div>
  `;

  openModal('projectReportModal');
}

function printProjectReport() {
  window.print();
}

// ── Prototype Preview Simulation ──
function openPrototypePreviewModal() {
  openModal('viewPrototypeModal');
}

let valvePulseTimeout = null;
function simulateValvePulse() {
  const valEl = document.getElementById('protoValveStatus');
  const btn = document.getElementById('btnSimValve');
  if (!valEl || !btn) return;

  btn.disabled = true;
  valEl.textContent = 'OPEN (Pulsing Line)';
  valEl.style.color = '#059669';

  Toast.info('Valve Actuation', 'Solenoid valve triggered: 5-second irrigation pulse active.');

  clearTimeout(valvePulseTimeout);
  valvePulseTimeout = setTimeout(() => {
    valEl.textContent = 'CLOSED (Idle)';
    valEl.style.color = '#b45309';
    btn.disabled = false;
    Toast.success('Valve Reset', 'Solenoid pulse complete. Sensor soil moisture updating.');
    const moistEl = document.getElementById('protoMoistureVal');
    if (moistEl) moistEl.textContent = '44%';
  }, 5000);
}

// ── Document View & Download Simulation ──
let currentPreviewDocTitle = '';
function viewDocument(docTitle) {
  currentPreviewDocTitle = docTitle;
  const titleEl = document.getElementById('docPreviewModalTitle');
  const subEl = document.getElementById('docPreviewModalSub');
  const bodyEl = document.getElementById('docPreviewModalBody');

  if (titleEl) titleEl.textContent = docTitle;
  if (subEl) subEl.textContent = `Official Project Record • Updated September 2026 • Certified Digital Copy`;

  if (bodyEl) {
    bodyEl.innerHTML = `
      <div style="border-left:4px solid var(--primary);padding-left:14px;margin-bottom:16px">
        <div style="font-size:15px;font-weight:800;color:var(--gray-900)">Document Abstract: ${docTitle}</div>
        <div style="font-size:12px;color:var(--gray-500);margin-top:2px">Project PRJ-001 • Xavier Institute of Social Service & ABC Technologies</div>
      </div>

      <p>This document details the engineering specifications, baseline metrics, telemetry schematics, and pilot testing framework formulated under JanSetu SIH 2026 Problem Statement 26043.</p>

      <div style="background:#f8fafc;padding:16px;border-radius:var(--radius-md);border:1px solid var(--gray-200);margin:16px 0">
        <div style="font-size:12.5px;font-weight:750;color:var(--gray-800);margin-bottom:6px">Key Provisions & Technical Architecture:</div>
        <ul style="margin:0;padding-left:20px;font-size:12.5px;color:var(--gray-700);line-height:1.6">
          <li>Microcontroller: ESP32 with low-power sleep state and solar power management.</li>
          <li>Sensors: Frequency domain capacitive soil moisture sensors (10 cm and 30 cm depths).</li>
          <li>Actuators: 12V DC latching solenoid valves with pulse duration modulation.</li>
          <li>Telemetry Protocol: LoRaWAN 865-867 MHz band with vernacular SMS gateway fallback.</li>
          <li>Community Interface: Vernacular Hindi & Santhali advisory alerts for participating farm clusters.</li>
        </ul>
      </div>

      <p style="font-size:12px;color:var(--gray-500);font-style:italic">
        Certified digitally in the JanSetu Institutional Repository. Click "Download File" to retrieve the full annexure.
      </p>
    `;
  }

  openModal('documentPreviewModal');
}

function triggerDocDownloadFromModal() {
  downloadDocument(currentPreviewDocTitle || 'Project Document');
  closeModal('documentPreviewModal');
}

function downloadDocument(docTitle) {
  Toast.success('Download Initiated', `Downloading "${docTitle}.pdf" (Simulated PDF generation complete).`);
}

// ── Connect with Impact & Analytics ──
function navigateToImpactAnalytics() {
  showSection('impact');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  Toast.info('Impact & Analytics', 'Loaded aggregated industry impact metrics and district outcome statistics.');
}

// Window bindings for upgraded workspace
window.openProjectWorkspace = openProjectWorkspace;
window.toggleFieldTestChecklist = toggleFieldTestChecklist;
window.openAddFeedbackModal = openAddFeedbackModal;
window.submitIndustryFeedback = submitIndustryFeedback;
window.openPostUpdateModal = openPostUpdateModal;
window.submitProjectUpdate = submitProjectUpdate;
window.openProjectReportModal = openProjectReportModal;
window.printProjectReport = printProjectReport;
window.openPrototypePreviewModal = openPrototypePreviewModal;
window.simulateValvePulse = simulateValvePulse;
window.viewDocument = viewDocument;
window.downloadDocument = downloadDocument;
window.triggerDocDownloadFromModal = triggerDocDownloadFromModal;
window.navigateToImpactAnalytics = navigateToImpactAnalytics;




// ── Industry Impact & Analytics Dashboard Logic ──

const IMPACT_STORAGE_KEY = 'industryImpactData';

const defaultIndustryImpact = {
  projectsSupported: 12,
  totalFunding: 1850000,
  studentsMentored: 47,
  prototypesDeveloped: 8,
  fieldTests: 6,
  solutionsDeployed: 3,
  communitiesImpacted: 2450
};

const defaultCommunityImpact = {
  peopleImpacted: 2450,
  villagesReached: 32,
  studentsBenefited: 780,
  farmersSupported: 920,
  householdsReached: 650,
  projectsDeployed: 3
};

const defaultProjectImpactList = [
  {
    projectId: 'proj-agri-003',
    challengeId: 'proj-agri-003',
    title: 'Smart Drip Irrigation & Soil Moisture Telemetry',
    domain: 'Agriculture',
    district: 'Ranchi',
    funding: 500000,
    studentsMentored: 8,
    prototypes: 1,
    fieldTests: 3,
    peopleImpacted: 500,
    problemResolution: 82,
    deploymentStatus: 'Deployed',
    completionPercentage: 85,
    year: 2026,
    problem: 'Tribal smallholders suffer erratic rainfall with up to 45% crop loss from manual flood irrigation.',
    contribution: 'Supplied 60 capacitive IoT probes, solar solenoid actuators, and 2 senior firmware mentors.',
    solution: 'Sub-₹2,500 smart solar irrigation controller with vernacular SMS alerts and automated valve timing.',
    outcome: '500 tribal farmers enrolled in pilot; 28% water saved and 32% crop yield increase during dry spell.',
    before: { title: 'Manual Flood Irrigation', items: ['Unpredictable water availability', 'High labour and runoff wastage', 'No real-time soil moisture telemetry'] },
    after: { title: 'Smart Automated Precision', items: ['Real-time capacitive soil moisture sensing', 'Automated solar drip valve scheduling', 'Vernacular Hindi/Santhali SMS alerts'] },
    metricName: 'Water Consumption',
    beforeMetric: '100%',
    afterMetric: '72%',
    improvement: '28% Water Conserved'
  },
  {
    projectId: 'proj-solar-001',
    challengeId: 'proj-solar-001',
    title: 'Decentralized Solar Micro-Grid & Automated Telemetry',
    domain: 'Energy & Technology',
    district: 'Latehar',
    funding: 500000,
    studentsMentored: 12,
    prototypes: 1,
    fieldTests: 2,
    peopleImpacted: 650,
    problemResolution: 78,
    deploymentStatus: 'Field Testing',
    completionPercentage: 65,
    year: 2026,
    problem: 'Forest-fringe tribal hamlets in Latehar face total darkness after dusk; rural clinic vaccine fridges spoil.',
    contribution: '₹5,00,000 pilot hardware grant, MPPT charge controllers, battery thermal test rig & 2 mentors.',
    solution: 'Smart DC micro-grid with LoRaWAN telemetry, modular battery swapping & Sahayak training.',
    outcome: '650 residents and 1 PHC clinic powered; zero vaccine spoilage in 14-hour blackout trial.',
    before: { title: 'Hazardous Darkness & Spoiled Vaccines', items: ['Kerosene wick illumination post dusk', 'Frequent vaccine spoiled in primary health node', 'Child evening studies completely halted'] },
    after: { title: 'Resilient Micro-Solar Telemetry', items: ['24x7 solar LED micro-lighting in 50 households', 'Continuous 14-hr cold-chain vaccine uptime', 'Remote cloud monitoring of battery state-of-charge'] },
    metricName: 'System Downtime',
    beforeMetric: '18%',
    afterMetric: '7%',
    improvement: '11% Uptime Boost'
  },
  {
    projectId: 'proj-water-002',
    challengeId: 'proj-water-002',
    title: 'Modular Bio-Adsorption Arsenic & Fluoride Water Filtration',
    domain: 'Water Management',
    district: 'Sahebganj',
    funding: 450000,
    studentsMentored: 9,
    prototypes: 1,
    fieldTests: 1,
    peopleImpacted: 450,
    problemResolution: 88,
    deploymentStatus: 'Field Testing',
    completionPercentage: 45,
    year: 2026,
    problem: 'Groundwater in Sahebganj hamlets shows toxic fluoride & arsenic causing fluorosis in children.',
    contribution: 'High-density filtration columns, spectrophotometer testing kits & chemical engineering advisory.',
    solution: 'Gravity-fed activated alumina & biochar multi-column filtration units requiring no electricity.',
    outcome: '450 school children and residents provided with safe drinking water meeting WHO guidelines.',
    before: { title: 'Toxic Contaminated Groundwater', items: ['3.8 ppm fluoride causing severe dental fluorosis', 'High arsenic leading to dermatitis in children', 'No decentralized filtration available'] },
    after: { title: 'Safe Multi-Stage Bio-Adsorption', items: ['Fluoride brought below 0.6 ppm (< WHO 1.0 ppm)', 'Zero electricity requirement (gravity-fed)', 'Low-cost replacement media sourced locally'] },
    metricName: 'Fluoride Concentration',
    beforeMetric: '3.8 ppm',
    afterMetric: '0.6 ppm',
    improvement: '84% Reduction'
  },
  {
    projectId: 'proj-health-004',
    challengeId: 'proj-health-004',
    title: 'Rural Maternal & Pediatric Telemedicine Kiosk',
    domain: 'Healthcare',
    district: 'Dumka',
    funding: 250000,
    studentsMentored: 10,
    prototypes: 1,
    fieldTests: 1,
    peopleImpacted: 580,
    problemResolution: 92,
    deploymentStatus: 'Deployed',
    completionPercentage: 90,
    year: 2025,
    problem: 'Pregnant tribal women travel 40+ km over rough terrain for routine fetal doppler & BP checkups.',
    contribution: 'Digital diagnostic kits, tablet computers with offline electronic health record app, 1 mentor.',
    solution: 'Vernacular tablet kiosk with Bluetooth pulse oximeter, digital fetal doppler, and ASHA worker liaison.',
    outcome: '580 checkups performed locally; 42 high-risk pregnancies caught early and safely referred.',
    before: { title: 'Delayed Rural Healthcare Access', items: ['40 km travel for routine antenatal checkup', '48-hour diagnostic turnaround from district hospital', 'High risk of unmonitored home delivery'] },
    after: { title: 'Decentralized Point-of-Care Diagnostics', items: ['Instant on-site fetal doppler and BP recording', 'Diagnostic report in under 1.5 hours via cellular sync', 'Direct tele-consultation with Ranchi doctors'] },
    metricName: 'Diagnostic Turnaround Time',
    beforeMetric: '48 Hours',
    afterMetric: '1.5 Hours',
    improvement: '96% Faster Care'
  },
  {
    projectId: 'proj-env-005',
    challengeId: 'proj-env-005',
    title: 'Decentralized Plastic Waste Pyrolysis & Eco-Paver Fabricator',
    domain: 'Environment',
    district: 'Jamshedpur',
    funding: 150000,
    studentsMentored: 8,
    prototypes: 1,
    fieldTests: 1,
    peopleImpacted: 270,
    problemResolution: 70,
    deploymentStatus: 'In Progress',
    completionPercentage: 55,
    year: 2025,
    problem: 'Non-recyclable single-use plastic clogs municipal drains and gets burned in open pits releasing toxins.',
    contribution: 'Thermal hydraulic press tooling, exhaust catalytic scrubber, and mechanical design guidance.',
    solution: 'Low-emission shredder-press converting plastic waste mixed with fly ash into certified pavement tiles.',
    outcome: '1.8 tonnes of plastic diverted from landfill; 4,200 interlocking eco-pavers pressed for community path.',
    before: { title: 'Open Pit Plastic Burning', items: ['Uncollected low-grade MLP plastic in drains', 'Toxic open incineration polluting village air', 'Drainage blockage causing monsoon waterlogging'] },
    after: { title: 'Circular Economic Value Addition', items: ['Decentralized village plastic collection incentives', 'Durable interlocking pavement tiles generated', 'Zero open burning in pilot cluster'] },
    metricName: 'Plastic Diverted from Landfill',
    beforeMetric: '0 Tonnes',
    afterMetric: '1.8 Tonnes',
    improvement: '1.8T Diverted'
  }
];

const defaultCSRContribution = [
  { sector: 'Agriculture & Rural Livelihoods', amount: 650000, percent: 35.1, color: '#059669', icon: '🌾' },
  { sector: 'Education & Student Skill Development', amount: 420000, percent: 22.7, color: '#2563eb', icon: '🎓' },
  { sector: 'Healthcare & Nutrition', amount: 310000, percent: 16.8, color: '#dc2626', icon: '🏥' },
  { sector: 'Environment & Waste Management', amount: 280000, percent: 15.1, color: '#0d9488', icon: '🌱' },
  { sector: 'Rural Energy & Clean Technology', amount: 190000, percent: 10.3, color: '#d97706', icon: '⚡' }
];

const defaultDistrictImpact = [
  { district: 'Ranchi', projects: 5, peopleImpacted: 850, funding: '₹6.2L', keyFocus: 'Smart Agriculture & IoT Automation' },
  { district: 'Latehar', projects: 3, peopleImpacted: 500, funding: '₹5.0L', keyFocus: 'Decentralized Micro-Solar & Energy' },
  { district: 'Dumka', projects: 2, peopleImpacted: 420, funding: '₹2.5L', keyFocus: 'Rural Telemedicine & Maternal Health' },
  { district: 'Jamshedpur (East Singhbhum)', projects: 2, peopleImpacted: 680, funding: '₹2.8L', keyFocus: 'Plastic Upcycling & Circular Materials' },
  { district: 'Sahebganj', projects: 2, peopleImpacted: 450, funding: '₹4.5L', keyFocus: 'Bio-Adsorption Arsenic/Fluoride Filtration' }
];

const defaultPerformanceMetrics = {
  collabSuccessRate: 87,
  prototypeSuccessRate: 82,
  fieldTestSuccessRate: 91,
  deploymentRate: 64,
  avgCompletionRate: 76
};

const defaultImpactTimeline = [
  { date: 'Jan 2026', title: 'Problem Discovery & University Alignment', desc: 'Identified 12 regional challenges with Jharkhand Higher Education Council and assigned HEI teams.', status: 'Completed' },
  { date: 'Feb 2026', title: 'Industry Collaboration Agreements Formulated', desc: 'Formalized CSR innovation support and assigned 47 student innovators to technical mentors.', status: 'Completed' },
  { date: 'Mar 2026', title: 'Hardware & Software Prototypes Completed', desc: '8 proof-of-concept prototypes fabricated and bench-tested under simulated environmental stress.', status: 'Completed' },
  { date: 'Apr 2026', title: 'On-Ground Field Testing Commenced', desc: '6 live village testbeds deployed across Ranchi, Latehar, Sahebganj, and Dumka.', status: 'Completed' },
  { date: 'May 2026', title: 'Community Feedback & Verification Gathered', desc: 'Direct feedback recorded from 2,450 beneficiaries with an average satisfaction rating of 4.4/5.', status: 'Completed' },
  { date: 'Jun 2026', title: 'District Deployment & Impact Scaling', desc: '3 fully verified solutions transitioned to district administrative rollout.', status: 'In Progress' }
];

// Active Filter State
let impactFilterYear = 'all';
let impactFilterDomain = 'all';
let impactFilterDistrict = 'all';
let impactFilterStatus = 'all';

let csrChartInstance = null;
let domainChartInstance = null;

function loadImpactAnalytics() {
  const container = document.getElementById('impactAnalyticsContainer');
  if (!container) return;

  renderImpactAnalytics();
}

function onImpactFilterChange() {
  impactFilterYear = document.getElementById('impactFilterYear')?.value || 'all';
  impactFilterDomain = document.getElementById('impactFilterDomain')?.value || 'all';
  impactFilterDistrict = document.getElementById('impactFilterDistrict')?.value || 'all';
  impactFilterStatus = document.getElementById('impactFilterStatus')?.value || 'all';

  renderImpactFilteredProjects();
}

function resetImpactFilters() {
  impactFilterYear = 'all';
  impactFilterDomain = 'all';
  impactFilterDistrict = 'all';
  impactFilterStatus = 'all';

  const y = document.getElementById('impactFilterYear');
  const d = document.getElementById('impactFilterDomain');
  const dt = document.getElementById('impactFilterDistrict');
  const s = document.getElementById('impactFilterStatus');
  if (y) y.value = 'all';
  if (d) d.value = 'all';
  if (dt) dt.value = 'all';
  if (s) s.value = 'all';

  renderImpactFilteredProjects();
}

function getFilteredImpactProjects() {
  return defaultProjectImpactList.filter(p => {
    if (impactFilterYear !== 'all' && String(p.year) !== impactFilterYear) return false;
    if (impactFilterDomain !== 'all' && p.domain !== impactFilterDomain) return false;
    if (impactFilterDistrict !== 'all' && !p.district.toLowerCase().includes(impactFilterDistrict.toLowerCase())) return false;
    if (impactFilterStatus !== 'all' && p.deploymentStatus !== impactFilterStatus) return false;
    return true;
  });
}

function renderImpactAnalytics() {
  const container = document.getElementById('impactAnalyticsContainer');
  if (!container) return;

  const kpi = defaultIndustryImpact;
  const comm = defaultCommunityImpact;
  const perf = defaultPerformanceMetrics;

  container.innerHTML = `
    <!-- Top Header -->
    <div class="impact-top-header">
      <div>
        <h1 class="impact-title">Industry Impact & Analytics</h1>
        <div class="impact-subtitle">Measure your organization's contribution and social impact across JanSetu projects.</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <button onclick="openImpactReportModal()" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:7px;box-shadow:var(--shadow-sm);font-weight:750">
          <span>📊</span> Generate Impact Report
        </button>
      </div>
    </div>

    <!-- Impact Overview Subheading -->
    <div style="margin-top:4px;margin-bottom:2px">
      <h2 style="font-size:17px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
        <span>📈</span> Impact Overview
      </h2>
      <div style="font-size:12.5px;color:var(--gray-500);margin-top:3px">Quantitative summary of institutional innovation, prototypes, and grassroots community reach</div>
    </div>

    <!-- Section 2: Impact Overview KPI Cards (Centralized Mock Data) -->
    <div class="impact-kpi-grid">
      <div class="impact-kpi-card">
        <div class="impact-kpi-icon kpi-icon" style="background:#eff6ff;color:#1d4ed8">📋</div>
        <div>
          <div class="impact-kpi-val kpi-value">${kpi.projectsSupported}</div>
          <div class="impact-kpi-lbl kpi-label">Projects Supported</div>
        </div>
      </div>
      <div class="impact-kpi-card">
        <div class="impact-kpi-icon kpi-icon" style="background:#ecfdf5;color:#059669">💰</div>
        <div>
          <div class="impact-kpi-val kpi-value">₹${(kpi.totalFunding / 100000).toFixed(1)}L</div>
          <div class="impact-kpi-lbl kpi-label">Total Funding</div>
        </div>
      </div>
      <div class="impact-kpi-card">
        <div class="impact-kpi-icon kpi-icon" style="background:#f5f3ff;color:#7c3aed">👨‍🎓</div>
        <div>
          <div class="impact-kpi-val kpi-value">${kpi.studentsMentored}</div>
          <div class="impact-kpi-lbl kpi-label">Students Mentored</div>
        </div>
      </div>
      <div class="impact-kpi-card">
        <div class="impact-kpi-icon kpi-icon" style="background:#fef3c7;color:#b45309">🛠️</div>
        <div>
          <div class="impact-kpi-val kpi-value">${kpi.prototypesDeveloped}</div>
          <div class="impact-kpi-lbl kpi-label">Prototypes Built</div>
        </div>
      </div>
      <div class="impact-kpi-card">
        <div class="impact-kpi-icon kpi-icon" style="background:#f0fdfa;color:#0d9488">🧪</div>
        <div>
          <div class="impact-kpi-val kpi-value">${kpi.fieldTests}</div>
          <div class="impact-kpi-lbl kpi-label">Field Tests</div>
        </div>
      </div>
      <div class="impact-kpi-card">
        <div class="impact-kpi-icon kpi-icon" style="background:#fdf2f8;color:#be185d">🚀</div>
        <div>
          <div class="impact-kpi-val kpi-value">${kpi.solutionsDeployed}</div>
          <div class="impact-kpi-lbl kpi-label">Solutions Deployed</div>
        </div>
      </div>
      <div class="impact-kpi-card">
        <div class="impact-kpi-icon kpi-icon" style="background:#ecfeff;color:#0891b2">👥</div>
        <div>
          <div class="impact-kpi-val kpi-value">${Number(kpi.communitiesImpacted).toLocaleString('en-IN')}</div>
          <div class="impact-kpi-lbl kpi-label">Communities Reached</div>
        </div>
      </div>
    </div>

    <!-- Section 13: Filters Bar -->
    <div class="card" style="margin-bottom:0">
      <div class="card-body" style="padding:16px 20px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:16px">🔍</span>
            <span style="font-size:13.5px;font-weight:750;color:var(--gray-900)">Filter Analytics:</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:10px;flex:1;max-width:850px">
            <select id="impactFilterYear" class="form-control" style="flex:1;min-width:130px;padding:7px 10px;font-size:12.5px" onchange="onImpactFilterChange()">
              <option value="all">All Years</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
            <select id="impactFilterDomain" class="form-control" style="flex:1;min-width:160px;padding:7px 10px;font-size:12.5px" onchange="onImpactFilterChange()">
              <option value="all">All Domains</option>
              <option value="Agriculture">Agriculture</option>
              <option value="Energy & Technology">Energy & Technology</option>
              <option value="Water Management">Water Management</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Environment">Environment</option>
            </select>
            <select id="impactFilterDistrict" class="form-control" style="flex:1;min-width:140px;padding:7px 10px;font-size:12.5px" onchange="onImpactFilterChange()">
              <option value="all">All Districts</option>
              <option value="Ranchi">Ranchi</option>
              <option value="Latehar">Latehar</option>
              <option value="Sahebganj">Sahebganj</option>
              <option value="Dumka">Dumka</option>
              <option value="Jamshedpur">Jamshedpur</option>
            </select>
            <select id="impactFilterStatus" class="form-control" style="flex:1;min-width:140px;padding:7px 10px;font-size:12.5px" onchange="onImpactFilterChange()">
              <option value="all">All Status</option>
              <option value="Deployed">Deployed</option>
              <option value="Field Testing">Field Testing</option>
              <option value="In Progress">In Progress</option>
            </select>
            <button onclick="resetImpactFilters()" class="btn btn-sm btn-ghost" style="border:1px solid var(--gray-200);white-space:nowrap">
              Reset Filters
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Section 3: Project Impact Cards Container -->
    <div class="card">
      <div class="card-header" style="padding:18px 24px 12px;border-bottom:1px solid var(--gray-100);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
          <h2 style="font-size:17px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
            <span>🚀</span> Project Impact
          </h2>
          <div style="font-size:12.5px;color:var(--gray-500);margin-top:2px">Initiatives co-funded and technically mentored by industry partners</div>
        </div>
        <span class="badge badge-assigned" id="filteredProjectsBadge" style="font-size:11.5px">Showing 5 Projects</span>
      </div>
      <div class="card-body" style="padding:20px 24px">
        <div id="impactProjectCardsGrid" style="display:flex;flex-direction:column;gap:16px">
          <!-- Populated by renderImpactFilteredProjects() -->
        </div>
      </div>
    </div>

    <!-- Section 4: Problem → Industry Contribution → Solution → Outcome (Visual Flow) -->
    <div class="card">
      <div class="card-header" style="padding:18px 24px 12px;border-bottom:1px solid var(--gray-100)">
        <h2 style="font-size:17px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
          <span>🔄</span> Problem → Contribution → Solution → Outcome
        </h2>
        <div style="font-size:12.5px;color:var(--gray-500);margin-top:2px">Visual impact pipeline demonstrating how industry input converts grassroots problems into measurable outcomes</div>
      </div>
      <div class="card-body" style="padding:20px 24px" id="impactFlowContainer">
        <!-- Rendered dynamically -->
      </div>
    </div>

    <!-- Section 5: Before vs After ("Impact Transformation") -->
    <div class="card">
      <div class="card-header" style="padding:18px 24px 12px;border-bottom:1px solid var(--gray-100)">
        <h2 style="font-size:17px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
          <span>⚖️</span> Impact Transformation (Before vs. After)
        </h2>
        <div style="font-size:12.5px;color:var(--gray-500);margin-top:2px">Verifiable comparative shift across ground operations and citizen welfare</div>
      </div>
      <div class="card-body" style="padding:20px 24px">
        <div class="comparison-grid" id="impactComparisonGrid">
          <!-- Rendered dynamically -->
        </div>
      </div>
    </div>

    <!-- Section 6 & 7: Charts Grid (CSR Breakdown & Domain Analytics) -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(340px, 1fr));gap:20px">
      <!-- Section 6: CSR & Social Impact Contribution -->
      <div class="card">
        <div class="card-header" style="padding:18px 24px 12px;border-bottom:1px solid var(--gray-100)">
          <h2 style="font-size:16px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
            <span>💰</span> CSR & Social Impact Contribution
          </h2>
          <div style="font-size:12px;color:var(--gray-500)">Total allocation: ₹18,50,000 across 5 sectors</div>
        </div>
        <div class="card-body" style="padding:20px 24px">
          <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">
            ${defaultCSRContribution.map(c => `
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px;margin-bottom:4px">
                  <span style="font-weight:700;color:var(--gray-800);display:flex;align-items:center;gap:6px">
                    <span>${c.icon}</span> <span>${c.sector}</span>
                  </span>
                  <span style="font-weight:800;color:var(--gray-900)">₹${(c.amount/100000).toFixed(1)}L <span style="font-weight:500;color:var(--gray-400)">(${c.percent}%)</span></span>
                </div>
                <div class="progress-bar" style="height:7px"><div class="progress-fill" style="width:${c.percent}%;background:${c.color}"></div></div>
              </div>
            `).join('')}
          </div>
          <div style="height:170px;position:relative">
            <canvas id="csrSectorChart"></canvas>
          </div>
        </div>
      </div>

      <!-- Section 7: Impact by Domain -->
      <div class="card">
        <div class="card-header" style="padding:18px 24px 12px;border-bottom:1px solid var(--gray-100)">
          <h2 style="font-size:16px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
            <span>🏷️</span> Supported Projects by Domain
          </h2>
          <div style="font-size:12px;color:var(--gray-500)">Aligned with JanSetu problem classification taxonomy</div>
        </div>
        <div class="card-body" style="padding:20px 24px">
          <div style="height:250px;position:relative">
            <canvas id="domainImpactChart"></canvas>
          </div>
          <div style="display:flex;justify-content:space-around;padding-top:12px;border-top:1px solid var(--gray-100);font-size:11.5px;color:var(--gray-600);text-align:center">
            <div><strong style="color:var(--primary);font-size:15px">4</strong><br>Agri</div>
            <div><strong style="color:#2563eb;font-size:15px">3</strong><br>Education</div>
            <div><strong style="color:#dc2626;font-size:15px">2</strong><br>Health</div>
            <div><strong style="color:#0891b2;font-size:15px">2</strong><br>Water</div>
            <div><strong style="color:#059669;font-size:15px">1</strong><br>Energy</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Section 8: Impact Across Jharkhand (District Breakdown) -->
    <div class="card">
      <div class="card-header" style="padding:18px 24px 12px;border-bottom:1px solid var(--gray-100)">
        <h2 style="font-size:17px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
          <span>📍</span> Impact Across Jharkhand
        </h2>
        <div style="font-size:12.5px;color:var(--gray-500)">Grassroots penetration and beneficiaries reached across 5 core districts</div>
      </div>
      <div class="card-body" style="padding:20px 24px">
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:14px">
          ${defaultDistrictImpact.map(d => `
            <div class="district-impact-card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <span style="font-size:15px;font-weight:800;color:var(--gray-900)">📍 ${d.district}</span>
                <span class="badge badge-assigned" style="font-size:10.5px">${d.funding}</span>
              </div>
              <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:4px">
                <span style="font-size:18px;font-weight:850;color:var(--primary)">${d.projects}</span>
                <span style="font-size:12px;color:var(--gray-500)">Active Projects</span>
              </div>
              <div style="font-size:12.5px;color:var(--gray-700);margin-bottom:6px">
                <strong>${d.peopleImpacted}</strong> People Impacted
              </div>
              <div style="font-size:11px;color:var(--gray-400);line-height:1.4">${d.keyFocus}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Section 9 & 10: Project Performance & Community Impact -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(340px, 1fr));gap:20px">
      <!-- Section 9: Project Success Metrics -->
      <div class="card">
        <div class="card-header" style="padding:18px 24px 12px;border-bottom:1px solid var(--gray-100)">
          <h2 style="font-size:16px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
            <span>📈</span> Project Performance
          </h2>
          <div style="font-size:12px;color:var(--gray-500)">Operational readiness and co-innovation efficiency</div>
        </div>
        <div class="card-body" style="padding:20px 24px">
          <div style="display:flex;flex-direction:column;gap:14px">
            <div>
              <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
                <span style="font-weight:700;color:var(--gray-800)">Collaboration Success Rate</span>
                <span style="font-weight:850;color:var(--primary)">${perf.collabSuccessRate}%</span>
              </div>
              <div class="progress-bar" style="height:8px"><div class="progress-fill" style="width:${perf.collabSuccessRate}%"></div></div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
                <span style="font-weight:700;color:var(--gray-800)">Prototype Success Rate</span>
                <span style="font-weight:850;color:var(--primary)">${perf.prototypeSuccessRate}%</span>
              </div>
              <div class="progress-bar" style="height:8px"><div class="progress-fill" style="width:${perf.prototypeSuccessRate}%"></div></div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
                <span style="font-weight:700;color:var(--gray-800)">Field Testing Success</span>
                <span style="font-weight:850;color:#059669">${perf.fieldTestSuccessRate}%</span>
              </div>
              <div class="progress-bar" style="height:8px"><div class="progress-fill" style="width:${perf.fieldTestSuccessRate}%;background:#059669"></div></div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
                <span style="font-weight:700;color:var(--gray-800)">Deployment Rate</span>
                <span style="font-weight:850;color:#d97706">${perf.deploymentRate}%</span>
              </div>
              <div class="progress-bar" style="height:8px"><div class="progress-fill" style="width:${perf.deploymentRate}%;background:#d97706"></div></div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
                <span style="font-weight:700;color:var(--gray-800)">Average Project Completion</span>
                <span style="font-weight:850;color:var(--primary)">${perf.avgCompletionRate}%</span>
              </div>
              <div class="progress-bar" style="height:8px"><div class="progress-fill" style="width:${perf.avgCompletionRate}%"></div></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 10: Community Impact -->
      <div class="card">
        <div class="card-header" style="padding:18px 24px 12px;border-bottom:1px solid var(--gray-100)">
          <h2 style="font-size:16px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
            <span>🤝</span> Community Impact
          </h2>
          <div style="font-size:12px;color:var(--gray-500)">Beneficiary reach across tribal and rural habitations</div>
        </div>
        <div class="card-body" style="padding:20px 24px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div style="padding:14px;background:#f8fafc;border:1px solid var(--gray-200);border-radius:var(--radius-md)">
              <div style="font-size:22px;font-weight:850;color:var(--gray-900)">${Number(comm.peopleImpacted).toLocaleString('en-IN')}</div>
              <div style="font-size:11.5px;color:var(--gray-500);margin-top:2px;font-weight:650">People Impacted</div>
            </div>
            <div style="padding:14px;background:#f8fafc;border:1px solid var(--gray-200);border-radius:var(--radius-md)">
              <div style="font-size:22px;font-weight:850;color:var(--gray-900)">${comm.villagesReached}</div>
              <div style="font-size:11.5px;color:var(--gray-500);margin-top:2px;font-weight:650">Villages Reached</div>
            </div>
            <div style="padding:14px;background:#f8fafc;border:1px solid var(--gray-200);border-radius:var(--radius-md)">
              <div style="font-size:22px;font-weight:850;color:var(--gray-900)">${comm.studentsBenefited}</div>
              <div style="font-size:11.5px;color:var(--gray-500);margin-top:2px;font-weight:650">Students Benefited</div>
            </div>
            <div style="padding:14px;background:#f8fafc;border:1px solid var(--gray-200);border-radius:var(--radius-md)">
              <div style="font-size:22px;font-weight:850;color:var(--gray-900)">${comm.farmersSupported}</div>
              <div style="font-size:11.5px;color:var(--gray-500);margin-top:2px;font-weight:650">Farmers Supported</div>
            </div>
            <div style="padding:14px;background:#f8fafc;border:1px solid var(--gray-200);border-radius:var(--radius-md)">
              <div style="font-size:22px;font-weight:850;color:var(--gray-900)">${comm.householdsReached}</div>
              <div style="font-size:11.5px;color:var(--gray-500);margin-top:2px;font-weight:650">Households Reached</div>
            </div>
            <div style="padding:14px;background:#f8fafc;border:1px solid var(--gray-200);border-radius:var(--radius-md)">
              <div style="font-size:22px;font-weight:850;color:#059669">${comm.projectsDeployed}</div>
              <div style="font-size:11.5px;color:var(--gray-500);margin-top:2px;font-weight:650">Solutions Deployed</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Section 11: Measured Outcomes -->
    <div class="card">
      <div class="card-header" style="padding:18px 24px 12px;border-bottom:1px solid var(--gray-100);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
          <h2 style="font-size:17px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
            <span>🎯</span> Measured Outcomes (Pilot vs. Baseline)
          </h2>
          <div style="font-size:12.5px;color:var(--gray-500)">Quantitative impact metrics tracked across active problem statements</div>
        </div>
        <span class="badge badge-resolved" style="font-size:11.5px">Field Validated</span>
      </div>
      <div class="card-body" style="padding:20px 24px">
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:16px" id="impactMeasuredOutcomesGrid">
          <!-- Rendered dynamically from defaultProjectImpactList -->
        </div>
      </div>
    </div>

    <!-- Section 12: Impact Timeline -->
    <div class="card">
      <div class="card-header" style="padding:18px 24px 12px;border-bottom:1px solid var(--gray-100)">
        <h2 style="font-size:17px;font-weight:800;color:var(--gray-900);margin:0;display:flex;align-items:center;gap:8px">
          <span>⏳</span> Industry Collaboration & Scaling Timeline
        </h2>
        <div style="font-size:12.5px;color:var(--gray-500)">Key milestone progress from problem adoption to field deployment</div>
      </div>
      <div class="card-body" style="padding:20px 24px">
        <div class="activity-log-stream">
          ${defaultImpactTimeline.map(t => `
            <div class="activity-log-item">
              <div style="flex:1">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:2px">
                  <div style="font-size:14px;font-weight:750;color:var(--gray-900)">${t.title}</div>
                  <span class="badge ${t.status==='Completed'?'badge-resolved':'badge-assigned'}" style="font-size:10.5px">${t.status}</span>
                </div>
                <div style="font-size:12.5px;color:var(--gray-600);line-height:1.5">${t.desc}</div>
                <div style="font-size:11px;color:var(--primary);font-weight:700;margin-top:4px">📅 ${t.date}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  renderImpactFilteredProjects();
  initImpactCharts();
}

function renderImpactFilteredProjects() {
  const container = document.getElementById('impactProjectCardsGrid');
  const flowContainer = document.getElementById('impactFlowContainer');
  const compGrid = document.getElementById('impactComparisonGrid');
  const outcomesGrid = document.getElementById('impactMeasuredOutcomesGrid');
  const badge = document.getElementById('filteredProjectsBadge');

  const filtered = getFilteredImpactProjects();
  if (badge) badge.textContent = `Showing ${filtered.length} of ${defaultProjectImpactList.length} Projects`;

  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding:30px;background:#f8fafc;border:1.5px dashed var(--gray-200);border-radius:var(--radius-lg);text-align:center">
        <div style="font-size:24px;margin-bottom:6px">🔍</div>
        <div style="font-size:14px;font-weight:700;color:var(--gray-700)">No Projects Match Current Filter Criteria</div>
        <div style="font-size:12px;color:var(--gray-500);margin-top:4px">Try clearing filters or changing the year/domain selection.</div>
        <button onclick="resetImpactFilters()" class="btn btn-sm btn-primary" style="margin-top:12px">Reset Filters</button>
      </div>
    `;
    if (flowContainer) flowContainer.innerHTML = '<div style="font-size:12px;color:var(--gray-500);text-align:center;padding:16px">No active flow items.</div>';
    if (compGrid) compGrid.innerHTML = '';
    if (outcomesGrid) outcomesGrid.innerHTML = '';
    return;
  }

  // Render Project Cards
  container.innerHTML = filtered.map(p => {
    const statusBadge = p.deploymentStatus === 'Deployed'
      ? '<span class="badge badge-resolved" style="font-size:11.5px">✓ Deployed</span>'
      : (p.deploymentStatus === 'Field Testing'
        ? '<span class="badge badge-assigned" style="font-size:11.5px">🧪 Field Testing</span>'
        : '<span class="badge badge-pending" style="font-size:11.5px">⚙️ In Progress</span>');

    return `
      <div class="card" style="border-left:4px solid var(--primary);transition:all 0.2s ease">
        <div class="card-body" style="padding:18px 22px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:10px">
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span class="badge badge-submitted" style="font-size:11px">${p.domain}</span>
                <span style="font-size:12px;color:var(--gray-500);font-weight:600">📍 ${p.district}, Jharkhand</span>
                <span style="font-size:11.5px;color:var(--gray-400)">• ${p.year}</span>
              </div>
              <div style="font-size:16px;font-weight:800;color:var(--gray-900)">${p.title}</div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              ${statusBadge}
              <button onclick="openProjectWorkspace('${p.projectId}')" class="btn btn-sm btn-primary" style="display:inline-flex;align-items:center;gap:5px;font-weight:750">
                <span>View Project</span> <span>→</span>
              </button>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:10px;background:#f8fafc;padding:12px 14px;border-radius:var(--radius-md);border:1px solid var(--gray-200);margin-bottom:12px">
            <div>
              <div style="font-size:10.5px;color:var(--gray-500);text-transform:uppercase;font-weight:700">Funding</div>
              <div style="font-size:14px;font-weight:800;color:var(--gray-900);margin-top:2px">₹${Number(p.funding).toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div style="font-size:10.5px;color:var(--gray-500);text-transform:uppercase;font-weight:700">Students</div>
              <div style="font-size:14px;font-weight:800;color:var(--gray-900);margin-top:2px">${p.studentsMentored} Mentored</div>
            </div>
            <div>
              <div style="font-size:10.5px;color:var(--gray-500);text-transform:uppercase;font-weight:700">Prototypes</div>
              <div style="font-size:14px;font-weight:800;color:var(--gray-900);margin-top:2px">${p.prototypes} Fabricated</div>
            </div>
            <div>
              <div style="font-size:10.5px;color:var(--gray-500);text-transform:uppercase;font-weight:700">Field Tests</div>
              <div style="font-size:14px;font-weight:800;color:var(--gray-900);margin-top:2px">${p.fieldTests} Conducted</div>
            </div>
            <div>
              <div style="font-size:10.5px;color:var(--gray-500);text-transform:uppercase;font-weight:700">People Impacted</div>
              <div style="font-size:14px;font-weight:800;color:var(--gray-900);margin-top:2px">${p.peopleImpacted}+</div>
            </div>
            <div>
              <div style="font-size:10.5px;color:var(--gray-500);text-transform:uppercase;font-weight:700">Resolution</div>
              <div style="font-size:14px;font-weight:800;color:#059669;margin-top:2px">${p.problemResolution}%</div>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--gray-600)">
            <span><strong>Outcome:</strong> ${p.outcome}</span>
            <span style="font-weight:700;color:var(--primary)">${p.completionPercentage}% Overall Progress</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Render Transformation Flow for Top Filtered Projects
  if (flowContainer) {
    flowContainer.innerHTML = filtered.slice(0, 3).map(p => `
      <div class="flow-card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;border-bottom:1px solid var(--gray-100);padding-bottom:8px">
          <div>
            <span style="font-size:14px;font-weight:800;color:var(--gray-900)">${p.title}</span>
            <span style="font-size:11.5px;color:var(--gray-500);margin-left:8px">(${p.domain} • ${p.district})</span>
          </div>
          <button onclick="openProjectWorkspace('${p.projectId}')" class="btn btn-sm btn-ghost" style="border:1px solid var(--gray-200);font-size:11.5px">
            Workspace Details →
          </button>
        </div>

        <div class="flow-steps-grid">
          <div class="flow-step-box" style="border-left:3px solid #ef4444">
            <span class="flow-step-badge" style="background:#fee2e2;color:#991b1b">1. PROBLEM</span>
            <div class="flow-step-text">${p.problem}</div>
          </div>
          <div class="flow-step-box" style="border-left:3px solid var(--primary)">
            <span class="flow-step-badge" style="background:var(--primary-50);color:var(--primary)">2. INDUSTRY CONTRIBUTION</span>
            <div class="flow-step-text">${p.contribution}</div>
          </div>
          <div class="flow-step-box" style="border-left:3px solid #0d9488">
            <span class="flow-step-badge" style="background:#ccfbf1;color:#115e59">3. SOLUTION</span>
            <div class="flow-step-text">${p.solution}</div>
          </div>
          <div class="flow-step-box" style="border-left:3px solid #059669">
            <span class="flow-step-badge" style="background:#d1fae5;color:#065f46">4. OUTCOME</span>
            <div class="flow-step-text">${p.outcome}</div>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Render Before vs After
  if (compGrid) {
    compGrid.innerHTML = filtered.slice(0, 4).map(p => `
      <div class="comparison-card">
        <div class="comparison-header">
          <span>${p.title}</span>
          <span class="badge badge-submitted" style="font-size:10.5px">${p.domain}</span>
        </div>
        <div class="comparison-body">
          <div class="comparison-col-before">
            <div style="font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">❌ BEFORE (Baseline)</div>
            <div style="font-weight:700;margin-bottom:6px;color:#7f1d1d">${p.before.title}</div>
            <ul style="padding-left:14px;margin:0;display:flex;flex-direction:column;gap:4px">
              ${p.before.items.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
          <div class="comparison-col-after">
            <div style="font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">✅ AFTER (Solution)</div>
            <div style="font-weight:700;margin-bottom:6px;color:#14532d">${p.after.title}</div>
            <ul style="padding-left:14px;margin:0;display:flex;flex-direction:column;gap:4px">
              ${p.after.items.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Render Measured Outcomes
  if (outcomesGrid) {
    outcomesGrid.innerHTML = filtered.map(p => `
      <div class="outcome-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:14px;font-weight:800;color:var(--gray-900)">${p.title}</div>
            <div style="font-size:11.5px;color:var(--gray-500)">Metric: <strong>${p.metricName}</strong></div>
          </div>
          <span class="badge badge-resolved" style="font-size:11px">${p.improvement}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;background:#f8fafc;padding:10px 14px;border-radius:var(--radius-md);border:1px solid var(--gray-200);margin-top:6px">
          <div>
            <div style="font-size:10.5px;color:var(--gray-400);text-transform:uppercase;font-weight:700">Before</div>
            <div style="font-size:16px;font-weight:800;color:#dc2626">${p.beforeMetric}</div>
          </div>
          <div style="font-size:18px;color:var(--gray-400)">→</div>
          <div>
            <div style="font-size:10.5px;color:var(--gray-400);text-transform:uppercase;font-weight:700">After</div>
            <div style="font-size:16px;font-weight:800;color:#059669">${p.afterMetric}</div>
          </div>
          <div>
            <div style="font-size:10.5px;color:var(--gray-400);text-transform:uppercase;font-weight:700">Gain</div>
            <div style="font-size:14px;font-weight:800;color:var(--primary)">${p.improvement.split(' ')[0]}</div>
          </div>
        </div>
      </div>
    `).join('');
  }
}

function initImpactCharts() {
  // 1. CSR Sector Chart (Doughnut)
  const csrCtx = document.getElementById('csrSectorChart')?.getContext('2d');
  if (csrCtx && typeof Chart !== 'undefined') {
    if (csrChartInstance) csrChartInstance.destroy();

    csrChartInstance = new Chart(csrCtx, {
      type: 'doughnut',
      data: {
        labels: defaultCSRContribution.map(c => c.sector.split('&')[0].trim()),
        datasets: [{
          data: defaultCSRContribution.map(c => c.amount),
          backgroundColor: defaultCSRContribution.map(c => c.color),
          borderWidth: 2,
          borderColor: 'white'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { family: 'Inter', size: 10.5 }, boxWidth: 10, padding: 8 }
          }
        },
        cutout: '58%'
      }
    });
  }

  // 2. Domain Impact Chart (Horizontal Bar)
  const domainCtx = document.getElementById('domainImpactChart')?.getContext('2d');
  if (domainCtx && typeof Chart !== 'undefined') {
    if (domainChartInstance) domainChartInstance.destroy();

    domainChartInstance = new Chart(domainCtx, {
      type: 'bar',
      data: {
        labels: ['Agriculture', 'Education', 'Healthcare', 'Water & San', 'Energy & Tech'],
        datasets: [{
          label: 'Supported Projects',
          data: [4, 3, 2, 2, 1],
          backgroundColor: ['#059669', '#2563eb', '#dc2626', '#0891b2', '#d97706'],
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { stepSize: 1, font: { size: 10.5 } },
            grid: { color: '#f1f5f9' }
          },
          y: {
            ticks: { font: { size: 11, weight: '600' } },
            grid: { display: false }
          }
        }
      }
    });
  }
}

function openImpactReportModal() {
  const printArea = document.getElementById('impactReportPrintArea');
  if (!printArea) return;

  const kpi = defaultIndustryImpact;
  const companyName = currentUser?.name || 'InnovateSphere Enterprise Partner';
  const reportDate = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  printArea.innerHTML = `
    <div style="border-bottom:2px solid var(--primary);padding-bottom:14px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:20px;font-weight:900;color:var(--gray-900)">JanSetu Innovation & CSR Social Audit Report</div>
        <div style="font-size:13px;color:var(--gray-600);margin-top:2px">Higher Education Institution & Industry Partnership Verification</div>
        <div style="font-size:12px;color:var(--primary);font-weight:700;margin-top:4px">SIH 2026 Problem Statement 26043</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:12px;color:var(--gray-500)">Report Date</div>
        <div style="font-size:14px;font-weight:800;color:var(--gray-800)">${reportDate}</div>
        <span class="badge badge-resolved" style="margin-top:4px;font-size:10.5px">Official CSR Impact Record</span>
      </div>
    </div>

    <!-- Company Meta -->
    <div style="background:#f8fafc;padding:12px 16px;border-radius:var(--radius-md);border:1px solid var(--gray-200);margin-bottom:18px;display:grid;grid-template-columns:repeat(3, 1fr);gap:12px;font-size:12.5px">
      <div>
        <span style="color:var(--gray-500)">Industry Enterprise:</span><br>
        <strong>${companyName}</strong>
      </div>
      <div>
        <span style="color:var(--gray-500)">Audit Jurisdiction:</span><br>
        <strong>Jharkhand State Council</strong>
      </div>
      <div>
        <span style="color:var(--gray-500)">Total Committed Grant:</span><br>
        <strong style="color:#059669">₹${(kpi.totalFunding/100000).toFixed(1)} Lakhs</strong>
      </div>
    </div>

    <!-- Core KPI Table -->
    <div style="font-size:14px;font-weight:800;color:var(--gray-900);margin-bottom:8px">1. Quantitative Social Return & Metrics</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12px">
      <thead>
        <tr style="background:#f1f5f9;text-align:left;border-bottom:1px solid var(--gray-200)">
          <th style="padding:8px 10px">Indicator</th>
          <th style="padding:8px 10px">Achieved Value</th>
          <th style="padding:8px 10px">Baseline</th>
          <th style="padding:8px 10px">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:1px solid var(--gray-100)">
          <td style="padding:8px 10px">Supported Higher Education Projects</td>
          <td style="padding:8px 10px"><strong>${kpi.projectsSupported} Projects</strong></td>
          <td style="padding:8px 10px">0</td>
          <td style="padding:8px 10px"><span class="badge badge-resolved" style="font-size:10px">Active</span></td>
        </tr>
        <tr style="border-bottom:1px solid var(--gray-100)">
          <td style="padding:8px 10px">Student Innovators Mentored</td>
          <td style="padding:8px 10px"><strong>${kpi.studentsMentored} Undergraduates & Grads</strong></td>
          <td style="padding:8px 10px">0</td>
          <td style="padding:8px 10px"><span class="badge badge-resolved" style="font-size:10px">Validated</span></td>
        </tr>
        <tr style="border-bottom:1px solid var(--gray-100)">
          <td style="padding:8px 10px">Working Prototypes Built & Bench Tested</td>
          <td style="padding:8px 10px"><strong>${kpi.prototypesDeveloped} Units</strong></td>
          <td style="padding:8px 10px">0</td>
          <td style="padding:8px 10px"><span class="badge badge-resolved" style="font-size:10px">Verified</span></td>
        </tr>
        <tr style="border-bottom:1px solid var(--gray-100)">
          <td style="padding:8px 10px">On-Ground Field Trials Conducted</td>
          <td style="padding:8px 10px"><strong>${kpi.fieldTests} Testbeds</strong></td>
          <td style="padding:8px 10px">0</td>
          <td style="padding:8px 10px"><span class="badge badge-resolved" style="font-size:10px">Passed</span></td>
        </tr>
        <tr style="border-bottom:1px solid var(--gray-100)">
          <td style="padding:8px 10px">Solutions Deployed in Communities</td>
          <td style="padding:8px 10px"><strong>${kpi.solutionsDeployed} Rollouts</strong></td>
          <td style="padding:8px 10px">0</td>
          <td style="padding:8px 10px"><span class="badge badge-resolved" style="font-size:10px">Commissioned</span></td>
        </tr>
        <tr style="border-bottom:1px solid var(--gray-100)">
          <td style="padding:8px 10px">Grassroots Citizens Impacted</td>
          <td style="padding:8px 10px"><strong>${Number(kpi.communitiesImpacted).toLocaleString('en-IN')} Beneficiaries</strong></td>
          <td style="padding:8px 10px">0</td>
          <td style="padding:8px 10px"><span class="badge badge-resolved" style="font-size:10px">Ground Surveyed</span></td>
        </tr>
      </tbody>
    </table>

    <!-- Project Breakdown Table -->
    <div style="font-size:14px;font-weight:800;color:var(--gray-900);margin-bottom:8px">2. Verified Project Portfolios</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12px">
      <thead>
        <tr style="background:#f1f5f9;text-align:left;border-bottom:1px solid var(--gray-200)">
          <th style="padding:8px 10px">Project</th>
          <th style="padding:8px 10px">Domain & District</th>
          <th style="padding:8px 10px">CSR Committed</th>
          <th style="padding:8px 10px">Measured Gain</th>
          <th style="padding:8px 10px">Status</th>
        </tr>
      </thead>
      <tbody>
        ${defaultProjectImpactList.map(p => `
          <tr style="border-bottom:1px solid var(--gray-100)">
            <td style="padding:8px 10px"><strong>${p.title}</strong></td>
            <td style="padding:8px 10px">${p.domain} • ${p.district}</td>
            <td style="padding:8px 10px">₹${Number(p.funding).toLocaleString('en-IN')}</td>
            <td style="padding:8px 10px;color:#059669;font-weight:700">${p.improvement}</td>
            <td style="padding:8px 10px">${p.deploymentStatus}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Signatures -->
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--gray-200);display:flex;justify-content:space-between;font-size:11.5px;color:var(--gray-600)">
      <div>
        __________________________________<br>
        <strong>Industry CSR Officer</strong><br>
        ${companyName}
      </div>
      <div style="text-align:right">
        __________________________________<br>
        <strong>JanSetu Platform Officer</strong><br>
        Higher Education & Innovation Wing
      </div>
    </div>
  `;

  openModal('impactReportModal');
}

function printImpactReport() {
  window.print();
}

// Window bindings for Impact Analytics
window.loadImpactAnalytics = loadImpactAnalytics;
window.onImpactFilterChange = onImpactFilterChange;
window.resetImpactFilters = resetImpactFilters;
window.openImpactReportModal = openImpactReportModal;
window.printImpactReport = printImpactReport;


// ══════════════════════════════════════════════════════════════════════════════════
// ── Industry Opportunity & ROI Center Logic (SIH 2026 Problem Statement 26043) ──
// ══════════════════════════════════════════════════════════════════════════════════

const STORAGE_ROI_SIMULATOR_KEY = 'janSetu_roi_simulator_state';

const OPPORTUNITY_ROI_PROJECTS = [
  {
    id: 'PRJ-001',
    challengeId: '7229B7B8',
    title: 'Smart Irrigation System for Water-Stressed Farms',
    domain: 'Agriculture',
    district: 'Ranchi',
    university: 'Xavier Institute of Social Service',
    matchScore: 96,
    pillars: {
      expertiseMatch: 94,
      csrAlignment: 98,
      socialImpact: 95,
      feasibility: 92
    },
    targetBeneficiaries: '500 Farmers across 3 village clusters',
    budgetRequired: '₹5,00,000',
    readinessLevel: 'TRL 5 (Lab & Bench Validated)',
    capabilities: ['IoT Telemetry', 'LoRaWAN Firmware', 'Capacitive Sensors', 'Solar Micro-grids'],
    impactSummary: '25% water conservation, 18% higher crop yield, automated SMS drought alerts in vernacular Hindi.',
    sdgs: ['SDG 2: Zero Hunger', 'SDG 6: Clean Water', 'SDG 12: Responsible Consumption'],
    risks: 'Seasonal monsoon variations; mitigated by IP67 weatherproof enclosures and solar battery backups.'
  },
  {
    id: 'proj-solar-001',
    challengeId: 'SOLAR-001',
    title: 'Solar-Powered Decentralized Cold Storage for Tribal Forest Produce',
    domain: 'Renewable Energy & Agriculture',
    district: 'Latehar',
    university: 'Birla Institute of Technology, Mesra',
    matchScore: 92,
    pillars: {
      expertiseMatch: 90,
      csrAlignment: 94,
      socialImpact: 93,
      feasibility: 89
    },
    targetBeneficiaries: '350 Tribal Forest Gatherers (Mahua, Lac, Tamarind)',
    budgetRequired: '₹7,50,000',
    readinessLevel: 'TRL 6 (Field Test Unit Operating)',
    capabilities: ['Thermal Phase Change Storage', 'Solar Inverter Design', 'Supply Chain Traceability'],
    impactSummary: 'Eliminates 40% post-harvest spoilage of perishable NTFPs, boosting annual tribal household incomes by ₹28,000.',
    sdgs: ['SDG 7: Clean Energy', 'SDG 8: Decent Work', 'SDG 10: Reduced Inequalities'],
    risks: 'Intermittent cloudy periods; mitigated by latent heat thermal storage phase-change wax tanks.'
  },
  {
    id: 'proj-water-002',
    challengeId: 'WATER-002',
    title: 'IoT-Enabled Arsenic & Fluoride Community Water Filtration Telemetry',
    domain: 'Water Management & Sanitation',
    district: 'Sahebganj',
    university: 'National Institute of Technology, Jamshedpur',
    matchScore: 89,
    pillars: {
      expertiseMatch: 88,
      csrAlignment: 92,
      socialImpact: 90,
      feasibility: 86
    },
    targetBeneficiaries: '1,200 Hamlet Residents across 4 Ganga Basin hamlets',
    budgetRequired: '₹6,00,000',
    readinessLevel: 'TRL 5 (Pilot Column Tested)',
    capabilities: ['Adsorbent Regeneration', 'GSM Telemetry', 'Spectrophotometric Sensing'],
    impactSummary: 'Safe potable water compliance meeting WHO standards for fluorosis-endemic hamlets with real-time Jal Jeevan sync.',
    sdgs: ['SDG 3: Good Health', 'SDG 6: Clean Water & Sanitation'],
    risks: 'Filter saturation monitoring; mitigated by ultrasonic automated backwash cycles and GSM alerts.'
  },
  {
    id: 'proj-health-004',
    challengeId: 'HEALTH-004',
    title: 'Mobile AI Diagnostic Kiosk for Remote Primary Health Centres',
    domain: 'Healthcare & Digital Health',
    district: 'Dumka',
    university: 'AIIMS Deoghar Collaboration & BIT Sindri',
    matchScore: 86,
    pillars: {
      expertiseMatch: 84,
      csrAlignment: 90,
      socialImpact: 88,
      feasibility: 82
    },
    targetBeneficiaries: '800 Remote Patients without primary physician access',
    budgetRequired: '₹8,00,000',
    readinessLevel: 'TRL 4 (Lab Prototype Functional)',
    capabilities: ['Biomedical Sensing', 'Edge Machine Learning', 'Vernacular Audio UI'],
    impactSummary: 'Rapid 8-parameter point-of-care vital screening under 3 minutes with automated tele-consultation routing.',
    sdgs: ['SDG 3: Good Health & Well-being', 'SDG 9: Industry & Innovation'],
    risks: 'Cellular dead zones in forest belts; mitigated by edge-native offline record caching with store-and-forward.'
  }
];

const DEFAULT_ROI_SIMULATOR_STATE = {
  funding: 500000,
  mentorship: 35,
  equipmentTier: 2, // 1: Basic Dev Kits, 2: IoT & Lab Benches, 3: Field Stations
  fieldSites: 3,     // 1 to 8 sites
  deploymentTier: 2, // 1: Pilot Testing, 2: Cluster Rollout, 3: District Scale
  whatIfBoost: 50    // 25%, 50%, or 100% boost
};

let currentRoiState = null;

function getStoredRoiSimulatorState() {
  try {
    const raw = localStorage.getItem(STORAGE_ROI_SIMULATOR_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.funding) {
        return { ...DEFAULT_ROI_SIMULATOR_STATE, ...parsed };
      }
    }
  } catch (e) {
    console.error('Failed to parse stored ROI simulator state:', e);
  }
  return { ...DEFAULT_ROI_SIMULATOR_STATE };
}

function saveStoredRoiSimulatorState(state) {
  if (!state) return;
  try {
    localStorage.setItem(STORAGE_ROI_SIMULATOR_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save ROI simulator state to localStorage:', e);
  }
}

function calculateRoiMetrics(state) {
  const funding = Number(state.funding) || 500000;
  const mentorship = Number(state.mentorship) || 35;
  const eqTier = Number(state.equipmentTier) || 2;
  const sites = Number(state.fieldSites) || 3;
  const depTier = Number(state.deploymentTier) || 2;

  const projectsSupported = Math.max(1, Math.floor(funding / 400000) + (eqTier >= 2 ? 1 : 0));
  const studentsMentored = (projectsSupported * 4) + Math.round(mentorship * 0.6) + (eqTier * 3);
  const communitiesReached = sites + ((depTier - 1) * 3) + Math.floor(funding / 600000);
  const prototypesAccelerated = Math.min(projectsSupported + 1, Math.floor(funding / 350000) + (eqTier >= 2 ? 1 : 0));
  const fieldTestsEnabled = sites;
  const solutionsDeployed = Math.max(1, Math.floor(sites * 0.6) + (depTier - 1));
  const beneficiaryReach = (communitiesReached * 175) + Math.round(funding / 1100) + (solutionsDeployed * 150);
  const impactScore = Math.min(99, Math.round(62 + (funding / 2500000) * 18 + (mentorship / 80) * 7 + (eqTier * 4) + (depTier * 4)));

  return {
    funding,
    mentorship,
    eqTier,
    sites,
    depTier,
    projectsSupported,
    studentsMentored,
    communitiesReached,
    prototypesAccelerated,
    fieldTestsEnabled,
    solutionsDeployed,
    beneficiaryReach,
    impactScore
  };
}

function loadOpportunityRoiCenter() {
  currentRoiState = getStoredRoiSimulatorState();
  renderOpportunityRoiCenter();
}

function renderOpportunityRoiCenter() {
  const container = document.getElementById('opportunityRoiContainer');
  if (!container) return;

  if (!currentRoiState) {
    currentRoiState = getStoredRoiSimulatorState();
  }

  const cur = calculateRoiMetrics(currentRoiState);

  // What-If Proposed Calculations
  const boost = Number(currentRoiState.whatIfBoost) || 50;
  const boostMultiplier = 1 + (boost / 100);
  const proposedState = {
    funding: Math.round(currentRoiState.funding * boostMultiplier),
    mentorship: Math.min(80, Math.round(currentRoiState.mentorship * boostMultiplier)),
    equipmentTier: Math.min(3, currentRoiState.equipmentTier + (boost >= 50 ? 1 : 0)),
    fieldSites: Math.min(8, Math.round(currentRoiState.fieldSites * boostMultiplier)),
    deploymentTier: Math.min(3, currentRoiState.deploymentTier + (boost >= 50 ? 1 : 0)),
    whatIfBoost: boost
  };
  const prop = calculateRoiMetrics(proposedState);

  // Deltas
  const dFunding = prop.funding - cur.funding;
  const dStudents = prop.studentsMentored - cur.studentsMentored;
  const dCommunities = prop.communitiesReached - cur.communitiesReached;
  const dPrototypes = prop.prototypesAccelerated - cur.prototypesAccelerated;
  const dDeployments = prop.solutionsDeployed - cur.solutionsDeployed;
  const dScore = prop.impactScore - cur.impactScore;

  container.innerHTML = `
    <!-- Top Hero Banner -->
    <div class="roi-hero-banner">
      <div class="roi-hero-title">
        <span>🎯</span>
        <span>Industry Opportunity & ROI Center</span>
        <span class="badge badge-resolved" style="background:#10b981;color:white;border:none;font-size:12px;font-weight:800;padding:4px 10px">
          SIH 2026 PS26043
        </span>
      </div>
      <div class="roi-hero-subtitle">
        Data-driven CSR allocation and university innovation matching engine for Jharkhand. Evaluate readiness, forecast measurable societal returns, and model your strategic footprint.
      </div>
      <div class="roi-microcopy-pill">
        <span>💡</span>
        <span>"See where your contribution can create the highest measurable impact."</span>
      </div>
    </div>

    <!-- ════════ 1. OPPORTUNITY SCORE ════════ -->
    <div>
      <div class="roi-section-head">
        <div>
          <h2 class="roi-section-title">
            <span>🏆</span> 1. Opportunity Score
          </h2>
          <div class="roi-section-sub">
            Ranked evaluation of higher education societal innovations based on capability match, CSR criteria, and feasibility.
          </div>
        </div>
        <span class="badge badge-assigned" style="font-size:12px;font-weight:750">
          AI Evaluated • 4 Verified HEI Projects
        </span>
      </div>

      <div class="opportunity-grid">
        ${OPPORTUNITY_ROI_PROJECTS.map(p => {
          const badgeClass = p.matchScore >= 90 ? 'high' : 'good';
          return `
            <div class="opportunity-card">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px">
                  <div>
                    <span style="font-size:11px;font-weight:800;color:var(--primary);text-transform:uppercase;letter-spacing:0.5px">
                      #${p.challengeId} • ${p.domain}
                    </span>
                    <h3 style="font-size:15.5px;font-weight:850;color:var(--gray-900);line-height:1.35;margin:4px 0">
                      ${p.title}
                    </h3>
                    <div style="font-size:12px;color:var(--gray-500)">
                      📍 ${p.district}, Jharkhand • 🏛️ ${p.university}
                    </div>
                  </div>
                  <div class="opp-score-badge ${badgeClass}" title="Opportunity Match Score">
                    ${p.matchScore}
                  </div>
                </div>

                <div class="pillar-row">
                  <div class="pillar-bar-item">
                    <div class="pillar-bar-label">
                      <span>Expertise Match</span>
                      <span style="color:var(--primary)">${p.pillars.expertiseMatch}%</span>
                    </div>
                    <div class="progress-bar" style="height:5px">
                      <div class="progress-fill" style="width:${p.pillars.expertiseMatch}%;background:var(--primary)"></div>
                    </div>
                  </div>

                  <div class="pillar-bar-item">
                    <div class="pillar-bar-label">
                      <span>CSR Alignment</span>
                      <span style="color:#059669">${p.pillars.csrAlignment}%</span>
                    </div>
                    <div class="progress-bar" style="height:5px">
                      <div class="progress-fill" style="width:${p.pillars.csrAlignment}%;background:#059669"></div>
                    </div>
                  </div>

                  <div class="pillar-bar-item">
                    <div class="pillar-bar-label">
                      <span>Social Impact Potential</span>
                      <span style="color:#d97706">${p.pillars.socialImpact}%</span>
                    </div>
                    <div class="progress-bar" style="height:5px">
                      <div class="progress-fill" style="width:${p.pillars.socialImpact}%;background:#d97706"></div>
                    </div>
                  </div>

                  <div class="pillar-bar-item">
                    <div class="pillar-bar-label">
                      <span>Implementation Feasibility</span>
                      <span style="color:#7c3aed">${p.pillars.feasibility}%</span>
                    </div>
                    <div class="progress-bar" style="height:5px">
                      <div class="progress-fill" style="width:${p.pillars.feasibility}%;background:#7c3aed"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--gray-100);padding-top:12px;gap:8px">
                <span class="badge" style="font-size:10.5px;background:#f1f5f9;color:var(--gray-600)">
                  ${p.readinessLevel.split('(')[0].trim()}
                </span>
                <button onclick="openOpportunityAnalysisModal('${p.id}')" class="btn btn-sm btn-outline-primary" style="font-weight:700;padding:5px 12px;font-size:12px">
                  <span>📊</span> View Analysis
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- ════════ 2 & 3. CONTRIBUTION SIMULATOR & CSR IMPACT CALCULATOR ════════ -->
    <div class="simulator-card">
      <div class="roi-section-head">
        <div>
          <h2 class="roi-section-title">
            <span>⚙️</span> 2. Contribution Simulator &amp; 3. CSR Impact Calculator
          </h2>
          <div class="roi-section-sub">
            Interactive modeling engine: adjust support parameters to dynamically calculate projected social outcomes across target districts.
          </div>
        </div>
        <button onclick="resetRoiSimulator()" class="btn btn-sm btn-ghost" style="border:1px solid var(--gray-200);font-weight:600">
          ↺ Reset Defaults
        </button>
      </div>

      <div class="simulator-layout-grid" style="margin-top:16px">
        
        <!-- Controls Column (Simulator) -->
        <div style="background:#fafbfc;border:1px solid var(--gray-200);border-radius:var(--radius-lg);padding:20px 22px">
          <div style="font-size:13.5px;font-weight:800;color:var(--gray-900);margin-bottom:14px;display:flex;align-items:center;gap:6px">
            <span>🎛️</span> Support Allocation Parameters
          </div>

          <!-- 1. Funding Slider -->
          <div class="sim-slider-row">
            <div class="sim-slider-header">
              <span>💰 Funding Amount</span>
              <span class="sim-val-bubble" id="simFundingText">₹${Number(currentRoiState.funding).toLocaleString('en-IN')}</span>
            </div>
            <input type="range" min="100000" max="2500000" step="50000" value="${currentRoiState.funding}" class="sim-slider-input" oninput="onRoiSliderChange('funding', this.value)">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--gray-400)">
              <span>₹1 Lakh</span>
              <span>₹12.5 Lakhs</span>
              <span>₹25 Lakhs</span>
            </div>
          </div>

          <!-- 2. Mentorship Slider -->
          <div class="sim-slider-row">
            <div class="sim-slider-header">
              <span>👨‍🏫 Technical Mentorship</span>
              <span class="sim-val-bubble" id="simMentorshipText">${currentRoiState.mentorship} hrs / month</span>
            </div>
            <input type="range" min="10" max="80" step="5" value="${currentRoiState.mentorship}" class="sim-slider-input" oninput="onRoiSliderChange('mentorship', this.value)">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--gray-400)">
              <span>10 hrs</span>
              <span>45 hrs</span>
              <span>80 hrs</span>
            </div>
          </div>

          <!-- 3. Hardware / Equipment Tiers -->
          <div style="margin-bottom:16px">
            <div style="font-size:12.5px;font-weight:700;color:var(--gray-800);margin-bottom:6px">
              🛠️ Hardware / Equipment Support
            </div>
            <div class="sim-tier-group">
              <button class="sim-tier-btn ${currentRoiState.equipmentTier === 1 ? 'active' : ''}" onclick="setRoiTier('equipmentTier', 1)">
                Basic Dev Kits
              </button>
              <button class="sim-tier-btn ${currentRoiState.equipmentTier === 2 ? 'active' : ''}" onclick="setRoiTier('equipmentTier', 2)">
                IoT &amp; Lab Benches
              </button>
              <button class="sim-tier-btn ${currentRoiState.equipmentTier === 3 ? 'active' : ''}" onclick="setRoiTier('equipmentTier', 3)">
                Field Test Stations
              </button>
            </div>
          </div>

          <!-- 4. Field Testing Sites -->
          <div style="margin-bottom:16px">
            <div style="font-size:12.5px;font-weight:700;color:var(--gray-800);margin-bottom:6px">
              🧪 Field Testing Support
            </div>
            <div class="sim-tier-group">
              <button class="sim-tier-btn ${currentRoiState.fieldSites === 1 ? 'active' : ''}" onclick="setRoiTier('fieldSites', 1)">
                1 Pilot Site
              </button>
              <button class="sim-tier-btn ${currentRoiState.fieldSites === 3 ? 'active' : ''}" onclick="setRoiTier('fieldSites', 3)">
                3 Village Sites
              </button>
              <button class="sim-tier-btn ${currentRoiState.fieldSites === 6 ? 'active' : ''}" onclick="setRoiTier('fieldSites', 6)">
                6 Cluster Sites
              </button>
            </div>
          </div>

          <!-- 5. Deployment Support -->
          <div>
            <div style="font-size:12.5px;font-weight:700;color:var(--gray-800);margin-bottom:6px">
              🚀 Deployment Support
            </div>
            <div class="sim-tier-group">
              <button class="sim-tier-btn ${currentRoiState.deploymentTier === 1 ? 'active' : ''}" onclick="setRoiTier('deploymentTier', 1)">
                Pilot Testing
              </button>
              <button class="sim-tier-btn ${currentRoiState.deploymentTier === 2 ? 'active' : ''}" onclick="setRoiTier('deploymentTier', 2)">
                Cluster Rollout
              </button>
              <button class="sim-tier-btn ${currentRoiState.deploymentTier === 3 ? 'active' : ''}" onclick="setRoiTier('deploymentTier', 3)">
                District Scale
              </button>
            </div>
          </div>
        </div>

        <!-- Outputs Column (CSR Impact Calculator) -->
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div style="font-size:13.5px;font-weight:800;color:var(--gray-900);display:flex;align-items:center;gap:6px">
              <span>📊</span> Projected CSR Social Return
            </div>
            <span class="badge" style="background:#eff6ff;color:var(--primary);border-color:#bfdbfe;font-size:11px;font-weight:750">
              Composite Social ROI: ${cur.impactScore}/100
            </span>
          </div>

          <div class="roi-calc-grid">
            <div class="roi-calc-stat-card">
              <div style="font-size:20px">🎓</div>
              <div>
                <div class="roi-stat-num" id="calcStudents">${cur.studentsMentored}</div>
                <div class="roi-stat-lbl">Students Benefited / Mentored</div>
              </div>
              <div style="font-size:10.5px;color:var(--gray-400);margin-top:4px">Estimated direct cohort</div>
            </div>

            <div class="roi-calc-stat-card">
              <div style="font-size:20px">🏘️</div>
              <div>
                <div class="roi-stat-num" id="calcCommunities">${cur.communitiesReached}</div>
                <div class="roi-stat-lbl">Communities / Villages Reached</div>
              </div>
              <div style="font-size:10.5px;color:var(--gray-400);margin-top:4px">Estimated target hamlets</div>
            </div>

            <div class="roi-calc-stat-card">
              <div style="font-size:20px">🔬</div>
              <div>
                <div class="roi-stat-num" id="calcPrototypes">${cur.prototypesAccelerated}</div>
                <div class="roi-stat-lbl">Prototypes Accelerated</div>
              </div>
              <div style="font-size:10.5px;color:var(--gray-400);margin-top:4px">Estimated functional units</div>
            </div>

            <div class="roi-calc-stat-card">
              <div style="font-size:20px">🧪</div>
              <div>
                <div class="roi-stat-num" id="calcFieldTests">${cur.fieldTestsEnabled}</div>
                <div class="roi-stat-lbl">Field Tests Enabled</div>
              </div>
              <div style="font-size:10.5px;color:var(--gray-400);margin-top:4px">Estimated validation sites</div>
            </div>

            <div class="roi-calc-stat-card">
              <div style="font-size:20px">🚀</div>
              <div>
                <div class="roi-stat-num" id="calcDeployments">${cur.solutionsDeployed}</div>
                <div class="roi-stat-lbl">Solutions Deployed</div>
              </div>
              <div style="font-size:10.5px;color:var(--gray-400);margin-top:4px">Estimated pilot rollouts</div>
            </div>

            <div class="roi-calc-stat-card" style="background:#f0fdf4;border-color:#bbf7d0">
              <div style="font-size:20px">👥</div>
              <div>
                <div class="roi-stat-num" style="color:#047857" id="calcBeneficiaries">${Number(cur.beneficiaryReach).toLocaleString('en-IN')}</div>
                <div class="roi-stat-lbl" style="color:#065f46">Estimated Beneficiary Reach</div>
              </div>
              <div style="font-size:10.5px;color:#059669;margin-top:4px">Estimated rural citizens</div>
            </div>
          </div>

          <div style="margin-top:14px;background:#f8fafc;border:1px solid var(--gray-200);border-radius:var(--radius-md);padding:12px 14px;font-size:12px;color:var(--gray-600);line-height:1.5">
            <strong>Estimated Social ROI Formula:</strong> Metric projections are generated by the JanSetu Institutional Matching Model calibrated for Jharkhand's aspirational districts. Results are forward-looking estimates based on selected allocation parameters.
          </div>
        </div>

      </div>
    </div>

    <!-- ════════ 4. WHAT-IF ANALYSIS ════════ -->
    <div class="card" style="padding:22px 26px">
      <div class="roi-section-head">
        <div>
          <h2 class="roi-section-title">
            <span>📈</span> 4. What If We Increase Our Support?
          </h2>
          <div class="roi-section-sub">
            Simulate scenario expansions to compare current contribution levels against prospective CSR funding boosts.
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <span style="font-size:12px;font-weight:700;color:var(--gray-600)">Expansion Preset:</span>
          <button class="btn btn-sm ${boost === 25 ? 'btn-primary' : 'btn-ghost'}" style="padding:4px 10px;font-size:11.5px;border:1px solid var(--gray-200)" onclick="setWhatIfBoost(25)">
            +25%
          </button>
          <button class="btn btn-sm ${boost === 50 ? 'btn-primary' : 'btn-ghost'}" style="padding:4px 10px;font-size:11.5px;border:1px solid var(--gray-200)" onclick="setWhatIfBoost(50)">
            +50% (Recommended)
          </button>
          <button class="btn btn-sm ${boost === 100 ? 'btn-primary' : 'btn-ghost'}" style="padding:4px 10px;font-size:11.5px;border:1px solid var(--gray-200)" onclick="setWhatIfBoost(100)">
            +100% (2x Scale)
          </button>
        </div>
      </div>

      <div class="what-if-grid" style="margin-top:16px">
        
        <!-- Card 1: Current Support -->
        <div class="what-if-card">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--gray-100);padding-bottom:10px">
            <span style="font-size:12px;font-weight:800;color:var(--gray-500);letter-spacing:0.5px">CURRENT SUPPORT LEVEL</span>
            <span class="badge" style="background:#f1f5f9;color:var(--gray-700);font-size:11px">Base Model</span>
          </div>

          <div style="font-size:24px;font-weight:850;color:var(--gray-900)">
            ₹${Number(cur.funding).toLocaleString('en-IN')}
            <span style="font-size:12.5px;font-weight:600;color:var(--gray-500);display:block">Committed Financial Grant</span>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;font-size:13px">
            <div style="display:flex;justify-content:space-between">
              <span style="color:var(--gray-600)">Students Benefited:</span>
              <strong>${cur.studentsMentored} Students</strong>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span style="color:var(--gray-600)">Communities Reached:</span>
              <strong>${cur.communitiesReached} Villages</strong>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span style="color:var(--gray-600)">Prototypes Accelerated:</span>
              <strong>${cur.prototypesAccelerated} Prototypes</strong>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span style="color:var(--gray-600)">Deployments Enabled:</span>
              <strong>${cur.solutionsDeployed} Deployments</strong>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span style="color:var(--gray-600)">Social Impact Score:</span>
              <strong style="color:var(--primary)">${cur.impactScore} / 100</strong>
            </div>
          </div>
        </div>

        <!-- Card 2: Proposed Support -->
        <div class="what-if-card proposed">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #bfdbfe;padding-bottom:10px">
            <span style="font-size:12px;font-weight:800;color:var(--primary);letter-spacing:0.5px">PROPOSED SUPPORT (+${boost}%)</span>
            <span class="what-if-delta-badge">
              +${boost}% Scale-Up
            </span>
          </div>

          <div style="font-size:24px;font-weight:850;color:var(--primary)">
            ₹${Number(prop.funding).toLocaleString('en-IN')}
            <span class="what-if-delta-badge" style="font-size:11px;margin-left:6px">+₹${(dFunding / 100000).toFixed(1)}L Boost</span>
            <span style="font-size:12.5px;font-weight:600;color:var(--gray-600);display:block">Expanded Allocation</span>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;font-size:13px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="color:var(--gray-700)">Students Benefited:</span>
              <div style="display:flex;align-items:center;gap:6px">
                <strong>${prop.studentsMentored} Students</strong>
                <span class="what-if-delta-badge">+${dStudents} (+${Math.round((dStudents / cur.studentsMentored) * 100)}%)</span>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="color:var(--gray-700)">Communities Reached:</span>
              <div style="display:flex;align-items:center;gap:6px">
                <strong>${prop.communitiesReached} Villages</strong>
                <span class="what-if-delta-badge">+${dCommunities} (+${Math.round((dCommunities / cur.communitiesReached) * 100)}%)</span>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="color:var(--gray-700)">Prototypes Accelerated:</span>
              <div style="display:flex;align-items:center;gap:6px">
                <strong>${prop.prototypesAccelerated} Prototypes</strong>
                <span class="what-if-delta-badge">+${dPrototypes} (+${Math.round((dPrototypes / cur.prototypesAccelerated) * 100)}%)</span>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="color:var(--gray-700)">Deployments Enabled:</span>
              <div style="display:flex;align-items:center;gap:6px">
                <strong>${prop.solutionsDeployed} Deployments</strong>
                <span class="what-if-delta-badge">+${dDeployments} (+${Math.round((dDeployments / cur.solutionsDeployed) * 100)}%)</span>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="color:var(--gray-700)">Social Impact Score:</span>
              <div style="display:flex;align-items:center;gap:6px">
                <strong style="color:#059669">${prop.impactScore} / 100</strong>
                <span class="what-if-delta-badge">+${dScore} pts</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- ════════ 5. RECOMMENDED OPPORTUNITIES ════════ -->
    <div>
      <div class="roi-section-head">
        <div>
          <h2 class="roi-section-title">
            <span>✨</span> 5. Recommended for Your Organization
          </h2>
          <div class="roi-section-sub">
            Ranked opportunities matching ABC Technologies' CSR focus, technical competencies, and district priorities.
          </div>
        </div>
        <span class="badge badge-assigned" style="font-size:12px">Ranked by Strategic ROI</span>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px">
        ${OPPORTUNITY_ROI_PROJECTS.map((p, idx) => `
          <div class="rec-opp-item">
            <div style="display:flex;align-items:flex-start;gap:14px;flex:1;min-width:280px">
              <span style="font-size:12px;font-weight:850;color:white;background:var(--primary);width:32px;height:32px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                #${idx + 1}
              </span>
              <div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span style="font-size:11px;font-weight:800;color:var(--primary);text-transform:uppercase">
                    #${p.challengeId} • ${p.domain}
                  </span>
                  <span class="badge" style="background:#eff6ff;color:var(--primary);border-color:#bfdbfe;font-size:11px">
                    Match Score: ${p.matchScore}/100
                  </span>
                  <span class="badge" style="background:#ecfdf5;color:#047857;border-color:#a7f3d0;font-size:11px">
                    ${p.pillars.csrAlignment}% CSR Alignment
                  </span>
                </div>
                <h3 style="font-size:16px;font-weight:850;color:var(--gray-900);margin:4px 0 3px">
                  ${p.title}
                </h3>
                <div style="font-size:12.5px;color:var(--gray-500);margin-bottom:6px">
                  📍 ${p.district}, Jharkhand &nbsp;•&nbsp; 🏛️ ${p.university} &nbsp;•&nbsp; 🎯 <strong>Beneficiaries:</strong> ${p.targetBeneficiaries}
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  ${p.capabilities.map(cap => `
                    <span style="font-size:11px;padding:2px 8px;background:#f1f5f9;border-radius:4px;color:var(--gray-700);font-weight:600">
                      ${cap}
                    </span>
                  `).join('')}
                </div>
              </div>
            </div>

            <div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
              <button onclick="openOpportunityAnalysisModal('${p.id}')" class="btn btn-sm btn-ghost" style="border:1px solid var(--gray-200);font-weight:700">
                Analyze Opportunity
              </button>
              <button onclick="startCollabFromRoi('${p.id}', '${p.title.replace(/'/g, "\\'")}')" class="btn btn-sm btn-primary" style="display:inline-flex;align-items:center;gap:6px;font-weight:700;box-shadow:var(--shadow-sm)">
                <span>🤝</span> Start Collaboration
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function onRoiSliderChange(param, val) {
  if (!currentRoiState) currentRoiState = getStoredRoiSimulatorState();
  currentRoiState[param] = Number(val);
  saveStoredRoiSimulatorState(currentRoiState);
  renderOpportunityRoiCenter();
}

function setRoiTier(param, val) {
  if (!currentRoiState) currentRoiState = getStoredRoiSimulatorState();
  currentRoiState[param] = Number(val);
  saveStoredRoiSimulatorState(currentRoiState);
  renderOpportunityRoiCenter();
}

function setWhatIfBoost(boost) {
  if (!currentRoiState) currentRoiState = getStoredRoiSimulatorState();
  currentRoiState.whatIfBoost = Number(boost);
  saveStoredRoiSimulatorState(currentRoiState);
  renderOpportunityRoiCenter();
}

function resetRoiSimulator() {
  currentRoiState = { ...DEFAULT_ROI_SIMULATOR_STATE };
  saveStoredRoiSimulatorState(currentRoiState);
  renderOpportunityRoiCenter();
  Toast.info('Simulator Reset', 'Restored default contribution allocation parameters.');
}

function openOpportunityAnalysisModal(projectId) {
  const p = OPPORTUNITY_ROI_PROJECTS.find(item => item.id === projectId) || OPPORTUNITY_ROI_PROJECTS[0];
  const titleEl = document.getElementById('oppModalTitle');
  const subEl = document.getElementById('oppModalSub');
  const scoreBadge = document.getElementById('oppModalScoreBadge');
  const bodyEl = document.getElementById('oppModalBody');
  const actionsEl = document.getElementById('oppModalFooterActions');

  if (titleEl) titleEl.textContent = p.title;
  if (subEl) subEl.textContent = `Challenge #${p.challengeId} • ${p.domain} • ${p.university} (${p.district}, Jharkhand)`;
  if (scoreBadge) scoreBadge.textContent = `${p.matchScore}/100 Match`;

  if (bodyEl) {
    bodyEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:10px;margin-bottom:18px">
        <div style="background:#f8fafc;border:1px solid var(--gray-200);border-radius:var(--radius-md);padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--gray-500);font-weight:700">EXPERTISE MATCH</div>
          <div style="font-size:20px;font-weight:850;color:var(--primary);margin-top:2px">${p.pillars.expertiseMatch}%</div>
        </div>
        <div style="background:#f8fafc;border:1px solid var(--gray-200);border-radius:var(--radius-md);padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--gray-500);font-weight:700">CSR ALIGNMENT</div>
          <div style="font-size:20px;font-weight:850;color:#059669;margin-top:2px">${p.pillars.csrAlignment}%</div>
        </div>
        <div style="background:#f8fafc;border:1px solid var(--gray-200);border-radius:var(--radius-md);padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--gray-500);font-weight:700">SOCIAL IMPACT</div>
          <div style="font-size:20px;font-weight:850;color:#d97706;margin-top:2px">${p.pillars.socialImpact}%</div>
        </div>
        <div style="background:#f8fafc;border:1px solid var(--gray-200);border-radius:var(--radius-md);padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--gray-500);font-weight:700">FEASIBILITY</div>
          <div style="font-size:20px;font-weight:850;color:#7c3aed;margin-top:2px">${p.pillars.feasibility}%</div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:var(--radius-md);padding:14px">
          <div style="font-size:11.5px;font-weight:800;color:var(--primary);text-transform:uppercase">Measurable Social Impact Rationale</div>
          <div style="font-size:13.5px;color:var(--gray-800);margin-top:4px;line-height:1.5">${p.impactSummary}</div>
        </div>

        <div style="background:#f8fafc;border:1px solid var(--gray-200);border-radius:var(--radius-md);padding:14px">
          <div style="font-size:11.5px;font-weight:800;color:var(--gray-700);text-transform:uppercase">Target Beneficiaries & Scope</div>
          <div style="font-size:13.5px;color:var(--gray-800);margin-top:4px">${p.targetBeneficiaries}</div>
          <div style="font-size:12px;color:var(--gray-500);margin-top:2px">Budget Allocation Benchmark: <strong>${p.budgetRequired}</strong> &nbsp;•&nbsp; Technology Readiness: <strong>${p.readinessLevel}</strong></div>
        </div>

        <div style="background:#f8fafc;border:1px solid var(--gray-200);border-radius:var(--radius-md);padding:14px">
          <div style="font-size:11.5px;font-weight:800;color:var(--gray-700);text-transform:uppercase;margin-bottom:6px">UN Sustainable Development Goals (SDGs)</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${p.sdgs.map(s => `<span class="badge badge-assigned" style="font-size:11px">${s}</span>`).join('')}
          </div>
        </div>

        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:var(--radius-md);padding:14px">
          <div style="font-size:11.5px;font-weight:800;color:#991b1b;text-transform:uppercase">Risk Factor & Engineering Mitigation</div>
          <div style="font-size:13px;color:#7f1d1d;margin-top:4px">${p.risks}</div>
        </div>
      </div>
    `;
  }

  if (actionsEl) {
    actionsEl.innerHTML = `
      <button onclick="closeModal('opportunityAnalysisModal')" class="btn btn-ghost">Close</button>
      <button onclick="startCollabFromRoi('${p.id}', '${p.title.replace(/'/g, "\\'")}')" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:6px;font-weight:700">
        <span>🤝</span> Start Collaboration
      </button>
    `;
  }

  openModal('opportunityAnalysisModal');
}

function startCollabFromRoi(projectId, title) {
  closeModal('opportunityAnalysisModal');
  // Reuses the existing Express Interest modal
  openPartnerModal(projectId, title);
}

// Window bindings for Opportunity & ROI Center
window.loadOpportunityRoiCenter = loadOpportunityRoiCenter;
window.onRoiSliderChange = onRoiSliderChange;
window.setRoiTier = setRoiTier;
window.setWhatIfBoost = setWhatIfBoost;
window.resetRoiSimulator = resetRoiSimulator;
window.openOpportunityAnalysisModal = openOpportunityAnalysisModal;
window.startCollabFromRoi = startCollabFromRoi;

window.openModal = (id) => document.getElementById(id).classList.add('open');
window.closeModal = (id) => document.getElementById(id).classList.remove('open');
document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if(e.target===o) o.classList.remove('open'); }));

window.logout = () => {
  Confirm.show({
    title: 'Logout', message: 'Are you sure you want to logout?', confirmText: 'Logout', type: 'warning',
    onConfirm: () => { Auth.clearAuth(); window.location.href = '/login.html'; }
  });
};
