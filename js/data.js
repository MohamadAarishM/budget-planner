/**
 * Seed data for BudgetNest
 * All currency values are stored as integer minor units (paise).
 * ₹1 = 100 paise.
 * October 2026 reference dataset.
 */

export const INITIAL_CATEGORIES = [
  { id: 'salary', name: 'Salary', type: 'income', icon: '💼', color: '#10B981' },
  { id: 'freelance', name: 'Freelance', type: 'income', icon: '💻', color: '#06B6D4' },
  { id: 'food', name: 'Food & Dining', type: 'expense', icon: '🍽️', color: '#F59E0B' },
  { id: 'transport', name: 'Transport', type: 'expense', icon: '🚇', color: '#3B82F6' },
  { id: 'housing', name: 'Housing', type: 'expense', icon: '🏠', color: '#8B5CF6' },
  { id: 'utilities', name: 'Utilities', type: 'expense', icon: '⚡', color: '#EC4899' },
  { id: 'shopping', name: 'Shopping', type: 'expense', icon: '🛍️', color: '#F97316' },
  { id: 'health', name: 'Health', type: 'expense', icon: '💊', color: '#14B8A6' },
  { id: 'entertainment', name: 'Entertainment', type: 'expense', icon: '🎬', color: '#A855F7' }
];

export const DEFAULT_USERS = [
  {
    id: 'user_aarish',
    name: 'Mohamad Aarish',
    email: 'mohamadaarish.m@budgetnest.app',
    password: 'password123',
    currencyCode: 'INR',
    currencySymbol: '₹',
    avatar: 'MA'
  },
  {
    id: 'user_sarah',
    name: 'Sarah Jenkins',
    email: 'sarah.j@budgetnest.app',
    password: 'password123',
    currencyCode: 'INR',
    currencySymbol: '₹',
    avatar: 'SJ'
  },
  {
    id: 'user_priya',
    name: 'Priya Sharma',
    email: 'priya.s@budgetnest.app',
    password: 'password123',
    currencyCode: 'INR',
    currencySymbol: '₹',
    avatar: 'PS'
  }
];

export const INITIAL_SETTINGS = {
  currencyCode: 'INR',
  currencySymbol: '₹',
  weekStart: 'monday',
  userName: 'Mohamad Aarish',
  userEmail: 'mohamadaarish.m@budgetnest.app',
  defaultMonth: '2026-10',
  startingBalanceMinor: 5000000 // ₹50,000 opening account balance
};

// Monthly budget: ₹50,000 = 5,000,000 paise
// Category limits total: ₹46,000
export const INITIAL_BUDGETS = {
  '2026-10': {
    monthlyBudgetMinor: 5000000,
    categories: {
      housing: 1500000,       // ₹15,000
      food: 1000000,          // ₹10,000
      transport: 500000,      // ₹5,000
      utilities: 400000,      // ₹4,000
      shopping: 500000,       // ₹5,000
      health: 300000,         // ₹3,000
      entertainment: 400000   // ₹4,000
    }
  }
};

// 15 Sample Transactions for October 2026 (stored in minor units: paise)
// Income total: ₹42,000 + ₹5,000 = ₹47,000 (4,700,000 paise)
// Expenses total: ₹19,280 (1,928,000 paise)
export const INITIAL_TRANSACTIONS = [
  {
    id: 'txn_01',
    date: '2026-10-01',
    description: 'October salary',
    categoryId: 'salary',
    type: 'income',
    amountMinor: 4200000, // ₹42,000
    createdAt: '2026-10-01T09:00:00.000Z'
  },
  {
    id: 'txn_02',
    date: '2026-10-02',
    description: 'October rent',
    categoryId: 'housing',
    type: 'expense',
    amountMinor: 1500000, // ₹15,000
    createdAt: '2026-10-02T10:00:00.000Z'
  },
  {
    id: 'txn_03',
    date: '2026-10-03',
    description: 'Weekly groceries',
    categoryId: 'food',
    type: 'expense',
    amountMinor: 85000, // ₹850
    createdAt: '2026-10-03T11:30:00.000Z'
  },
  {
    id: 'txn_04',
    date: '2026-10-04',
    description: 'Metro card recharge',
    categoryId: 'transport',
    type: 'expense',
    amountMinor: 12000, // ₹120
    createdAt: '2026-10-04T08:45:00.000Z'
  },
  {
    id: 'txn_05',
    date: '2026-10-05',
    description: 'Logo design project',
    categoryId: 'freelance',
    type: 'income',
    amountMinor: 500000, // ₹5,000
    createdAt: '2026-10-05T15:20:00.000Z'
  },
  {
    id: 'txn_06',
    date: '2026-10-06',
    description: 'Electricity bill',
    categoryId: 'utilities',
    type: 'expense',
    amountMinor: 18000, // ₹180
    createdAt: '2026-10-06T14:10:00.000Z'
  },
  {
    id: 'txn_07',
    date: '2026-10-07',
    description: 'Dinner with friends',
    categoryId: 'food',
    type: 'expense',
    amountMinor: 45000, // ₹450
    createdAt: '2026-10-07T20:15:00.000Z'
  },
  {
    id: 'txn_08',
    date: '2026-10-08',
    description: 'Movie tickets',
    categoryId: 'entertainment',
    type: 'expense',
    amountMinor: 24000, // ₹240
    createdAt: '2026-10-08T18:00:00.000Z'
  },
  {
    id: 'txn_09',
    date: '2026-10-09',
    description: 'Running shoes',
    categoryId: 'shopping',
    type: 'expense',
    amountMinor: 32000, // ₹320
    createdAt: '2026-10-09T16:40:00.000Z'
  },
  {
    id: 'txn_10',
    date: '2026-10-10',
    description: 'Pharmacy',
    categoryId: 'health',
    type: 'expense',
    amountMinor: 15000, // ₹150
    createdAt: '2026-10-10T12:05:00.000Z'
  },
  {
    id: 'txn_11',
    date: '2026-10-11',
    description: 'Groceries',
    categoryId: 'food',
    type: 'expense',
    amountMinor: 78000, // ₹780
    createdAt: '2026-10-11T11:15:00.000Z'
  },
  {
    id: 'txn_12',
    date: '2026-10-12',
    description: 'Taxi',
    categoryId: 'transport',
    type: 'expense',
    amountMinor: 9000, // ₹90
    createdAt: '2026-10-12T09:30:00.000Z'
  },
  {
    id: 'txn_13',
    date: '2026-10-13',
    description: 'Internet bill',
    categoryId: 'utilities',
    type: 'expense',
    amountMinor: 28000, // ₹280
    createdAt: '2026-10-13T10:00:00.000Z'
  },
  {
    id: 'txn_14',
    date: '2026-10-14',
    description: 'Restaurant lunch',
    categoryId: 'food',
    type: 'expense',
    amountMinor: 60000, // ₹600
    createdAt: '2026-10-14T13:45:00.000Z'
  },
  {
    id: 'txn_15',
    date: '2026-10-15',
    description: 'Household supplies',
    categoryId: 'shopping',
    type: 'expense',
    amountMinor: 22000, // ₹220
    createdAt: '2026-10-15T17:10:00.000Z'
  }
];
