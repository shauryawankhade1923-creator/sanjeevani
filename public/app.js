const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const escapeHTML = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const formatNumber = (value) => new Intl.NumberFormat('en-IN').format(Number(value || 0));
const formatTime = (value) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
const roleLabel = { admin: 'Operations admin', donor: 'Donor', rider: 'Volunteer rider', shelter: 'Receiving center' };

let appState = null;
let activePage = 'operations';
let stream = null;
let operationsTemplate = '';
let streamPaused = false;
let activeFilter = 'all';
let toastTimer;
let currentConfig = null;
let activeLeafletMap = null;
let realtimePollInterval = null;

document.addEventListener('DOMContentLoaded', init);

window.addEventListener('popstate', (event) => {
  if (event.state?.page) {
    setPage(event.state.page, false);
  } else {
    const hash = window.location.hash.replace('#', '');
    if (hash && appState) {
      setPage(hash, false);
    }
  }
});

async function init() {
  operationsTemplate = $('#workspace-root')?.innerHTML || '';
  await loadConfig();
  bindStaticListeners();
  const me = await api('/api/me', { silent: true });
  if (me?.user) await enterApp(me.user);
  else showLogin();
}

async function loadConfig() {
  currentConfig = await api('/api/config', { silent: true });
}

async function api(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (!options.silent) showToast(payload.error || 'Something went wrong', true);
      return null;
    }
    return payload;
  } catch (error) {
    if (!options.silent) showToast('The Sanjeevani server is unavailable', true);
    return null;
  }
}

function bindStaticListeners() {
  document.addEventListener('click', (event) => {
    // Switch role from switcher dropdown
    const switchItem = event.target.closest('[data-switch-role]');
    if (switchItem) {
      event.preventDefault();
      switchRole(switchItem.dataset.switchRole);
      return;
    }

    // Toggle switcher dropdown
    const switchToggle = event.target.closest('#workspace-switcher') || event.target.closest('#topbar-switch-btn') || event.target.closest('#switcher-toggle-btn');
    if (switchToggle && !event.target.closest('.switcher-dropdown')) {
      const dd = $('#switcher-dropdown');
      if (dd) dd.hidden = !dd.hidden;
      return;
    }

    // Close switcher dropdown on outside click
    if (!event.target.closest('#workspace-switcher') && !event.target.closest('#topbar-switch-btn')) {
      const dd = $('#switcher-dropdown');
      if (dd && !dd.hidden) dd.hidden = true;
    }

    const logout = event.target.closest('[data-logout]');
    if (logout) {
      logoutUser();
      return;
    }
    if (event.target.closest('#sidebar-add') || event.target.closest('#add-batch')) {
      openDonationModal();
      return;
    }
    if (event.target.closest('#sidebar-scenario')) {
      if (appState?.user?.role === 'admin') setPage('scenario');
      return;
    }
    if (event.target.closest('#close-modal') || event.target.closest('#cancel-modal')) {
      closeDonationModal();
      return;
    }
    if (event.target.closest('#notification-button')) {
      if (appState) setPage('activity');
      return;
    }
    const pageButton = event.target.closest('[data-page]');
    if (pageButton && appState) {
      setPage(pageButton.dataset.page);
      return;
    }
    const action = event.target.closest('[data-action]');
    if (action && appState) {
      handleAction(action.dataset.action, action.dataset.id, action.dataset.value);
      return;
    }
  });

  const batchForm = $('#batch-form');
  if (batchForm) {
    batchForm.addEventListener('submit', submitDonation);
  }

  const batchType = $('#batch-type');
  if (batchType) {
    batchType.addEventListener('change', () => {
      const cat = batchType.value;
      const unitInput = $('#batch-unit');
      const expiryInput = $('#batch-expiry');
      if (cat === 'Cooked meals') {
        if (unitInput) unitInput.value = 'meals';
        if (expiryInput) expiryInput.value = '75';
      } else if (cat === 'Medical supplies') {
        if (unitInput) unitInput.value = 'kits';
        if (expiryInput) expiryInput.value = '180';
      } else if (cat === 'Ration kits') {
        if (unitInput) unitInput.value = 'kits';
        if (expiryInput) expiryInput.value = '720';
      } else {
        if (unitInput) unitInput.value = 'units';
        if (expiryInput) expiryInput.value = '120';
      }
    });
  }

  window.addEventListener('click', (event) => { if (event.target.id === 'batch-modal') closeDonationModal(); });
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeDonationModal(); });
}

async function switchRole(targetRole) {
  const dd = $('#switcher-dropdown');
  if (dd) dd.hidden = true;
  if (appState?.user?.role === targetRole) {
    showToast(`Already active as ${roleLabel[targetRole] || targetRole}`);
    return;
  }
  showToast(`Switching to ${roleLabel[targetRole] || targetRole}…`);
  const result = await api('/api/auth/switch', {
    method: 'POST',
    body: JSON.stringify({ role: targetRole }),
    silent: true
  });
  if (result?.user) {
    await enterApp(result.user);
    showToast(`Active role: ${roleLabel[targetRole] || targetRole}`);
  } else {
    showToast('Failed to switch role', true);
  }
}

