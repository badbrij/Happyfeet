const API_BASE = 'http://localhost:5000/api/v1';

let authToken = '';
let currentUser = null;
let currentStep = 1;

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initUserSelector();
  initModal();
  initLocationSelectors();
  initOtpInputs('otp-inputs-container');
  initEditProfileSetup();
  initHealthSyncSetup();
  checkSavedSession();

  document.getElementById('sync-steps-btn').addEventListener('click', handleSyncSteps);
  document.getElementById('registration-form').addEventListener('submit', handleRegistrationSubmit);
  
  const quickLoginForm = document.getElementById('quick-login-form');
  if (quickLoginForm) {
    quickLoginForm.addEventListener('submit', handleQuickLogin);
  }

  const quickLoginOtpForm = document.getElementById('quick-login-otp-form');
  if (quickLoginOtpForm) {
    quickLoginOtpForm.addEventListener('submit', handleQuickLoginOtpSubmit);
  }

  const createGroupForm = document.getElementById('create-group-form');
  if (createGroupForm) {
    createGroupForm.addEventListener('submit', handleCreateGroup);
  }

  const joinGroupForm = document.getElementById('join-group-form');
  if (joinGroupForm) {
    joinGroupForm.addEventListener('submit', handleJoinGroup);
  }

  // Check for invite query param
  const urlParams = new URLSearchParams(window.location.search);
  const inviteCode = urlParams.get('invite');
  if (inviteCode) {
    localStorage.setItem('pending_invite_code', inviteCode);
    // Clear query parameter from browser address bar
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  initViewportSwitcher();
  initDailyChallenge();
  initAvatarSetup();
});

// Tab Navigation
function initTabs() {
  const tabs = document.querySelectorAll('.nav-btn');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      const targetView = tab.getAttribute('data-tab');
      document.querySelectorAll('.view-panel').forEach((panel) => panel.classList.remove('active'));
      document.getElementById(targetView).classList.add('active');
    });
  });
}

// User Switcher
function initUserSelector() {
  const selector = document.getElementById('user-selector');
  selector.addEventListener('change', (e) => {
    loginUser(e.target.value);
  });
}

