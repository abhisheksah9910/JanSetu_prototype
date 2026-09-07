// auth.js — Login, Register, Forgot Password logic

document.addEventListener('DOMContentLoaded', () => {
  // Redirect if already logged in (login, register, forgot-password)
  if (Auth.isLoggedIn()) {
    const user = Auth.getUser();
    Auth.redirectToDashboard(user ? user.role : 'citizen');
    return;
  }

  const page = window.location.pathname;
  if (page.includes('login')) initLogin();
  if (page.includes('register')) initRegister();
  if (page.includes('forgot-password')) initForgotPassword();

  // Pre-fill role from URL param
  const urlRole = new URLSearchParams(window.location.search).get('role');
  if (urlRole) {
    const roleInput = document.querySelector(`input[name="role"][value="${urlRole}"]`);
    if (roleInput) { roleInput.checked = true; roleInput.dispatchEvent(new Event('change')); }
  }
});

// ── Login ──
function initLogin() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btn = document.getElementById('loginBtn');

    clearErrors();

    let valid = true;
    if (!email || email.length < 3) { showError('emailError', 'Please enter your email, mobile, or citizen ID (e.g. C4819)'); valid = false; }
    if (!password) { showError('passwordError', 'Password is required'); valid = false; }
    if (!valid) return;

    btn.classList.add('loading');

    try {
      const res = await API.post('/auth/login', { email, password });
      if (res.success) {
        Auth.setAuth(res.token, res.user);
        Toast.success('Welcome back!', `Logged in as ${res.user.name}`);
        setTimeout(() => Auth.redirectToDashboard(res.user.role), 800);
      }
    } catch (error) {
      showAlert('loginAlert', 'error', error.message || 'Login failed. Please check your credentials.');
      btn.classList.remove('loading');
    }
  });
}

window.quickLogin = async (email, password) => {
  document.getElementById('email').value = email;
  document.getElementById('password').value = password;
  document.getElementById('loginForm').dispatchEvent(new Event('submit'));
};

window.openOtpLoginModal = () => {
  const modal = document.getElementById('otpLoginModal');
  if (modal) modal.style.display = 'flex';
};

window.closeOtpLoginModal = () => {
  const modal = document.getElementById('otpLoginModal');
  if (modal) modal.style.display = 'none';
};

window.submitOtpLogin = async () => {
  const identifier = (document.getElementById('otpLoginIdentifier')?.value || '').trim();
  const otp = (document.getElementById('otpLoginInput')?.value || '').trim();

  if (!identifier) {
    alert('Please enter your Mobile or Aadhaar number');
    return;
  }
  if (otp !== '123456') {
    alert('Invalid OTP. Please enter demo code 123456');
    return;
  }

  // Quick sign in as Citizen (Rajesh Mahto)
  closeOtpLoginModal();
  quickLogin('rajesh@gmail.com', 'citizen123');
};

let isRegOtpVerified = false;

window.triggerRegisterOtp = () => {
  const modal = document.getElementById('regOtpModal');
  if (modal) modal.style.display = 'flex';
};

window.closeRegOtpModal = () => {
  const modal = document.getElementById('regOtpModal');
  if (modal) modal.style.display = 'none';
};

window.verifyRegOtp = () => {
  const otp = (document.getElementById('regOtpInput')?.value || '').trim();
  if (otp !== '123456') {
    alert('Invalid OTP. Please enter demo code 123456');
    return;
  }
  isRegOtpVerified = true;
  closeRegOtpModal();
  const statusEl = document.getElementById('regOtpStatusText');
  if (statusEl) statusEl.innerHTML = '<span style="color:#059669;font-weight:800;">✓ Mobile &amp; Aadhaar Verified Successfully!</span>';
  const triggerBtn = document.getElementById('btnTriggerRegOtp');
  if (triggerBtn) {
    triggerBtn.textContent = '✓ Verified';
    triggerBtn.style.background = '#059669';
    triggerBtn.style.borderColor = '#059669';
    triggerBtn.disabled = true;
  }
  Toast.success('Identity Verified!', 'Mobile and Aadhaar authenticated via OTP 123456');
};