function showLogin(errorMessage = '') {
  if (realtimePollInterval) {
    clearInterval(realtimePollInterval);
    realtimePollInterval = null;
  }
  $('#app-shell').hidden = true;
  const auth = $('#auth-screen');
  auth.className = 'auth-screen';
  auth.innerHTML = `<div class="auth-layout">
    <section class="auth-story">
      <img class="auth-logo" src="sanjeevani-logo.jpeg" alt="Sanjeevani logo" />
      <div>
        <h1>Good aid should<br /><em>never wait.</em></h1>
        <p>One live network for safe surplus collection, reliable riders, and receiving centers that can adapt when the ground changes.</p>
        <div class="auth-story-footer">
          <span>Shared live data</span>
          <span>Safety-first dispatch</span>
        </div>
      </div>
    </section>
    <section class="auth-panel">
      <div class="section-kicker">Sanjeevani operations network</div>
      <h2>Welcome back</h2>
      <p class="auth-subtitle">Sign in to coordinate what matters, where it matters, before the clock runs out.</p>
      <form class="auth-form" id="login-form">
        <label class="auth-field">
          <span>Email address</span>
          <input id="login-email" type="email" autocomplete="username" placeholder="you@example.com" value="admin@demo.sanjeevani.app" required />
        </label>
        <label class="auth-field">
          <span>Password</span>
          <div class="password-row">
            <input id="login-password" type="password" autocomplete="current-password" placeholder="Enter your password" value="SanjeevaniDemo!2026" required />
            <button class="password-toggle" type="button" id="toggle-password">Show</button>
          </div>
        </label>
        <div class="auth-error" id="login-error">${escapeHTML(errorMessage)}</div>
        <button class="primary-button auth-submit" type="submit" id="login-submit">Sign in to Sanjeevani <span>→</span></button>
      </form>
      <div class="demo-login">
        <h3>1-Click Demo Accounts</h3>
        <p>Click any role to load demo credentials (default password: <code>SanjeevaniDemo!2026</code>):</p>
        <div class="demo-role-grid">
          <button class="demo-role-button" data-demo-email="admin@demo.sanjeevani.app">
            <i class="role-dot">⌁</i>
            <span><strong>Administrator</strong><small>Network operations</small></span>
          </button>
          <button class="demo-role-button" data-demo-email="donor@demo.sanjeevani.app">
            <i class="role-dot">＋</i>
            <span><strong>Donor</strong><small>Post surplus aid</small></span>
          </button>
          <button class="demo-role-button" data-demo-email="rider@demo.sanjeevani.app">
            <i class="role-dot">◌</i>
            <span><strong>Rider</strong><small>Move and deliver aid</small></span>
          </button>
          <button class="demo-role-button" data-demo-email="shelter@demo.sanjeevani.app">
            <i class="role-dot">⌂</i>
            <span><strong>Shelter</strong><small>Manage demand</small></span>
          </button>
        </div>
      </div>
    </section>
  </div>`;

  $('#login-form').addEventListener('submit', loginUser);
  $('#toggle-password').addEventListener('click', () => {
    const input = $('#login-password');
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    $('#toggle-password').textContent = visible ? 'Show' : 'Hide';
  });

  $$('.demo-role-button').forEach((button) => {
    button.addEventListener('click', () => {
      $('#login-email').value = button.dataset.demoEmail;
      $('#login-password').value = 'SanjeevaniDemo!2026';
      showToast(`Loaded ${button.querySelector('strong').textContent} credentials`);
      $('#login-submit').focus();
    });
  });
}

async function loginUser(event) {
  event.preventDefault();
  const submit = $('#login-submit');
  const error = $('#login-error');
  submit.disabled = true;
  submit.textContent = 'Signing in…';
  error.textContent = '';
  const result = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: $('#login-email').value, password: $('#login-password').value }),
    silent: true
  });
  submit.disabled = false;
  submit.innerHTML = 'Sign in to Sanjeevani <span>→</span>';
  if (!result) {
    error.textContent = 'Invalid email or password. Use demo password SanjeevaniDemo!2026.';
    return;
  }
  await enterApp(result.user);
}

async function logoutUser() {
  await api('/api/auth/logout', { method: 'POST', silent: true });
  if (stream) {
    stream.close();
    stream = null;
  }
  if (realtimePollInterval) {
    clearInterval(realtimePollInterval);
    realtimePollInterval = null;
  }
  appState = null;
  showLogin();
  showToast('Signed out');
}

async function enterApp(user) {
  const state = await api('/api/state', { silent: true });
  if (!state) return showLogin('The server could not load your workspace.');
  appState = state;
  appState.user = user || state.user;
  $('#auth-screen').innerHTML = '';
  $('#auth-screen').className = '';
  $('#app-shell').hidden = false;
  configureShell();
  connectRealtime();
  setPage(defaultPageForRole(appState.user.role));
}

function defaultPageForRole(role) {
  return role === 'donor' ? 'donations' : role === 'rider' ? 'dispatch' : role === 'shelter' ? 'shelters' : 'operations';
}

