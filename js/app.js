/**
 * Personal Budget Planner - Main Application Logic & Router
 * Implements all 5 blueprint screens, calculations, modals, and reactive state.
 */

import { storage } from './storage.js';
import { ChartRenderer } from './charts.js';

class BudgetApp {
  constructor() {
    this.currentRoute = 'dashboard';
    this.selectedMonth = '2026-10'; // Reference period from blueprint
    this.lastDeletedTx = null; // For Undo functionality

    // Filter states for Transactions page
    this.txFilter = {
      search: '',
      type: 'all',
      categoryId: 'all',
      sort: 'newest'
    };

    this.init();
  }

  init() {
    // Check initial settings
    const settings = storage.getSettings();
    if (settings.defaultMonth) {
      this.selectedMonth = settings.defaultMonth;
    }

    this.setupEventListeners();
    this.updateUserProfileHeader();
    this.updateMonthPickerDisplay();
    this.navigateTo(this.currentRoute);
  }

  updateUserProfileHeader() {
    const user = storage.getCurrentUser();
    const nameEl = document.getElementById('userProfileName');
    const emailEl = document.getElementById('userProfileEmail');
    const avatarEl = document.getElementById('userAvatarInitials');
    const chip = document.getElementById('userProfileChip');

    const dropdownName = document.getElementById('dropdownUserName');
    const dropdownEmail = document.getElementById('dropdownUserEmail');
    const accountsList = document.getElementById('dropdownAccountsList');

    const name = user.name || 'Mohamad Aarish';
    const email = user.email || 'mohamadaarish.m@budget.app';
    const initials = user.avatar || name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = email;
    if (avatarEl) avatarEl.textContent = initials;
    if (chip) chip.setAttribute('title', `${name} (${email}) - Click to switch`);

    if (dropdownName) dropdownName.textContent = name;
    if (dropdownEmail) dropdownUserEmail.textContent = email;

    // Render accounts list in dropdown
    if (accountsList) {
      const allUsers = storage.getUsers();
      accountsList.innerHTML = allUsers.map(u => {
        const isActive = u.id === user.id;
        return `
          <button class="dropdown-item ${isActive ? 'active-account' : ''} switch-account-btn" data-user-id="${u.id}">
            <div class="user-avatar" style="width: 24px; height: 24px; font-size: 10px;">${u.avatar || u.name[0]}</div>
            <span>${u.name}</span>
            ${isActive ? '<span style="margin-left: auto; font-size: 11px;">✓ Active</span>' : ''}
          </button>
        `;
      }).join('');

      accountsList.querySelectorAll('.switch-account-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetUserId = btn.getAttribute('data-user-id');
          if (targetUserId !== user.id) {
            const switchedUser = storage.setCurrentUser(targetUserId);
            const menu = document.getElementById('profileDropdownMenu');
            if (menu) menu.classList.remove('active');
            this.updateUserProfileHeader();
            this.renderCurrentPage();
            this.showToast(`Switched account to ${switchedUser.name}`, 'success');
          }
        });
      });
    }
  }

  // --- NAVIGATION & ROUTER ---
  setupEventListeners() {
    // Profile Dropdown Toggle
    const profileChip = document.getElementById('userProfileChip');
    const profileMenu = document.getElementById('profileDropdownMenu');
    if (profileChip && profileMenu) {
      profileChip.addEventListener('click', (e) => {
        e.stopPropagation();
        profileMenu.classList.toggle('active');
      });

      document.addEventListener('click', (e) => {
        if (!profileChip.contains(e.target) && !profileMenu.contains(e.target)) {
          profileMenu.classList.remove('active');
        }
      });
    }

    const addAccountBtn = document.getElementById('dropdownAddAccountBtn');
    if (addAccountBtn) {
      addAccountBtn.addEventListener('click', () => {
        if (profileMenu) profileMenu.classList.remove('active');
        this.openAuthModal('signup');
      });
    }

    const logoutBtn = document.getElementById('dropdownLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (profileMenu) profileMenu.classList.remove('active');
        this.openAuthModal('signin');
      });
    }

    const quickSalaryDropdownBtn = document.getElementById('dropdownQuickSalaryBtn');
    if (quickSalaryDropdownBtn) {
      quickSalaryDropdownBtn.addEventListener('click', () => {
        if (profileMenu) profileMenu.classList.remove('active');
        this.openSalaryModal();
      });
    }

    // Desktop Nav links
    document.querySelectorAll('.nav-link').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const route = btn.getAttribute('data-route');
        if (route) this.navigateTo(route);
      });
    });

    // Mobile Bottom Nav buttons
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const route = btn.getAttribute('data-route');
        if (route) this.navigateTo(route);
      });
    });

    // Global Month Picker
    const monthPicker = document.getElementById('globalMonthPicker');
    if (monthPicker) {
      monthPicker.value = this.selectedMonth;
      monthPicker.addEventListener('change', (e) => {
        this.selectedMonth = e.target.value || '2026-10';
        this.updateMonthPickerDisplay();
        this.renderCurrentPage();
      });
    }

    // Global Add Transaction Button
    const addBtn = document.getElementById('globalAddTxnBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openTransactionModal());
    }

    const mobileAddBtn = document.getElementById('mobileAddBtn');
    if (mobileAddBtn) {
      mobileAddBtn.addEventListener('click', () => this.openTransactionModal());
    }

    // Sidebar Target Adjust Button
    const adjustBudgetBtn = document.getElementById('sidebar-edit-target-btn');
    if (adjustBudgetBtn) {
      adjustBudgetBtn.addEventListener('click', () => this.openBudgetModal());
    }

    // Command Palette / Search Shortcut
    const searchBtn = document.getElementById('globalSearchBtn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => this.openQuickSearch());
    }

    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        this.openQuickSearch();
      }
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });

    // Setup Modal Forms
    this.setupTransactionModalHandlers();
    this.setupBudgetModalHandlers();
    this.setupCategoryLimitModalHandlers();
    this.setupDeleteModalHandlers();
    this.setupQuickSearchHandlers();
    this.setupAuthModalHandlers();
    this.setupSalaryModalHandlers();
    this.setupStartingBalanceModalHandlers();
  }

  navigateTo(route) {
    this.currentRoute = route;

    // Update active nav button states
    document.querySelectorAll('.nav-link').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-route') === route);
    });

    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-route') === route);
    });

    this.renderCurrentPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  renderCurrentPage() {
    const container = document.getElementById('pageContainer');
    if (!container) return;

    // Update sidebar transaction count
    const allTx = storage.getTransactions();
    const countBadge = document.getElementById('sidebar-tx-count');
    if (countBadge) countBadge.textContent = allTx.length;

    switch (this.currentRoute) {
      case 'dashboard':
        this.renderDashboard(container);
        break;
      case 'transactions':
        this.renderTransactionsPage(container);
        break;
      case 'budgets':
        this.renderBudgetsPage(container);
        break;
      case 'reports':
        this.renderReportsPage(container);
        break;
      case 'settings':
        this.renderSettingsPage(container);
        break;
      default:
        this.renderDashboard(container);
    }
  }

  updateMonthPickerDisplay() {
    const display = document.getElementById('currentMonthDisplay');
    const input = document.getElementById('globalMonthPicker');
    if (!display || !this.selectedMonth) return;

    const [year, month] = this.selectedMonth.split('-');
    const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const monthName = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    display.textContent = monthName;
    if (input) input.value = this.selectedMonth;

    // Also update sidebar promo text
    const promoSub = document.getElementById('sidebar-promo-sub');
    if (promoSub) {
      const summary = storage.getMonthSummary(this.selectedMonth);
      promoSub.textContent = `${monthName} progress is steady. ${summary.progressPercent}% of your plan utilized.`;
    }
  }

  // ==========================================================================
  // PAGE 1: DASHBOARD
  // ==========================================================================
  renderDashboard(container) {
    const summary = storage.getMonthSummary(this.selectedMonth);
    const [year, month] = this.selectedMonth.split('-');
    const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const monthName = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Sorted categories by spent
    const categories = storage.getCategories();
    const catSpentList = Object.entries(summary.categoryTotals).map(([catId, amountMinor]) => {
      const cat = storage.getCategoryById(catId);
      return {
        ...cat,
        amountMinor,
        percentOfTotal: summary.expensesMinor > 0 ? ((amountMinor / summary.expensesMinor) * 100).toFixed(1) : 0
      };
    }).sort((a, b) => b.amountMinor - a.amountMinor);

    // Latest 5 transactions
    const recentTxns = [...summary.transactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    // If completely empty first-use state
    const hasData = summary.transactions.length > 0;

    container.innerHTML = `
      <!-- Hero Header -->
      <section class="page-hero">
        <div>
          <h1 class="page-title">Good morning, ${storage.getSettings().userName || 'Mohamad Aarish'}</h1>
          <p class="page-subtitle">Here is how your money is tracking for ${monthName}.</p>
        </div>
        <div class="period-pill-badge">
          <span class="active-indicator"></span>
          <span>Period: ${monthName}</span>
        </div>
      </section>

      <!-- 5 Summary Cards (Row) -->
      <section class="summary-cards-row" aria-label="Monthly Totals">
        <!-- Monthly Budget -->
        <div class="summary-card">
          <div class="summary-card-header">
            <span class="summary-card-label">Monthly Budget</span>
            <span class="summary-card-badge badge-purple">Target</span>
          </div>
          <div class="summary-card-value">${storage.formatCurrency(summary.monthlyBudgetMinor)}</div>
          <div class="summary-card-hint">Set by you for ${monthName}</div>
        </div>

        <!-- Total Income -->
        <div class="summary-card">
          <div class="summary-card-header">
            <span class="summary-card-label">Income</span>
            <button class="income-edit-badge" id="dashEditSalaryBtn" title="Change or adjust monthly salary">
              ✏️ Edit Salary
            </button>
          </div>
          <div class="summary-card-value" style="color: var(--color-income);">${storage.formatCurrency(summary.incomeMinor)}</div>
          <div class="summary-card-hint">Salary + freelance (Click to edit)</div>
        </div>

        <!-- Total Expenses -->
        <div class="summary-card">
          <div class="summary-card-header">
            <span class="summary-card-label">Expenses</span>
            <span class="summary-card-badge badge-rose">${summary.transactionCount} txns</span>
          </div>
          <div class="summary-card-value">${storage.formatCurrency(summary.expensesMinor)}</div>
          <div class="summary-card-hint">${summary.progressPercent}% of monthly target</div>
        </div>

        <!-- Budget left (Monthly budget - Expenses) -->
        <div class="summary-card highlight-budget-left">
          <div class="summary-card-header">
            <span class="summary-card-label">Budget left</span>
            <span class="summary-card-badge ${summary.budgetRemainingMinor >= 0 ? 'badge-lime' : 'badge-rose'}">
              ${summary.budgetRemainingMinor >= 0 ? 'Remaining' : 'Over budget'}
            </span>
          </div>
          <div class="summary-card-value" style="${summary.budgetRemainingMinor < 0 ? 'color: var(--color-expense);' : ''}">${storage.formatCurrency(summary.budgetRemainingMinor)}</div>
          <div class="summary-card-hint">Monthly budget − expenses</div>
        </div>

        <!-- Net this month (Income - Expenses) -->
        <div class="summary-card highlight-net-month">
          <div class="summary-card-header">
            <span class="summary-card-label">Net this month</span>
            <span class="summary-card-badge ${summary.netMonthMinor >= 0 ? 'badge-emerald' : 'badge-rose'}">
              ${summary.netMonthMinor >= 0 ? '+ Surplus' : '- Deficit'}
            </span>
          </div>
          <div class="summary-card-value" style="color: ${summary.netMonthMinor >= 0 ? 'var(--color-income)' : 'var(--color-expense)'};">
            ${(summary.netMonthMinor >= 0 ? '+' : '') + storage.formatCurrency(summary.netMonthMinor)}
          </div>
          <div class="summary-card-hint">Income − expenses</div>
        </div>
      </section>

      <!-- Account Balance & Starting Balance Strip -->
      <section class="account-balance-strip" aria-label="Account Balance Details">
        <div class="account-balance-content">
          <div class="balance-strip-chip">🏦 Account Balance</div>
          <div class="balance-strip-main">
            <span class="balance-strip-val">${storage.formatCurrency(summary.actualAccountBalanceMinor)}</span>
            <span class="balance-strip-formula">
              Starting balance (<strong>${storage.formatCurrency(summary.startingBalanceMinor)}</strong>) + Net this month (<strong>${(summary.netMonthMinor >= 0 ? '+' : '') + storage.formatCurrency(summary.netMonthMinor)}</strong>)
            </span>
          </div>
        </div>
        <button class="balance-edit-btn" id="dashEditStartingBalanceBtn" title="Set starting account balance">
          ⚙️ Set Starting Balance
        </button>
      </section>

      <!-- Main Dashboard 2-Column Split -->
      <section class="dashboard-grid">
        
        <!-- Left Column: Energy Bubble Visual & Dark Runway Card -->
        <div class="dash-col-left">
          
          <!-- Overlapping Bubbles Visual Widget (Flux design inspired) -->
          <div class="bubbles-card">
            <div class="card-header">
              <div class="card-title-group">
                <span class="card-icon-pill">⚡</span>
                <h3 class="card-title">Cash Flow & Available Pool</h3>
              </div>
              <span class="period-pill-badge" style="font-size: 11px;">Active Balance</span>
            </div>

            <!-- Overlapping Bubble Elements -->
            <div class="bubbles-graphic-area">
              <div class="bubble bubble-income" id="dashBubbleIncomeBtn" style="cursor: pointer;" title="Click to edit salary">
                <span class="bubble-amt">${storage.formatCurrency(summary.incomeMinor)}</span>
                <span class="bubble-lbl">Income ✏️</span>
              </div>
              <div class="bubble bubble-expense" title="Total Expenses">
                <span class="bubble-amt">${storage.formatCurrency(summary.expensesMinor)}</span>
                <span class="bubble-lbl">Expenses</span>
              </div>
              <div class="bubble bubble-balance" title="Budget Left">
                <span class="bubble-amt">${storage.formatCurrency(summary.budgetRemainingMinor)}</span>
                <span class="bubble-lbl">Budget Left</span>
              </div>
            </div>

            <!-- Top Category Micro Bars -->
            <div class="category-micro-bars">
              ${catSpentList.slice(0, 3).map(cat => `
                <div class="micro-bar-row">
                  <span class="micro-bar-percent">${cat.percentOfTotal}%</span>
                  <div class="micro-bar-track">
                    <div class="micro-bar-fill" style="width: ${cat.percentOfTotal}%; background: ${cat.color};"></div>
                  </div>
                  <span class="micro-bar-name">
                    <span class="color-dot" style="background: ${cat.color};"></span>
                    ${cat.name}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Dark Accent Card: Sleep Analysis / Spending Runway (From Screenshot) -->
          <div class="dark-accent-card">
            <div class="dark-card-header">
              <div class="dark-card-title-group">
                <span style="font-size: 18px;">🌙</span>
                <h3 class="dark-card-title">Runway & Daily Rhythm</h3>
              </div>
              <span class="dark-card-tag">${monthName}</span>
            </div>

            <div class="dark-metrics-row">
              <div class="dark-metric-item">
                <div class="dark-metric-val">
                  <span class="lime-indicator-pill"></span>
                  ${storage.formatCurrency(summary.budgetRemainingMinor)}
                </div>
                <span class="dark-metric-sub">Budget remaining (Budget − expenses)</span>
              </div>

              <div class="dark-metric-item">
                <div class="dark-metric-val">
                  <span class="lime-indicator-pill" style="background: #818CF8;"></span>
                  ${summary.progressPercent}%
                </div>
                <span class="dark-metric-sub">${storage.formatCurrency(summary.expensesMinor)} of ${storage.formatCurrency(summary.monthlyBudgetMinor)} used</span>
              </div>
            </div>

            <!-- Vector Daily Bar Chart -->
            <div id="dashboardDailyTrendChart"></div>
          </div>

        </div>

        <!-- Right Column: Spending By Category & Recent Activity -->
        <div class="dash-col-right">
          
          <!-- Spending by Category Card -->
          <div class="card">
            <div class="card-header">
              <div class="card-title-group">
                <span class="card-icon-pill">🏷️</span>
                <h3 class="card-title">Spending by Category</h3>
              </div>
              <button class="promo-btn" style="width: auto; padding: 4px 10px; font-size: 11px;" id="viewAllCategoriesBtn">
                View All
              </button>
            </div>

            ${catSpentList.length === 0 ? `
              <p style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0;">
                No category expenses recorded for this month.
              </p>
            ` : `
              <div class="category-breakdown-list">
                ${catSpentList.map(cat => `
                  <div class="category-item-row" data-filter-cat="${cat.id}">
                    <div class="cat-info-group">
                      <div class="cat-icon-badge">${cat.icon}</div>
                      <div>
                        <div class="cat-name">${cat.name}</div>
                        <div class="cat-type">${cat.percentOfTotal}% of total</div>
                      </div>
                    </div>
                    <div class="cat-amount-group">
                      <div class="cat-spent">${storage.formatCurrency(cat.amountMinor)}</div>
                      <div class="cat-limit-sub">Click to filter</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Recent Activity Card (Latest 5 Transactions) -->
          <div class="card">
            <div class="card-header">
              <div class="card-title-group">
                <span class="card-icon-pill">🕒</span>
                <h3 class="card-title">Recent Activity</h3>
              </div>
              <button class="card-action-btn" id="viewAllTransactionsBtn" title="View all transactions">
                See all →
              </button>
            </div>

            ${recentTxns.length === 0 ? `
              <div class="empty-state-card" style="padding: 24px 12px;">
                <div class="empty-state-icon">📝</div>
                <div class="empty-state-title">No transactions yet</div>
                <div class="empty-state-text">Add your first income or expense for ${monthName}.</div>
                <button class="btn-primary-action" style="margin-top: 10px;" id="dashAddFirstTxnBtn">+ Add Record</button>
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${recentTxns.map(tx => {
                  const cat = storage.getCategoryById(tx.categoryId);
                  const isIncome = tx.type === 'income';
                  return `
                    <div class="category-item-row" style="background: var(--bg-card-subtle);">
                      <div class="cat-info-group">
                        <div class="cat-icon-badge">${cat.icon}</div>
                        <div>
                          <div class="cat-name">${tx.description || cat.name}</div>
                          <div class="cat-type">${tx.date} • ${cat.name}</div>
                        </div>
                      </div>
                      <div class="cat-amount-group">
                        <div class="tx-amount-cell ${isIncome ? 'income' : 'expense'}">
                          ${isIncome ? '+' : '-'}${storage.formatCurrency(tx.amountMinor)}
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>

        </div>

      </section>
    `;

    // Render SVG Daily Spending Runway Chart inside dark card
    ChartRenderer.renderDailySpendingChart(
      'dashboardDailyTrendChart',
      summary.transactions,
      this.selectedMonth,
      (paise) => storage.formatCurrency(paise)
    );

    // Event listeners inside dashboard
    const viewAllTxns = document.getElementById('viewAllTransactionsBtn');
    if (viewAllTxns) {
      viewAllTxns.addEventListener('click', () => this.navigateTo('transactions'));
    }

    const viewAllCats = document.getElementById('viewAllCategoriesBtn');
    if (viewAllCats) {
      viewAllCats.addEventListener('click', () => this.navigateTo('budgets'));
    }

    const dashAddBtn = document.getElementById('dashAddFirstTxnBtn');
    if (dashAddBtn) {
      dashAddBtn.addEventListener('click', () => this.openTransactionModal());
    }

    const editSalaryBtn = document.getElementById('dashEditSalaryBtn');
    if (editSalaryBtn) {
      editSalaryBtn.addEventListener('click', () => this.openSalaryModal());
    }

    const bubbleIncomeBtn = document.getElementById('dashBubbleIncomeBtn');
    if (bubbleIncomeBtn) {
      bubbleIncomeBtn.addEventListener('click', () => this.openSalaryModal());
    }

    const editStartingBalanceBtn = document.getElementById('dashEditStartingBalanceBtn');
    if (editStartingBalanceBtn) {
      editStartingBalanceBtn.addEventListener('click', () => this.openStartingBalanceModal());
    }

    // Clicking category rows filters transactions
    container.querySelectorAll('[data-filter-cat]').forEach(el => {
      el.addEventListener('click', () => {
        const catId = el.getAttribute('data-filter-cat');
        this.txFilter.categoryId = catId;
        this.navigateTo('transactions');
      });
    });
  }

  // ==========================================================================
  // PAGE 2: TRANSACTIONS
  // ==========================================================================
  renderTransactionsPage(container) {
    const allTx = storage.getTransactions();
    const categories = storage.getCategories();

    // Filter by selected month, search term, type, and category
    let filtered = allTx.filter(tx => {
      // Month filter (if set to current selected month)
      if (this.selectedMonth && tx.date && !tx.date.startsWith(this.selectedMonth)) {
        return false;
      }
      // Type filter
      if (this.txFilter.type !== 'all' && tx.type !== this.txFilter.type) {
        return false;
      }
      // Category filter
      if (this.txFilter.categoryId !== 'all' && tx.categoryId !== this.txFilter.categoryId) {
        return false;
      }
      // Search filter (description)
      if (this.txFilter.search) {
        const q = this.txFilter.search.toLowerCase();
        const descMatch = (tx.description || '').toLowerCase().includes(q);
        const catObj = storage.getCategoryById(tx.categoryId);
        const catMatch = catObj.name.toLowerCase().includes(q);
        if (!descMatch && !catMatch) return false;
      }
      return true;
    });

    // Sorting
    if (this.txFilter.sort === 'newest') {
      filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (this.txFilter.sort === 'oldest') {
      filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (this.txFilter.sort === 'largest') {
      filtered.sort((a, b) => b.amountMinor - a.amountMinor);
    }

    // Totals for filtered records
    const filteredIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amountMinor, 0);
    const filteredExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amountMinor, 0);

    const [year, month] = this.selectedMonth.split('-');
    const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const monthName = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    container.innerHTML = `
      <section class="page-hero">
        <div>
          <h1 class="page-title">Transactions</h1>
          <p class="page-subtitle">Search, filter, add, edit, and organize financial records for ${monthName}.</p>
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="btn-primary-action" id="pageAddTxnBtn">+ Add Transaction</button>
        </div>
      </section>

      <!-- Filter & Search Bar -->
      <section class="filters-bar-card">
        <div class="filters-group">
          <!-- Search Input -->
          <div class="search-input-box">
            <span>🔍</span>
            <input type="text" id="txSearchInput" placeholder="Search by description or category..." value="${this.txFilter.search}">
            ${this.txFilter.search ? `<button id="clearSearchBtn" style="border:none;background:none;cursor:pointer;">✕</button>` : ''}
          </div>

          <!-- Type Filter -->
          <select class="filter-select" id="txTypeFilter" aria-label="Filter by type">
            <option value="all" ${this.txFilter.type === 'all' ? 'selected' : ''}>All Types</option>
            <option value="expense" ${this.txFilter.type === 'expense' ? 'selected' : ''}>Expenses Only</option>
            <option value="income" ${this.txFilter.type === 'income' ? 'selected' : ''}>Income Only</option>
          </select>

          <!-- Category Filter -->
          <select class="filter-select" id="txCategoryFilter" aria-label="Filter by category">
            <option value="all">All Categories</option>
            ${categories.map(c => `
              <option value="${c.id}" ${this.txFilter.categoryId === c.id ? 'selected' : ''}>
                ${c.icon} ${c.name} (${c.type})
              </option>
            `).join('')}
          </select>

          <!-- Sort -->
          <select class="filter-select" id="txSortFilter" aria-label="Sort transactions">
            <option value="newest" ${this.txFilter.sort === 'newest' ? 'selected' : ''}>Newest First</option>
            <option value="oldest" ${this.txFilter.sort === 'oldest' ? 'selected' : ''}>Oldest First</option>
            <option value="largest" ${this.txFilter.sort === 'largest' ? 'selected' : ''}>Largest Amount</option>
          </select>
        </div>

        <!-- Filter Count Pill -->
        <div class="period-pill-badge">
          <span>${filtered.length} records</span>
          <span>•</span>
          <span style="color: var(--color-income);">+${storage.formatCurrency(filteredIncome)}</span>
          <span>•</span>
          <span style="color: var(--color-expense);">-${storage.formatCurrency(filteredExpense)}</span>
        </div>
      </section>

      <!-- Records Presentation: Desktop Table + Mobile Cards -->
      <section class="card" style="padding: 16px;">
        ${filtered.length === 0 ? `
          <div class="empty-state-card">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-title">No matching records found</div>
            <div class="empty-state-text">
              Try adjusting your search terms or filters for ${monthName}, or add a new transaction.
            </div>
            <button class="btn-primary-action" style="margin-top: 14px;" id="emptyAddTxnBtn">+ Add Transaction</button>
          </div>
        ` : `
          <!-- Desktop Table -->
          <div class="table-responsive">
            <table class="modern-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th style="text-align: right;">Amount</th>
                  <th style="text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(tx => {
                  const cat = storage.getCategoryById(tx.categoryId);
                  const isIncome = tx.type === 'income';
                  return `
                    <tr data-id="${tx.id}">
                      <td style="font-weight: 700;">${tx.date}</td>
                      <td>
                        <strong>${tx.description || cat.name}</strong>
                      </td>
                      <td>
                        <span class="badge-cat-tag">
                          <span>${cat.icon}</span>
                          <span>${cat.name}</span>
                        </span>
                      </td>
                      <td>
                        <span class="summary-card-badge ${isIncome ? 'badge-emerald' : 'badge-rose'}">
                          ${isIncome ? 'Income' : 'Expense'}
                        </span>
                      </td>
                      <td style="text-align: right;" class="tx-amount-cell ${isIncome ? 'income' : 'expense'}">
                        ${isIncome ? '+' : '-'}${storage.formatCurrency(tx.amountMinor)}
                      </td>
                      <td style="text-align: right;">
                        <div class="action-btns-group" style="justify-content: flex-end;">
                          <button class="table-action-btn edit-tx-btn" data-id="${tx.id}" title="Edit transaction">✏️</button>
                          <button class="table-action-btn delete-btn delete-tx-btn" data-id="${tx.id}" title="Delete transaction">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Mobile Stacked Cards -->
          <div class="mobile-tx-cards">
            ${filtered.map(tx => {
              const cat = storage.getCategoryById(tx.categoryId);
              const isIncome = tx.type === 'income';
              return `
                <div class="mobile-tx-card">
                  <div class="mobile-tx-top">
                    <div>
                      <div class="mobile-tx-desc">${tx.description || cat.name}</div>
                      <div style="font-size: 12px; color: var(--text-muted);">${tx.date}</div>
                    </div>
                    <div class="tx-amount-cell ${isIncome ? 'income' : 'expense'}">
                      ${isIncome ? '+' : '-'}${storage.formatCurrency(tx.amountMinor)}
                    </div>
                  </div>
                  <div class="mobile-tx-bottom">
                    <span class="badge-cat-tag">
                      <span>${cat.icon}</span>
                      <span>${cat.name}</span>
                    </span>
                    <div class="action-btns-group">
                      <button class="table-action-btn edit-tx-btn" data-id="${tx.id}">✏️</button>
                      <button class="table-action-btn delete-btn delete-tx-btn" data-id="${tx.id}">🗑️</button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </section>
    `;

    // Filter event listeners
    const searchInput = document.getElementById('txSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.txFilter.search = e.target.value;
        this.renderTransactionsPage(container);
      });
    }

    const clearSearch = document.getElementById('clearSearchBtn');
    if (clearSearch) {
      clearSearch.addEventListener('click', () => {
        this.txFilter.search = '';
        this.renderTransactionsPage(container);
      });
    }

    const typeFilter = document.getElementById('txTypeFilter');
    if (typeFilter) {
      typeFilter.addEventListener('change', (e) => {
        this.txFilter.type = e.target.value;
        this.renderTransactionsPage(container);
      });
    }

    const catFilter = document.getElementById('txCategoryFilter');
    if (catFilter) {
      catFilter.addEventListener('change', (e) => {
        this.txFilter.categoryId = e.target.value;
        this.renderTransactionsPage(container);
      });
    }

    const sortFilter = document.getElementById('txSortFilter');
    if (sortFilter) {
      sortFilter.addEventListener('change', (e) => {
        this.txFilter.sort = e.target.value;
        this.renderTransactionsPage(container);
      });
    }

    const pageAddBtn = document.getElementById('pageAddTxnBtn');
    if (pageAddBtn) pageAddBtn.addEventListener('click', () => this.openTransactionModal());

    const emptyAddBtn = document.getElementById('emptyAddTxnBtn');
    if (emptyAddBtn) emptyAddBtn.addEventListener('click', () => this.openTransactionModal());

    // Edit and Delete buttons
    container.querySelectorAll('.edit-tx-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        this.openTransactionModal(id);
      });
    });

    container.querySelectorAll('.delete-tx-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        this.openDeleteConfirmModal(id);
      });
    });
  }

  // ==========================================================================
  // PAGE 3: BUDGETS
  // ==========================================================================
  renderBudgetsPage(container) {
    const summary = storage.getMonthSummary(this.selectedMonth);
    const budgetData = storage.getBudgetForMonth(this.selectedMonth);
    const categoryLimits = budgetData.categories || {};
    const categories = storage.getCategories().filter(c => c.type === 'expense');

    const [year, month] = this.selectedMonth.split('-');
    const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const monthName = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Calculate sum of category targets
    const totalCategoryLimitsMinor = Object.values(categoryLimits).reduce((sum, val) => sum + val, 0);

    container.innerHTML = `
      <section class="page-hero">
        <div>
          <h1 class="page-title">Budgets</h1>
          <p class="page-subtitle">Separate monthly spending target from income-inclusive available balance.</p>
        </div>
        <button class="btn-primary-action" id="editMonthlyBudgetBtn">
          ✏️ Edit Monthly Target
        </button>
      </section>

      <!-- Monthly Budget Main Card -->
      <section class="budgets-overview-card">
        <div class="card-header" style="margin-bottom: 0;">
          <div>
            <span class="summary-card-label">Monthly Spending Target</span>
            <h2 style="font-size: 26px; font-weight: 800; margin-top: 4px;">
              ${storage.formatCurrency(summary.monthlyBudgetMinor)}
            </h2>
          </div>
          <div class="period-pill-badge">
            <span>Progress: ${summary.progressPercent}% used</span>
          </div>
        </div>

        <!-- Large Progress Bar -->
        <div class="progress-track-lg" style="margin: 20px 0 16px 0;">
          <div class="progress-fill-lime ${summary.progressPercent > 100 ? 'progress-fill-warning' : ''}" 
               style="width: ${Math.min(100, summary.progressPercent)}%;"></div>
        </div>

        <!-- 4 Sub Metrics Grid -->
        <div class="budgets-stats-grid">
          <div class="budget-stat-item">
            <span class="summary-card-label">Monthly Budget</span>
            <div style="font-size: 20px; font-weight: 800; margin-top: 4px;">
              ${storage.formatCurrency(summary.monthlyBudgetMinor)}
            </div>
            <span style="font-size: 11px; color: var(--text-muted);">Configured limit</span>
          </div>

          <div class="budget-stat-item">
            <span class="summary-card-label">${monthName} Expenses</span>
            <div style="font-size: 20px; font-weight: 800; margin-top: 4px; color: var(--color-expense);">
              ${storage.formatCurrency(summary.expensesMinor)}
            </div>
            <span style="font-size: 11px; color: var(--text-muted);">Total spent so far</span>
          </div>

          <div class="budget-stat-item highlight-stat">
            <span class="summary-card-label" style="color: #3F6212;">Budget Remaining</span>
            <div style="font-size: 20px; font-weight: 800; margin-top: 4px; color: #111827;">
              ${storage.formatCurrency(summary.budgetRemainingMinor)}
            </div>
            <span style="font-size: 11px; color: #4D7C0F;">Budget − expenses</span>
          </div>

          <div class="budget-stat-item">
            <span class="summary-card-label">Category Targets Sum</span>
            <div style="font-size: 20px; font-weight: 800; margin-top: 4px;">
              ${storage.formatCurrency(totalCategoryLimitsMinor)}
            </div>
            <span style="font-size: 11px; color: var(--text-muted);">Independent targets</span>
          </div>
        </div>
      </section>

      <!-- Category Limits Section -->
      <section style="margin-top: 24px;">
        <div class="page-hero" style="margin-bottom: 16px;">
          <div>
            <h2 style="font-size: 20px; font-weight: 800;">Category Spending Limits</h2>
            <p style="font-size: 13px; color: var(--text-secondary);">
              Individual spending guardrails. Limits do not need to add up to the monthly budget.
            </p>
          </div>
        </div>

        <div class="category-limits-grid">
          ${categories.map(cat => {
            const limitMinor = categoryLimits[cat.id] || 0;
            const spentMinor = summary.categoryTotals[cat.id] || 0;
            const remainingMinor = limitMinor - spentMinor;
            const isOver = limitMinor > 0 && spentMinor > limitMinor;
            const isMaxed = limitMinor > 0 && spentMinor === limitMinor;
            const progress = limitMinor > 0 ? Math.min(100, Math.round((spentMinor / limitMinor) * 100)) : 0;

            return `
              <div class="category-limit-card ${isOver ? 'over-limit' : ''}">
                <div class="limit-card-top">
                  <div class="cat-info-group">
                    <div class="cat-icon-badge">${cat.icon}</div>
                    <div>
                      <h4 class="cat-name">${cat.name}</h4>
                      <span class="cat-type">${limitMinor > 0 ? `${progress}% used` : 'No limit set'}</span>
                    </div>
                  </div>
                  <button class="table-action-btn edit-cat-limit-btn" data-cat-id="${cat.id}" data-cat-name="${cat.name}" data-limit="${limitMinor / 100}" title="Edit limit">
                    ✏️
                  </button>
                </div>

                <div class="limit-card-values">
                  <div>
                    <span class="summary-card-label">Spent</span>
                    <div class="limit-spent-large">${storage.formatCurrency(spentMinor)}</div>
                  </div>
                  <div style="text-align: right;">
                    <span class="summary-card-label">Target</span>
                    <div class="limit-target-small">${limitMinor > 0 ? storage.formatCurrency(limitMinor) : 'Not set'}</div>
                  </div>
                </div>

                <!-- Progress Track -->
                <div class="micro-bar-track" style="height: 8px;">
                  <div class="micro-bar-fill" style="width: ${progress}%; background: ${isOver ? 'var(--color-expense)' : isMaxed ? '#F59E0B' : cat.color};"></div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
                  ${isOver ? `
                    <span class="limit-remaining-badge" style="background: var(--color-expense-soft); color: #991B1B;">
                      ⚠️ Over by ${storage.formatCurrency(Math.abs(remainingMinor))}
                    </span>
                  ` : isMaxed ? `
                    <span class="limit-remaining-badge" style="background: var(--color-warning-soft); color: #92400E;">
                      ⚠️ Limit reached (₹0 left)
                    </span>
                  ` : limitMinor > 0 ? `
                    <span class="limit-remaining-badge" style="background: var(--lime-soft); color: #3F6212;">
                      ✓ ${storage.formatCurrency(remainingMinor)} left
                    </span>
                  ` : `
                    <span style="color: var(--text-muted);">No limit set</span>
                  `}

                  <button class="promo-btn" style="width: auto; padding: 4px 10px; font-size: 11px;" data-cat-id="${cat.id}" data-cat-name="${cat.name}" data-limit="${limitMinor / 100}">
                    ${limitMinor > 0 ? 'Edit' : '+ Set Limit'}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;

    // Event listeners
    const editBudgetBtn = document.getElementById('editMonthlyBudgetBtn');
    if (editBudgetBtn) editBudgetBtn.addEventListener('click', () => this.openBudgetModal());

    container.querySelectorAll('.edit-cat-limit-btn, .category-limit-card .promo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = btn.getAttribute('data-cat-id');
        const catName = btn.getAttribute('data-cat-name');
        const limitInr = btn.getAttribute('data-limit');
        this.openCategoryLimitModal(catId, catName, limitInr);
      });
    });
  }

  // ==========================================================================
  // PAGE 4: REPORTS
  // ==========================================================================
  renderReportsPage(container) {
    const summary = storage.getMonthSummary(this.selectedMonth);
    const [year, month] = this.selectedMonth.split('-');
    const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const monthName = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Category breakdown data
    const catList = Object.entries(summary.categoryTotals).map(([catId, amountMinor]) => {
      const cat = storage.getCategoryById(catId);
      return {
        ...cat,
        amountMinor,
        fraction: summary.expensesMinor > 0 ? amountMinor / summary.expensesMinor : 0
      };
    }).sort((a, b) => b.amountMinor - a.amountMinor);

    container.innerHTML = `
      <section class="page-hero">
        <div>
          <h1 class="page-title">Reports & Analytics</h1>
          <p class="page-subtitle">Review spending patterns and compare income with expenses for ${monthName}.</p>
        </div>
        <button class="btn-primary-action" id="exportReportBtn">
          📥 Export CSV Report
        </button>
      </section>

      <!-- Top Summary Banner -->
      <section class="report-summary-banner">
        <div class="report-banner-stat">
          <span style="font-size: 12px; color: var(--text-white-muted); text-transform: uppercase;">Total Income</span>
          <div class="report-banner-val" style="color: var(--lime-primary);">${storage.formatCurrency(summary.incomeMinor)}</div>
          <span style="font-size: 12px; color: var(--text-white-muted);">Salary + freelance deposits</span>
        </div>

        <div class="report-banner-stat">
          <span style="font-size: 12px; color: var(--text-white-muted); text-transform: uppercase;">Total Expenses</span>
          <div class="report-banner-val">${storage.formatCurrency(summary.expensesMinor)}</div>
          <span style="font-size: 12px; color: var(--text-white-muted);">${summary.transactionCount} transactions recorded</span>
        </div>

        <div class="report-banner-stat">
          <span style="font-size: 12px; color: var(--text-white-muted); text-transform: uppercase;">Net for Month</span>
          <div class="report-banner-val" style="color: ${summary.netMonthMinor >= 0 ? '#10B981' : '#EF4444'};">
            ${summary.netMonthMinor >= 0 ? '+' : ''}${storage.formatCurrency(summary.netMonthMinor)}
          </div>
          <span style="font-size: 12px; color: var(--text-white-muted);">Income minus expenses</span>
        </div>
      </section>

      <!-- Charts Grid -->
      <section class="reports-grid">
        
        <!-- Expenses By Category Donut Chart -->
        <div class="card" style="grid-column: span 6;">
          <div class="card-header">
            <div class="card-title-group">
              <span class="card-icon-pill">🍩</span>
              <h3 class="card-title">Expenses by Category</h3>
            </div>
            <span class="period-pill-badge" style="font-size: 11px;">Breakdown</span>
          </div>

          <div id="reportCategoryDonutChart"></div>

          <!-- Category Ranked List with Percentages -->
          <div style="margin-top: 18px; display: flex; flex-direction: column; gap: 8px;">
            ${catList.map(cat => `
              <div class="category-item-row" style="background: var(--bg-card-subtle);">
                <div class="cat-info-group">
                  <span class="color-dot" style="background: ${cat.color};"></span>
                  <span style="font-size: 13px; font-weight: 700;">${cat.name}</span>
                </div>
                <div class="cat-amount-group">
                  <span style="font-size: 14px; font-weight: 800;">${storage.formatCurrency(cat.amountMinor)}</span>
                  <span style="font-size: 11px; color: var(--text-muted); margin-left: 6px;">
                    (${(cat.fraction * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Income vs Expenses Visual Bar Comparison -->
        <div class="card" style="grid-column: span 6;">
          <div class="card-header">
            <div class="card-title-group">
              <span class="card-icon-pill">⚖️</span>
              <h3 class="card-title">Income vs Expenses</h3>
            </div>
            <span class="period-pill-badge" style="font-size: 11px;">Comparison</span>
          </div>

          <div id="reportIncomeVsExpenseChart"></div>

          <!-- Explanatory note -->
          <div style="margin-top: 24px; padding: 16px; background: var(--bg-card-subtle); border-radius: 14px; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            <strong>Financial Health Note:</strong> Your monthly income exceeds expenses by 
            <strong style="color: var(--color-income);">${storage.formatCurrency(summary.netMonthMinor)}</strong>. 
            You have successfully preserved <strong>${((summary.netMonthMinor / (summary.incomeMinor || 1)) * 100).toFixed(1)}%</strong> of your earnings in ${monthName}.
          </div>
        </div>

        <!-- Dark Daily Spending Trend Bar Chart (Full Width) -->
        <div class="dark-accent-card" style="grid-column: span 12;">
          <div id="reportDailyTrendChart"></div>
        </div>

      </section>
    `;

    // Render Vector Charts
    ChartRenderer.renderDonutChart(
      'reportCategoryDonutChart',
      catList,
      summary.expensesMinor,
      (paise) => storage.formatCurrency(paise)
    );

    ChartRenderer.renderIncomeVsExpense(
      'reportIncomeVsExpenseChart',
      summary.incomeMinor,
      summary.expensesMinor,
      summary.monthlyBudgetMinor,
      (paise) => storage.formatCurrency(paise)
    );

    ChartRenderer.renderDailySpendingChart(
      'reportDailyTrendChart',
      summary.transactions,
      this.selectedMonth,
      (paise) => storage.formatCurrency(paise)
    );

    // Export button listener
    const exportBtn = document.getElementById('exportReportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.downloadCSV();
      });
    }
  }

  // ==========================================================================
  // PAGE 5: SETTINGS
  // ==========================================================================
  renderSettingsPage(container) {
    const settings = storage.getSettings();
    const categories = storage.getCategories();
    const transactions = storage.getTransactions();

    container.innerHTML = `
      <section class="page-hero">
        <div>
          <h1 class="page-title">Settings & Preferences</h1>
          <p class="page-subtitle">Manage preferences, currency units, categories, and saved device data.</p>
        </div>
      </section>

      <!-- User Profile & Primary Salary Section -->
      <section class="settings-section-card">
        <h3 style="font-size: 18px; font-weight: 800; margin-bottom: 8px;">Account & Income Setup</h3>
        
        <div class="settings-row">
          <div class="settings-info">
            <h4>Active Profile</h4>
            <p>Currently logged in as <strong>${storage.getCurrentUser().name}</strong> (${storage.getCurrentUser().email}).</p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="promo-btn" style="width: auto; padding: 6px 14px;" id="settingsSwitchAccountBtn">Switch User / Login</button>
          </div>
        </div>

        <div class="settings-row">
          <div class="settings-info">
            <h4>Monthly Salary</h4>
            <p>Primary salary for ${this.selectedMonth}: <strong>${storage.formatCurrency(storage.getSalaryForMonth(this.selectedMonth) ? storage.getSalaryForMonth(this.selectedMonth).amountMinor : 4200000)}</strong>.</p>
          </div>
          <div>
            <button class="btn-primary-action" style="padding: 6px 14px; font-size: 13px;" id="settingsEditSalaryBtn">✏️ Edit Salary</button>
          </div>
        </div>
      </section>

      <!-- Currency & Preferences Section -->
      <section class="settings-section-card">
        <h3 style="font-size: 18px; font-weight: 800; margin-bottom: 8px;">Regional & Currency Settings</h3>
        
        <div class="settings-row">
          <div class="settings-info">
            <h4>Currency Display</h4>
            <p>Stored as integer minor units (paise: ₹1 = 100 paise). Default: Indian Rupee (INR ₹).</p>
          </div>
          <div>
            <select class="filter-select" id="settingCurrencySelect">
              <option value="INR" ${settings.currencyCode === 'INR' ? 'selected' : ''}>Indian Rupee (₹ INR)</option>
              <option value="USD" ${settings.currencyCode === 'USD' ? 'selected' : ''}>US Dollar ($ USD)</option>
              <option value="EUR" ${settings.currencyCode === 'EUR' ? 'selected' : ''}>Euro (€ EUR)</option>
              <option value="GBP" ${settings.currencyCode === 'GBP' ? 'selected' : ''}>British Pound (£ GBP)</option>
            </select>
          </div>
        </div>

        <div class="settings-row">
          <div class="settings-info">
            <h4>Start of Week</h4>
            <p>Select which day begins your financial week.</p>
          </div>
          <div>
            <select class="filter-select" id="settingWeekStartSelect">
              <option value="monday" ${settings.weekStart === 'monday' ? 'selected' : ''}>Monday</option>
              <option value="sunday" ${settings.weekStart === 'sunday' ? 'selected' : ''}>Sunday</option>
            </select>
          </div>
        </div>

        <div class="settings-row">
          <div class="settings-info">
            <h4>Starting Account Balance</h4>
            <p>Opening bank balance for calculating actual account balance (Starting + Net this month).</p>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="number" class="filter-select" id="settingStartingBalanceInput" value="${Math.round((settings.startingBalanceMinor || 5000000) / 100)}" style="width: 140px; padding: 6px 10px;" min="0">
            <button class="promo-btn" style="width: auto; padding: 6px 14px;" id="saveStartingBalanceSettingBtn">Save</button>
          </div>
        </div>
      </section>

      <!-- Category Management Section -->
      <section class="settings-section-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <div>
            <h3 style="font-size: 18px; font-weight: 800;">Manage Categories</h3>
            <p style="font-size: 13px; color: var(--text-secondary);">Customize income and expense classifications.</p>
          </div>
          <button class="promo-btn" style="width: auto; padding: 6px 14px;" id="addNewCategoryBtn">+ Add Category</button>
        </div>

        <div class="category-tags-wrap">
          ${categories.map(cat => `
            <div class="category-tag-chip" style="border-left: 3px solid ${cat.color};">
              <span>${cat.icon}</span>
              <span>${cat.name}</span>
              <span style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">(${cat.type})</span>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- Data Export & Backup Section -->
      <section class="settings-section-card">
        <h3 style="font-size: 18px; font-weight: 800; margin-bottom: 8px;">Data Storage & Backup</h3>
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
          All records are stored locally in this browser (${transactions.length} transactions saved). 
          Data does not sync across devices unless backed up.
        </p>

        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <button class="promo-btn" style="width: auto; padding: 10px 18px; background: #111827; color: #FFFFFF;" id="exportJsonBtn">
            💾 Export Backup (JSON)
          </button>
          <button class="promo-btn" style="width: auto; padding: 10px 18px; background: #3B82F6; color: #FFFFFF;" id="exportCsvBtn">
            📊 Export Records (CSV)
          </button>
          <button class="promo-btn" style="width: auto; padding: 10px 18px; background: #64748B; color: #FFFFFF;" id="restoreSeedBtn">
            ↺ Reset to October 2026 Seed Data
          </button>
          <button class="promo-btn" style="width: auto; padding: 10px 18px; background: var(--color-expense); color: #FFFFFF;" id="clearAllDataBtn">
            ⚠️ Clear All Data
          </button>
        </div>
      </section>
    `;

    // Event listeners for Settings
    const switchBtn = document.getElementById('settingsSwitchAccountBtn');
    if (switchBtn) switchBtn.addEventListener('click', () => this.openAuthModal());

    const editSalaryBtn = document.getElementById('settingsEditSalaryBtn');
    if (editSalaryBtn) editSalaryBtn.addEventListener('click', () => this.openSalaryModal());

    const currencySelect = document.getElementById('settingCurrencySelect');
    if (currencySelect) {
      currencySelect.addEventListener('change', (e) => {
        const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
        storage.saveSettings({
          currencyCode: e.target.value,
          currencySymbol: symbols[e.target.value] || '₹'
        });
        this.showToast('Currency preference updated successfully', 'success');
        this.renderCurrentPage();
      });
    }

    const weekStartSelect = document.getElementById('settingWeekStartSelect');
    if (weekStartSelect) {
      weekStartSelect.addEventListener('change', (e) => {
        storage.saveSettings({ weekStart: e.target.value });
        this.showToast('Week start preference updated', 'success');
      });
    }

    const saveStartingBtn = document.getElementById('saveStartingBalanceSettingBtn');
    if (saveStartingBtn) {
      saveStartingBtn.addEventListener('click', () => {
        const val = parseFloat(document.getElementById('settingStartingBalanceInput').value);
        if (isNaN(val) || val < 0) {
          alert('Please enter a valid positive starting balance.');
          return;
        }
        const paise = Math.round(val * 100);
        storage.setStartingBalance(paise);
        this.showToast(`Starting balance updated to ${storage.formatCurrency(paise)}`, 'success');
      });
    }

    const exportJson = document.getElementById('exportJsonBtn');
    if (exportJson) exportJson.addEventListener('click', () => this.downloadJSON());

    const exportCsv = document.getElementById('exportCsvBtn');
    if (exportCsv) exportCsv.addEventListener('click', () => this.downloadCSV());

    const restoreSeed = document.getElementById('restoreSeedBtn');
    if (restoreSeed) {
      restoreSeed.addEventListener('click', () => {
        if (confirm('Reset to the October 2026 reference seed dataset? This will restore the ₹50,000 budget and 15 sample transactions.')) {
          storage.resetToSeedData();
          this.selectedMonth = '2026-10';
          this.updateMonthPickerDisplay();
          this.showToast('Reset to October 2026 reference data', 'success');
          this.navigateTo('dashboard');
        }
      });
    }

    const clearAll = document.getElementById('clearAllDataBtn');
    if (clearAll) {
      clearAll.addEventListener('click', () => {
        if (confirm('Are you sure you want to completely clear all data? This cannot be undone.')) {
          storage.clearAllData();
          storage.init(); // reinitialize empty structures
          this.showToast('All browser records cleared', 'error');
          this.renderCurrentPage();
        }
      });
    }

    const addCatBtn = document.getElementById('addNewCategoryBtn');
    if (addCatBtn) {
      addCatBtn.addEventListener('click', () => {
        const name = prompt('Enter new category name:');
        if (name && name.trim()) {
          const type = prompt('Enter type (expense or income):', 'expense') || 'expense';
          const icon = prompt('Enter emoji icon:', type === 'income' ? '💵' : '📦') || '📦';
          const id = name.trim().toLowerCase().replace(/\s+/g, '_');
          try {
            storage.addCategory({ id, name: name.trim(), type: type.toLowerCase(), icon, color: '#6366F1' });
            this.showToast(`Category "${name}" added`, 'success');
            this.renderSettingsPage(container);
          } catch (err) {
            alert(err.message);
          }
        }
      });
    }
  }

  // ==========================================================================
  // TRANSACTION MODAL (Add / Edit)
  // ==========================================================================
  setupTransactionModalHandlers() {
    const overlay = document.getElementById('txnModalOverlay');
    const closeBtn = document.getElementById('closeTxnModalBtn');
    const cancelBtn = document.getElementById('cancelTxnBtn');
    const form = document.getElementById('txnForm');
    const expenseBtn = document.getElementById('typeExpenseBtn');
    const incomeBtn = document.getElementById('typeIncomeBtn');
    const typeInput = document.getElementById('txType');

    const closeModal = () => {
      overlay.classList.remove('active');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Type toggles
    if (expenseBtn && incomeBtn) {
      expenseBtn.addEventListener('click', () => {
        expenseBtn.classList.add('active');
        incomeBtn.classList.remove('active');
        typeInput.value = 'expense';
        this.populateCategorySelect('expense');
      });

      incomeBtn.addEventListener('click', () => {
        incomeBtn.classList.add('active');
        expenseBtn.classList.remove('active');
        typeInput.value = 'income';
        this.populateCategorySelect('income');
      });
    }

    // Form Submit
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('txId').value;
        const type = typeInput.value;
        const amountInr = parseFloat(document.getElementById('txAmount').value);
        const categoryId = document.getElementById('txCategory').value;
        const date = document.getElementById('txDate').value;
        const description = document.getElementById('txDescription').value;

        // Validation
        const amountError = document.getElementById('txAmountError');
        const catError = document.getElementById('txCategoryError');
        const dateError = document.getElementById('txDateError');

        let hasError = false;
        if (isNaN(amountInr) || amountInr <= 0) {
          amountError.textContent = 'Amount must be greater than zero.';
          amountError.style.display = 'block';
          hasError = true;
        } else {
          amountError.style.display = 'none';
        }

        if (!categoryId) {
          catError.textContent = 'Please select a valid category.';
          catError.style.display = 'block';
          hasError = true;
        } else {
          catError.style.display = 'none';
        }

        if (!date) {
          dateError.textContent = 'Date is required.';
          dateError.style.display = 'block';
          hasError = true;
        } else {
          dateError.style.display = 'none';
        }

        if (hasError) return;

        // Convert INR rupees to paise integer minor units
        const amountMinor = Math.round(amountInr * 100);

        if (id) {
          // Update
          storage.updateTransaction(id, {
            type,
            amountMinor,
            categoryId,
            date,
            description
          });
          this.showToast('Transaction updated successfully', 'success');
        } else {
          // Create
          storage.addTransaction({
            type,
            amountMinor,
            categoryId,
            date,
            description
          });
          this.showToast('New transaction recorded', 'success');
        }

        closeModal();
        this.renderCurrentPage();
      });
    }
  }

  populateCategorySelect(type, selectedId = null) {
    const select = document.getElementById('txCategory');
    if (!select) return;
    const categories = storage.getCategories().filter(c => c.type === type);
    select.innerHTML = categories.map(c => `
      <option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>
        ${c.icon} ${c.name}
      </option>
    `).join('');
  }

  openTransactionModal(id = null) {
    const overlay = document.getElementById('txnModalOverlay');
    const title = document.getElementById('txnModalTitle');
    const idInput = document.getElementById('txId');
    const expenseBtn = document.getElementById('typeExpenseBtn');
    const incomeBtn = document.getElementById('typeIncomeBtn');
    const typeInput = document.getElementById('txType');
    const amountInput = document.getElementById('txAmount');
    const dateInput = document.getElementById('txDate');
    const descInput = document.getElementById('txDescription');

    // Reset error messages
    document.getElementById('txAmountError').style.display = 'none';
    document.getElementById('txCategoryError').style.display = 'none';
    document.getElementById('txDateError').style.display = 'none';

    if (id) {
      // Editing existing transaction
      const transactions = storage.getTransactions();
      const tx = transactions.find(t => t.id === id);
      if (!tx) return;

      title.textContent = 'Edit Transaction';
      idInput.value = tx.id;
      typeInput.value = tx.type;
      amountInput.value = (tx.amountMinor / 100).toFixed(2);
      dateInput.value = tx.date;
      descInput.value = tx.description || '';

      if (tx.type === 'income') {
        incomeBtn.classList.add('active');
        expenseBtn.classList.remove('active');
      } else {
        expenseBtn.classList.add('active');
        incomeBtn.classList.remove('active');
      }
      this.populateCategorySelect(tx.type, tx.categoryId);
    } else {
      // New Transaction
      title.textContent = 'Add Transaction';
      idInput.value = '';
      typeInput.value = 'expense';
      expenseBtn.classList.add('active');
      incomeBtn.classList.remove('active');
      amountInput.value = '';
      // Default to selected month day
      dateInput.value = `${this.selectedMonth}-15`;
      descInput.value = '';
      this.populateCategorySelect('expense');
    }

    overlay.classList.add('active');
    amountInput.focus();
  }

  // ==========================================================================
  // MONTHLY BUDGET MODAL
  // ==========================================================================
  setupBudgetModalHandlers() {
    const overlay = document.getElementById('budgetModalOverlay');
    const closeBtn = document.getElementById('closeBudgetModalBtn');
    const cancelBtn = document.getElementById('cancelBudgetBtn');
    const form = document.getElementById('budgetForm');

    const close = () => overlay.classList.remove('active');
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (cancelBtn) cancelBtn.addEventListener('click', close);

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const inr = parseFloat(document.getElementById('monthlyBudgetInput').value);
        if (isNaN(inr) || inr < 0) return;
        const amountMinor = Math.round(inr * 100);
        storage.setMonthlyBudget(this.selectedMonth, amountMinor);
        close();
        this.showToast(`Monthly budget updated to ${storage.formatCurrency(amountMinor)}`, 'success');
        this.renderCurrentPage();
      });
    }
  }

  openBudgetModal() {
    const overlay = document.getElementById('budgetModalOverlay');
    const input = document.getElementById('monthlyBudgetInput');
    const budgetData = storage.getBudgetForMonth(this.selectedMonth);
    input.value = budgetData.monthlyBudgetMinor ? budgetData.monthlyBudgetMinor / 100 : 50000;
    overlay.classList.add('active');
    input.focus();
  }

  // ==========================================================================
  // CATEGORY LIMIT MODAL
  // ==========================================================================
  setupCategoryLimitModalHandlers() {
    const overlay = document.getElementById('catLimitModalOverlay');
    const closeBtn = document.getElementById('closeCatLimitModalBtn');
    const cancelBtn = document.getElementById('cancelCatLimitBtn');
    const form = document.getElementById('catLimitForm');

    const close = () => overlay.classList.remove('active');
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (cancelBtn) cancelBtn.addEventListener('click', close);

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const catId = document.getElementById('limitCatId').value;
        const inr = parseFloat(document.getElementById('catLimitAmountInput').value);
        if (isNaN(inr) || inr < 0) return;
        const limitMinor = Math.round(inr * 100);
        storage.setCategoryLimit(this.selectedMonth, catId, limitMinor);
        close();
        this.showToast('Category limit saved', 'success');
        this.renderCurrentPage();
      });
    }
  }

  openCategoryLimitModal(catId, catName, currentInr) {
    const overlay = document.getElementById('catLimitModalOverlay');
    const title = document.getElementById('catLimitModalTitle');
    const idInput = document.getElementById('limitCatId');
    const amountInput = document.getElementById('catLimitAmountInput');
    const desc = document.getElementById('catLimitDescription');

    title.textContent = `Set Limit for ${catName}`;
    desc.textContent = `Set your target monthly spending ceiling for ${catName} in ${this.selectedMonth}.`;
    idInput.value = catId;
    amountInput.value = currentInr && currentInr > 0 ? currentInr : '';

    overlay.classList.add('active');
    amountInput.focus();
  }

  // ==========================================================================
  // DELETE CONFIRMATION & UNDO
  // ==========================================================================
  setupDeleteModalHandlers() {
    const overlay = document.getElementById('confirmDeleteModalOverlay');
    const closeBtn = document.getElementById('closeConfirmDeleteBtn');
    const cancelBtn = document.getElementById('cancelDeleteBtn');
    const confirmBtn = document.getElementById('confirmDeleteActionBtn');

    const close = () => overlay.classList.remove('active');
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (cancelBtn) cancelBtn.addEventListener('click', close);

    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        const txId = confirmBtn.getAttribute('data-id');
        if (txId) {
          const deleted = storage.deleteTransaction(txId);
          this.lastDeletedTx = deleted;
          close();
          this.showToast('Transaction deleted', 'error', () => {
            // Undo action
            if (this.lastDeletedTx) {
              const all = storage.getTransactions();
              all.unshift(this.lastDeletedTx);
              storage.saveTransactions(all);
              this.lastDeletedTx = null;
              this.showToast('Deletion undone', 'success');
              this.renderCurrentPage();
            }
          });
          this.renderCurrentPage();
        }
      });
    }
  }

  openDeleteConfirmModal(txId) {
    const overlay = document.getElementById('confirmDeleteModalOverlay');
    const confirmBtn = document.getElementById('confirmDeleteActionBtn');
    const msg = document.getElementById('deleteConfirmMessage');

    const tx = storage.getTransactions().find(t => t.id === txId);
    if (tx) {
      const cat = storage.getCategoryById(tx.categoryId);
      msg.textContent = `Are you sure you want to delete "${tx.description || cat.name}" (${storage.formatCurrency(tx.amountMinor)})?`;
    }

    confirmBtn.setAttribute('data-id', txId);
    overlay.classList.add('active');
  }

  // ==========================================================================
  // QUICK SEARCH / COMMAND PALETTE
  // ==========================================================================
  setupQuickSearchHandlers() {
    const overlay = document.getElementById('quickSearchModalOverlay');
    const input = document.getElementById('quickSearchInput');
    const results = document.getElementById('quickSearchResults');

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('active');
    });

    if (input) {
      input.addEventListener('input', (e) => {
        const query = (e.target.value || '').trim().toLowerCase();
        if (!query) {
          results.innerHTML = `
            <div style="padding: 12px; font-size: 13px; color: var(--text-muted); text-align: center;">
              Type keywords to search across transactions and destinations.
            </div>
          `;
          return;
        }

        const transactions = storage.getTransactions();
        const matches = transactions.filter(t => {
          const descMatch = (t.description || '').toLowerCase().includes(query);
          const cat = storage.getCategoryById(t.categoryId);
          const catMatch = cat.name.toLowerCase().includes(query);
          return descMatch || catMatch;
        }).slice(0, 8);

        if (matches.length === 0) {
          results.innerHTML = `
            <div style="padding: 16px; font-size: 13px; color: var(--text-muted); text-align: center;">
              No matching records found.
            </div>
          `;
          return;
        }

        results.innerHTML = matches.map(tx => {
          const cat = storage.getCategoryById(tx.categoryId);
          return `
            <div class="category-item-row quick-search-item" data-id="${tx.id}" style="margin-bottom: 6px;">
              <div class="cat-info-group">
                <span class="cat-icon-badge">${cat.icon}</span>
                <div>
                  <div class="cat-name">${tx.description || cat.name}</div>
                  <div class="cat-type">${tx.date} • ${cat.name}</div>
                </div>
              </div>
              <div class="tx-amount-cell ${tx.type === 'income' ? 'income' : 'expense'}">
                ${tx.type === 'income' ? '+' : '-'}${storage.formatCurrency(tx.amountMinor)}
              </div>
            </div>
          `;
        }).join('');

        // Clicking result edits transaction
        results.querySelectorAll('.quick-search-item').forEach(el => {
          el.addEventListener('click', () => {
            const id = el.getAttribute('data-id');
            overlay.classList.remove('active');
            this.openTransactionModal(id);
          });
        });
      });
    }
  }

  openQuickSearch() {
    const overlay = document.getElementById('quickSearchModalOverlay');
    const input = document.getElementById('quickSearchInput');
    overlay.classList.add('active');
    input.value = '';
    input.focus();
  }

  // ==========================================================================
  // AUTHENTICATION & MULTI-USER MODAL
  // ==========================================================================
  setupAuthModalHandlers() {
    const overlay = document.getElementById('authModalOverlay');
    const closeBtn = document.getElementById('closeAuthModalBtn');
    const tabSignIn = document.getElementById('tabSignInBtn');
    const tabSignUp = document.getElementById('tabSignUpBtn');
    const signInForm = document.getElementById('signInForm');
    const signUpForm = document.getElementById('signUpForm');
    const loginError = document.getElementById('loginErrorMsg');
    const registerError = document.getElementById('registerErrorMsg');

    const close = () => overlay.classList.remove('active');
    if (closeBtn) closeBtn.addEventListener('click', close);

    if (tabSignIn && tabSignUp) {
      tabSignIn.addEventListener('click', () => {
        tabSignIn.classList.add('active');
        tabSignUp.classList.remove('active');
        signInForm.style.display = 'block';
        signUpForm.style.display = 'none';
        loginError.style.display = 'none';
      });

      tabSignUp.addEventListener('click', () => {
        tabSignUp.classList.add('active');
        tabSignIn.classList.remove('active');
        signUpForm.style.display = 'block';
        signInForm.style.display = 'none';
        registerError.style.display = 'none';
      });
    }

    // Sign in form
    if (signInForm) {
      signInForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
          const user = storage.login(email, password);
          close();
          this.updateUserProfileHeader();
          this.renderCurrentPage();
          this.showToast(`Welcome back, ${user.name}!`, 'success');
        } catch (err) {
          loginError.textContent = err.message;
          loginError.style.display = 'block';
        }
      });
    }

    // Sign up form
    if (signUpForm) {
      signUpForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;

        try {
          const user = storage.register(name, email, password);
          close();
          this.updateUserProfileHeader();
          this.renderCurrentPage();
          this.showToast(`Account created! Welcome, ${user.name}!`, 'success');
        } catch (err) {
          registerError.textContent = err.message;
          registerError.style.display = 'block';
        }
      });
    }
  }

  openAuthModal(defaultTab = 'signin') {
    const overlay = document.getElementById('authModalOverlay');
    const tabSignIn = document.getElementById('tabSignInBtn');
    const tabSignUp = document.getElementById('tabSignUpBtn');
    const signInForm = document.getElementById('signInForm');
    const signUpForm = document.getElementById('signUpForm');
    const quickList = document.getElementById('quickDemoUsersList');
    const loginError = document.getElementById('loginErrorMsg');
    const registerError = document.getElementById('registerErrorMsg');

    if (loginError) loginError.style.display = 'none';
    if (registerError) registerError.style.display = 'none';

    if (defaultTab === 'signup') {
      tabSignUp.classList.add('active');
      tabSignIn.classList.remove('active');
      signUpForm.style.display = 'block';
      signInForm.style.display = 'none';
    } else {
      tabSignIn.classList.add('active');
      tabSignUp.classList.remove('active');
      signInForm.style.display = 'block';
      signUpForm.style.display = 'none';
    }

    // Populate quick 1-click accounts
    if (quickList) {
      const users = storage.getUsers();
      quickList.innerHTML = users.map(u => `
        <div class="demo-user-card" data-user-email="${u.email}" data-user-pwd="${u.password || 'password123'}">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="user-avatar" style="width: 28px; height: 28px; font-size: 11px;">${u.avatar || u.name[0]}</div>
            <div>
              <div style="font-size: 13px; font-weight: 700;">${u.name}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${u.email}</div>
            </div>
          </div>
          <button type="button" class="promo-btn" style="width: auto; padding: 4px 10px; font-size: 11px;">
            Login →
          </button>
        </div>
      `).join('');

      quickList.querySelectorAll('.demo-user-card').forEach(card => {
        card.addEventListener('click', () => {
          const email = card.getAttribute('data-user-email');
          const pwd = card.getAttribute('data-user-pwd');
          try {
            const user = storage.login(email, pwd);
            overlay.classList.remove('active');
            this.updateUserProfileHeader();
            this.renderCurrentPage();
            this.showToast(`Logged in as ${user.name}`, 'success');
          } catch (err) {
            alert(err.message);
          }
        });
      });
    }

    overlay.classList.add('active');
  }

  // ==========================================================================
  // SALARY & INCOME EDITING MODAL
  // ==========================================================================
  setupSalaryModalHandlers() {
    const overlay = document.getElementById('salaryModalOverlay');
    const closeBtn = document.getElementById('closeSalaryModalBtn');
    const cancelBtn = document.getElementById('cancelSalaryBtn');
    const form = document.getElementById('salaryForm');
    const amountInput = document.getElementById('salaryAmountInput');

    const close = () => overlay.classList.remove('active');
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (cancelBtn) cancelBtn.addEventListener('click', close);

    // Quick preset buttons
    overlay.querySelectorAll('.salary-quick-pills button[data-amt]').forEach(btn => {
      btn.addEventListener('click', () => {
        amountInput.value = btn.getAttribute('data-amt');
      });
    });

    const add5Pct = document.getElementById('salaryAdd5PctBtn');
    if (add5Pct) {
      add5Pct.addEventListener('click', () => {
        const val = parseFloat(amountInput.value) || 42000;
        amountInput.value = Math.round(val * 1.05);
      });
    }

    const add10Pct = document.getElementById('salaryAdd10PctBtn');
    if (add10Pct) {
      add10Pct.addEventListener('click', () => {
        const val = parseFloat(amountInput.value) || 42000;
        amountInput.value = Math.round(val * 1.10);
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const inr = parseFloat(amountInput.value);
        const desc = document.getElementById('salaryDescInput').value;

        if (isNaN(inr) || inr <= 0) {
          alert('Please enter a valid salary amount greater than zero.');
          return;
        }

        const amountMinor = Math.round(inr * 100);
        storage.updateSalaryForMonth(this.selectedMonth, amountMinor, desc);
        close();
        this.renderCurrentPage();
        this.showToast(`Monthly salary updated to ${storage.formatCurrency(amountMinor)}`, 'success');
      });
    }
  }

  openSalaryModal() {
    const overlay = document.getElementById('salaryModalOverlay');
    const preview = document.getElementById('salaryCurrentPreview');
    const amountInput = document.getElementById('salaryAmountInput');
    const monthDisplay = document.getElementById('salaryMonthDisplay');
    const descInput = document.getElementById('salaryDescInput');

    const [year, month] = this.selectedMonth.split('-');
    const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const monthName = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (monthDisplay) monthDisplay.textContent = monthName;

    const existingSalaryTx = storage.getSalaryForMonth(this.selectedMonth);
    const currentPaise = existingSalaryTx ? existingSalaryTx.amountMinor : 4200000;

    if (preview) preview.textContent = storage.formatCurrency(currentPaise);
    if (amountInput) amountInput.value = Math.round(currentPaise / 100);
    if (descInput) descInput.value = existingSalaryTx ? existingSalaryTx.description : `${monthName} salary`;

    overlay.classList.add('active');
    amountInput.focus();
  }

  // ==========================================================================
  // STARTING ACCOUNT BALANCE MODAL
  // ==========================================================================
  setupStartingBalanceModalHandlers() {
    const overlay = document.getElementById('startingBalanceModalOverlay');
    if (!overlay) return;
    const closeBtn = document.getElementById('closeStartingBalanceModalBtn');
    const cancelBtn = document.getElementById('cancelStartingBalanceBtn');
    const form = document.getElementById('startingBalanceForm');
    const amountInput = document.getElementById('startingBalanceAmountInput');

    const close = () => overlay.classList.remove('active');
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (cancelBtn) cancelBtn.addEventListener('click', close);

    // Quick presets
    overlay.querySelectorAll('button[data-starting-amt]').forEach(btn => {
      btn.addEventListener('click', () => {
        amountInput.value = btn.getAttribute('data-starting-amt');
      });
    });

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const inr = parseFloat(amountInput.value);

        if (isNaN(inr) || inr < 0) {
          alert('Please enter a valid starting balance amount.');
          return;
        }

        const amountMinor = Math.round(inr * 100);
        storage.setStartingBalance(amountMinor);
        close();
        this.renderCurrentPage();
        this.showToast(`Starting balance updated to ${storage.formatCurrency(amountMinor)}`, 'success');
      });
    }
  }

  openStartingBalanceModal() {
    const overlay = document.getElementById('startingBalanceModalOverlay');
    if (!overlay) return;
    const preview = document.getElementById('startingBalanceCurrentPreview');
    const amountInput = document.getElementById('startingBalanceAmountInput');

    const currentPaise = storage.getStartingBalance();

    if (preview) preview.textContent = storage.formatCurrency(currentPaise);
    if (amountInput) amountInput.value = Math.round(currentPaise / 100);

    overlay.classList.add('active');
    amountInput.focus();
  }

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.classList.remove('active');
    });
  }

  // ==========================================================================
  // TOAST & FEEDBACK SYSTEM
  // ==========================================================================
  showToast(message, type = 'success', undoCallback = null) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = type === 'success' ? '✓' : '⚠️';
    toast.innerHTML = `
      <span>${icon}</span>
      <span>${message}</span>
      ${undoCallback ? `<button class="toast-undo-btn">Undo</button>` : ''}
    `;

    if (undoCallback) {
      toast.querySelector('.toast-undo-btn').addEventListener('click', () => {
        undoCallback();
        toast.remove();
      });
    }

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 4000);
  }

  // ==========================================================================
  // EXPORT HELPERS
  // ==========================================================================
  downloadCSV() {
    const csvContent = storage.exportCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `budget_transactions_${this.selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('CSV report downloaded', 'success');
  }

  downloadJSON() {
    const jsonContent = storage.exportJSON();
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `budget_backup_${this.selectedMonth}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('JSON backup exported', 'success');
  }
}

// Instantiate application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.budgetApp = new BudgetApp();
});
