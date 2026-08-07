const API_BASE = 'http://localhost:5000/api/v1';

let authToken = '';
let currentUser = null;
let currentStep = 1;

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initUserSelector();
  initModal();
  loginUser('brijesh@happyfeet.com');

  document.getElementById('sync-steps-btn').addEventListener('click', handleSyncSteps);
  document.getElementById('registration-form').addEventListener('submit', handleRegistrationSubmit);
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
  const modal = document.getElementById('register-modal');
  const openBtn = document.getElementById('open-register-modal-btn');
  const closeBtn = document.getElementById('close-modal-btn');

  openBtn.addEventListener('click', () => {
    currentStep = 1;
    showFormStep(1);
    modal.classList.add('active');
  });

  closeBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });

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

// Submit Registration Form to Backend REST API
async function handleRegistrationSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('reg-name').value;
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

  const payload = {
    name,
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
      showToast(`🎉 Account Created! Welcome to HappyFeet, ${name}!`);

      authToken = data.token;
      currentUser = data.user;

      // Add to user selector dropdown
      const selector = document.getElementById('user-selector');
      const newOpt = document.createElement('option');
      newOpt.value = currentUser.email;
      newOpt.text = `${currentUser.name} (${currentUser.location.city})`;
      newOpt.selected = true;
      selector.add(newOpt);

      refreshAllData();
    } else {
      alert(`❌ Registration Failed: ${data.error}`);
    }
  } catch (err) {
    console.error(err);
    alert('Failed to connect to backend server for registration.');
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
      showToast(`Active User: ${currentUser.name}`);
      refreshAllData();
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
async function handleSyncSteps() {
  try {
    const res = await fetch(`${API_BASE}/steps/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        source: 'AppleHealthKit',
        steps: [{ count: 1000, distanceMeters: 750, activeMinutes: 10 }],
      }),
    });

    const data = await res.json();
    if (res.ok) {
      showToast('Successfully synced +1,000 steps!');
      refreshAllData();
    } else {
      showToast(data.error || 'Failed to sync steps');
    }
  } catch (err) {
    console.error(err);
  }
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
          <div style="text-align: right;">
            <span class="rank-badge" style="margin-bottom: 8px;">Invite Code: ${g.inviteCode}</span>
            <div style="font-size: 13px; color: var(--text-muted);">${g.members.length} Members Active</div>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error(err);
  }
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