function configureShell() {
  const role = appState.user.role;
  const user = appState.user;
  const nav = $$('.nav-item');
  const names = role === 'admin' ? ['Operations', 'Dispatch queue', 'Shelters', 'Riders', 'Impact'] : role === 'donor' ? ['My dashboard', 'My donations', 'Pickup map', 'Impact', 'Activity'] : role === 'rider' ? ['My deliveries', 'Available work', 'My map', 'History', 'Activity'] : ['Center dashboard', 'Incoming deliveries', 'Demand & capacity', 'Center map', 'Activity'];
  const pages = role === 'admin' ? ['operations', 'dispatch', 'shelters', 'riders', 'impact'] : role === 'donor' ? ['operations', 'donations', 'map', 'impact', 'activity'] : role === 'rider' ? ['operations', 'dispatch', 'map', 'history', 'activity'] : ['operations', 'dispatch', 'shelters', 'map', 'activity'];
  
  nav.forEach((item, index) => {
    item.dataset.page = pages[index];
    const label = item.querySelector('span:nth-child(2)');
    if (label) label.textContent = names[index];
    item.hidden = false;
  });

  $('.sidebar-label-spaced').textContent = role === 'admin' ? 'Quick actions' : 'Workspace actions';
  const action = $('#sidebar-add');
  if (action) {
    action.hidden = !['admin', 'donor'].includes(role);
    action.querySelector('span:last-child').textContent = role === 'donor' ? 'Post a donation' : 'Log a donation';
  }
  const scenario = $('#sidebar-scenario');
  if (scenario) scenario.hidden = role !== 'admin';

  // Workspace Switcher title & subtitle & avatar
  const wsAvatar = $('#workspace-avatar');
  const wsTitle = $('#workspace-title');
  const wsSub = $('#workspace-subtitle');
  if (role === 'admin') {
    if (wsAvatar) wsAvatar.textContent = 'MC';
    if (wsTitle) wsTitle.textContent = 'Metro Civic Network';
    if (wsSub) wsSub.textContent = 'Operations team';
  } else if (role === 'donor') {
    if (wsAvatar) wsAvatar.textContent = 'AF';
    if (wsTitle) wsTitle.textContent = 'Aarav Foods';
    if (wsSub) wsSub.textContent = 'Food Donor Workspace';
  } else if (role === 'rider') {
    if (wsAvatar) wsAvatar.textContent = 'AM';
    if (wsTitle) wsTitle.textContent = 'Aarav Mehta Logistics';
    if (wsSub) wsSub.textContent = 'Volunteer Rider Desk';
  } else if (role === 'shelter') {
    if (wsAvatar) wsAvatar.textContent = 'NS';
    if (wsTitle) wsTitle.textContent = 'Night Shelter A';
    if (wsSub) wsSub.textContent = 'Receiving Center Desk';
  }

  // User profile in sidebar
  const initials = (user.name || 'User').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const avatarEl = $('.profile-avatar');
  if (avatarEl) avatarEl.textContent = initials;
  const topAvatarEl = $('.avatar-button');
  if (topAvatarEl) topAvatarEl.textContent = initials;
  const profileName = $('.profile-row strong');
  if (profileName) profileName.textContent = user.name || 'Demo User';
  const profileRole = $('.profile-row span');
  if (profileRole) profileRole.textContent = roleLabel[role] || role;

  // Topbar role chip, quick switch button, logout
  const topActions = $('.topbar-actions');
  if (topActions) {
    let sessionUser = $('.session-user', topActions);
    if (!sessionUser) {
      sessionUser = document.createElement('div');
      sessionUser.className = 'session-user';
      topActions.appendChild(sessionUser);
    }
    sessionUser.innerHTML = `
      <span class="role-chip">${escapeHTML(roleLabel[role])}</span>
      <button class="switch-role-btn" id="topbar-switch-btn" type="button" title="Quick switch to another role">Switch role ⇄</button>
      <button class="logout-button" id="logout-button" data-logout>Log out</button>
    `;
  }

  let banner = document.querySelector('.backend-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'backend-banner';
    $('.main-content').insertBefore(banner, $('.topbar').nextSibling);
  }
  banner.innerHTML = `<span>●</span><strong>Local shared demo mode</strong><span>Data is persisted in data/sanjeevani.json and shared through the Sanjeevani server.${currentConfig?.supabaseConfigured ? ' Supabase variables configured.' : ''}</span><button class="banner-action" data-page="activity">View activity</button>`;
}

function connectRealtime() {
  if (stream) {
    stream.close();
    stream = null;
  }
  try {
    stream = new EventSource('/api/events/stream');
    stream.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'connected' || streamPaused) return;
        const next = await api('/api/state', { silent: true });
        if (next) {
          appState = next;
          renderCurrentPage();
        }
      } catch {}
    };
    stream.onerror = () => {
      if (stream) stream.close();
      stream = null;
    };
  } catch {}

  if (!realtimePollInterval) {
    realtimePollInterval = setInterval(async () => {
      if (appState && !streamPaused && document.visibilityState === 'visible') {
        const next = await api('/api/state', { silent: true });
        if (next && (JSON.stringify(next.metrics) !== JSON.stringify(appState.metrics) || next.events.length !== appState.events.length)) {
          appState = next;
          renderCurrentPage();
        }
      }
    }, 4000);
  }
}

async function refreshState() {
  const next = await api('/api/state', { silent: true });
  if (next) {
    appState = next;
    renderCurrentPage();
    showToast('State updated');
  }
}

function setPage(page, push = true) {
  activePage = page;
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.page === page));
  $('#current-view-label').textContent = pageTitle(page);
  if (push && window.location.hash !== `#${page}`) {
    history.pushState({ page, role: appState?.user?.role }, '', `#${page}`);
  }
  renderCurrentPage();
}

function pageTitle(page) {
  return ({ operations: 'Operations', dispatch: 'Dispatch queue', donations: 'My donations', shelters: 'Shelters & demand', riders: 'Riders', impact: 'Impact', map: 'Live map', activity: 'Activity log', history: 'Delivery history', scenario: 'Scenario Lab' })[page] || 'Workspace';
}

function renderCurrentPage() {
  if (!appState) return;

  const clock = $('#clock-time');
  if (clock && appState.metrics?.simulationNow) {
    clock.textContent = formatTime(appState.metrics.simulationNow);
  }
  const notifBadge = $('.notification-badge');
  if (notifBadge && appState.metrics) {
    notifBadge.textContent = appState.metrics.needsAttention || '0';
  }

  const root = $('#workspace-root');
  if (activePage === 'operations' && appState.user.role === 'admin') {
    root.innerHTML = operationsTemplate;
    bindOperations();
    renderOperations();
    return;
  }
  root.innerHTML = renderRolePage(activePage);
  bindDynamicPage();
  if (activePage === 'map') {
    setTimeout(() => renderMap('workspace-map'), 10);
  }
}

function operationRows() {
  return appState.shipments.map((shipment) => {
    const donation = appState.donations.find((item) => item.id === shipment.donationId) || {};
    const rider = appState.riders.find((item) => item.id === shipment.riderId) || {};
    const center = appState.centers.find((item) => item.id === shipment.centerId) || {};
    return {
      ...shipment,
      donation,
      rider,
      center,
      minutes: Math.max(0, Math.round((new Date(shipment.etaAt || appState.metrics.simulationNow) - new Date(appState.metrics.simulationNow)) / 60000))
    };
  });
}

