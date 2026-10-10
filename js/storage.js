/**
 * Storage and calculations engine for Personal Budget Planner
 * Handles Multi-User Authentication, per-user localStorage isolation,
 * Salary & Income management, calculations, validations, and export/import.
 */

import { INITIAL_CATEGORIES, INITIAL_SETTINGS, INITIAL_BUDGETS, INITIAL_TRANSACTIONS, DEFAULT_USERS } from './data.js';

const STORAGE_KEYS = {
  USERS: 'pbp_users_v2',
  CURRENT_USER: 'pbp_current_user_v2',
  LEGACY_TX: 'pbp_transactions_v1',
  LEGACY_SETTINGS: 'pbp_settings_v1',
  LEGACY_BUDGETS: 'pbp_budgets_v1'
};

class StorageManager {
  constructor() {
    this.init();
  }

  init() {
    // Initialize users list if not present
    let users = this.getUsers();
    if (!users || users.length === 0) {
      users = [...DEFAULT_USERS];
      this.saveUsers(users);
    }

    // Initialize current user
    let currentUserId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!currentUserId || !users.some(u => u.id === currentUserId)) {
      currentUserId = 'user_aarish';
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, currentUserId);
    }

    // Ensure current user's dataset is initialized
    this.ensureUserData(currentUserId);
  }

  // --- MULTI-USER AUTH & PROFILE ---
  getUsers() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      return data ? JSON.parse(data) : [...DEFAULT_USERS];
    } catch {
      return [...DEFAULT_USERS];
    }
  }

  saveUsers(users) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }

  getCurrentUser() {
    const users = this.getUsers();
    const currentId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER) || 'user_aarish';
    return users.find(u => u.id === currentId) || users[0] || DEFAULT_USERS[0];
  }

  setCurrentUser(userId) {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) throw new Error('User not found');
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, userId);
    this.ensureUserData(userId);
    return user;
  }

  login(email, password) {
    const users = this.getUsers();
    const cleanEmail = (email || '').trim().toLowerCase();
    const user = users.find(u => u.email.toLowerCase() === cleanEmail && u.password === password);
    if (!user) {
      throw new Error('Invalid email or password.');
    }
    this.setCurrentUser(user.id);
    return user;
  }

  register(name, email, password) {
    const users = this.getUsers();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (name || '').trim();

    if (!cleanName) throw new Error('Name is required.');
    if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Valid email is required.');
    if (!password || password.length < 4) throw new Error('Password must be at least 4 characters.');

    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      throw new Error('An account with this email already exists.');
    }

    const initials = cleanName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
    const newUser = {
      id: 'user_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      name: cleanName,
      email: cleanEmail,
      password: password,
      currencyCode: 'INR',
      currencySymbol: '₹',
      avatar: initials
    };

    users.push(newUser);
    this.saveUsers(users);

    // Initialize clean starter data for new user
    this.initializeNewUserData(newUser.id, cleanName, cleanEmail);
    this.setCurrentUser(newUser.id);
    return newUser;
  }

  logout() {
    // Keep user list intact, switch to default or signal logged-out
    // We can allow guest/login screen prompt
    return true;
  }

  // --- PER-USER DATA STORAGE ---
  getUserDataKey(userId, keyType) {
    return `pbp_${userId}_${keyType}_v2`;
  }

  ensureUserData(userId) {
    const txKey = this.getUserDataKey(userId, 'transactions');
    if (!localStorage.getItem(txKey)) {
      if (userId === 'user_aarish') {
        // Use reference seed data for Mohamad Aarish
        localStorage.setItem(txKey, JSON.stringify(INITIAL_TRANSACTIONS));
        localStorage.setItem(this.getUserDataKey(userId, 'budgets'), JSON.stringify(INITIAL_BUDGETS));
        localStorage.setItem(this.getUserDataKey(userId, 'categories'), JSON.stringify(INITIAL_CATEGORIES));
        localStorage.setItem(this.getUserDataKey(userId, 'settings'), JSON.stringify({
          ...INITIAL_SETTINGS,
          userName: 'Mohamad Aarish',
          userEmail: 'mohamadaarish.m@budget.app'
        }));
      } else {
        const user = this.getUsers().find(u => u.id === userId);
        this.initializeNewUserData(userId, user ? user.name : 'User', user ? user.email : 'user@budget.app');
      }
    }
  }

  initializeNewUserData(userId, name, email) {
    // Starter setup for new accounts
    const starterCategories = [...INITIAL_CATEGORIES];
    const starterSettings = {
      ...INITIAL_SETTINGS,
      userName: name,
      userEmail: email,
      defaultMonth: '2026-10'
    };
    const starterBudgets = {
      '2026-10': {
        monthlyBudgetMinor: 4000000, // ₹40,000
        categories: {
          housing: 1200000,
          food: 800000,
          transport: 400000,
          utilities: 300000
        }
      }
    };
    // Starter salary transaction
    const starterTransactions = [
      {
        id: 'txn_' + Date.now().toString(36) + '_sal',
        date: '2026-10-01',
        description: 'Monthly salary',
        categoryId: 'salary',
        type: 'income',
        amountMinor: 3500000, // ₹35,000
        createdAt: new Date().toISOString()
      }
    ];

    localStorage.setItem(this.getUserDataKey(userId, 'transactions'), JSON.stringify(starterTransactions));
    localStorage.setItem(this.getUserDataKey(userId, 'budgets'), JSON.stringify(starterBudgets));
    localStorage.setItem(this.getUserDataKey(userId, 'categories'), JSON.stringify(starterCategories));
    localStorage.setItem(this.getUserDataKey(userId, 'settings'), JSON.stringify(starterSettings));
  }

  // --- SETTINGS (Scoped to Current User) ---
  getSettings() {
    const user = this.getCurrentUser();
    const key = this.getUserDataKey(user.id, 'settings');
    try {
      const data = localStorage.getItem(key);
      const parsed = data ? JSON.parse(data) : { ...INITIAL_SETTINGS };
      parsed.userName = user.name;
      parsed.userEmail = user.email;
      return parsed;
    } catch {
      return { ...INITIAL_SETTINGS, userName: user.name, userEmail: user.email };
    }
  }

  saveSettings(newSettings) {
    const user = this.getCurrentUser();
    const current = this.getSettings();
    const updated = { ...current, ...newSettings };
    const key = this.getUserDataKey(user.id, 'settings');
    localStorage.setItem(key, JSON.stringify(updated));

    // Update user profile record if name or email changed
    if (newSettings.userName || newSettings.userEmail) {
      const users = this.getUsers();
      const idx = users.findIndex(u => u.id === user.id);
      if (idx !== -1) {
        if (newSettings.userName) users[idx].name = newSettings.userName;
        if (newSettings.userEmail) users[idx].email = newSettings.userEmail;
        this.saveUsers(users);
      }
    }

    return updated;
  }

  // --- CATEGORIES (Scoped to Current User) ---
  getCategories() {
    const user = this.getCurrentUser();
    const key = this.getUserDataKey(user.id, 'categories');
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [...INITIAL_CATEGORIES];
    } catch {
      return [...INITIAL_CATEGORIES];
    }
  }

  saveCategories(categories) {
    const user = this.getCurrentUser();
    localStorage.setItem(this.getUserDataKey(user.id, 'categories'), JSON.stringify(categories));
  }

  getCategoryById(id) {
    const categories = this.getCategories();
    return categories.find(c => c.id === id) || { id, name: id, icon: '🏷️', color: '#64748B', type: 'expense' };
  }

  addCategory(category) {
    const categories = this.getCategories();
    if (categories.some(c => c.id === category.id)) {
      throw new Error(`Category ID "${category.id}" already exists`);
    }
    categories.push(category);
    this.saveCategories(categories);
    return category;
  }

  // --- BUDGETS (Scoped to Current User) ---
  getAllBudgets() {
    const user = this.getCurrentUser();
    const key = this.getUserDataKey(user.id, 'budgets');
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : { ...INITIAL_BUDGETS };
    } catch {
      return { ...INITIAL_BUDGETS };
    }
  }

  getBudgetForMonth(monthStr) {
    const all = this.getAllBudgets();
    if (all[monthStr]) return all[monthStr];
    return { monthlyBudgetMinor: 5000000, categories: {} };
  }

  setMonthlyBudget(monthStr, amountMinor) {
    const user = this.getCurrentUser();
    const all = this.getAllBudgets();
    if (!all[monthStr]) {
      all[monthStr] = { monthlyBudgetMinor: 0, categories: {} };
    }
    all[monthStr].monthlyBudgetMinor = Math.max(0, parseInt(amountMinor, 10));
    localStorage.setItem(this.getUserDataKey(user.id, 'budgets'), JSON.stringify(all));
    return all[monthStr];
  }

  setCategoryLimit(monthStr, categoryId, limitMinor) {
    const user = this.getCurrentUser();
    const all = this.getAllBudgets();
    if (!all[monthStr]) {
      all[monthStr] = { monthlyBudgetMinor: 5000000, categories: {} };
    }
    if (!all[monthStr].categories) {
      all[monthStr].categories = {};
    }
    if (limitMinor === null || limitMinor === undefined) {
      delete all[monthStr].categories[categoryId];
    } else {
      all[monthStr].categories[categoryId] = Math.max(0, parseInt(limitMinor, 10));
    }
    localStorage.setItem(this.getUserDataKey(user.id, 'budgets'), JSON.stringify(all));
    return all[monthStr];
  }

  // --- TRANSACTIONS (Scoped to Current User) ---
  getTransactions() {
    const user = this.getCurrentUser();
    const key = this.getUserDataKey(user.id, 'transactions');
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [...INITIAL_TRANSACTIONS];
    } catch {
      return [...INITIAL_TRANSACTIONS];
    }
  }

  saveTransactions(transactions) {
    const user = this.getCurrentUser();
    localStorage.setItem(this.getUserDataKey(user.id, 'transactions'), JSON.stringify(transactions));
  }

  addTransaction(txData) {
    const transactions = this.getTransactions();
    const id = 'txn_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const newTx = {
      id,
      date: txData.date,
      description: (txData.description || '').trim(),
      categoryId: txData.categoryId,
      type: txData.type,
      amountMinor: Math.max(0, parseInt(txData.amountMinor, 10)),
      createdAt: new Date().toISOString()
    };
    transactions.unshift(newTx);
    this.saveTransactions(transactions);
    return newTx;
  }

  updateTransaction(id, updates) {
    const transactions = this.getTransactions();
    const idx = transactions.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Transaction not found');
    transactions[idx] = {
      ...transactions[idx],
      ...updates,
      amountMinor: Math.max(0, parseInt(updates.amountMinor !== undefined ? updates.amountMinor : transactions[idx].amountMinor, 10)),
      updatedAt: new Date().toISOString()
    };
    this.saveTransactions(transactions);
    return transactions[idx];
  }

  deleteTransaction(id) {
    const transactions = this.getTransactions();
    const deletedTx = transactions.find(t => t.id === id);
    const updated = transactions.filter(t => t.id !== id);
    this.saveTransactions(updated);
    return deletedTx;
  }

  // ==========================================================================
  // SALARY & INCOME EDITING METHOD
  // ==========================================================================

  /**
   * Finds the primary salary transaction for a given month (YYYY-MM).
   * @param {string} monthStr e.g. "2026-10"
   */
  getSalaryForMonth(monthStr) {
    const transactions = this.getTransactions();
    return transactions.find(t => t.type === 'income' && t.categoryId === 'salary' && t.date.startsWith(monthStr)) || null;
  }

  /**
   * Sets, updates, or adjusts the primary salary for a given month.
   * Modifies existing transaction or creates one if it doesn't exist.
   * @param {string} monthStr e.g. "2026-10"
   * @param {number} amountMinor amount in integer paise
   * @param {string} description optional description
   */
  updateSalaryForMonth(monthStr, amountMinor, description = 'October salary') {
    const transactions = this.getTransactions();
    const existingSalaryTx = this.getSalaryForMonth(monthStr);

    if (existingSalaryTx) {
      return this.updateTransaction(existingSalaryTx.id, {
        amountMinor: Math.max(0, parseInt(amountMinor, 10)),
        description: description || existingSalaryTx.description || 'Monthly salary',
        date: existingSalaryTx.date || `${monthStr}-01`
      });
    } else {
      // Create a salary record on the 1st of the month
      return this.addTransaction({
        date: `${monthStr}-01`,
        description: description || 'Monthly salary',
        categoryId: 'salary',
        type: 'income',
        amountMinor: Math.max(0, parseInt(amountMinor, 10))
      });
    }
  }

  // --- CALCULATIONS FOR MONTH ---
  getMonthSummary(monthStr) {
    const transactions = this.getTransactions();
    const budgetData = this.getBudgetForMonth(monthStr);
    const monthlyBudgetMinor = budgetData.monthlyBudgetMinor || 0;
    const settings = this.getSettings();
    const startingBalanceMinor = settings.startingBalanceMinor !== undefined ? settings.startingBalanceMinor : 5000000;

    const monthTxns = transactions.filter(t => t.date && t.date.startsWith(monthStr));

    let incomeMinor = 0;
    let expensesMinor = 0;
    const categoryTotals = {};

    monthTxns.forEach(tx => {
      if (tx.type === 'income') {
        incomeMinor += tx.amountMinor;
      } else if (tx.type === 'expense') {
        expensesMinor += tx.amountMinor;
        categoryTotals[tx.categoryId] = (categoryTotals[tx.categoryId] || 0) + tx.amountMinor;
      }
    });

    // Explicit calculations:
    // 1. Budget left = Monthly budget - Expenses
    const budgetRemainingMinor = monthlyBudgetMinor - expensesMinor;
    // 2. Net this month = Income - Expenses
    const netMonthMinor = incomeMinor - expensesMinor;
    // 3. Actual Account Balance = Starting account balance + Income - Expenses
    const actualAccountBalanceMinor = startingBalanceMinor + netMonthMinor;
    const availableBalanceMinor = actualAccountBalanceMinor;
    const progressPercent = monthlyBudgetMinor > 0 
      ? Math.min(100, Math.round((expensesMinor / monthlyBudgetMinor) * 1000) / 10)
      : 0;

    return {
      month: monthStr,
      monthlyBudgetMinor,
      startingBalanceMinor,
      incomeMinor,
      expensesMinor,
      budgetRemainingMinor,      // Budget left
      netMonthMinor,             // Net this month
      actualAccountBalanceMinor, // Actual account balance (starting + net)
      availableBalanceMinor,
      progressPercent,
      transactionCount: monthTxns.length,
      categoryTotals,
      transactions: monthTxns
    };
  }

  getStartingBalance() {
    const settings = this.getSettings();
    return settings.startingBalanceMinor !== undefined ? settings.startingBalanceMinor : 5000000;
  }

  setStartingBalance(amountMinor) {
    return this.saveSettings({ startingBalanceMinor: Math.max(0, parseInt(amountMinor, 10)) });
  }

  // Currency Formatter
  formatCurrency(paiseAmount, showDecimals = false) {
    const settings = this.getSettings();
    const symbol = settings.currencySymbol || '₹';
    const isNegative = paiseAmount < 0;
    const absPaise = Math.abs(paiseAmount);
    const rupees = absPaise / 100;

    let formattedRupees;
    if (showDecimals || rupees % 1 !== 0) {
      formattedRupees = rupees.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    } else {
      formattedRupees = rupees.toLocaleString('en-IN', {
        maximumFractionDigits: 0
      });
    }

    return `${isNegative ? '-' : ''}${symbol}${formattedRupees}`;
  }

  // Export data as JSON
  exportJSON() {
    const user = this.getCurrentUser();
    const data = {
      user: { id: user.id, name: user.name, email: user.email },
      settings: this.getSettings(),
      categories: this.getCategories(),
      budgets: this.getAllBudgets(),
      transactions: this.getTransactions(),
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  }

  // Export data as CSV
  exportCSV() {
    const transactions = this.getTransactions();
    const categoriesMap = new Map(this.getCategories().map(c => [c.id, c.name]));
    const headers = ['ID', 'Date', 'Type', 'Category', 'Description', 'Amount (INR)', 'Amount (Paise)'];
    
    const rows = transactions.map(t => {
      const categoryName = categoriesMap.get(t.categoryId) || t.categoryId;
      const inr = (t.amountMinor / 100).toFixed(2);
      const desc = `"${(t.description || '').replace(/"/g, '""')}"`;
      return [t.id, t.date, t.type, `"${categoryName}"`, desc, inr, t.amountMinor].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  resetCurrentUserDataToSeed() {
    const user = this.getCurrentUser();
    localStorage.removeItem(this.getUserDataKey(user.id, 'transactions'));
    localStorage.removeItem(this.getUserDataKey(user.id, 'budgets'));
    localStorage.removeItem(this.getUserDataKey(user.id, 'categories'));
    localStorage.removeItem(this.getUserDataKey(user.id, 'settings'));
    this.ensureUserData(user.id);
  }

  clearAllData() {
    const user = this.getCurrentUser();
    localStorage.removeItem(this.getUserDataKey(user.id, 'transactions'));
    localStorage.removeItem(this.getUserDataKey(user.id, 'budgets'));
    localStorage.removeItem(this.getUserDataKey(user.id, 'categories'));
    localStorage.removeItem(this.getUserDataKey(user.id, 'settings'));
    this.ensureUserData(user.id);
  }
}

export const storage = new StorageManager();
