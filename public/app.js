const API = '/api';

// --- Utils ---
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  let data;
  try {
    data = await res.json();
  } catch (e) {
    const text = await res.text().catch(() => 'Request failed');
    data = { error: text.length > 50 ? text.slice(0, 50) + '...' : text };
  }
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

// --- Toast System ---
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : '✕'}</span>
    <span class="toast-msg">${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// --- DOM Elements ---
const landing = document.getElementById('landing');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const userInfo = document.getElementById('user-info');
const logoutBtn = document.getElementById('logout-btn');

// Dashboard Elements
const overviewBalance = document.getElementById('overview-balance');
const statIncome = document.getElementById('stat-income');
const statExpense = document.getElementById('stat-expense');
const transactionsTableBody = document.querySelector('#transactions-table tbody');
const settingsFullname = document.getElementById('settings-fullname');

// Forms
const sendMoneyForm = document.getElementById('send-money-form');
const depositForm = document.getElementById('deposit-form');
const withdrawForm = document.getElementById('withdraw-form');
const profileForm = document.getElementById('profile-form');

// --- Chart State ---
let spendingChart = null;

function initChart(data) {
  const ctx = document.getElementById('spending-chart').getContext('2d');
  if (spendingChart) spendingChart.destroy();

  const labels = data.map(d => d.date);
  const values = data.map(d => d.amount);

  spendingChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Spending ($)',
        data: values,
        borderColor: '#7eb8da',
        backgroundColor: 'rgba(126, 184, 218, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#7eb8da',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          bottom: 10,
          left: 10,
          right: 20,
          top: 10
        }
      },
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#a0a0b0' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a0a0b0' } }
      }
    }
  });
}

// --- Data Fetching ---
async function refreshDashboard() {
  try {
    const [me, balanceData, stats, transactions] = await Promise.all([
      api('/me'),
      api('/balance'),
      api('/stats'),
      api('/transactions')
    ]);

    // Update Header & Settings
    userInfo.textContent = `Welcome back, ${me.fullName} • ${me.email}`;
    settingsFullname.value = me.fullName;

    // Update Stats
    overviewBalance.textContent = `$${Number(balanceData.balance).toFixed(2)}`;
    statIncome.textContent = `+$${Number(stats.income).toFixed(2)}`;
    statExpense.textContent = `-$${Number(stats.expense).toFixed(2)}`;

    // Update Table
    renderTransactions(transactions);

    // Update Chart (Processing last 7 spending items)
    const spendingData = transactions
      .filter(tx => tx.type === 'withdraw' || tx.type === 'sent')
      .slice(0, 7)
      .reverse()
      .map(tx => ({
        date: new Date(tx.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        amount: Number(tx.amount)
      }));
    initChart(spendingData);

  } catch (err) {
    console.error('Refresh Error:', err);
    if (err.status === 401) logout();
  }
}

function renderTransactions(transactions) {
  if (!transactionsTableBody) return;
  if (transactions.length === 0) {
    transactionsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; opacity:0.5;">No transactions found</td></tr>';
    return;
  }
  transactionsTableBody.innerHTML = transactions
    .map((tx) => {
      const date = new Date(tx.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const isPositive = (tx.type === 'deposit' || tx.type === 'received');
      return `
      <tr>
        <td><span class="badge badge-${tx.type}">${tx.type}</span></td>
        <td class="${isPositive ? 'txt-success' : 'txt-error'}">${isPositive ? '+' : '-'}$${Number(tx.amount).toFixed(2)}</td>
        <td>${tx.other_party || '-'}</td>
        <td class="txt-muted">${date}</td>
      </tr>
    `;
    })
    .join('');
}

// --- Event Handlers ---

// Tabs
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const isLogin = tab.dataset.tab === 'login';
    loginForm.classList.toggle('hidden', !isLogin);
    registerForm.classList.toggle('hidden', isLogin);
  });
});

// Navigation
document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const page = btn.dataset.page;
    document.querySelectorAll('.page').forEach((p) => p.classList.add('hidden'));
    document.getElementById(`page-${page}`).classList.remove('hidden');
    refreshDashboard();
  });
});

// Auth
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/login', { method: 'POST', body: { email: loginForm.email.value, password: loginForm.password.value } });
    showDashboard();
    showToast('Login successful');
  } catch (err) {
    showToast(err.error || 'Login failed', 'error');
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/register', {
      method: 'POST', body: {
        fullName: registerForm.fullName.value,
        email: registerForm.email.value,
        password: registerForm.password.value
      }
    });
    showToast('Registration successful! Please log in.');
    document.querySelector('.tab[data-tab="login"]').click();
  } catch (err) {
    showToast(err.error || 'Registration failed', 'error');
  }
});

// Operations
depositForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/deposit', { method: 'POST', body: { amount: parseFloat(depositForm.amount.value) } });
    showToast('Funds deposited successfully');
    depositForm.reset();
    refreshDashboard();
  } catch (err) {
    showToast(err.error || 'Deposit failed', 'error');
  }
});

withdrawForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/withdraw', { method: 'POST', body: { amount: parseFloat(withdrawForm.amount.value) } });
    showToast('Funds withdrawn successfully');
    withdrawForm.reset();
    refreshDashboard();
  } catch (err) {
    showToast(err.error || 'Withdrawal failed', 'error');
  }
});

sendMoneyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/send-money', {
      method: 'POST', body: {
        toEmail: sendMoneyForm.toEmail.value,
        amount: parseFloat(sendMoneyForm.amount.value)
      }
    });
    showToast('Transfer completed successfully');
    sendMoneyForm.reset();
    refreshDashboard();
  } catch (err) {
    showToast(err.error || 'Transfer failed', 'error');
  }
});

// Profile Update
profileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/profile/update', { method: 'POST', body: { fullName: settingsFullname.value } });
    showToast('Profile updated');
    refreshDashboard();
  } catch (err) {
    showToast(err.error || 'Update failed', 'error');
  }
});

// Logout
function logout() {
  api('/logout', { method: 'POST' }).catch(() => { });
  landing.classList.remove('hidden');
  dashboard.classList.add('hidden');
  if (window.IndianBankAI) window.IndianBankAI.hide();
}
logoutBtn.addEventListener('click', logout);

// Visibility Control
async function showDashboard() {
  landing.classList.add('hidden');
  dashboard.classList.remove('hidden');
  await refreshDashboard();
  if (window.IndianBankAI) window.IndianBankAI.show();
}

// Initializer
(async function init() {
  if (getCookie('bank_token')) {
    try {
      await api('/me');
      showDashboard();
    } catch { }
  }
})();
