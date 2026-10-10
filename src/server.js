/**
 * Server entrypoint
 */
import app from './app.js';

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`🚀 Personal Budget Planner server active on http://localhost:${PORT}`);
});
