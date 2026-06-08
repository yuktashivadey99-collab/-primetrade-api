// ════════════════════════════════════════════════════════════════
//  PrimeTrade API – Frontend App
// ════════════════════════════════════════════════════════════════
const API = '';  // same-origin; change to http://localhost:5000 if serving separately

let currentUser = null;
let currentToken = null;
let editingTaskId = null;
let currentPage = 1;
let debounceTimer = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
(function init() {
  const saved = localStorage.getItem('pt_token');
  if (saved) {
    currentToken = saved;
    fetchMe().catch(() => { localStorage.removeItem('pt_token'); showAuth(); });
  } else {
    showAuth();
  }
})();

// ─── Auth Helpers ─────────────────────────────────────────────────────────────
function showAuth() { document.getElementById('auth-screen').className = 'screen active'; document.getElementById('dashboard-screen').className = 'screen hidden'; }
function showDashboard() { document.getElementById('auth-screen').className = 'screen hidden'; document.getElementById('dashboard-screen').className = 'screen active'; }

function switchTab(tab) {
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  setLoading(btn, true);
  clearAlert('login-error');

  try {
    const res = await apiFetch('/api/v1/auth/login', 'POST', {
      email: document.getElementById('login-email').value,
      password: document.getElementById('login-password').value,
    });
    currentToken = res.data.token;
    currentUser = res.data.user;
    localStorage.setItem('pt_token', currentToken);
    bootstrapDashboard();
    showDashboard();
    toast('Welcome back, ' + currentUser.username + '!', 'success');
  } catch (err) {
    showAlert('login-error', err.message);
  } finally {
    setLoading(btn, false);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('reg-btn');
  setLoading(btn, true);
  clearAlert('reg-error'); clearAlert('reg-success');

  try {
    await apiFetch('/api/v1/auth/register', 'POST', {
      username: document.getElementById('reg-username').value,
      email: document.getElementById('reg-email').value,
      password: document.getElementById('reg-password').value,
    });
    showAlert('reg-success', '✅ Account created! Signing you in...');
    // Auto-login
    const res = await apiFetch('/api/v1/auth/login', 'POST', {
      email: document.getElementById('reg-email').value,
      password: document.getElementById('reg-password').value,
    });
    currentToken = res.data.token;
    currentUser = res.data.user;
    localStorage.setItem('pt_token', currentToken);
    bootstrapDashboard();
    showDashboard();
    toast('Account created successfully!', 'success');
  } catch (err) {
    showAlert('reg-error', err.message);
  } finally {
    setLoading(btn, false);
  }
}

async function fetchMe() {
  const res = await apiFetch('/api/v1/auth/me', 'GET');
  currentUser = res.data.user;
  bootstrapDashboard();
  showDashboard();
}

function logout() {
  localStorage.removeItem('pt_token');
  currentToken = null; currentUser = null;
  showAuth();
  toast('Logged out successfully', 'info');
}

// ─── Dashboard Bootstrap ──────────────────────────────────────────────────────
function bootstrapDashboard() {
  document.getElementById('sidebar-username').textContent = currentUser.username;
  const roleBadge = document.getElementById('sidebar-role');
  roleBadge.textContent = currentUser.role;
  roleBadge.className = 'role-badge ' + currentUser.role;
  document.getElementById('user-avatar-initials').textContent = currentUser.username[0].toUpperCase();

  const adminNav = document.getElementById('nav-admin');
  if (currentUser.role === 'admin') {
    adminNav.style.display = 'flex';
    document.getElementById('tasks-subtitle').textContent = 'All tasks across all users';
    loadAdminStats();
  } else {
    adminNav.style.display = 'none';
    document.getElementById('tasks-subtitle').textContent = 'Your personal task list';
  }
  fetchTasks();
}

// ─── Panel Navigation ─────────────────────────────────────────────────────────
function showPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  const navBtn = document.getElementById('nav-' + name);
  if (navBtn) navBtn.classList.add('active');
  if (name === 'admin') fetchUsers();
}