function renderOperations() {
  const rows = operationRows();
  const filtered = activeFilter === 'critical' ? rows.filter((row) => ['offered', 'delayed', 'attention'].includes(row.status) || row.minutes <= 15) : activeFilter === 'transit' ? rows.filter((row) => ['in_transit', 'picked_up', 'rerouted'].includes(row.status)) : activeFilter === 'action' ? rows.filter((row) => ['offered', 'delayed', 'attention'].includes(row.status)) : rows;
  $('#active-shipments').textContent = String(appState.metrics.activeShipments).padStart(2, '0');
  $('#attention-count').textContent = String(appState.metrics.needsAttention).padStart(2, '0');
  $('#meals-rescued').textContent = formatNumber(appState.metrics.mealsRescued);
  $('#shelter-demand').innerHTML = `${Math.round(appState.metrics.openDemand / Math.max(1, appState.metrics.openDemand + 120) * 100)}<span class="metric-unit">%</span>`;
  $('#all-count').textContent = rows.length;
  $('#critical-count').textContent = rows.filter((row) => ['offered', 'delayed', 'attention'].includes(row.status) || row.minutes <= 15).length;
  $('#transit-count').textContent = rows.filter((row) => ['in_transit', 'picked_up', 'rerouted'].includes(row.status)).length;
  $('#action-count').textContent = rows.filter((row) => ['offered', 'delayed', 'attention'].includes(row.status)).length;
  $('#operation-list').innerHTML = filtered.length ? filtered.map((row) => operationCard(row)).join('') : '<div class="empty-state">No shipments match this filter.</div>';
  $('#attention-list').innerHTML = rows.filter((row) => ['offered', 'delayed', 'attention'].includes(row.status)).slice(0, 3).map((row) => `<div class="attention-item"><div class="attention-marker ${row.status === 'offered' ? 'yellow' : ''}">${row.status === 'offered' ? '◷' : '!'}</div><div class="attention-copy"><strong>${escapeHTML(row.donation.donorName)} · ${escapeHTML(row.center.name)}</strong><span>${escapeHTML(row.status === 'offered' ? 'Waiting for rider response' : 'Operator review required')} · ${row.minutes} min remaining</span></div><button class="attention-action" data-action="shipment-ping" data-id="${row.id}">Open</button></div>`).join('') || '<div class="empty-state">All clear for now.</div>';
  $('#activity-list').innerHTML = appState.events.slice(0, 3).map((event) => `<div class="activity-item"><i class="activity-dot ${event.type.includes('delay') || event.type.includes('expired') ? 'orange' : event.type.includes('shipment') ? 'blue' : ''}"></i><div class="activity-copy"><strong>${escapeHTML(event.message)}</strong><span>${escapeHTML(event.type.replaceAll('.', ' · '))}</span><small class="activity-time">${formatTime(event.createdAt)}</small></div></div>`).join('');
  bindOperations();
}

function operationCard(row) {
  const status = row.status.replaceAll('_', ' ');
  const statusClass = row.status === 'in_transit' ? 'transit' : ['offered', 'delayed', 'attention'].includes(row.status) ? 'action' : row.status === 'delivered' ? 'delivered' : row.status === 'rerouted' ? 'rerouted' : 'ready';
  const action = row.status === 'offered' ? 'Allocate / inspect' : row.status === 'delayed' ? 'Review delay' : row.status === 'delivered' ? 'View receipt' : 'Open shipment';
  return `<article class="operation-card"><div class="operation-card-head"><div class="aid-icon ${row.donation.category === 'Medical supplies' ? 'medical' : row.donation.category === 'Ration kits' ? 'ration' : 'meals'}">${row.donation.category === 'Medical supplies' ? '✚' : row.donation.category === 'Ration kits' ? '▦' : '🍱'}</div><div class="operation-name"><strong>${formatNumber(row.quantity)} ${escapeHTML(row.unit)} · ${escapeHTML(row.donation.donorName)}</strong><span>${escapeHTML(row.donation.category)} · ${escapeHTML(row.rider.name || 'Unassigned')}</span></div><span class="status-pill ${statusClass}">${escapeHTML(status)}</span></div><div class="operation-route"><div class="route-point"><i class="route-dot"></i><span>${escapeHTML(row.donation.pickupLocation.name)}</span></div><span class="route-arrow">→</span><div class="route-point"><i class="route-dot"></i><span>${escapeHTML(row.center.name)}</span></div></div><div class="operation-progress ${statusClass === 'action' ? 'orange' : statusClass === 'transit' ? '' : 'blue'}"><span style="width:${row.status === 'delivered' ? 100 : row.status === 'in_transit' ? 72 : row.status === 'picked_up' ? 46 : 14}%"></span></div><div class="operation-meta"><span class="meta-item">◷ <strong>${row.status === 'delivered' ? 'Complete' : `${row.minutes} min left`}</strong></span><span class="meta-item">♙ <strong>${escapeHTML(row.rider.name || 'Open pool')}</strong></span><span class="meta-item">▣ <strong>${formatNumber(row.quantity)} / ${formatNumber(row.donation.originalQuantity)}</strong></span><span class="meta-spacer"></span><button class="operation-action" data-action="shipment-open" data-id="${row.id}">${action} <span>→</span></button></div></article>`;
}

function bindOperations() {
  $$('.filter-chip').forEach((chip) => chip.addEventListener('click', () => {
    activeFilter = chip.dataset.filter;
    $$('.filter-chip').forEach((item) => item.classList.toggle('active', item === chip));
    renderOperations();
  }));
  $('#advance-time')?.addEventListener('click', () => handleScenario('advance-time'));
  $('#filter-button')?.addEventListener('click', () => $('#filter-row')?.classList.toggle('expanded'));
  $('#clear-attention')?.addEventListener('click', () => showToast('Attention queue is backed by live shipment state'));
  $('#pause-stream')?.addEventListener('click', (event) => {
    streamPaused = !streamPaused;
    event.currentTarget.textContent = streamPaused ? 'Resume stream' : 'Pause stream';
  });
  $('#view-all')?.addEventListener('click', () => {
    activeFilter = 'all';
    renderOperations();
  });
  $$('.scenario-actions button').forEach((button) => button.addEventListener('click', () => handleScenario(button.dataset.scenario)));
}

