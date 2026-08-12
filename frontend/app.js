const API_BASE = 'http://localhost:5000/api/v1';

let authToken = '';
let currentUser = null;
let currentStep = 1;

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initUserSelector();
  initModal();
  loginUser('brijesh@BadaKadam.com');

  document.getElementById('sync-steps-btn').addEventListener('click', handleSyncSteps);
  document.getElementById('registration-form').addEventListener('submit', handleRegistrationSubmit);
  
  const quickLoginForm = document.getElementById('quick-login-form');
  if (quickLoginForm) {
    quickLoginForm.addEventListener('submit', handleQuickLogin);
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

  if (openQuickLoginBtn) {
    openQuickLoginBtn.addEventListener('click', () => {
      quickLoginModal.classList.add('active');
    });
  }

  if (closeQuickLoginBtn) {
    closeQuickLoginBtn.addEventListener('click', () => {
      quickLoginModal.classList.remove('active');
    });
  }

  if (closeRegisterBtn) {
    closeRegisterBtn.addEventListener('click', () => {
      registerModal.classList.remove('active');
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

  document.getElementById('next-step-1').addEventListener('click', () => showFormStep(2));
  document.getElementById('next-step-2').addEventListener('click', () => showFormStep(3));
  document.getElementById('prev-step-2').addEventListener('click', () => showFormStep(1));
  document.getElementById('prev-step-3').addEventListener('click', () => showFormStep(2));
}

function showFormStep(step) {
  currentStep = step;
  document.getElementById('onboarding-step-num').innerText = step;

  document.querySelectorAll('.form-step').forEach((el) => el.classList.remove('active'));
  document.getElementById(`form-step-${step}`).classList.add('active');
}

// Quick Login Handler
async function handleQuickLogin(e) {
  e.preventDefault();
  const phone = document.getElementById('ql-phone').value;

  try {
    const res = await fetch(`${API_BASE}/auth/quick-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });

    const data = await res.json();
    if (res.ok) {
      // User found, login successful
      document.getElementById('quick-login-modal').classList.remove('active');
      authToken = data.token;
      currentUser = data.user;
      const displayName = currentUser.alias || currentUser.name;
      showToast(`Welcome back, ${displayName}!`);
      
      // Select the user in dropdown if they exist there, or just refresh
      const selector = document.getElementById('user-selector');
      let found = false;
      Array.from(selector.options).forEach(opt => {
        if (opt.value === currentUser.email) {
          opt.selected = true;
          found = true;
        }
      });
      if (!found) {
        const newOpt = document.createElement('option');
        newOpt.value = currentUser.email;
        newOpt.text = `${displayName} (${currentUser.location.city})`;
        newOpt.selected = true;
        selector.add(newOpt);
      }
      updateAuthUI();
      refreshAllData();
      checkPendingInvite();
    } else if (res.status === 404) {
      // User not found, prompt registration
      document.getElementById('quick-login-modal').classList.remove('active');
      document.getElementById('register-modal').classList.add('active');
      document.getElementById('reg-phone').value = phone;
      currentStep = 1;
      showFormStep(1);
    } else {
      showToast(data.error || 'Quick Login Failed');
    }
  } catch (err) {
    console.error(err);
    alert('Failed to connect to backend server for quick login.');
  }
}

// Submit Registration Form to Backend REST API
async function handleRegistrationSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('reg-name').value;
  const alias = document.getElementById('reg-alias').value;
  const email = document.getElementById('reg-email').value;
  const phone = document.getElementById('reg-phone').value;
  const password = document.getElementById('reg-password').value;

  const dob = document.getElementById('reg-dob').value;
  const gender = document.getElementById('reg-gender').value;
  const country = document.getElementById('reg-country').value;
  const state = document.getElementById('reg-state').value;
  const city = document.getElementById('reg-city').value;
  const locality = document.getElementById('reg-locality').value;

  const heightCm = Number(document.getElementById('reg-height').value);
  const weightKg = Number(document.getElementById('reg-weight').value);
  const occupation = document.getElementById('reg-occupation').value;
  const dailyStepGoal = Number(document.getElementById('reg-goal').value);

  const profilePic = document.getElementById('reg-avatar-data').value;

  const payload = {
    name,
    alias,
    profilePic,
    email,
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

      // Add to user selector dropdown
      const selector = document.getElementById('user-selector');
      const newOpt = document.createElement('option');
      newOpt.value = currentUser.email;
      const optName = currentUser.alias || currentUser.name;
      newOpt.text = `${optName} (${currentUser.location.city})`;
      newOpt.selected = true;
      selector.add(newOpt);

      updateAuthUI();
      refreshAllData();
      checkPendingInvite();
    } else {
      alert(`❌ Registration Failed: ${data.error}`);
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
  const allowedPhonesVal = document.getElementById('grp-allowed-phones').value;
  const allowedPhones = allowedPhonesVal ? allowedPhonesVal.split(',').map(p => p.trim()).filter(p => p !== '') : [];

  try {
    const res = await fetch(`${API_BASE}/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ name, groupType, targetSteps, allowedPhones }),
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
      const displayName = currentUser.alias || currentUser.name;
      showToast(`Active User: ${displayName}`);
      updateAuthUI();
      refreshAllData();
      checkPendingInvite();
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
}

// Fetch Today's Steps
async function fetchTodayActivity() {
  try {
    const res = await fetch(`${API_BASE}/steps/today`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    if (res.ok) {
      document.getElementById('step-count-display').innerText = data.summary.totalSteps.toLocaleString();
      document.getElementById('step-goal-target').innerText = data.dailyGoal.toLocaleString();
      document.getElementById('goal-percent').innerText = `${data.completionPercentage}%`;
      document.getElementById('calories-display').innerText = data.summary.totalCalories;
      document.getElementById('distance-display').innerText = `${(data.summary.totalDistanceMeters / 1000).toFixed(1)} km`;
      document.getElementById('streak-display').innerText = `${data.streakDays} Days`;
      document.getElementById('user-coins').innerText = currentUser.walkCoins.toLocaleString();
      document.getElementById('marketplace-coins').innerText = currentUser.walkCoins.toLocaleString();
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

      // Quick Rank Summary
      const quickContainer = document.getElementById('quick-rank-summary');
      quickContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-size:14px;">
          <span>Category (${data.rankings.sameAgeAndGender.category}):</span>
          <strong style="color:#10B981;">Rank #${data.rankings.sameAgeAndGender.rank} of ${data.rankings.sameAgeAndGender.total}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:14px;">
          <span>Locality (${data.rankings.locality.name}):</span>
          <strong style="color:#06B6D4;">Rank #${data.rankings.locality.rank} of ${data.rankings.locality.total}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:14px;">
          <span>City (${data.rankings.city.name}):</span>
          <strong style="color:#8B5CF6;">Rank #${data.rankings.city.rank} of ${data.rankings.city.total}</strong>
        </div>
      `;

      // Full Rankings Universe Grid
      const container = document.getElementById('rankings-container');
      container.innerHTML = `
        <div class="rank-tile">
          <div class="rank-tile-title">Same Age + Same Gender (${data.rankings.sameAgeAndGender.category})</div>
          <div class="rank-number">Rank #${data.rankings.sameAgeAndGender.rank}</div>
          <div class="rank-badge">Out of ${data.rankings.sameAgeAndGender.total} walkers</div>
        </div>
        <div class="rank-tile">
          <div class="rank-tile-title">Locality (${data.rankings.locality.name})</div>
          <div class="rank-number">Rank #${data.rankings.locality.rank}</div>
          <div class="rank-badge">Out of ${data.rankings.locality.total} walkers</div>
        </div>
        <div class="rank-tile">
          <div class="rank-tile-title">City (${data.rankings.city.name})</div>
          <div class="rank-number">Rank #${data.rankings.city.rank}</div>
          <div class="rank-badge">Out of ${data.rankings.city.total} walkers</div>
        </div>
        <div class="rank-tile">
          <div class="rank-tile-title">Global Standings</div>
          <div class="rank-number">Rank #${data.rankings.global.rank}</div>
          <div class="rank-badge">Worldwide Ranking</div>
        </div>
        <div class="rank-tile">
          <div class="rank-tile-title">Overall Fitness Cohort</div>
          <div class="rank-number">${data.fitnessPercentile}</div>
          <div class="rank-badge" style="background:rgba(245,158,11,0.2); color:#F59E0B;">Top Performing Tier</div>
        </div>
      `;
    }
  } catch (err) {
    console.error(err);
  }
}

// Sync Steps Action
function handleSyncSteps() {
  alert('Please open the BadaKadam mobile app on your smartphone to sync steps. Steps are captured automatically from Apple Health or Google Fit to ensure fair play. Manual entry is not allowed.');
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
      container.innerHTML = data.groups.map((g) => `
        <div class="glass-card group-item">
          <div>
            <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">${g.name}</h3>
            <p style="color: var(--text-muted); font-size: 13px;">${g.description}</p>
            <div style="margin-top: 12px; font-size: 13px; color: var(--accent-cyan); font-weight: 600;">
              Collective Target: ${g.currentSteps.toLocaleString()} / ${g.targetSteps.toLocaleString()} steps
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${Math.min(100, Math.round((g.currentSteps / g.targetSteps) * 100))}%;"></div>
            </div>
          </div>
          <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between;">
            <div>
              <span class="rank-badge" style="margin-bottom: 8px; display: inline-block;">Invite Code: ${g.inviteCode}</span>
              <div style="font-size: 13px; color: var(--text-muted);">${g.members.length} Members Active</div>
            </div>
            <button class="sync-action-btn share-grp-btn" onclick="openShareModal('${g.name}', '${g.inviteCode}')" style="margin-top: 8px; padding: 6px 12px; font-size: 12px; background: rgba(59,130,246,0.2); color: #60A5FA; border: 1px solid rgba(59,130,246,0.3); border-radius: 6px; display: flex; align-items: center; gap: 6px; cursor: pointer;">
              <i class="fa-solid fa-share-nodes"></i> Share Invite
            </button>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

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
      container.innerHTML = getAvatarHTML(currentUser.profilePic, '32px', '22px');
    } else {
      headerAvatar.style.display = 'none';
    }
  }
}

function handleSignOut() {
  authToken = '';
  currentUser = null;
  updateAuthUI();
  
  // Clear dashboard or show a state that requires login
  document.getElementById('user-coins').innerText = '0';
  document.getElementById('marketplace-coins').innerText = '0';
  document.getElementById('rankings-container').innerHTML = '<p style="color: white">Please login to see rankings.</p>';
  document.getElementById('groups-container').innerHTML = '<p style="color: white">Please login to see groups.</p>';
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
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.innerText = message;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

// Avatar rendering helper
function getAvatarHTML(profilePic, size = '32px', fontSize = '22px') {
  if (!profilePic) {
    return `<div class="avatar-circle-render" style="font-size: ${fontSize};">👤</div>`;
  }
  
  // Check if it's one of the preselected avatars
  const avatarMap = {
    'Bull': { emoji: '🐂', class: 'zoom-head' },
    'Eagle': { emoji: '🦅', class: 'float-anim' },
    'Falcon': { emoji: '🦉', class: 'glance-anim' },
    'Cheetah': { emoji: '🐆', class: 'run-anim' },
    'Rabbit': { emoji: '🐇', class: 'hop-anim' }
  };
  
  if (avatarMap[profilePic]) {
    const data = avatarMap[profilePic];
    // Return standard emoji wrapped in dynamic container for zooming close-up
    return `<div class="avatar-option-emoji ${data.class} close-up-view" style="font-size: calc(${size} * 2.5); line-height: ${size}; transform: translateY(calc(${size} * 0.15)) scale(1.6);">${data.emoji}</div>`;
  }
  
  // Otherwise it's a URL or base64 data
  return `<img src="${profilePic}" style="width: 100%; height: 100%; object-fit: cover;">`;
}

// Initialize avatar handlers
function initAvatarSetup() {
  const fileInput = document.getElementById('reg-avatar-file');
  const uploadTrigger = document.getElementById('upload-avatar-trigger');
  const chooseTrigger = document.getElementById('choose-avatar-trigger');
  const grid = document.getElementById('avatar-selection-grid');
  const previewRender = document.getElementById('avatar-preview-render');
  const avatarDataInput = document.getElementById('reg-avatar-data');

  if (uploadTrigger && fileInput) {
    uploadTrigger.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64Data = event.target.result;
          previewRender.innerHTML = `<img src="${base64Data}" style="width:100%; height:100%; object-fit:cover;">`;
          previewRender.className = "avatar-circle-render"; // reset close-up transform
          avatarDataInput.value = base64Data;
          
          document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('active'));
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (chooseTrigger && grid) {
    chooseTrigger.addEventListener('click', () => {
      grid.style.display = grid.style.display === 'none' ? 'grid' : 'none';
    });
  }

  const avatarOptions = document.querySelectorAll('.avatar-option');
  avatarOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      avatarOptions.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');

      const avatarName = opt.getAttribute('data-avatar');
      avatarDataInput.value = avatarName;

      previewRender.innerHTML = getAvatarHTML(avatarName, '90px', '55px');
      previewRender.className = "avatar-circle-render";
    });
  });

  // Simulated Sync Buttons
  const syncGoogle = document.getElementById('sync-google-avatar');
  const syncWhatsapp = document.getElementById('sync-whatsapp-avatar');

  if (syncGoogle) {
    syncGoogle.addEventListener('click', () => {
      showToast('Syncing with Google Account...');
      setTimeout(() => {
        const mockGoogleAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=GoogleUser${Date.now()}`;
        previewRender.innerHTML = `<img src="${mockGoogleAvatar}" style="width:100%; height:100%; object-fit:cover;">`;
        previewRender.className = "avatar-circle-render";
        avatarDataInput.value = mockGoogleAvatar;
        document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('active'));
        showToast('Successfully synced Google avatar!');
      }, 1000);
    });
  }

  if (syncWhatsapp) {
    syncWhatsapp.addEventListener('click', () => {
      showToast('Syncing with WhatsApp Profile...');
      setTimeout(() => {
        const mockWhatsappAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=WhatsAppUser${Date.now()}`;
        previewRender.innerHTML = `<img src="${mockWhatsappAvatar}" style="width:100%; height:100%; object-fit:cover;">`;
        previewRender.className = "avatar-circle-render";
        avatarDataInput.value = mockWhatsappAvatar;
        document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('active'));
        showToast('Successfully synced WhatsApp avatar!');
      }, 1000);
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