// ─── Tasks ────────────────────────────────────────────────────────────────────
async function fetchTasks(page = 1) {
  currentPage = page;
  const search = document.getElementById('search-tasks').value.trim();
  const status = document.getElementById('filter-status').value;
  const priority = document.getElementById('filter-priority').value;

  const params = new URLSearchParams({ page, limit: 12 });
  if (status) params.append('status', status);
  if (priority) params.append('priority', priority);
  if (search) params.append('search', search);

  showSkeletons();
  try {
    const res = await apiFetch(`/api/v1/tasks?${params}`, 'GET');
    renderTasks(res.data.tasks);
    renderPagination(res.data.pagination);
  } catch (err) {
    showAlert('tasks-global-msg', err.message, 'alert-error');
  }
}

function debouncedFetch() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => fetchTasks(), 350);
}

function showSkeletons() {
  const grid = document.getElementById('tasks-list');
  grid.innerHTML = Array(6).fill('<div class="skeleton skeleton-card"></div>').join('');
}

function renderTasks(tasks) {
  const grid = document.getElementById('tasks-list');
  if (!tasks.length) {
    grid.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
      <p>No tasks found</p>
      <span>Create your first task to get started</span>
    </div>`;
    return;
  }
  grid.innerHTML = tasks.map(t => `
    <div class="task-card priority-${t.priority}">
      <div class="task-top">
        <div class="task-title">${escHtml(t.title)}</div>
      </div>
      <div class="task-badges">
        <span class="badge badge-${t.status}">${t.status.replace('_', ' ')}</span>
        <span class="badge badge-${t.priority}">${t.priority}</span>
      </div>
      ${t.description ? `<div class="task-desc">${escHtml(t.description.substring(0, 100))}${t.description.length > 100 ? '...' : ''}</div>` : ''}
      <div class="task-meta">
        <span>${t.due_date ? '📅 ' + t.due_date : (t.owner ? '👤 ' + t.owner : '')}</span>
        <div class="task-actions">
          <button class="btn btn-ghost btn-sm" onclick="editTask('${t.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTask('${t.id}')">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

function renderPagination({ page, pages }) {
  const el = document.getElementById('tasks-pagination');
  if (pages <= 1) { el.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= pages; i++) {
    html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="fetchTasks(${i})">${i}</button>`;
  }
  el.innerHTML = html;
}

async function loadAdminStats() {
  try {
    const res = await apiFetch('/api/v1/tasks/stats', 'GET');
    const s = res.data.stats;
    document.getElementById('task-stats-row').style.display = 'grid';
    document.getElementById('stat-total').textContent = s.total;
    document.getElementById('stat-pending').textContent = s.pending;
    document.getElementById('stat-progress').textContent = s.in_progress;
    document.getElementById('stat-completed').textContent = s.completed;
  } catch (_) {}
}

// ─── Task Modal ───────────────────────────────────────────────────────────────
function openTaskModal(task = null) {
  editingTaskId = task ? task.id : null;
  document.getElementById('modal-title').textContent = task ? 'Edit Task' : 'New Task';
  document.getElementById('task-title').value = task?.title || '';
  document.getElementById('task-desc').value = task?.description || '';
  document.getElementById('task-status').value = task?.status || 'pending';
  document.getElementById('task-priority').value = task?.priority || 'medium';
  document.getElementById('task-due').value = task?.due_date || '';
  clearAlert('task-modal-error');
  document.getElementById('task-modal').classList.remove('hidden');
}

function closeTaskModal() { document.getElementById('task-modal').classList.add('hidden'); editingTaskId = null; }
function closeModalOnOverlay(e) { if (e.target === document.getElementById('task-modal')) closeTaskModal(); }

async function handleTaskSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('task-submit-btn');
  setLoading(btn, true);
  clearAlert('task-modal-error');

  const payload = {
    title: document.getElementById('task-title').value,
    description: document.getElementById('task-desc').value || undefined,
    status: document.getElementById('task-status').value,
    priority: document.getElementById('task-priority').value,
    due_date: document.getElementById('task-due').value || undefined,
  };

  try {
    if (editingTaskId) {
      await apiFetch(`/api/v1/tasks/${editingTaskId}`, 'PUT', payload);
      toast('Task updated!', 'success');
    } else {
      await apiFetch('/api/v1/tasks', 'POST', payload);
      toast('Task created!', 'success');
    }
    closeTaskModal();
    fetchTasks(currentPage);
    if (currentUser.role === 'admin') loadAdminStats();
  } catch (err) {
    showAlert('task-modal-error', err.message);
  } finally {
    setLoading(btn, false);
  }
}

async function editTask(id) {
  try {
    const res = await apiFetch(`/api/v1/tasks/${id}`, 'GET');
    openTaskModal(res.data.task);
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteTask(id) {
  if (!confirm('Are you sure you want to delete this task?')) return;
  try {
    await apiFetch(`/api/v1/tasks/${id}`, 'DELETE');
    toast('Task deleted', 'info');
    fetchTasks(currentPage);
    if (currentUser.role === 'admin') loadAdminStats();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ─── Users (Admin) ────────────────────────────────────────────────────────────
async function fetchUsers() {
  try {
    const res = await apiFetch('/api/v1/auth/users', 'GET');
    renderUsers(res.data.users);
  } catch (err) {
    showAlert('users-global-msg', err.message, 'alert-error');
  }
}

function renderUsers(users) {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = users.map(u => `
    <tr>
      <td><strong>${escHtml(u.username)}</strong></td>
      <td>${escHtml(u.email)}</td>
      <td><span class="role-badge ${u.role}">${u.role}</span></td>
      <td>${u.is_active ? '<span style="color:#10b981">Active</span>' : '<span style="color:#6b7280">Inactive</span>'}</td>
      <td>${u.created_at?.split('T')[0] || u.created_at?.split(' ')[0]}</td>
      <td>
        ${u.id !== currentUser.id ? `
          <button class="btn btn-ghost btn-sm" onclick="changeRole('${u.id}','${u.role === 'admin' ? 'user' : 'admin'}')">
            Make ${u.role === 'admin' ? 'User' : 'Admin'}
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}')">Delete</button>
        ` : '<span style="color:var(--text-muted);font-size:12px">You</span>'}
      </td>
    </tr>
  `).join('');
}

async function changeRole(id, newRole) {
  try {
    await apiFetch(`/api/v1/auth/users/${id}/role`, 'PATCH', { role: newRole });
    toast('Role updated!', 'success');
    fetchUsers();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteUser(id) {
  if (!confirm('Delete this user and all their tasks?')) return;
  try {
    await apiFetch(`/api/v1/auth/users/${id}`, 'DELETE');
    toast('User deleted', 'info');
    fetchUsers();
  } catch (err) { toast(err.message, 'error'); }
}

// ─── API Fetch Wrapper ────────────────────────────────────────────────────────
async function apiFetch(path, method, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (currentToken) headers['Authorization'] = 'Bearer ' + currentToken;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || 'Request failed');
  return data;
}

// ─── UI Utilities ─────────────────────────────────────────────────────────────
function setLoading(btn, on) {
  btn.querySelector('.btn-text').classList.toggle('hidden', on);
  btn.querySelector('.btn-loader').classList.toggle('hidden', !on);
  btn.disabled = on;
}

function showAlert(id, msg, cls = 'alert-error') {
  const el = document.getElementById(id);
  el.textContent = msg; el.className = `alert ${cls}`; el.classList.remove('hidden');
}
function clearAlert(id) { const el = document.getElementById(id); el.className = 'alert hidden'; el.textContent = ''; }

let toastTimer;
function toast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = 'toast hidden', 3200);
}

function escHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str || ''));
  return d.innerHTML;
}

// Keyboard: Escape closes modal
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTaskModal(); });