// ── Register ──
function initRegister() {
  const form = document.getElementById('registerForm');
  if (!form) return;

  // Toggle university/industry fields based on role
  document.querySelectorAll('input[name="role"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const role = radio.value;
      document.getElementById('universityFields').style.display = role === 'university_rep' ? 'block' : 'none';
      document.getElementById('industryFields').style.display = role === 'industry_rep' ? 'block' : 'none';
      document.getElementById('citizenFields').style.display = role === 'citizen' ? 'block' : 'none';

      // Load universities/partners if needed
      if (role === 'university_rep') loadUniversitiesForSelect();
      if (role === 'industry_rep') loadIndustryForSelect();
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('registerBtn');
    clearErrors();

    const role = document.querySelector('input[name="role"]:checked')?.value || 'citizen';
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const phone = document.getElementById('regPhone').value.trim();
    const aadhaar = document.getElementById('regAadhaar')?.value.trim() || '8492-3840-4819';

    let valid = true;
    if (!name || name.length < 2) { showError('nameError', 'Please enter your full name'); valid = false; }
    if (!email || !/\S+@\S+\.\S+/.test(email)) { showError('regEmailError', 'Please enter a valid email'); valid = false; }
    if (!password || password.length < 6) { showError('regPasswordError', 'Password must be at least 6 characters'); valid = false; }
    if (password !== confirmPassword) { showError('confirmPasswordError', 'Passwords do not match'); valid = false; }
    if (role === 'citizen' && (!aadhaar || aadhaar.length < 12)) {
      showError('regAadhaarError', 'Please enter a valid 12-digit Aadhaar number');
      valid = false;
    }
    if (!valid) return;

    if (role === 'citizen' && !isRegOtpVerified) {
      triggerRegisterOtp();
      return;
    }

    const data = { name, email, password, role, phone, aadhaar };

    if (role === 'university_rep') {
      data.universityId = document.getElementById('universitySelect')?.value;
      data.designation = document.getElementById('designation')?.value;
      data.department = document.getElementById('department')?.value;
    }
    if (role === 'industry_rep') {
      data.industryPartnerId = document.getElementById('industrySelect')?.value;
      data.designation = document.getElementById('designationInd')?.value;
    }
    if (role === 'citizen') {
      data.address = {
        city: document.getElementById('city')?.value,
        district: document.getElementById('district')?.value
      };
    }

    btn.classList.add('loading');

    try {
      const res = await API.post('/auth/register', data);
      if (res.success) {
        Auth.setAuth(res.token, res.user);
        const cidMsg = res.user.citizenId ? ` Your Citizen ID is: ${res.user.citizenId}.` : '';
        Toast.success('Account created!' + cidMsg, 'Welcome to JanSetu!');
        setTimeout(() => Auth.redirectToDashboard(res.user.role), 1200);
      }
    } catch (error) {
      showAlert('registerAlert', 'error', error.message || 'Registration failed. Please try again.');
      btn.classList.remove('loading');
    }
  });
}

async function loadUniversitiesForSelect() {
  const sel = document.getElementById('universitySelect');
  if (!sel || sel.children.length > 1) return;
  try {
    const res = await API.get('/universities');
    if (res.success) {
      res.data.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u._id;
        opt.textContent = u.name;
        sel.appendChild(opt);
      });
    }
  } catch(e) {}
}

async function loadIndustryForSelect() {
  const sel = document.getElementById('industrySelect');
  if (!sel || sel.children.length > 1) return;
  try {
    const res = await API.get('/industry');
    if (res.success) {
      res.data.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p._id;
        opt.textContent = p.name;
        sel.appendChild(opt);
      });
    }
  } catch(e) {}
}

// ── Forgot Password ──
function initForgotPassword() {
  const form = document.getElementById('forgotForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('fpEmail').value.trim();
    const btn = document.getElementById('fpBtn');

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      showError('fpEmailError', 'Please enter a valid email address');
      return;
    }

    btn.classList.add('loading');

    try {
      const res = await API.post('/auth/forgot-password', { email });
      if (res.success) {
        document.getElementById('forgotForm').style.display = 'none';
        document.getElementById('forgotSuccess').style.display = 'block';
      }
    } catch (error) {
      showAlert('fpAlert', 'error', error.message || 'Could not send reset link. Please try again.');
      btn.classList.remove('loading');
    }
  });
}

// ── Helpers ──
function showError(id, message) {
  const el = document.getElementById(id);
  if (el) {
    el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> ${message}`;
    el.style.display = 'flex';
    const input = el.previousElementSibling?.querySelector('input') || el.previousElementSibling;
    if (input) input.classList.add('error');
  }
}

function clearErrors() {
  document.querySelectorAll('.form-error').forEach(el => { el.style.display = 'none'; el.textContent = ''; });
  document.querySelectorAll('.form-control.error').forEach(el => el.classList.remove('error'));
}

function showAlert(id, type, message) {
  const el = document.getElementById(id);
  if (!el) return;
  const icons = { error: '✕', success: '✓', info: 'ℹ' };
  el.className = `auth-alert auth-alert-${type}`;
  el.innerHTML = `<span>${icons[type]}</span> ${message}`;
  el.style.display = 'flex';
}

window.togglePassword = (id) => {
  const input = document.getElementById(id);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
};