// Multi-step Modal Controls
function initModal() {
  const registerModal = document.getElementById('register-modal');
  const quickLoginModal = document.getElementById('quick-login-modal');
  const openQuickLoginBtn = document.getElementById('open-quick-login-modal-btn');
  const closeRegisterBtn = document.getElementById('close-modal-btn');
  const closeQuickLoginBtn = document.getElementById('close-quick-login-modal-btn');
  const headerAvatar = document.getElementById('header-user-avatar');
  const editProfileModal = document.getElementById('edit-profile-modal');
  const closeEditProfileBtn = document.getElementById('close-edit-profile-btn');

  if (headerAvatar) {
    headerAvatar.style.cursor = 'pointer';
    headerAvatar.title = 'Edit Profile';
    headerAvatar.addEventListener('click', () => {
      if (currentUser) {
        document.getElementById('edit-alias').value = currentUser.alias || currentUser.name || '';
        document.getElementById('edit-gender').value = currentUser.gender || 'Male';
        document.getElementById('edit-avatar-data').value = currentUser.profilePic || '';
        
        const preview = document.getElementById('edit-avatar-preview');
        if (preview) {
          preview.innerHTML = getAvatarHTML(currentUser.profilePic, '90px', '55px', currentUser.gender);
        }
        editProfileModal.classList.add('active');
      }
    });
  }

  if (closeEditProfileBtn) {
    closeEditProfileBtn.addEventListener('click', () => {
      editProfileModal.classList.remove('active');
    });
  }

  if (openQuickLoginBtn) {
    openQuickLoginBtn.addEventListener('click', () => {
      quickLoginModal.classList.add('active');
    });
  }

  if (closeQuickLoginBtn) {
    closeQuickLoginBtn.addEventListener('click', () => {
      quickLoginModal.classList.remove('active');
      document.getElementById('quick-login-form').style.display = 'block';
      document.getElementById('quick-login-otp-form').style.display = 'none';
      document.getElementById('quick-login-otp-form').reset();
      document.getElementById('quick-login-form').reset();
      document.getElementById('ql-otp-sim-hint').style.display = 'none';
      document.getElementById('ql-otp-sim-code').innerText = '';
    });
  }

  if (closeRegisterBtn) {
    closeRegisterBtn.addEventListener('click', () => {
      registerModal.classList.remove('active');
      showFormStep(1);
      document.getElementById('registration-form').reset();
      document.querySelectorAll('#form-step-otp .otp-input-box').forEach(inp => inp.value = '');
      document.getElementById('reg-otp-sim-hint').style.display = 'none';
      document.getElementById('reg-otp-sim-code').innerText = '';
    });
  }

  const qlOtpBackBtn = document.getElementById('ql-otp-back-btn');
  if (qlOtpBackBtn) {
    qlOtpBackBtn.addEventListener('click', () => {
      document.getElementById('quick-login-otp-form').style.display = 'none';
      document.getElementById('quick-login-form').style.display = 'block';
      document.getElementById('quick-login-otp-form').reset();
      document.getElementById('ql-otp-sim-hint').style.display = 'none';
      document.getElementById('ql-otp-sim-code').innerText = '';
    });
  }

  const createGroupModal = document.getElementById('create-group-modal');
  const openCreateGroupBtn = document.getElementById('create-group-btn');
  const closeCreateGroupBtn = document.getElementById('close-create-group-modal-btn');

  if (openCreateGroupBtn) {
    openCreateGroupBtn.addEventListener('click', () => {
      if (!currentUser) {
        showToast('Please login to create a group');
        document.getElementById('quick-login-modal').classList.add('active');
        return;
      }
      createGroupModal.classList.add('active');
    });
  }

  if (closeCreateGroupBtn) {
    closeCreateGroupBtn.addEventListener('click', () => {
      createGroupModal.classList.remove('active');
    });
  }

  const joinGroupModal = document.getElementById('join-group-modal');
  const openJoinGroupBtn = document.getElementById('join-group-btn');
  const closeJoinGroupBtn = document.getElementById('close-join-group-modal-btn');

  if (openJoinGroupBtn) {
    openJoinGroupBtn.addEventListener('click', () => {
      if (!currentUser) {
        showToast('Please login to join a group');
        document.getElementById('quick-login-modal').classList.add('active');
        return;
      }
      joinGroupModal.classList.add('active');
    });
  }

  if (closeJoinGroupBtn) {
    closeJoinGroupBtn.addEventListener('click', () => {
      joinGroupModal.classList.remove('active');
    });
  }

  const shareGroupModal = document.getElementById('share-group-modal');
  const closeShareGroupBtn = document.getElementById('close-share-group-modal-btn');
  if (closeShareGroupBtn) {
    closeShareGroupBtn.addEventListener('click', () => {
      shareGroupModal.classList.remove('active');
    });
  }

  const guideModal = document.getElementById('walkcoins-guide-modal');
  const showGuideBtn = document.getElementById('show-coins-guide-btn');
  const closeGuideBtn = document.getElementById('close-walkcoins-guide-modal-btn');
  if (showGuideBtn && guideModal) {
    showGuideBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      guideModal.classList.add('active');
    });
  }
  if (closeGuideBtn && guideModal) {
    closeGuideBtn.addEventListener('click', () => {
      guideModal.classList.remove('active');
    });
  }

  const copyBtn = document.getElementById('copy-share-link-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const linkInput = document.getElementById('share-link-input');
      linkInput.select();
      linkInput.setSelectionRange(0, 99999);
      navigator.clipboard.writeText(linkInput.value);
      showToast('Link copied to clipboard!');
    });
  }

  let verificationPhone = '';
  let verifiedPhone = '';

  document.getElementById('next-step-1').addEventListener('click', async () => {
    const name = document.getElementById('reg-name').value;
    const phone = document.getElementById('reg-phone').value;
    const cleanPhone = phone.replace(/[-.\s()]/g, '');
    const phoneRegex = /^\+?\d{10,12}$/;

    if (!name || !phone) {
      showToast('⚠️ Please fill out all basic details.');
      return;
    }
    if (!phoneRegex.test(cleanPhone)) {
      showToast('⚠️ Please enter a valid 10-digit or 12-digit mobile number.');
      return;
    }

    if (phone === verifiedPhone) {
      showFormStep(2);
      return;
    }

    verificationPhone = phone;
    document.getElementById('reg-otp-phone-display').innerText = phone;

    // Send OTP via Backend
    showToast('📨 Sending verification code...');
    try {
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (res.ok) {
        // Show simulated OTP in UI toast so user doesn't need terminal access
        showToast(`💬 Simulated SMS: Your verification code is ${data.simulatedOtp}`, 15000);
        document.getElementById('reg-otp-sim-code').innerText = data.simulatedOtp;
        document.getElementById('reg-otp-sim-hint').style.display = 'block';
        showFormStep('otp');
        setTimeout(() => document.getElementById('reg-otp-1').focus(), 100);
      } else {
        showToast(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      showToast('❌ Connection error sending OTP.');
    }
  });

  // Back button from OTP verification step inside Registration
  const regOtpBackBtn = document.getElementById('reg-otp-back-btn');
  if (regOtpBackBtn) {
    regOtpBackBtn.addEventListener('click', () => {
      showFormStep(1);
      document.getElementById('reg-otp-sim-hint').style.display = 'none';
      document.getElementById('reg-otp-sim-code').innerText = '';
    });
  }

  // Verify OTP inside Registration step
  const regOtpVerifyBtn = document.getElementById('reg-otp-verify-btn');
  if (regOtpVerifyBtn) {
    regOtpVerifyBtn.addEventListener('click', async () => {
      let otp = '';
      for (let i = 1; i <= 6; i++) {
        otp += document.getElementById(`reg-otp-${i}`).value;
      }

      if (otp.length < 6) {
        showToast('⚠️ Please enter the complete 6-digit verification code.');
        return;
      }

      showToast('🔑 Verifying code...');
      try {
        const res = await fetch(`${API_BASE}/auth/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: verificationPhone, otp }),
        });
        const data = await res.json();
        if (res.ok) {
          showToast('✅ Mobile number verified!');
          
          verifiedPhone = verificationPhone;
          if (data.exists) {
            // Existing user duplicate registration path - auto-login directly!
            document.getElementById('register-modal').classList.remove('active');
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('happyfeet_token', authToken);
            localStorage.setItem('happyfeet_user_email', currentUser.email);
            
            showToast(`Welcome back, ${currentUser.alias || currentUser.name}!`);
            window.location.reload();
          } else {
            // New user - unlock step 2 and proceed
            showFormStep(2);
          }
        } else {
          showToast(`❌ Invalid OTP: ${data.error}`);
        }
      } catch (err) {
        console.error(err);
        showToast('❌ Connection error verifying OTP.');
      }
    });
  }

  document.getElementById('next-step-2').addEventListener('click', () => {
    const dob = document.getElementById('reg-dob').value;
    const gender = document.getElementById('reg-gender').value;
    const country = document.getElementById('reg-country').value;
    const state = document.getElementById('reg-state').value;
    let city = document.getElementById('reg-city').value;
    const locality = document.getElementById('reg-locality').value;

    if (!dob || !gender || !country || !state || !city || !locality) {
      showToast('⚠️ Please fill out all location details.');
      return;
    }

    if (city === 'Other') {
      const cityManual = document.getElementById('reg-city-manual').value.trim();
      if (!cityManual) {
        showToast('⚠️ Please enter your city name.');
        return;
      }
      city = cityManual;
    }

    // Age validation
    const dobDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - dobDate.getFullYear();
    const m = today.getMonth() - dobDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
      age--;
    }
    if (age < 15) {
      showToast('⚠️ You must be at least 15 years old to join BadaKadam.');
      return;
    }

    showFormStep(3);
  });

  document.getElementById('prev-step-2').addEventListener('click', () => showFormStep(1));
  document.getElementById('prev-step-3').addEventListener('click', () => showFormStep(2));
}

function showFormStep(step) {
  currentStep = step;
  if (step === 'otp') {
    document.getElementById('onboarding-step-num').innerText = 'Verification';
  } else {
    document.getElementById('onboarding-step-num').innerText = step;
  }

  document.querySelectorAll('.form-step').forEach((el) => el.classList.remove('active'));
  document.getElementById(`form-step-${step}`).classList.add('active');
}

let quickLoginPhone = '';

// Quick Login Form Submit -> Dispatch OTP
async function handleQuickLogin(e) {
  e.preventDefault();
  const phone = document.getElementById('ql-phone').value;

  const cleanPhone = phone.replace(/[-.\s()]/g, '');
  const phoneRegex = /^\+?\d{10,12}$/;
  if (!phoneRegex.test(cleanPhone)) {
    showToast('⚠️ Please enter a valid 10-digit or 12-digit mobile number.');
    return;
  }

  showToast('📨 Sending verification code...');
  try {
    const res = await fetch(`${API_BASE}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (res.ok) {
      quickLoginPhone = phone;
      document.getElementById('ql-otp-phone-display').innerText = phone;
      
      // Show simulated OTP banner
      showToast(`💬 Simulated SMS: Your verification code is ${data.simulatedOtp}`, 15000);
      document.getElementById('ql-otp-sim-code').innerText = data.simulatedOtp;
      document.getElementById('ql-otp-sim-hint').style.display = 'block';
      
      // Transition forms inside modal
      document.getElementById('quick-login-form').style.display = 'none';
      document.getElementById('quick-login-otp-form').style.display = 'flex';
      setTimeout(() => document.getElementById('ql-otp-1').focus(), 100);
    } else {
      showToast(`❌ Error: ${data.error}`);
    }
  } catch (err) {
    console.error(err);
    showToast('❌ Connection error sending OTP.');
  }
}

// Quick Login OTP Verification
async function handleQuickLoginOtpSubmit(e) {
  e.preventDefault();
  let otp = '';
  for (let i = 1; i <= 6; i++) {
    otp += document.getElementById(`ql-otp-${i}`).value;
  }

  if (otp.length < 6) {
    showToast('⚠️ Please enter the complete 6-digit verification code.');
    return;
  }

  showToast('🔑 Verifying code...');
  try {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: quickLoginPhone, otp }),
    });
    const data = await res.json();
    if (res.ok) {
      if (data.exists) {
        // User exists: log in successfully
        document.getElementById('quick-login-modal').classList.remove('active');
        document.getElementById('quick-login-otp-form').reset();
        document.getElementById('quick-login-form').reset();
        
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('happyfeet_token', authToken);
        localStorage.setItem('happyfeet_user_email', currentUser.email);
        localStorage.removeItem('happyfeet_logged_out');

        const displayName = currentUser.alias || currentUser.name;
        showToast(`Welcome back, ${displayName}!`);
        window.location.reload();
      } else {
        // User does not exist: redirect to registration modal!
        document.getElementById('quick-login-modal').classList.remove('active');
        document.getElementById('quick-login-otp-form').reset();
        document.getElementById('quick-login-form').reset();
        
        // Open registration and pre-fill phone number
        document.getElementById('register-modal').classList.add('active');
        document.getElementById('reg-phone').value = quickLoginPhone;
        document.getElementById('reg-phone').setAttribute('readonly', 'true');
        document.getElementById('reg-phone').style.background = 'rgba(255,255,255,0.02)';
        document.getElementById('reg-phone').style.opacity = '0.8';

        verifiedPhone = quickLoginPhone; // Bypasses duplicate OTP validation on register submit!
        showToast('🔑 Mobile number verified! Please complete your profile configuration.');
        showFormStep(1);
      }
    } else {
      showToast(`❌ Invalid OTP: ${data.error}`);
    }
  } catch (err) {
    console.error(err);
    showToast('❌ Connection error verifying OTP.');
  }
}

// Submit Registration Form to Backend REST API
async function handleRegistrationSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('reg-name').value;
  const alias = document.getElementById('reg-alias').value;
  const phone = document.getElementById('reg-phone').value;
  const password = 'Password123!';

  const dob = document.getElementById('reg-dob').value;
  const gender = document.getElementById('reg-gender').value;
  const country = document.getElementById('reg-country').value;
  const state = document.getElementById('reg-state').value;
  let city = document.getElementById('reg-city').value;
  const locality = document.getElementById('reg-locality').value;

  const heightCm = Number(document.getElementById('reg-height').value);
  const weightKg = Number(document.getElementById('reg-weight').value);
  const occupation = document.getElementById('reg-occupation').value;
  const dailyStepGoal = Number(document.getElementById('reg-goal').value);

  const profilePic = document.getElementById('reg-avatar-data').value;

  if (city === 'Other') {
    city = document.getElementById('reg-city-manual').value.trim();
    if (!city) {
      showToast('⚠️ Please enter your city name.');
      return;
    }
  }

  // Age validation
  const dobDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - dobDate.getFullYear();
  const m = today.getMonth() - dobDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
    age--;
  }
  if (age < 15) {
    showToast('⚠️ You must be at least 15 years old to join BadaKadam.');
    return;
  }

  if (dailyStepGoal <= 0) {
    showToast('⚠️ Daily step goal must be a positive number.');
    return;
  }

  const payload = {
    name,
    alias,
    profilePic,
    phone,
    password,
    dob,
    gender,
    location: { country, state, city, locality },
    healthProfile: { heightCm, weightKg, occupation, dailyStepGoal }
  };

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.ok) {
      document.getElementById('register-modal').classList.remove('active');
      const displayName = alias || name;
      showToast(`🎉 Account Created! Welcome to BadaKadam, ${displayName}!`);

      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('happyfeet_token', authToken);
      localStorage.setItem('happyfeet_user_email', currentUser.email);
      localStorage.removeItem('happyfeet_logged_out');
      window.location.reload();
    } else {
      if (data.error && (data.error.includes('mobile number') || data.error.includes('phone'))) {
        showToast('🔑 Mobile number already registered! Logging you in...');
        
        try {
          const loginRes = await fetch(`${API_BASE}/auth/quick-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone }),
          });
          const loginData = await loginRes.json();
          if (loginRes.ok) {
            document.getElementById('register-modal').classList.remove('active');
            authToken = loginData.token;
            currentUser = loginData.user;
            localStorage.setItem('happyfeet_token', authToken);
            localStorage.setItem('happyfeet_user_email', currentUser.email);
            localStorage.removeItem('happyfeet_logged_out');
            
            showToast(`Welcome back, ${currentUser.alias || currentUser.name}!`);
            window.location.reload();
          } else {
            alert(`❌ Auto-Login Failed: ${loginData.error}`);
          }
        } catch (loginErr) {
          console.error(loginErr);
          alert('Failed to connect to backend for auto-login.');
        }
      } else if (data.error && data.error.includes('email')) {
        alert(`❌ Email already exists: ${data.error}. Please log in or use a different email address.`);
      } else {
        alert(`❌ Registration Failed: ${data.error}`);
      }
    }
  } catch (err) {
    console.error(err);
    alert('Failed to connect to backend server for registration.');
  }
}

// Handle Group Creation
async function handleCreateGroup(e) {
  e.preventDefault();
  if (!authToken) {
    showToast('Please login first');
    return;
  }

  const name = document.getElementById('grp-name').value;
  const groupType = document.getElementById('grp-type').value;
  const targetSteps = parseInt(document.getElementById('grp-target').value, 10);
  const battleDuration = document.getElementById('grp-duration').value;
  const allowedPhonesVal = document.getElementById('grp-allowed-phones').value;
  const allowedPhones = allowedPhonesVal ? allowedPhonesVal.split(',').map(p => p.trim()).filter(p => p !== '') : [];

  try {
    const res = await fetch(`${API_BASE}/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ name, groupType, targetSteps, allowedPhones, battleDuration }),
    });

    const data = await res.json();
    if (res.ok) {
      showToast('Group Created Successfully!');
      document.getElementById('create-group-modal').classList.remove('active');
      document.getElementById('create-group-form').reset();
      refreshAllData(); // Refresh groups
    } else {
      showToast(data.error || 'Failed to create group');
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to connect to server');
  }
}

