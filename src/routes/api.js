/**
 * HTTP Route definitions for /api/v1
 */
import { Router } from 'express';

const router = Router();

// Health
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Transactions
router.get('/transactions', (req, res) => {
  res.json({ message: 'Transaction listing endpoint' });
});

router.post('/transactions', (req, res) => {
  res.status(201).json({ message: 'Create transaction' });
});

router.get('/budgets/:month', (req, res) => {
  res.json({ message: 'Budget endpoint' });
});

router.get('/reports/summary', (req, res) => {
  res.json({ message: 'Report summary endpoint' });
});

router.get('/categories', (req, res) => {
  res.json({ message: 'Categories list' });
});

router.get('/settings', (req, res) => {
  res.json({ message: 'Settings endpoint' });
});

export default router;