function renderRolePage(page) {
  const role = appState.user.role;
  const rows = operationRows();
  if (page === 'donations' || (role === 'donor' && page === 'operations')) {
    return `<div class="page-toolbar"><div><div class="section-kicker">Donor workspace</div><h2>Your donation flow</h2><p>Post surplus, see collection progress, and keep every handoff accountable.</p></div><div class="toolbar-actions"><button class="small-button primary" data-action="open-donation">＋ Post a donation</button></div></div><div class="stat-grid"><div class="stat-tile"><span>My donations</span><strong>${appState.donations.length}</strong></div><div class="stat-tile"><span>Available units</span><strong>${formatNumber(appState.donations.reduce((sum, item) => sum + item.availableQuantity, 0))}</strong></div><div class="stat-tile"><span>Collected</span><strong>${formatNumber(appState.donations.reduce((sum, item) => sum + item.pickedUpQuantity, 0))}</strong></div><div class="stat-tile"><span>Delivered</span><strong>${formatNumber(appState.donations.reduce((sum, item) => sum + item.deliveredQuantity, 0))}</strong></div></div>${donationsTable(appState.donations, true)}`;
  }
  if (page === 'dispatch' || page === 'history') {
    if (role === 'admin') return adminDispatchView(rows);
    return `<div class="page-toolbar"><div><div class="section-kicker">${role === 'rider' ? 'Rider dispatch' : 'Incoming delivery queue'}</div><h2>${role === 'rider' ? 'Move what matters' : 'Know what is arriving'}</h2><p>${role === 'rider' ? 'Accept, collect, move, and complete your assigned shipments.' : 'Confirm received quantities and update demand when the ground changes.'}</p></div></div>${role === 'rider' ? riderDispatch(rows) : shelterDispatch(rows)}`;
  }
  if (page === 'shelters') return sheltersView();
  if (page === 'riders') return ridersView();
  if (page === 'impact') return impactView();
  if (page === 'activity') return activityView();
  if (page === 'scenario') return scenarioView();
  if (page === 'map') return mapView();
  return role === 'rider' ? riderDispatch(rows) : role === 'shelter' ? sheltersView() : role === 'donor' ? renderRolePage('donations') : operationsTemplate;
}