// Handle Join Group
async function handleJoinGroup(e) {
  e.preventDefault();
  if (!authToken) {
    showToast('Please login first');
    return;
  }

  const inviteCode = document.getElementById('join-grp-code').value;

  try {
    const res = await fetch(`${API_BASE}/groups/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ inviteCode }),
    });

    const data = await res.json();
    if (res.ok) {
      showToast('Successfully joined the group!');
      document.getElementById('join-group-modal').classList.remove('active');
      document.getElementById('join-group-form').reset();
      refreshAllData(); // Refresh groups
    } else {
      showToast(data.error || 'Failed to join group');
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to connect to server');
  }
}

// Setup multi-box focus and key actions for OTP verification screens
function initOtpInputs(containerClass) {
  const containers = document.querySelectorAll(`.${containerClass}`);
  containers.forEach(container => {
    const inputs = container.querySelectorAll('.otp-input-box');
    inputs.forEach((input, index) => {
      input.addEventListener('keyup', (e) => {
        if (e.key >= 0 && e.key <= 9) {
          if (index < inputs.length - 1) {
            inputs[index + 1].focus();
          }
        } else if (e.key === 'Backspace') {
          if (index > 0) {
            inputs[index - 1].focus();
          }
        }
      });
      // Handle paste
      input.addEventListener('paste', (e) => {
        const data = e.clipboardData.getData('text').trim();
        if (data.length === inputs.length && /^\d+$/.test(data)) {
          inputs.forEach((inp, idx) => {
            inp.value = data[idx];
          });
          inputs[inputs.length - 1].focus();
          e.preventDefault();
        }
      });
    });
  });
}

// Check saved session in LocalStorage
async function checkSavedSession() {
  const savedToken = localStorage.getItem('happyfeet_token');
  const loggedOut = localStorage.getItem('happyfeet_logged_out');
  
  if (savedToken) {
    authToken = savedToken;
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        currentUser = data.user;
        updateAuthUI();
        refreshAllData();
        checkPendingInvite();
        return;
      } else {
        localStorage.removeItem('happyfeet_token');
        localStorage.removeItem('happyfeet_user_email');
        authToken = '';
      }
    } catch (err) {
      console.error('Session load error:', err);
    }
  }
  
  if (loggedOut === 'true') {
    updateAuthUI();
    return;
  }
  
  // Default fallback reviewer login
  loginUser('brijesh@badakadam.com');
}

// Rebuild user profile switcher selector dropdown options dynamically
function updateSwitcherOptions(topGroupWalkers = []) {
  const selector = document.getElementById('user-selector');
  if (!selector) return;

  if (!currentUser) {
    selector.innerHTML = `
      <optgroup label="Demo Profiles">
        <option value="brijesh@badakadam.com">Brijesh Sharma (Hyderabad)</option>
        <option value="priya@badakadam.com">Priya Verma (Hyderabad)</option>
        <option value="rahul@badakadam.com">Rahul Mehta (Hyderabad)</option>
        <option value="amit@badakadam.com">Amit Patel (Mumbai)</option>
        <option value="ananya@badakadam.com">Ananya Rao (Bangalore)</option>
      </optgroup>
      <optgroup label="Registered Profiles" id="user-registered-group"></optgroup>
    `;
    return;
  }

  const userCity = currentUser.location ? currentUser.location.city : '';
  const userLabel = `${currentUser.alias || currentUser.name} (You, ${userCity})`;
  
  let html = `
    <optgroup label="Your Profile">
      <option value="${currentUser.email}" selected>${userLabel}</option>
    </optgroup>
  `;

  if (topGroupWalkers.length > 0) {
    html += `
      <optgroup label="Battle & Group Members">
        ${topGroupWalkers.map(w => `
          <option value="${w.email || w.name}">${w.name} (${w.todaySteps.toLocaleString()} steps)</option>
        `).join('')}
      </optgroup>
    `;
  } else {
    html += `
      <optgroup label="Battle & Group Members">
        <option disabled>No other members in your battles</option>
      </optgroup>
    `;
  }

  selector.innerHTML = html;
}

// Login via Backend API
async function loginUser(email) {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Password123!' }),
    });

    const data = await res.json();
    if (res.ok) {
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('happyfeet_token', authToken);
      localStorage.setItem('happyfeet_user_email', currentUser.email);
      localStorage.removeItem('happyfeet_logged_out');

      const displayName = currentUser.alias || currentUser.name;
      showToast(`Active User: ${displayName}`);
      window.location.reload();
    } else {
      showToast(data.error || 'Login failed');
    }
  } catch (err) {
    console.error(err);
    showToast('Backend server connection error. Ensure server is running on port 5000.');
  }
}

// Refresh all views
async function refreshAllData() {
  await fetchTodayActivity();
  await fetchRankings();
  await fetchGroups();
  await fetchMarketplace();
  await fetchWalletHistory();
  initDailyChallenge();
}

// Fetch Today's Steps
async function fetchTodayActivity() {
  try {
    const res = await fetch(`${API_BASE}/steps/today`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    if (res.ok) {
      const steps = data.summary.totalSteps;
      const goal = data.dailyGoal;
      const percent = data.completionPercentage;

      document.getElementById('step-count-display').innerText = steps.toLocaleString();
      document.getElementById('step-goal-target').innerText = goal.toLocaleString();
      document.getElementById('goal-percent').innerText = `${percent}%`;
      document.getElementById('calories-display').innerText = `${data.summary.totalCalories} kcal`;
      document.getElementById('distance-display').innerText = `${(data.summary.totalDistanceMeters / 1000).toFixed(1)} km`;
      document.getElementById('streak-display').innerText = `${data.streakDays}`;
      document.getElementById('user-coins').innerText = currentUser.walkCoins.toLocaleString();
      document.getElementById('marketplace-coins').innerText = currentUser.walkCoins.toLocaleString();
      document.getElementById('dashboard-coins-display').innerText = currentUser.walkCoins.toLocaleString();

      // Circular Ring offset animation (Iron Man Arc Reactor Style)
      const ringFill = document.getElementById('step-ring-fill');
      if (ringFill) {
        const circumference = 502.6; // 2 * pi * 80
        
        // Calculate the percentage of the current 100% loop
        let currentCirclePercent = percent;
        if (percent > 0) {
          currentCirclePercent = percent % 100;
          if (currentCirclePercent === 0 && percent >= 100) {
            currentCirclePercent = 100;
          }
        }
        
        const offset = circumference - (currentCirclePercent / 100) * circumference;
        ringFill.style.strokeDashoffset = offset;

        // Apply Iron Man style color shifts and glowing drop-shadows
        if (percent >= 200) {
          // Supercharged Reactor Purple
          ringFill.setAttribute('stroke', 'url(#neon-purple-grad)');
          ringFill.style.filter = 'drop-shadow(0 0 16px rgba(217, 70, 239, 0.9)) drop-shadow(0 0 4px rgba(217, 70, 239, 0.5))';
        } else if (percent >= 100) {
          // Core Active Bright Neon Blue
          ringFill.setAttribute('stroke', 'url(#neon-blue-grad)');
          ringFill.style.filter = 'drop-shadow(0 0 16px rgba(6, 182, 212, 0.9)) drop-shadow(0 0 4px rgba(6, 182, 212, 0.5))';
        } else {
          // Charging/Warm-up Golden Red
          ringFill.setAttribute('stroke', 'url(#gold-grad)');
          const glow = Math.max(3, (percent / 100) * 12);
          ringFill.style.filter = `drop-shadow(0 0 ${glow}px rgba(245, 158, 11, 0.8)) drop-shadow(0 0 3px rgba(239, 68, 68, 0.4))`;
        }
      }

      // Update Daily Challenge progress if active
      updateChallengeProgress(steps);
    }
  } catch (err) {
    console.error(err);
  }
}

// Fetch Rankings Universe
async function fetchRankings() {
  try {
    const res = await fetch(`${API_BASE}/rankings`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    if (res.ok) {
      // AI Insight Update
      document.getElementById('ai-message-text').innerText = `"${data.aiInsight.message}"`;
      document.getElementById('ai-nudge-text').innerText = `"${data.aiInsight.nudge}"`;

      // Update Premium City stats on dashboard
      const cityRank = data.rankings.city.rank;
      const cityTotal = data.rankings.city.total;
      const cityName = data.rankings.city.name;
      
      document.getElementById('relative-rank-display').innerText = `#${cityRank}`;
      document.getElementById('city-rank-headline').innerText = `${cityName} Rank #${cityRank}`;
      document.getElementById('city-trend-display').innerText = `Up ${15 - (cityRank % 4)} positions today`;
      document.getElementById('city-tier-display').innerText = `Top ${data.fitnessPercentile}`;
      document.getElementById('city-total-walkers').innerText = `${cityTotal.toLocaleString()} users`;

      const formatRank = (rank, total) => {
        let prefix = '';
        if (rank === 1) prefix = '🥇 ';
        else if (rank === 2) prefix = '🥈 ';
        else if (rank === 3) prefix = '🥉 ';
        return `<strong style="color: ${rank <= 3 ? '#F59E0B' : '#10B981'};">${prefix}Rank #${rank} of ${total}</strong>`;
      };

      // Quick Rank Summary
      const quickContainer = document.getElementById('quick-rank-summary');
      quickContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom: 8px;">
          <span>Category (${data.rankings.sameAgeAndGender.category}):</span>
          ${formatRank(data.rankings.sameAgeAndGender.rank, data.rankings.sameAgeAndGender.total)}
        </div>
        <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom: 8px;">
          <span>Locality (${data.rankings.locality.name}):</span>
          ${formatRank(data.rankings.locality.rank, data.rankings.locality.total)}
        </div>
        <div style="display:flex; justify-content:space-between; font-size:14px;">
          <span>City (${data.rankings.city.name}):</span>
          ${formatRank(data.rankings.city.rank, data.rankings.city.total)}
        </div>
      `;

      const getMedalHTML = (rank) => {
        if (rank === 1) return '<span style="font-size: 20px; margin-right: 4px;">🥇</span>';
        if (rank === 2) return '<span style="font-size: 20px; margin-right: 4px;">🥈</span>';
        if (rank === 3) return '<span style="font-size: 20px; margin-right: 4px;">🥉</span>';
        return '';
      };

      const getTileClass = (rank) => {
        if (rank === 1) return 'gold-rank';
        if (rank === 2) return 'silver-rank';
        if (rank === 3) return 'bronze-rank';
        return '';
      };

      // Full Rankings Universe Grid
      const container = document.getElementById('rankings-container');
      container.innerHTML = `
        <div class="rank-tile ${getTileClass(data.rankings.sameAgeAndGender.rank)}">
          <div class="rank-tile-title">Same Age + Same Gender (${data.rankings.sameAgeAndGender.category})</div>
          <div class="rank-number" style="display: flex; align-items: center; justify-content: center; gap: 4px;">
            ${getMedalHTML(data.rankings.sameAgeAndGender.rank)}Rank #${data.rankings.sameAgeAndGender.rank}
          </div>
          <div class="rank-badge">Out of ${data.rankings.sameAgeAndGender.total} walkers</div>
        </div>
        <div class="rank-tile ${getTileClass(data.rankings.locality.rank)}">
          <div class="rank-tile-title">Locality (${data.rankings.locality.name})</div>
          <div class="rank-number" style="display: flex; align-items: center; justify-content: center; gap: 4px;">
            ${getMedalHTML(data.rankings.locality.rank)}Rank #${data.rankings.locality.rank}
          </div>
          <div class="rank-badge">Out of ${data.rankings.locality.total} walkers</div>
        </div>
        <div class="rank-tile ${getTileClass(data.rankings.city.rank)}">
          <div class="rank-tile-title">City (${data.rankings.city.name})</div>
          <div class="rank-number" style="display: flex; align-items: center; justify-content: center; gap: 4px;">
            ${getMedalHTML(data.rankings.city.rank)}Rank #${data.rankings.city.rank}
          </div>
          <div class="rank-badge">Out of ${data.rankings.city.total} walkers</div>
        </div>
        <div class="rank-tile ${getTileClass(data.rankings.global.rank)}">
          <div class="rank-tile-title">Global Standings</div>
          <div class="rank-number" style="display: flex; align-items: center; justify-content: center; gap: 4px;">
            ${getMedalHTML(data.rankings.global.rank)}Rank #${data.rankings.global.rank}
          </div>
          <div class="rank-badge">Out of ${data.rankings.global.total} worldwide</div>
        </div>
        <div class="rank-tile">
          <div class="rank-tile-title">Overall Fitness Cohort</div>
          <div class="rank-number" style="color: #F59E0B;">${data.fitnessPercentile}</div>
          <div class="rank-badge" style="background:rgba(245,158,11,0.2); color:#F59E0B;">Top Performing Tier</div>
        </div>
      `;

      // Render Achievements & Milestones (Cult.fit Inspired)
      if (currentUser) {
        const todaySteps = data.userStepsToday || 0;
        const streak = currentUser.currentStreak || 1;
        const lifetime = currentUser.lifetimeSteps || 0;

        const milestones = [
          { name: 'Early Bird', desc: 'Walk 10,000 steps today', emoji: '🌅', unlocked: todaySteps >= 10000, prog: `${todaySteps.toLocaleString()} / 10,000`, anim: 'zoom-head' },
          { name: 'Streak Starter', desc: 'Reach a 7-day streak', emoji: '🔥', unlocked: streak >= 7, prog: `${streak} / 7 days`, anim: 'hop-anim' },
          { name: 'Consistency Master', desc: 'Reach a 30-day streak', emoji: '👑', unlocked: streak >= 30, prog: `${streak} / 30 days`, anim: 'glance-anim' },
          { name: 'Centurion', desc: 'Reach 100k lifetime steps', emoji: '💯', unlocked: lifetime >= 100000, prog: `${lifetime.toLocaleString()} / 100,000`, anim: 'float-anim' },
          { name: 'Millionaire Walk', desc: 'Reach 1M lifetime steps', emoji: '🌌', unlocked: lifetime >= 1000000, prog: `${lifetime.toLocaleString()} / 1,000,000`, anim: 'run-anim' }
        ];

        const unlockedCount = milestones.filter(m => m.unlocked).length;
        const badgesCountEl = document.getElementById('dashboard-badges-count');
        if (badgesCountEl) {
          badgesCountEl.innerText = `${unlockedCount} / 5 Badges`;
        }

        const badgesContainer = document.getElementById('badges-container');
        if (badgesContainer) {
          badgesContainer.innerHTML = milestones.map(m => {
            const stateClass = m.unlocked ? 'badge-unlocked' : 'badge-locked';
            return `
              <div class="badge-card ${stateClass}" style="position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 16px; border-radius: 12px; transition: all 0.3s ease;">
                <div class="avatar-circle-render ${m.unlocked ? m.anim : ''}" style="font-size: 40px; margin-bottom: 8px; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.03); border-radius: 50%;">
                  ${m.emoji}
                </div>
                <h4 style="font-size: 13px; font-weight: 700; color: white; margin-bottom: 4px;">${m.name}</h4>
                <p style="font-size: 11px; color: var(--text-muted); line-height: 1.3; height: 32px; margin-bottom: 8px; margin-top: 0;">${m.desc}</p>
                <div style="font-size: 11px; font-weight: 700; color: ${m.unlocked ? 'var(--accent-cyan)' : 'var(--text-muted)'}; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 20px; width: fit-content; margin: 0 auto;">
                  ${m.prog}
                </div>
                ${m.unlocked ? `<span style="position: absolute; top: 6px; right: 6px; font-size: 8px; padding: 1px 4px; background: rgba(16,185,129,0.2); color: #34D399; border-radius: 4px; font-weight: 700;">UNLOCKED</span>` : ''}
              </div>
            `;
          }).join('');
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
}

// Sync Steps Action
function handleSyncSteps() {
  if (!currentUser) {
    showToast('⚠️ Please log in to synchronize steps.');
    document.getElementById('quick-login-modal').classList.add('active');
    return;
  }
  
  const savedProvider = localStorage.getItem('happyfeet_sync_provider');
  
  // Reset modal state
  document.querySelectorAll('.provider-card').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.sim-step-btn').forEach(b => b.classList.remove('active'));
  
  if (savedProvider) {
    document.getElementById('sync-provider-select').style.display = 'none';
    document.getElementById('sync-conn-status').style.display = 'block';
    document.getElementById('conn-loading').style.display = 'none';
    document.getElementById('conn-success').style.display = 'block';
    
    const activeCard = document.querySelector(`.provider-card[data-provider="${savedProvider}"]`);
    if (activeCard) activeCard.classList.add('active');
    
    document.getElementById('sync-sim-controls').style.display = 'flex';
    document.getElementById('sync-action-submit-btn').removeAttribute('disabled');
  } else {
    document.getElementById('sync-provider-select').style.display = 'block';
    document.getElementById('sync-conn-status').style.display = 'none';
    document.getElementById('sync-sim-controls').style.display = 'none';
    document.getElementById('sync-action-submit-btn').setAttribute('disabled', 'true');
  }
  
  // Show Modal
  document.getElementById('health-sync-modal').classList.add('active');
}

// Fetch Groups
async function fetchGroups() {
  try {
    const res = await fetch(`${API_BASE}/groups`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    if (res.ok) {
      const container = document.getElementById('groups-container');
      container.innerHTML = data.groups.map((g) => {
        let statusBadge = '';
        if (g.battleDuration && g.battleDuration !== 'Infinite') {
          if (g.status === 'Concluded') {
            statusBadge = `<span class="battle-status-badge concluded" style="margin-left: 10px;"><i class="fa-solid fa-circle-stop"></i> Concluded</span>`;
          } else {
            statusBadge = `<span class="battle-status-badge active" style="margin-left: 10px;"><i class="fa-solid fa-circle-play"></i> Active (${g.daysRemaining} days left)</span>`;
          }
        } else {
          statusBadge = `<span class="battle-status-badge active" style="margin-left: 10px; background: rgba(6,182,212,0.15); border: 1px solid rgba(6,182,212,0.3); color: var(--accent-cyan);"><i class="fa-solid fa-rotate"></i> Ongoing</span>`;
        }

        let dateInfo = '';
        if (g.battleDuration && g.battleDuration !== 'Infinite') {
          dateInfo = `<div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">Timeline: ${g.startDate} to ${g.endDate}</div>`;
        }

        const isOwner = currentUser && g.ownerId === currentUser.id;
        const actionBtnText = isOwner ? '<i class="fa-solid fa-trash-can"></i> Delete' : '<i class="fa-solid fa-right-from-bracket"></i> Leave';
        const actionBtnClass = isOwner ? 'sync-action-btn' : 'leave-battle-btn';
        const actionBtnStyle = isOwner 
          ? 'margin-top: 0; padding: 6px 12px; font-size: 12px; background: rgba(239,68,68,0.15); color: #F87171; border: 1px solid rgba(239,68,68,0.3); border-radius: 6px; cursor: pointer;' 
          : 'margin-top: 0;';

        const leaveBtnHTML = `
          <button class="${actionBtnClass}" onclick="leaveOrDeleteGroup('${g.id}', ${isOwner})" style="${actionBtnStyle}">
            ${actionBtnText}
          </button>
        `;

        return `
        <div class="glass-card group-item" id="group-card-${g.id}" style="display: flex; flex-direction: column; gap: 16px; padding: 20px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
            <div>
              <div style="display: flex; align-items: center; flex-wrap: wrap;">
                <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">${g.name}</h3>
                ${statusBadge}
              </div>
              <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 8px;">${g.description}</p>
              <div style="font-size: 13px; color: var(--accent-cyan); font-weight: 600;">
                Collective Target: ${g.currentSteps.toLocaleString()} / ${g.targetSteps.toLocaleString()} steps
              </div>
              <div class="progress-bar-bg" style="margin-top: 6px; width: 250px;">
                <div class="progress-bar-fill" style="width: ${Math.min(100, Math.round((g.currentSteps / g.targetSteps) * 100))}%;"></div>
              </div>
              ${dateInfo}
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between;">
              <div>
                <span class="rank-badge" style="margin-bottom: 8px; display: inline-block;">Invite Code: ${g.inviteCode}</span>
                <div style="font-size: 13px; color: var(--text-muted);">${g.members.length} Members Active</div>
              </div>
              <div style="display: flex; gap: 8px; margin-top: 8px; align-items: center;">
                <button class="sync-action-btn" onclick="toggleGroupLeaderboard('${g.id}')" style="margin-top: 0; padding: 6px 12px; font-size: 12px; background: rgba(6,182,212,0.15); color: var(--accent-cyan); border: 1px solid rgba(6,182,212,0.3); border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                  <i class="fa-solid fa-ranking-star"></i> View Battle
                </button>
                <button class="sync-action-btn share-grp-btn" onclick="openShareModal('${g.name}', '${g.inviteCode}')" style="margin-top: 0; padding: 6px 12px; font-size: 12px; background: rgba(59,130,246,0.2); color: #60A5FA; border: 1px solid rgba(59,130,246,0.3); border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                  <i class="fa-solid fa-share-nodes"></i> Share
                </button>
                ${leaveBtnHTML}
              </div>
            </div>
          </div>
        `;
      }).join('');
          
          <!-- Collapsible Leaderboard section -->
          <div id="group-leaderboard-${g.id}" class="group-leaderboard-container" style="display: none; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; margin-top: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <h4 style="font-size: 14px; font-weight: 700; color: white;"><i class="fa-solid fa-fire" style="color: #EF4444;"></i> Live Battle Leaderboard</h4>
              <span style="font-size: 12px; color: var(--text-muted);" id="group-total-steps-${g.id}">Total group steps today: 0</span>
            </div>
            <div class="leaderboard-list" id="group-leaderboard-list-${g.id}" style="display: flex; flex-direction: column; gap: 10px;">
              <!-- Loaded dynamically via API -->
            </div>
          </div>
        </div>
      `).join('');
      
      // Compile and list top 5 group walkers in switcher
      compileTopWalkers(data.groups);
    }
  } catch (err) {
    console.error(err);
  }
}

// Collapsible Group Leaderboard Handler
window.toggleGroupLeaderboard = async function(groupId) {
  const container = document.getElementById(`group-leaderboard-${groupId}`);
  if (!container) return;

  if (container.style.display === 'block') {
    container.style.display = 'none';
    return;
  }

  // Fetch the leaderboard data from backend
  try {
    const res = await fetch(`${API_BASE}/groups/${groupId}/leaderboard`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    if (res.ok) {
      const isConcluded = data.status === 'Concluded';
      const stepsContextLabel = data.battleDuration !== 'Infinite' ? 'battle steps' : 'steps today';
      
      document.getElementById(`group-total-steps-${groupId}`).innerText = data.battleDuration !== 'Infinite'
        ? `Total battle steps: ${data.battleTotalSteps.toLocaleString()}`
        : `Total group steps today: ${data.groupTotalSteps.toLocaleString()}`;
      
      const listContainer = document.getElementById(`group-leaderboard-list-${groupId}`);
      const totalMembers = data.leaderboard.length;
      
      // Determine max steps for visual comparison bar relative scaling
      const leaderSteps = data.leaderboard[0]?.battleSteps || 1;
      const maxSteps = leaderSteps > 0 ? leaderSteps : 1;

      let podiumHeaderHTML = '';
      if (data.battleDuration !== 'Infinite') {
        if (isConcluded) {
          const winner = data.leaderboard[0];
          const winnerName = winner ? winner.name : 'No one';
          const winnerSteps = winner ? winner.battleSteps.toLocaleString() : '0';
          podiumHeaderHTML = `
            <div class="battle-podium-header">
              <h4 style="color: #F59E0B; font-size: 15px; font-weight: 800; margin-bottom: 4px;">
                🏆 BATTLE CHAMPION CONCLUDED
              </h4>
              <p style="color: white; font-size: 13px; font-weight: 700; margin: 0;">
                Congratulations to <span style="color: var(--accent-cyan); font-weight: 800;">${winnerName}</span> for winning the battle with <span style="color: #10B981; font-weight: 800;">${winnerSteps}</span> cumulative steps!
              </p>
            </div>
          `;
        } else {
          podiumHeaderHTML = `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); padding: 12px; border-radius: 10px; text-align: center; margin-bottom: 16px;">
              <p style="color: var(--text-muted); font-size: 12px; margin: 0; line-height: 1.4;">
                🕒 Battle Timeline: <span style="color: white; font-weight: 700;">${data.startDate}</span> to <span style="color: white; font-weight: 700;">${data.endDate}</span>. <span style="color: var(--accent-cyan); font-weight: 700;">${data.daysRemaining} days remaining</span>.
              </p>
            </div>
          `;
        }
      }

      const listHTML = data.leaderboard.map((m, index) => {
        const rank = index + 1;
        let medal = '';
        let glowBorder = '';
        if (rank === 1) {
          medal = '🥇 ';
          if (isConcluded) glowBorder = 'box-shadow: 0 0 10px rgba(245, 158, 11, 0.4); border: 1px solid rgba(245, 158, 11, 0.5);';
        } else if (rank === 2) {
          medal = '🥈 ';
          if (isConcluded) glowBorder = 'box-shadow: 0 0 10px rgba(148, 163, 184, 0.25); border: 1px solid rgba(148, 163, 184, 0.35);';
        } else if (rank === 3) {
          medal = '🥉 ';
          if (isConcluded) glowBorder = 'box-shadow: 0 0 10px rgba(180, 83, 9, 0.25); border: 1px solid rgba(180, 83, 9, 0.35);';
        } else {
          medal = `#${rank} `;
        }

        const isCurrentUser = currentUser && (currentUser.name === m.name || currentUser.alias === m.name);
        const highlightStyle = isCurrentUser 
          ? 'background: rgba(6,182,212,0.1); border: 1px solid rgba(6,182,212,0.25);' 
          : 'background: rgba(255,255,255,0.02);';

        const avatarHTML = getAvatarHTML(m.profilePic, '28px', '18px', m.gender);
        const widthPercent = Math.min(100, Math.round((m.battleSteps / maxSteps) * 100));

        return `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 8px; ${highlightStyle} ${glowBorder}">
            <div style="display: flex; align-items: center; gap: 12px; flex-grow: 1;">
              <span style="font-weight: 800; font-size: 14px; color: ${rank <= 3 ? '#F59E0B' : 'var(--text-muted)'}; min-width: 28px;">${medal}</span>
              <div class="avatar-circle" style="width: 28px; height: 28px; border-color: ${isCurrentUser ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.1)'};">
                ${avatarHTML}
              </div>
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <div style="display: flex; align-items: center;">
                  <span style="font-size: 13px; font-weight: 700; color: white;">${m.name}</span>
                  ${m.role !== 'Member' ? `<span style="font-size: 9px; padding: 1px 4px; background: rgba(255,255,255,0.1); border-radius: 4px; margin-left: 6px; color: var(--text-muted); font-weight: 600;">${m.role}</span>` : ''}
                </div>
                
                <!-- Visualized progress comparison bar -->
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                  <div class="comparison-bar-bg" style="width: 140px; margin-top: 0;">
                    <div class="comparison-bar-fill ${isCurrentUser ? 'current-user' : ''}" style="width: ${widthPercent}%;"></div>
                  </div>
                  <span style="font-size: 10px; color: var(--text-muted); font-weight: 700;">${widthPercent}%</span>
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 16px; flex-shrink: 0; text-align: right;">
              <span style="font-size: 12px; color: #F59E0B;"><i class="fa-solid fa-fire"></i> ${m.streak}d</span>
              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                <span style="font-size: 13px; font-weight: 800; color: white;">
                  ${m.battleSteps.toLocaleString()} <span style="font-size: 10px; font-weight: 500; color: var(--accent-cyan);">${stepsContextLabel}</span>
                </span>
                ${data.battleDuration !== 'Infinite' ? `<span style="font-size: 10px; color: var(--text-muted);">Today: ${m.todaySteps.toLocaleString()}</span>` : ''}
              </div>
              <span style="font-size: 11px; color: var(--text-muted); font-weight: 600; display: none;">(Rank ${rank} of ${totalMembers})</span>
            </div>
          </div>
        `;
      }).join('');

      listContainer.innerHTML = podiumHeaderHTML + listHTML;
      container.style.display = 'block';
    } else {
      showToast(data.error || 'Failed to load leaderboard');
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to connect to server');
  }
};

