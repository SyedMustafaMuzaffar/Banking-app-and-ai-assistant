const API = '/api';

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...(options.body && typeof options.body === 'object' && !(options.body instanceof FormData)
      ? { body: JSON.stringify(options.body) }
      : {}),
  });
  const data = res.ok ? await res.json().catch(() => ({})) : await res.json().catch(() => ({ error: 'Request failed' }));
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

// --- DOM ---
const landing = document.getElementById('landing');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');
const userInfo = document.getElementById('user-info');
const logoutBtn = document.getElementById('logout-btn');
const fetchBalanceBtn = document.getElementById('fetch-balance-btn');
const balanceResult = document.getElementById('balance-result');
const sendMoneyForm = document.getElementById('send-money-form');
const sendError = document.getElementById('send-error');
const sendResult = document.getElementById('send-result');

const depositForm = document.getElementById('deposit-form');
const depositError = document.getElementById('deposit-error');
const depositResult = document.getElementById('deposit-result');

const withdrawForm = document.getElementById('withdraw-form');
const withdrawError = document.getElementById('withdraw-error');
const withdrawResult = document.getElementById('withdraw-result');

const transactionsTableBody = document.querySelector('#transactions-table tbody');
const refreshTransactionsBtn = document.getElementById('refresh-transactions-btn');

// --- Auth tabs ---
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const isLogin = tab.dataset.tab === 'login';
    loginForm.classList.toggle('hidden', !isLogin);
    registerForm.classList.toggle('hidden', isLogin);
    loginError.textContent = '';
    registerError.textContent = '';
  });
});

// --- Login ---
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const email = loginForm.email.value.trim();
  const password = loginForm.password.value;
  try {
    await api('/login', { method: 'POST', body: { email, password } });
    await showDashboard();
  } catch (err) {
    loginError.textContent = err.error || 'Login failed';
  }
});

// --- Register ---
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  registerError.textContent = '';
  const fullName = registerForm.fullName.value.trim();
  const email = registerForm.email.value.trim();
  const password = registerForm.password.value;
  try {
    await api('/register', { method: 'POST', body: { fullName, email, password } });
    registerForm.reset();
    document.querySelector('.tab[data-tab="login"]').click();
    registerError.textContent = '';
    loginError.textContent = 'Registration successful. You can log in now.';
  } catch (err) {
    registerError.textContent = err.error || 'Registration failed';
  }
});

// --- Dashboard visibility ---
async function showDashboard() {
  let me;
  try {
    me = await api('/me');
  } catch {
    landing.classList.remove('hidden');
    dashboard.classList.add('hidden');
    return;
  }
  userInfo.textContent = `${me.fullName} (${me.email})`;
  landing.classList.add('hidden');
  dashboard.classList.remove('hidden');
  balanceResult.textContent = '';
  balanceResult.classList.remove('visible', 'success');
  sendResult.textContent = '';
  sendError.textContent = '';
  if (window.BankBuddy) window.BankBuddy.show();
}

// --- Nav pages ---
document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const page = btn.dataset.page;
    document.querySelectorAll('.page').forEach((p) => p.classList.add('hidden'));
    document.getElementById(`page-${page}`).classList.remove('hidden');

    if (page === 'transactions') {
      fetchTransactions();
    }
  });
});

// --- Check balance (sends cookie automatically via credentials: 'include') ---
fetchBalanceBtn.addEventListener('click', async () => {
  balanceResult.textContent = 'Loading…';
  balanceResult.classList.remove('visible', 'success');
  try {
    const data = await api('/balance');
    balanceResult.textContent = `Balance: $${Number(data.balance).toFixed(2)}`;
    balanceResult.classList.add('visible', 'success');
  } catch (err) {
    balanceResult.textContent = err.error || 'Failed to load balance';
    balanceResult.classList.remove('success');
  }
});

// --- Deposit ---
depositForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  depositError.textContent = '';
  depositResult.textContent = '';
  const amount = parseFloat(depositForm.amount.value);
  try {
    const data = await api('/deposit', {
      method: 'POST',
      body: { amount },
    });
    depositResult.textContent = `${data.message}. New balance: $${Number(data.balance).toFixed(2)}`;
    depositResult.classList.add('success');
    depositForm.reset();
  } catch (err) {
    depositError.textContent = err.error || 'Deposit failed';
  }
});

// --- Withdraw ---
withdrawForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  withdrawError.textContent = '';
  withdrawResult.textContent = '';
  const amount = parseFloat(withdrawForm.amount.value);
  try {
    const data = await api('/withdraw', {
      method: 'POST',
      body: { amount },
    });
    withdrawResult.textContent = `${data.message}. New balance: $${Number(data.balance).toFixed(2)}`;
    withdrawResult.classList.add('success');
    withdrawForm.reset();
  } catch (err) {
    withdrawError.textContent = err.error || 'Withdrawal failed';
  }
});

// --- Send money ---
sendMoneyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  sendError.textContent = '';
  sendResult.textContent = '';
  const toEmail = sendMoneyForm.toEmail.value.trim();
  const amount = parseFloat(sendMoneyForm.amount.value);
  try {
    const data = await api('/send-money', {
      method: 'POST',
      body: { toEmail, amount },
    });
    sendResult.textContent = data.message + (data.balance != null ? ` New balance: $${Number(data.balance).toFixed(2)}` : '');
    sendResult.classList.add('success');
    sendMoneyForm.reset();
  } catch (err) {
    sendError.textContent = err.error || 'Transfer failed';
  }
});

// --- Transactions ---
async function fetchTransactions() {
  transactionsTableBody.innerHTML = '<tr><td colspan="4">Loading history...</td></tr>';
  try {
    const transactions = await api('/transactions');
    renderTransactions(transactions);
  } catch (err) {
    transactionsTableBody.innerHTML = `<tr><td colspan="4" class="error">${err.error || 'Failed to load history'}</td></tr>`;
  }
}

function renderTransactions(transactions) {
  if (transactions.length === 0) {
    transactionsTableBody.innerHTML = '<tr><td colspan="4">No transactions yet</td></tr>';
    return;
  }
  transactionsTableBody.innerHTML = transactions
    .map((tx) => {
      const date = new Date(tx.created_at).toLocaleString();
      const amountClass = (tx.type === 'deposit' || tx.type === 'received') ? 'txt-success' : 'txt-error';
      const prefix = (tx.type === 'deposit' || tx.type === 'received') ? '+' : '-';
      return `
      <tr>
        <td><span class="badge badge-${tx.type}">${tx.type}</span></td>
        <td class="${amountClass}">${prefix}$${Number(tx.amount).toFixed(2)}</td>
        <td>${tx.other_party || '-'}</td>
        <td class="txt-muted">${date}</td>
      </tr>
    `;
    })
    .join('');
}

refreshTransactionsBtn.addEventListener('click', fetchTransactions);

// --- Logout ---
logoutBtn.addEventListener('click', async () => {
  try {
    await api('/logout', { method: 'POST' });
  } catch (_) { }
  landing.classList.remove('hidden');
  dashboard.classList.add('hidden');
  loginForm.reset();
  loginError.textContent = '';
  if (window.BankBuddy) window.BankBuddy.hide();
});

// --- Initial: if already logged in, show dashboard ---
(async function init() {
  if (getCookie('bank_token')) {
    try {
      await api('/me');
      await showDashboard();
    } catch {
      // invalid token, stay on landing
    }
  }
})();