function adminDispatchView(rows) {
  return `<div class="page-toolbar"><div><div class="section-kicker">Administrator allocation queue</div><h2>Allocate only what is safe</h2><p>Recommendations are constrained by capacity, center demand, dependencies, and remaining shelf-life.</p></div><button class="small-button secondary" data-action="refresh">Refresh state</button></div><div class="notice-card"><span class="notice-icon">✦</span><span>Manual allocation is role-protected on the server. Every offer creates a short reservation lease and is released exactly once if the rider does not respond.</span></div>${donationsTable(appState.donations)}<div class="panel-card" style="margin-top:16px;padding:20px"><div class="panel-heading compact"><div><div class="section-kicker">Live shipments</div><h2>Current allocation state</h2></div></div>${rows.length ? `<div class="data-table-card" style="margin-top:13px"><table class="data-table"><thead><tr><th>Shipment</th><th>Rider</th><th>Center</th><th>Status</th><th>ETA</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${formatNumber(row.quantity)} ${escapeHTML(row.unit)}</strong><br /><span>${escapeHTML(row.donation.donorName)}</span></td><td>${escapeHTML(row.rider.name || 'Open')}</td><td>${escapeHTML(row.center.name || '—')}</td><td><span class="status-text ${row.status === 'delivered' ? 'good' : row.status === 'offered' ? 'warn' : 'info'}">${escapeHTML(row.status.replaceAll('_', ' '))}</span></td><td>${formatTime(row.etaAt)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-panel" style="margin-top:13px">No shipments yet.</div>'}</div>`;
}

function donationsTable(donations, mine = false) {
  if (!donations.length) return '<div class="empty-panel"><strong>No donations yet</strong>Post your first surplus batch and it will appear here for the network.</div>';
  return `<div class="data-table-card panel-card"><table class="data-table"><thead><tr><th>Donation</th><th>Quantity</th><th>Safe until</th><th>Available</th><th>Status</th><th></th></tr></thead><tbody>${donations.map((donation) => `<tr><td><strong>${escapeHTML(donation.title)}</strong><br /><span>${escapeHTML(donation.category)} · ${escapeHTML(donation.pickupLocation.name)}</span></td><td>${formatNumber(donation.originalQuantity)} ${escapeHTML(donation.unit)}</td><td>${formatTime(donation.safeUntil)}</td><td>${formatNumber(donation.availableQuantity)}</td><td><span class="status-text ${donation.availableQuantity ? 'good' : 'info'}">${escapeHTML(donation.status.replaceAll('_', ' '))}</span></td><td><div class="table-actions"><button class="table-action" data-action="donation-open" data-id="${donation.id}">Details</button>${appState.user.role === 'admin' && donation.availableQuantity > 0 ? `<button class="table-action" data-action="auto-match" data-id="${donation.id}">Auto-match</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>`;
}

function riderDispatch(rows) {
  const riderRows = rows.filter((row) => activePage === 'dispatch' ? true : (row.rider.id === appState.user.entityId || row.status !== 'offered'));
  if (!riderRows.length) return '<div class="empty-panel"><strong>No active assignments</strong>New safe offers will appear here in real time.</div>';
  return `<div class="data-table-card panel-card"><table class="data-table"><thead><tr><th>Shipment</th><th>Route</th><th>State</th><th>Deadline</th><th>Action</th></tr></thead><tbody>${riderRows.map((row) => `<tr><td><strong>${formatNumber(row.quantity)} ${escapeHTML(row.unit)}</strong><br /><span>${escapeHTML(row.donation.category)} · ${escapeHTML(row.donation.donorName)}</span></td><td>${escapeHTML(row.donation.pickupLocation.name)} → ${escapeHTML(row.center.name)}</td><td><span class="status-text ${row.status === 'offered' ? 'warn' : row.status === 'delivered' ? 'good' : 'info'}">${escapeHTML(row.status.replaceAll('_', ' '))}</span></td><td>${row.minutes} min</td><td><div class="table-actions">${riderActionButtons(row)}</div></td></tr>`).join('')}</tbody></table></div>`;
}

function shelterDispatch(rows) {
  const incoming = rows.filter((row) => row.center.id === appState.user.entityId);
  return incoming.length ? `<div class="data-table-card panel-card"><table class="data-table"><thead><tr><th>Shipment</th><th>Rider</th><th>ETA</th><th>State</th><th>Action</th></tr></thead><tbody>${incoming.map((row) => `<tr><td><strong>${formatNumber(row.quantity)} ${escapeHTML(row.unit)}</strong><br /><span>${escapeHTML(row.donation.category)} · ${escapeHTML(row.donation.donorName)}</span></td><td>${escapeHTML(row.rider.name)}</td><td>${formatTime(row.etaAt)}</td><td><span class="status-text ${row.status === 'delivered' ? 'good' : 'info'}">${escapeHTML(row.status.replaceAll('_', ' '))}</span></td><td>${row.status !== 'delivered' ? `<button class="table-action" data-action="shipment-action" data-id="${row.id}" data-value="delivered">Confirm receipt</button>` : '<span class="status-text good">Received</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-panel"><strong>No incoming shipments</strong>When a safe allocation is made to your center, it will appear here.</div>';
}

function riderActionButtons(row) {
  if (row.status === 'offered') return `<button class="table-action" data-action="shipment-action" data-id="${row.id}" data-value="accept">Accept</button><button class="table-action" data-action="shipment-action" data-id="${row.id}" data-value="reject">Reject</button>`;
  if (row.status === 'reserved') return `<button class="table-action" data-action="shipment-action" data-id="${row.id}" data-value="pickup-arrived">Arrived</button>`;
  if (row.status === 'pickup_confirmed') return `<button class="table-action" data-action="shipment-action" data-id="${row.id}" data-value="picked-up">Picked up</button>`;
  if (row.status === 'picked_up') return `<button class="table-action" data-action="shipment-action" data-id="${row.id}" data-value="in-transit">Start trip</button>`;
  if (['in_transit', 'delayed'].includes(row.status)) return `<button class="table-action" data-action="shipment-action" data-id="${row.id}" data-value="report-delay">Report delay</button>`;
  return '<span class="status-text good">Complete</span>';
}

function sheltersView() {
  const centers = appState.centers;
  return `<div class="page-toolbar"><div><div class="section-kicker">Receiving network</div><h2>Centers and demand</h2><p>Keep capacity, dependencies, and receiving status truthful.</p></div></div><div class="detail-grid">${centers.map((center) => `<article class="detail-card"><div class="panel-heading compact"><div><div class="section-kicker">${escapeHTML(center.type)}</div><h3>${escapeHTML(center.name)}</h3></div><span class="status-pill ${center.isOpen ? 'ready' : 'action'}">${center.isOpen ? 'Open' : 'Closed'}</span></div><div class="detail-row"><span>Capacity</span><strong>${center.occupancy} / ${center.capacity}</strong></div><div class="detail-row"><span>Water / fuel</span><strong>${center.water ? 'Water ready' : 'No water'} · ${center.fuel ? 'Fuel ready' : 'No fuel'}</strong></div><div class="detail-row"><span>Receiving hours</span><strong>${escapeHTML(center.receivingHours)}</strong></div><div class="action-stack"><button class="small-button secondary" data-action="center-toggle" data-id="${center.id}" data-value="${center.isOpen ? 'close' : 'open'}">${center.isOpen ? 'Close center' : 'Reopen center'}</button>${appState.user.role === 'shelter' || appState.user.role === 'admin' ? `<button class="small-button primary" data-action="center-demand" data-id="${center.id}">Update demand</button>` : ''}</div></article>`).join('')}</div><div class="panel-card" style="margin-top:16px;padding:20px"><div class="panel-heading compact"><div><div class="section-kicker">Demand lines</div><h2>Open need by item type</h2></div></div>${demandsTable(appState.demands)}</div>`;
}

function demandsTable(demands) {
  return `<div class="data-table-card" style="margin-top:13px"><table class="data-table"><thead><tr><th>Center</th><th>Category</th><th>Need</th><th>Priority</th><th>Last updated</th></tr></thead><tbody>${demands.map((demand) => `<tr><td>${escapeHTML(appState.centers.find((center) => center.id === demand.centerId)?.name || '—')}</td><td><strong>${escapeHTML(demand.category)}</strong></td><td>${formatNumber(demand.quantity)} ${escapeHTML(demand.unit)}</td><td><span class="status-text ${demand.priority === 'urgent' ? 'warn' : 'info'}">${escapeHTML(demand.priority)}</span></td><td>${formatTime(demand.updatedAt)}</td></tr>`).join('')}</tbody></table></div>`;
}

function ridersView() {
  return `<div class="page-toolbar"><div><div class="section-kicker">Volunteer network</div><h2>Riders and live availability</h2><p>Use capacity and last-seen data to make safe dispatch decisions.</p></div></div><div class="data-table-card panel-card"><table class="data-table"><thead><tr><th>Rider</th><th>Vehicle</th><th>Capacity</th><th>Availability</th><th>Reliability</th><th>Last seen</th></tr></thead><tbody>${appState.riders.map((rider) => `<tr><td><strong>${escapeHTML(rider.name)}</strong><br /><span>${escapeHTML(rider.phone)}</span></td><td>${escapeHTML(rider.vehicle)}</td><td>${rider.capacity - rider.capacityReserved} / ${rider.capacity}</td><td><span class="status-text ${rider.availability === 'available' ? 'good' : 'info'}">${escapeHTML(rider.availability.replaceAll('_', ' '))}</span></td><td>${Math.round(rider.reliability * 100)}%</td><td>${formatTime(rider.lastSeenAt)}</td></tr>`).join('')}</tbody></table></div>`;
}

function impactView() {
  const m = appState.metrics;
  return `<div class="page-toolbar"><div><div class="section-kicker">Measured from live records</div><h2>Impact, not vanity numbers</h2><p>Every metric below is calculated from the current database-backed state.</p></div></div><div class="stat-grid"><div class="stat-tile"><span>Active shipments</span><strong>${m.activeShipments}</strong></div><div class="stat-tile"><span>Units rescued</span><strong>${formatNumber(m.unitsDelivered)}</strong></div><div class="stat-tile"><span>On-time delivery</span><strong>${m.onTimeRate}%</strong></div><div class="stat-tile"><span>Units wasted</span><strong>${formatNumber(m.unitsWasted)}</strong></div></div><div class="detail-grid"><article class="detail-card"><h3>Network health</h3><div class="detail-row"><span>Open demand</span><strong>${formatNumber(m.openDemand)} units</strong></div><div class="detail-row"><span>Available inventory</span><strong>${formatNumber(m.availableUnits)} units</strong></div><div class="detail-row"><span>Donations logged</span><strong>${m.totalDonations}</strong></div><div class="detail-row"><span>Attention queue</span><strong>${m.needsAttention}</strong></div></article><article class="detail-card"><h3>How to read this</h3><p style="color:#87938a;font-size:11px;line-height:1.6;margin:0">Seeded historical records are marked in the database with <strong>seeded: true</strong>. New records created from any signed-in role are stored in the same shared server data file and are broadcast to connected sessions.</p></article></div>`;
}

function activityView() {
  return `<div class="page-toolbar"><div><div class="section-kicker">Auditable coordination</div><h2>Activity and audit log</h2><p>Important allocations, state changes, releases, and delivery confirmations are recorded.</p></div></div><div class="log-list">${appState.events.map((event) => `<div class="log-item"><div class="log-icon">✦</div><div class="log-copy"><strong>${escapeHTML(event.message)}</strong><span>${escapeHTML(event.type)} · actor ${escapeHTML(event.actorId || 'system')}</span><time>${new Date(event.createdAt).toLocaleString()}</time></div></div>`).join('')}</div>`;
}

function scenarioView() {
  return `<div class="page-toolbar"><div><div class="section-kicker">Administrator tools</div><h2>Scenario Lab</h2><p>Run deterministic, database-backed failure cases for the hackathon demo.</p></div><button class="small-button danger" data-action="scenario" data-value="reset">Reset demo data</button></div><div class="notice-card"><span class="notice-icon">◈</span><span>Every control below changes the shared server state, activity log, dispatch board, and metrics. Open another browser to observe the update in real time.</span></div><div class="sim-lab">${[['urgent','Create urgent donation','Create a 180-meal batch with a 35-minute safe-use deadline.'],['split','Split a large batch','Allocate the urgent batch across multiple riders and eligible centers.'],['no-show','Simulate rider no-show','Expire an offered reservation and return its quantity to the open pool.'],['advance-time','Advance simulation clock','Move the server simulation clock forward by ten minutes.'],['closure','Close Shelter A mid-route','Close a destination and reassess unpicked or in-transit shipments.'],['demand-reduction','Reduce shelter demand','Reduce current demand and release affected unpicked work.'],['delay','Simulate route delay','Add a delay to an active shipment and update its ETA.'],['movement','Simulate rider movement','Move a demo rider on the Leaflet map.']].map(([key,title,description]) => `<div class="scenario-control"><div><strong>${title}</strong><span>${description}</span></div><button class="small-button primary" data-action="scenario" data-value="${key}">Run</button></div>`).join('')}</div>`;
}

function mapView() {
  return `<div class="page-toolbar"><div><div class="section-kicker">Simulated Pune / Alandi network</div><h2>Live operations map</h2><p>Seeded coordinates are fictional demo data. Simulated movement is explicitly labelled.</p></div><div class="toolbar-actions"><button class="small-button secondary" data-action="scenario" data-value="movement">Simulate rider movement</button></div></div><div class="map-card"><div class="map-container" id="workspace-map"></div><div class="map-legend"><span class="legend-item"><i class="legend-dot green"></i>Open center</span><span class="legend-item"><i class="legend-dot orange"></i>Attention</span><span class="legend-item"><i class="legend-dot blue"></i>Active rider</span><span>Demo coordinates · OSM attribution</span></div></div>`;
}

function renderMap(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!window.L) {
    container.innerHTML = '<div class="map-fallback">Leaflet could not load. The rest of the workspace remains available; check network access for the OpenStreetMap map tiles.</div>';
    return;
  }
  if (activeLeafletMap) {
    try {
      activeLeafletMap.remove();
    } catch {}
    activeLeafletMap = null;
  }
  if (container._leaflet_id) {
    container._leaflet_id = null;
  }
  container.innerHTML = '';
  const map = L.map(container).setView([18.588, 73.899], 13);
  activeLeafletMap = map;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
  const bounds = [];
  appState.centers.forEach((center) => {
    const marker = L.circleMarker([center.lat, center.lng], {
      radius: 8,
      color: center.isOpen ? '#5c9d50' : '#b8684f',
      fillColor: center.isOpen ? '#90c96b' : '#e58f72',
      fillOpacity: 0.9
    }).addTo(map);
    marker.bindPopup(`<strong>${escapeHTML(center.name)}</strong><br />${center.isOpen ? 'Open' : 'Closed'} · ${center.occupancy}/${center.capacity} occupied`);
    bounds.push([center.lat, center.lng]);
  });
  appState.riders.forEach((rider) => {
    const marker = L.circleMarker([rider.lat, rider.lng], {
      radius: 6,
      color: '#4c8f96',
      fillColor: '#85c1c2',
      fillOpacity: 0.95
    }).addTo(map);
    marker.bindPopup(`<strong>${escapeHTML(rider.name)}</strong><br />${escapeHTML(rider.availability)} · ${escapeHTML(rider.vehicle)}<br /><em>Simulated demo location</em>`);
    bounds.push([rider.lat, rider.lng]);
  });
  appState.donations.forEach((donation) => {
    if (donation.pickupLocation?.lat && donation.pickupLocation?.lng) {
      const marker = L.marker([donation.pickupLocation.lat, donation.pickupLocation.lng]).addTo(map);
      marker.bindPopup(`<strong>${escapeHTML(donation.title)}</strong><br />${formatNumber(donation.availableQuantity)} available · safe until ${formatTime(donation.safeUntil)}`);
      bounds.push([donation.pickupLocation.lat, donation.pickupLocation.lng]);
    }
  });
  if (bounds.length) map.fitBounds(bounds, { padding: [20, 20] });
}

function bindDynamicPage() {
  $$('.data-action').forEach((item) => item.addEventListener('click', () => handleAction(item.dataset.action, item.dataset.id, item.dataset.value)));
  if (activePage === 'donations') $('#add-batch')?.addEventListener('click', openDonationModal);
}

async function handleAction(action, entityId, value) {
  if (action === 'refresh') return refreshState();
  if (action === 'auto-match') {
    const result = await api('/api/admin/allocate-best', { method: 'POST', body: JSON.stringify({ donationId: entityId }) });
    if (result) {
      appState = result.state;
      renderCurrentPage();
      showToast(result.message || `Created ${result.created.length} safe offer(s)`);
    }
    return;
  }
  if (action === 'open-donation') return openDonationModal();
  if (action === 'scenario') return handleScenario(value);
  if (action === 'shipment-action') {
    const payload = value === 'report-delay' ? { delayMinutes: 15 } : {};
    const result = await api(`/api/shipments/${entityId}/${value}`, { method: 'POST', body: JSON.stringify(payload) });
    if (result) {
      appState = result.state;
      renderCurrentPage();
      showToast(`Shipment ${value.replaceAll('-', ' ')} updated`);
    }
    return;
  }
  if (action === 'center-toggle') {
    const result = await api(`/api/centers/${entityId}/status`, { method: 'POST', body: JSON.stringify({ isOpen: value === 'open' }) });
    if (result) {
      appState = result.state;
      renderCurrentPage();
      showToast(`Receiving center ${value === 'open' ? 'reopened' : 'closed'}`);
    }
    return;
  }
  if (action === 'center-demand') {
    const demand = appState.demands.find((item) => item.centerId === entityId);
    const next = window.prompt(`Update ${demand?.category || 'demand'} quantity`, String(demand?.quantity ?? 0));
    if (next === null) return;
    const result = await api(`/api/centers/${entityId}/demand`, { method: 'POST', body: JSON.stringify({ demandId: demand.id, quantity: Number(next) }) });
    if (result) {
      appState = result.state;
      renderCurrentPage();
      showToast('Demand updated and affected allocations reassessed');
    }
    return;
  }
  if (action === 'shipment-open' || action === 'shipment-ping') {
    setPage('dispatch');
    showToast('Shipment details are available in the dispatch queue');
    return;
  }
  if (action === 'donation-open') return showToast('Donation details are visible in the dispatch queue and audit log');
}

async function handleScenario(scenario) {
  const result = await api('/api/admin/scenario', { method: 'POST', body: JSON.stringify({ scenario }) });
  if (result) {
    appState = result.state || appState;
    renderCurrentPage();
    showToast(result.message || 'Scenario completed');
  }
}

function openDonationModal() {
  const existing = $('#batch-modal');
  if (!existing) return showToast('Donation form unavailable on this page', true);
  if (appState?.user?.role === 'donor') {
    const donorInput = $('#batch-donor');
    if (donorInput) donorInput.value = appState.user.name;
  }
  existing.classList.add('open');
  existing.setAttribute('aria-hidden', 'false');
  $('#batch-title')?.focus();
}

async function submitDonation(event) {
  event.preventDefault();
  const title = $('#batch-title')?.value || `${$('#batch-type').value} donation`;
  const category = $('#batch-type').value;
  const quantity = Number($('#batch-quantity').value);
  const unit = $('#batch-unit')?.value || ($('#batch-type').value === 'Cooked meals' ? 'meals' : 'units');
  const safeMinutes = Number($('#batch-expiry').value);
  const pickupName = $('#batch-donor').value;
  const pickupAddress = $('#batch-address')?.value || 'Pune / Alandi demo location';
  const pickupWindow = $('#batch-window').value;
  const storage = $('#batch-storage')?.value || 'Standard';
  const handling = $('#batch-handling').value;
  const notes = $('#batch-notes')?.value || '';

  const result = await api('/api/donations', {
    method: 'POST',
    body: JSON.stringify({
      title,
      category,
      quantity,
      unit,
      safeMinutes,
      pickupName,
      pickupAddress,
      pickupWindow,
      storage,
      handling,
      notes
    })
  });

  if (result) {
    closeDonationModal();
    appState = result.state;
    renderCurrentPage();
    showToast('Donation saved to the shared dispatch network');
  }
}

function closeDonationModal() {
  $('#batch-modal')?.classList.remove('open');
  $('#batch-modal')?.setAttribute('aria-hidden', 'true');
}

function showToast(message, error = false) {
  const toast = $('#toast');
  if (!toast) return;
  $('#toast-message').textContent = message;
  toast.classList.toggle('error', error);
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}