// Global Group Leaving / Deletion Click Trigger handler
window.leaveOrDeleteGroup = async function(groupId, isOwner) {
  const actionText = isOwner ? 'DELETE this battle challenge (all collective progress will be deleted)?' : 'LEAVE this battle/group?';
  if (!confirm(`Are you sure you want to ${actionText}`)) return;

  try {
    const res = await fetch(`${API_BASE}/groups/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ groupId })
    });

    const data = await res.json();
    if (res.ok) {
      showToast(isOwner ? '🔥 Battle deleted successfully!' : '🚪 Left group successfully!');
      window.location.reload();
    } else {
      showToast(`❌ Error: ${data.error || 'Operation failed'}`);
    }
  } catch (err) {
    console.error(err);
    showToast('❌ Connection error leaving group.');
  }
};

// Update Auth UI Buttons
function updateAuthUI() {
  const authBtn = document.getElementById('open-quick-login-modal-btn');
  if (authBtn) {
    if (currentUser) {
      authBtn.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Sign Out';
      authBtn.onclick = handleSignOut;
    } else {
      authBtn.innerHTML = '<i class="fa-solid fa-user"></i> Login / Signup';
      authBtn.onclick = () => {
        document.getElementById('quick-login-modal').classList.add('active');
      };
    }
  }

  // Render header avatar
  const headerAvatar = document.getElementById('header-user-avatar');
  if (headerAvatar) {
    if (currentUser) {
      headerAvatar.style.display = 'flex';
      const container = document.getElementById('header-avatar-render');
      container.innerHTML = getAvatarHTML(currentUser.profilePic, '32px', '22px', currentUser.gender);
    } else {
      headerAvatar.style.display = 'none';
    }
  }

  // Render "Member since" date
  const memberSince = document.getElementById('member-since-display');
  if (memberSince) {
    if (currentUser) {
      memberSince.style.display = 'block';
      const createdDate = currentUser.createdAt ? new Date(currentUser.createdAt) : new Date();
      const formatted = createdDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      memberSince.innerText = `Member since: ${formatted}`;
    } else {
      memberSince.style.display = 'none';
    }
  }

  // Rebuild selector options and match currentUser if logged in
  updateSwitcherOptions();
  const selector = document.getElementById('user-selector');
  if (selector && currentUser) {
    selector.value = currentUser.email;
  }
}

function handleSignOut() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('happyfeet_token');
  localStorage.removeItem('happyfeet_user_email');
  localStorage.setItem('happyfeet_logged_out', 'true');
  window.location.reload();
  
  // Clear dashboard or show a state that requires login
  document.getElementById('user-coins').innerText = '0';
  document.getElementById('marketplace-coins').innerText = '0';
  document.getElementById('rankings-container').innerHTML = '<p style="color: white">Please login to see rankings.</p>';
  document.getElementById('groups-container').innerHTML = '<p style="color: white">Please login to see groups.</p>';
  
  const historyContainer = document.getElementById('wallet-history-container');
  if (historyContainer) {
    historyContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">Please login to see wallet activity.</p>';
  }
  
  showToast('You have been signed out.');
}

// Fetch Marketplace Rewards
async function fetchMarketplace() {
  try {
    const res = await fetch(`${API_BASE}/rewards/marketplace`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    if (res.ok) {
      const container = document.getElementById('rewards-container');
      container.innerHTML = data.rewards.map((r) => `
        <div class="glass-card reward-card">
          <div>
            <div class="reward-brand">${r.brand}</div>
            <div class="reward-title">${r.title}</div>
            <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 12px;">${r.description}</p>
          </div>
          <div>
            <div class="reward-cost"><i class="fa-solid fa-coins"></i> ${r.costWalkCoins} WalkCoins</div>
            <button class="redeem-btn" onclick="redeemReward('${r.id}')">Redeem Voucher</button>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

// Redeem Reward Action
async function redeemReward(rewardId) {
  try {
    const res = await fetch(`${API_BASE}/rewards/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ rewardId }),
    });

    const data = await res.json();
    if (res.ok) {
      alert(`🎉 Voucher Redeemed!\n\nCoupon Code: ${data.reward.couponCode}\nBrand: ${data.reward.brand}`);
      currentUser.walkCoins = data.remainingWalkCoins;
      refreshAllData();
    } else {
      alert(`❌ ${data.error}`);
    }
  } catch (err) {
    console.error(err);
  }
}

// Toast notification helper
function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  toast.innerText = message;
  toast.style.display = 'block';
  
  if (toast.timeoutId) {
    clearTimeout(toast.timeoutId);
  }
  
  toast.timeoutId = setTimeout(() => {
    toast.style.display = 'none';
  }, duration);
}

// Avatar rendering helper
function getAvatarHTML(profilePic, size = '32px', fontSize = '22px', gender = 'Male') {
  const avatarMap = {
    'Bull': { emoji: '🐂', class: 'zoom-head' },
    'Eagle': { emoji: '🦅', class: 'float-anim' },
    'Falcon': { emoji: '🦉', class: 'glance-anim' },
    'Cheetah': { emoji: '🐆', class: 'run-anim' },
    'Rabbit': { emoji: '🐇', class: 'hop-anim' }
  };
  
  if (profilePic && avatarMap[profilePic]) {
    const data = avatarMap[profilePic];
    return `<div class="avatar-option-emoji ${data.class} close-up-view" style="font-size: calc(${size} * 2.5); line-height: ${size}; transform: translateY(calc(${size} * 0.15)) scale(1.6);">${data.emoji}</div>`;
  }
  
  if (profilePic && (profilePic.startsWith('http') || profilePic.startsWith('data:image'))) {
    return `<img src="${profilePic}" style="width: 100%; height: 100%; object-fit: cover;">`;
  }
  
  // Cutout placeholders based on gender
  const isFemale = gender && gender.toLowerCase() === 'female';
  if (isFemale) {
    return `<div class="avatar-circle-render" style="font-size: ${fontSize}; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: rgba(236, 72, 153, 0.15); color: #F472B6; font-weight: 700; border-radius: 50%;">👩</div>`;
  }
  return `<div class="avatar-circle-render" style="font-size: ${fontSize}; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: rgba(6, 182, 212, 0.15); color: var(--accent-cyan); font-weight: 700; border-radius: 50%;">👨</div>`;
}

// Process uploaded or camera photo: center-crops to a 1:1 passport aspect ratio and resizes to 200x200
function processUploadedImage(file, previewRender, avatarDataInput) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      // Create canvas for 1:1 crop and resize (passport / portrait mode square)
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');

      // Calculate cropping coordinates (center crop to square)
      const minSize = Math.min(img.width, img.height);
      const sourceX = (img.width - minSize) / 2;
      const sourceY = (img.height - minSize) / 2;

      // Draw the center-cropped region scaled to 200x200
      ctx.drawImage(
        img, 
        sourceX, sourceY, minSize, minSize, // source crop rect
        0, 0, 200, 200                     // dest rect
      );

      // Export as compressed JPEG base64 Data URL
      const processedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      previewRender.innerHTML = `<img src="${processedDataUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
      previewRender.className = "avatar-circle-render";
      avatarDataInput.value = processedDataUrl;
      document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('active'));
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

// Initialize avatar handlers
function initAvatarSetup() {
  const fileInput = document.getElementById('reg-avatar-file');
  const cameraInput = document.getElementById('reg-avatar-camera');
  const uploadTrigger = document.getElementById('upload-avatar-trigger');
  const cameraTrigger = document.getElementById('camera-avatar-trigger');
  const previewRender = document.getElementById('avatar-preview-render');
  const avatarDataInput = document.getElementById('reg-avatar-data');

  if (uploadTrigger && fileInput) {
    uploadTrigger.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      processUploadedImage(e.target.files[0], previewRender, avatarDataInput);
    };
  }

  if (cameraTrigger && cameraInput) {
    cameraTrigger.onclick = () => cameraInput.click();
    cameraInput.onchange = (e) => {
      processUploadedImage(e.target.files[0], previewRender, avatarDataInput);
    };
  }

  // Update gender placeholder dynamically
  const genderSelect = document.getElementById('reg-gender');
  if (genderSelect) {
    genderSelect.addEventListener('change', (e) => {
      if (!avatarDataInput.value || (!avatarDataInput.value.startsWith('data:image') && !avatarDataInput.value.startsWith('http'))) {
        if (previewRender) {
          previewRender.innerHTML = getAvatarHTML('', '90px', '55px', e.target.value);
        }
      }
    });
  }
}

// Check pending invite and auto join
function checkPendingInvite() {
  const pendingInvite = localStorage.getItem('pending_invite_code');
  if (pendingInvite && currentUser) {
    localStorage.removeItem('pending_invite_code');
    // Switch to groups tab
    const groupsTab = document.querySelector('[data-tab="groups-view"]');
    if (groupsTab) {
      groupsTab.click();
    }
    
    setTimeout(() => {
      const joinModal = document.getElementById('join-group-modal');
      if (joinModal) {
        document.getElementById('join-grp-code').value = pendingInvite;
        joinModal.classList.add('active');
      }
    }, 500);
  }
}

// Open Share Group Modal
window.openShareModal = function(groupName, inviteCode) {
  const shareModal = document.getElementById('share-group-modal');
  if (!shareModal) return;

  const inviteLink = `${window.location.origin}/?invite=${inviteCode}`;
  
  document.getElementById('share-invite-code').value = inviteCode;
  document.getElementById('share-link-input').value = inviteLink;

  // Setup WhatsApp link
  const waText = encodeURIComponent(`Join my BadaKadam walking group "${groupName}"! Use invite code: ${inviteCode}.\n\nClick here to join directly: ${inviteLink}`);
  document.getElementById('share-whatsapp-btn').href = `https://api.whatsapp.com/send?text=${waText}`;

  // Setup Email link
  const emailSubject = encodeURIComponent(`Join my BadaKadam Walking Group!`);
  const emailBody = encodeURIComponent(`Hey,\n\nJoin my BadaKadam walking group "${groupName}"!\n\nInvite Code: ${inviteCode}\nClick here to join directly: ${inviteLink}\n\nDownload BadaKadam and let's start walking together!`);
  document.getElementById('share-email-btn').href = `mailto:?subject=${emailSubject}&body=${emailBody}`;

  shareModal.classList.add('active');
};

// Fetch Wallet Transaction History
async function fetchWalletHistory() {
  if (!authToken) return;

  try {
    const res = await fetch(`${API_BASE}/rewards/wallet/history`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    if (res.ok) {
      const container = document.getElementById('wallet-history-container');
      if (container) {
        if (!data.history || data.history.length === 0) {
          container.innerHTML = '<p style="color: var(--text-muted); font-size: 13px; text-align: center; margin-top: 10px;">No transaction history yet.</p>';
          return;
        }

        container.innerHTML = data.history.map(tx => {
          const dateStr = new Date(tx.createdAt).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          });

          const isPositive = tx.amount > 0;
          const colorClass = isPositive ? '#10B981' : '#EF4444';
          const amountSign = isPositive ? `+${tx.amount}` : `${tx.amount}`;

          return `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 12px 14px; border-radius: 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <span style="font-size: 12px; font-weight: 700; color: white;">${tx.description}</span>
                <span style="font-size: 10px; color: var(--text-muted);"><i class="fa-regular fa-clock"></i> ${dateStr}</span>
              </div>
              <div style="font-size: 13px; font-weight: 800; color: ${colorClass}; white-space: nowrap;">
                ${amountSign}
              </div>
            </div>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.error('Error fetching wallet ledger history:', err);
  }
}

// Compile Top 5 Walkers from Groups and Battles
async function compileTopWalkers(groups) {
  if (!groups || groups.length === 0) return;

  try {
    // Fetch leaderboards in parallel
    const promises = groups.map(g => 
      fetch(`${API_BASE}/groups/${g.id}/leaderboard`, {
        headers: { Authorization: `Bearer ${authToken}` },
      }).then(res => {
        if (!res.ok) throw new Error('Failed to load group leaderboard');
        return res.json();
      })
    );

    const leaderboards = await Promise.all(promises);

    const allMembers = [];
    leaderboards.forEach(lb => {
      if (lb && lb.leaderboard) {
        allMembers.push(...lb.leaderboard);
      }
    });

    const uniqueWalkers = [];
    const seenEmails = new Set();

    // Prevent active user from appearing in top performers switcher list
    if (currentUser) {
      seenEmails.add(currentUser.email);
    }

    allMembers.forEach(m => {
      const key = m.email || m.name;
      if (key && !seenEmails.has(key)) {
        seenEmails.add(key);
        uniqueWalkers.push(m);
      }
    });

    // Sort descending by steps today
    uniqueWalkers.sort((a, b) => b.todaySteps - a.todaySteps);

    const top5 = uniqueWalkers.slice(0, 5);

    updateSwitcherOptions(top5);
  } catch (err) {
    console.error('Error compiling top group walkers:', err);
  }
}

// Device Viewport switcher & emulator controller
let currentViewportMode = 'web';

function initViewportSwitcher() {
  const switchWebBtn = document.getElementById('switch-web-btn');
  const switchMobileBtn = document.getElementById('switch-mobile-btn');
  
  if (switchWebBtn && switchMobileBtn) {
    switchWebBtn.addEventListener('click', () => setViewportMode('web'));
    switchMobileBtn.addEventListener('click', () => setViewportMode('mobile'));
  }

  // Update clock on mobile status bar
  setInterval(() => {
    const timeEl = document.getElementById('mobile-time');
    if (timeEl) {
      const now = new Date();
      timeEl.innerText = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
  }, 1000);
}

function setViewportMode(mode) {
  if (currentViewportMode === mode) return;
  currentViewportMode = mode;

  const wrapper = document.getElementById('viewport-wrapper');
  const webBtn = document.getElementById('switch-web-btn');
  const mobileBtn = document.getElementById('switch-mobile-btn');
  const header = document.getElementById('app-header');
  const main = document.getElementById('app-main');

  if (mode === 'mobile') {
    wrapper.classList.remove('view-mode-web');
    wrapper.classList.add('view-mode-mobile');
    webBtn.classList.remove('active');
    mobileBtn.classList.add('active');

    // Reparent header, main, modals, and toast to mobile screen content
    document.getElementById('mobile-screen').appendChild(header);
    document.getElementById('mobile-screen').appendChild(main);
    document.getElementById('mobile-screen').appendChild(document.getElementById('app-modals'));
    document.getElementById('mobile-screen').appendChild(document.getElementById('toast'));
  } else {
    wrapper.classList.remove('view-mode-mobile');
    wrapper.classList.add('view-mode-web');
    mobileBtn.classList.remove('active');
    webBtn.classList.add('active');

    // Reparent header, main back to web container, modals and toast back to body
    document.getElementById('web-container').appendChild(header);
    document.getElementById('web-container').appendChild(main);
    document.body.appendChild(document.getElementById('app-modals'));
    document.body.appendChild(document.getElementById('toast'));
  }
}

// Interactive Daily Challenge Logic
let challengeActive = false;
let challengeStartSteps = 0;
const CHALLENGE_TARGET_DIFFERENCE = 2000;

function initDailyChallenge() {
  const startBtn = document.getElementById('start-challenge-btn');
  if (startBtn) {
    startBtn.onclick = handleChallengeClick;
  }

  // Load from user-specific local storage keys
  const prefix = currentUser ? currentUser.id : 'guest';
  const active = localStorage.getItem(`challenge_active_${prefix}`) === 'true';
  const completed = localStorage.getItem(`challenge_completed_${prefix}`) === 'true';
  
  if (completed) {
    setChallengeCompletedState();
  } else if (active) {
    challengeActive = true;
    challengeStartSteps = parseInt(localStorage.getItem(`challenge_start_steps_${prefix}`) || '0', 10);
    setChallengeActiveState();
    
    // Auto-check and update progress using current DOM steps
    const stepsText = document.getElementById('step-count-display').innerText.replace(/,/g, '');
    const currentSteps = parseInt(stepsText || '0', 10);
    updateChallengeProgress(currentSteps);
  } else {
    challengeActive = false;
    challengeStartSteps = 0;
    setChallengeInactiveState();
  }
}

function handleChallengeClick() {
  if (challengeActive) {
    // Act as steps sync trigger
    handleSyncSteps();
    return;
  }

  // Activate challenge for current user
  const stepsText = document.getElementById('step-count-display').innerText.replace(/,/g, '');
  const currentSteps = parseInt(stepsText || '0', 10);
  
  challengeActive = true;
  challengeStartSteps = currentSteps;
  
  const prefix = currentUser ? currentUser.id : 'guest';
  localStorage.setItem(`challenge_active_${prefix}`, 'true');
  localStorage.setItem(`challenge_start_steps_${prefix}`, currentSteps.toString());
  localStorage.setItem(`challenge_completed_${prefix}`, 'false');

  setChallengeActiveState();
  updateChallengeProgress(currentSteps);
  
  // Show toast feedback
  showToast('Daily Challenge Activated! Walk 2,000 steps and tap sync to complete!');
}

function setChallengeInactiveState() {
  const statusBadge = document.getElementById('challenge-status-badge');
  const textEl = document.getElementById('challenge-text');
  const startBtn = document.getElementById('start-challenge-btn');
  const progContainer = document.getElementById('challenge-progress-container');

  if (statusBadge) {
    statusBadge.innerText = 'Inactive';
    statusBadge.className = 'challenge-inactive-badge';
  }
  if (textEl) {
    textEl.innerText = 'Walk 2,000 steps today to earn a WalkCoins bonus!';
  }
  if (startBtn) {
    startBtn.innerText = 'Start Challenge';
    startBtn.disabled = false;
    startBtn.style.background = '';
    startBtn.style.color = '';
    startBtn.style.borderColor = '';
    startBtn.style.boxShadow = '';
  }
  if (progContainer) {
    progContainer.style.display = 'none';
  }
}

function setChallengeActiveState() {
  const statusBadge = document.getElementById('challenge-status-badge');
  const textEl = document.getElementById('challenge-text');
  const startBtn = document.getElementById('start-challenge-btn');
  const progContainer = document.getElementById('challenge-progress-container');

  if (statusBadge) {
    statusBadge.innerText = 'Active';
    statusBadge.className = 'challenge-active-badge';
  }
  if (textEl) {
    textEl.innerText = `Walk 2,000 more steps today (Target: ${(challengeStartSteps + CHALLENGE_TARGET_DIFFERENCE).toLocaleString()} steps)`;
  }
  if (startBtn) {
    startBtn.innerText = 'Sync Steps to Verify';
    startBtn.style.background = 'linear-gradient(135deg, var(--primary-emerald), #059669)';
  }
  if (progContainer) {
    progContainer.style.display = 'block';
  }
}

function setChallengeCompletedState() {
  const statusBadge = document.getElementById('challenge-status-badge');
  const startBtn = document.getElementById('start-challenge-btn');
  const textEl = document.getElementById('challenge-text');
  const progContainer = document.getElementById('challenge-progress-container');

  if (statusBadge) {
    statusBadge.innerText = 'Completed';
    statusBadge.className = 'challenge-success-badge';
  }
  if (textEl) {
    textEl.innerText = 'Congratulations! You completed today\'s step challenge.';
  }
  if (startBtn) {
    startBtn.innerText = 'Completed ✅';
    startBtn.disabled = true;
    startBtn.style.background = 'rgba(255,255,255,0.05)';
    startBtn.style.color = 'var(--text-muted)';
    startBtn.style.borderColor = 'transparent';
    startBtn.style.boxShadow = 'none';
  }
  if (progContainer) {
    progContainer.style.display = 'none';
  }
}

async function updateChallengeProgress(currentSteps) {
  if (!challengeActive) return;

  const diff = currentSteps - challengeStartSteps;
  const target = CHALLENGE_TARGET_DIFFERENCE;
  const progressText = document.getElementById('challenge-progress-text');
  const progressFill = document.getElementById('challenge-progress-fill');

  if (progressText) {
    progressText.innerText = `${Math.max(0, diff).toLocaleString()} / ${target.toLocaleString()} steps`;
  }
  if (progressFill) {
    const percent = Math.min(100, Math.max(0, (diff / target) * 100));
    progressFill.style.width = `${percent}%`;
  }

  if (diff >= target) {
    // Challenge success!
    challengeActive = false;
    const prefix = currentUser ? currentUser.id : 'guest';
    localStorage.setItem(`challenge_active_${prefix}`, 'false');
    localStorage.setItem(`challenge_completed_${prefix}`, 'true');
    setChallengeCompletedState();
    
    // Reward WalkCoins
    try {
      const res = await fetch(`${API_BASE}/rewards/challenge/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        currentUser.walkCoins = data.newBalance;
        document.getElementById('user-coins').innerText = currentUser.walkCoins.toLocaleString();
        document.getElementById('marketplace-coins').innerText = currentUser.walkCoins.toLocaleString();
        document.getElementById('dashboard-coins-display').innerText = currentUser.walkCoins.toLocaleString();
        
        showToast('🎉 Challenge Completed! +50 WalkCoins added to your wallet!');
        await fetchWalletHistory();
      }
    } catch (err) {
      console.error('Error rewarding challenge coins:', err);
    }
  }
}

// Indian state-city mapping data (fully exhaustive for 28 states and 8 Union Territories)
const IndianLocations = {
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Rajahmundry", "Tirupati", "Kakinada", "Eluru", "Anantapur"],
  "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Pasighat", "Tawang", "Ziro", "Along", "Tezu"],
  "Assam": ["Guwahati", "Dibrugarh", "Silchar", "Jorhat", "Nagaon", "Tinsukia", "Tezpur", "Bongaigaon"],
  "Bihar": ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", "Ara", "Bihar Sharif", "Munger", "Begusarai"],
  "Chhattisgarh": ["Raipur", "Bhilai", "Bilaspur", "Korba", "Rajnandgaon", "Jagdalpur", "Ambikapur", "Dhamtari"],
  "Goa": ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Junagadh", "Gandhinagar", "Anand", "Morbi", "Nadiad"],
  "Haryana": ["Faridabad", "Gurgaon", "Panipat", "Ambala", "Yamunanagar", "Rohtak", "Hisar", "Karnal", "Sonipat", "Panchkula"],
  "Himachal Pradesh": ["Shimla", "Dharamshala", "Solan", "Mandi", "Nahan", "Bilaspur", "Chamba", "Hamirpur"],
  "Jharkhand": ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro Steel City", "Deoghar", "Hazaribagh", "Giridih", "Ramgarh"],
  "Karnataka": ["Bangalore", "Hubli-Dharwad", "Mysore", "Kalaburagi", "Mangalore", "Belgaum", "Davanagere", "Bellary", "Shimoga", "Tumkur", "Udupi"],
  "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Kollam", "Thrissur", "Alappuzha", "Palakkad", "Kannur", "Kottayam"],
  "Madhya Pradesh": ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Dewas", "Satna", "Ratlam", "Rewa"],
  "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Thane", "Pimpri-Chinchwad", "Nashik", "Kalyan-Dombivli", "Vasai-Virar", "Aurangabad", "Navi Mumbai", "Solapur", "Kolhapur", "Amravati"],
  "Manipur": ["Imphal", "Thoubal", "Kakching", "Ukhrul", "Churachandpur"],
  "Meghalaya": ["Shillong", "Tura", "Jowai", "Nongpoh", "Cherrapunji"],
  "Mizoram": ["Aizawl", "Lunglei", "Champhai", "Saiha"],
  "Nagaland": ["Kohima", "Dimapur", "Mokokchung", "Wokha", "Tuensang"],
  "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur", "Puri", "Balasore", "Bhadrak"],
  "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali", "Hoshiarpur", "Pathankot", "Moga"],
  "Rajasthan": ["Jaipur", "Jodhpur", "Kota", "Bikaner", "Ajmer", "Udaipur", "Bhilwara", "Alwar", "Sikar", "Bharatpur"],
  "Sikkim": ["Gangtok", "Namchi", "Geyzing", "Mangan"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tiruppur", "Erode", "Vellore", "Thoothukudi", "Tirunelveli", "Nagercoil"],
  "Telangana": ["Hyderabad", "Secunderabad", "Warangal", "Nizamabad", "Karimnagar", "Ramagundam", "Khammam", "Mahbubnagar"],
  "Tripura": ["Agartala", "Dharmanagar", "Udaipur", "Kailasahar"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Ghaziabad", "Agra", "Meerut", "Varanasi", "Prayagraj", "Bareilly", "Aligarh", "Moradabad", "Noida", "Firozabad", "Gorakhpur", "Jhansi"],
  "Uttarakhand": ["Dehradun", "Haridwar", "Roorkee", "Haldwani", "Rudrapur", "Kashipur", "Rishikesh"],
  "West Bengal": ["Kolkata", "Howrah", "Darjeeling", "Siliguri", "Asansol", "Durgapur", "Bardhaman", "Malda", "Baharampur", "Kharagpur"],
  "Andaman and Nicobar Islands": ["Port Blair"],
  "Chandigarh": ["Chandigarh"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Daman", "Diu", "Silvassa"],
  "Delhi (NCT)": ["New Delhi", "Delhi", "Dwarka", "Rohini", "Noida (NCR)", "Gurgaon (NCR)"],
  "Jammu and Kashmir": ["Srinagar", "Jammu", "Anantnag", "Baramulla", "Kathua", "Sopore"],
  "Ladakh": ["Leh", "Kargil"],
  "Lakshadweep": ["Kavaratti"],
  "Puducherry": ["Puducherry", "Karaikal", "Mahe", "Yanam"]
};

// Initialize State and City dropdown linkages
function initLocationSelectors() {
  const stateSelect = document.getElementById('reg-state');
  const citySelect = document.getElementById('reg-city');
  const manualInput = document.getElementById('reg-city-manual');
  if (!stateSelect || !citySelect) return;

  stateSelect.addEventListener('change', (e) => {
    const selectedState = e.target.value;
    const cities = IndianLocations[selectedState] || [];
    
    citySelect.innerHTML = '<option value="" disabled selected>Select City</option>';
    cities.forEach(city => {
      const opt = document.createElement('option');
      opt.value = city;
      opt.textContent = city;
      citySelect.appendChild(opt);
    });

    // Append manual other option
    const optOther = document.createElement('option');
    optOther.value = 'Other';
    optOther.textContent = 'Others (Enter Manually)';
    citySelect.appendChild(optOther);

    if (manualInput) {
      manualInput.style.display = 'none';
      manualInput.removeAttribute('required');
      manualInput.value = '';
    }
  });

  citySelect.addEventListener('change', (e) => {
    if (manualInput) {
      if (e.target.value === 'Other') {
        manualInput.style.display = 'block';
        manualInput.setAttribute('required', 'true');
        manualInput.focus();
      } else {
        manualInput.style.display = 'none';
        manualInput.removeAttribute('required');
        manualInput.value = '';
      }
    }
  });
}

// Edit Profile Modal handlers
function initEditProfileSetup() {
  const fileInput = document.getElementById('edit-avatar-file');
  const cameraInput = document.getElementById('edit-avatar-camera');
  const uploadTrigger = document.getElementById('edit-upload-avatar-trigger');
  const cameraTrigger = document.getElementById('edit-camera-avatar-trigger');
  const previewRender = document.getElementById('edit-avatar-preview');
  const avatarDataInput = document.getElementById('edit-avatar-data');
  const editProfileForm = document.getElementById('edit-profile-form');

  if (uploadTrigger && fileInput) {
    uploadTrigger.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      processUploadedImage(e.target.files[0], previewRender, avatarDataInput);
    };
  }

  if (cameraTrigger && cameraInput) {
    cameraTrigger.onclick = () => cameraInput.click();
    cameraInput.onchange = (e) => {
      processUploadedImage(e.target.files[0], previewRender, avatarDataInput);
    };
  }

  // Update gender placeholder dynamically in Edit Profile
  const editGenderSelect = document.getElementById('edit-gender');
  if (editGenderSelect) {
    editGenderSelect.addEventListener('change', (e) => {
      if (!avatarDataInput.value || (!avatarDataInput.value.startsWith('data:image') && !avatarDataInput.value.startsWith('http'))) {
        if (previewRender) {
          previewRender.innerHTML = getAvatarHTML('', '90px', '55px', e.target.value);
        }
      }
    });
  }

  if (editProfileForm) {
    editProfileForm.addEventListener('submit', handleEditProfileSubmit);
  }
}

async function handleEditProfileSubmit(e) {
  e.preventDefault();
  
  const alias = document.getElementById('edit-alias').value.trim();
  const gender = document.getElementById('edit-gender').value;
  const profilePic = document.getElementById('edit-avatar-data').value;

  if (!alias) {
    showToast('⚠️ Alias/Nickname cannot be empty.');
    return;
  }

  showToast('💾 Saving profile changes...');
  try {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ alias, gender, profilePic }),
    });

    const data = await res.json();
    if (res.ok) {
      document.getElementById('edit-profile-modal').classList.remove('active');
      showToast('🎉 Profile updated successfully!');
      currentUser = data.user;
      localStorage.setItem('happyfeet_user_email', currentUser.email);
      window.location.reload();
    } else {
      showToast(`❌ Error: ${data.error || 'Failed to update profile'}`);
    }
  } catch (err) {
    console.error(err);
    showToast('❌ Connection error saving profile.');
  }
}

// Health Device Sync Simulation handlers
function initHealthSyncSetup() {
  const modal = document.getElementById('health-sync-modal');
  const closeBtn = document.getElementById('close-health-sync-btn');
  const providerCards = document.querySelectorAll('.provider-card');
  const simStepBtns = document.querySelectorAll('.sim-step-btn');
  const submitBtn = document.getElementById('sync-action-submit-btn');
  const changeProviderBtn = document.getElementById('change-sync-provider-btn');

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  if (changeProviderBtn) {
    changeProviderBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('happyfeet_sync_provider');
      selectedProvider = '';
      
      document.querySelectorAll('.provider-card').forEach(c => c.classList.remove('active'));
      document.querySelectorAll('.sim-step-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('sync-provider-select').style.display = 'block';
      document.getElementById('sync-conn-status').style.display = 'none';
      document.getElementById('sync-sim-controls').style.display = 'none';
      submitBtn.setAttribute('disabled', 'true');
    });
  }

  let selectedProvider = localStorage.getItem('happyfeet_sync_provider') || '';
  let selectedSteps = 0;

  providerCards.forEach(card => {
    card.addEventListener('click', () => {
      providerCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      selectedProvider = card.getAttribute('data-provider');

      // Trigger simulated connection loading
      document.getElementById('sync-conn-status').style.display = 'block';
      document.getElementById('conn-loading').style.display = 'block';
      document.getElementById('conn-loading-text').innerText = `Establishing encrypted synchronization tunnel with ${selectedProvider}...`;
      document.getElementById('conn-success').style.display = 'none';
      document.getElementById('sync-sim-controls').style.display = 'none';

      setTimeout(() => {
        document.getElementById('conn-loading').style.display = 'none';
        document.getElementById('conn-success').style.display = 'block';
        document.getElementById('sync-sim-controls').style.display = 'flex';
        localStorage.setItem('happyfeet_sync_provider', selectedProvider);
      }, 1500);
    });
  });

  simStepBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      simStepBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSteps = Number(btn.getAttribute('data-steps'));
      submitBtn.removeAttribute('disabled');
    });
  });

  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      if (!selectedSteps || !selectedProvider) return;

      submitBtn.setAttribute('disabled', 'true');
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Synchronizing steps...';

      const todayStr = new Date().toISOString().split('T')[0];
      const payload = {
        source: selectedProvider,
        steps: [
          {
            timestamp: new Date().toISOString(),
            date: todayStr,
            count: selectedSteps,
            distanceMeters: Math.round(selectedSteps * 0.7),
            calories: Math.round(selectedSteps * 0.04),
            activeMinutes: Math.round(selectedSteps / 100)
          }
        ]
      };

      try {
        const res = await fetch(`${API_BASE}/steps/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok) {
          modal.classList.remove('active');
          showToast(`✅ Synced ${selectedSteps.toLocaleString()} steps via ${selectedProvider}!`);
          window.location.reload();
        } else {
          showToast(`❌ Sync Failed: ${data.error || 'Check speed restrictions'}`);
          submitBtn.removeAttribute('disabled');
          submitBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Synchronize Health Data';
        }
      } catch (err) {
        console.error(err);
        showToast('❌ Connection error syncing steps.');
        submitBtn.removeAttribute('disabled');
        submitBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Synchronize Health Data';
      }
    });
  }
}

