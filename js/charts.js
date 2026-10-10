/**
 * SVG Charts generator for Personal Budget Planner
 * Renders high-end interactive vector charts matching the Dribbble design aesthetics
 */

export class ChartRenderer {
  /**
   * Renders an interactive Category Spending Donut Chart
   */
  static renderDonutChart(containerId, categoryData, totalExpensesMinor, formatCurrency) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!categoryData || categoryData.length === 0 || totalExpensesMinor === 0) {
      container.innerHTML = `
        <div class="empty-chart-state">
          <div class="empty-chart-icon">📊</div>
          <p class="empty-chart-text">No expense records for this month yet</p>
        </div>
      `;
      return;
    }

    const size = 260;
    const strokeWidth = 34;
    const radius = (size - strokeWidth) / 2;
    const center = size / 2;
    const circumference = 2 * Math.PI * radius;

    let accumulatedAngle = -90; // Start at top 12 o'clock
    const slices = [];

    categoryData.forEach((item) => {
      const fraction = item.amountMinor / totalExpensesMinor;
      const strokeDash = fraction * circumference;
      const angle = (accumulatedAngle * Math.PI) / 180;
      
      slices.push({
        ...item,
        fraction,
        percentage: (fraction * 100).toFixed(1),
        strokeDash,
        strokeOffset: circumference - strokeDash,
        startAngle: accumulatedAngle
      });

      accumulatedAngle += fraction * 360;
    });

    let currentOffset = 0;
    const pathsSvg = slices.map((slice, i) => {
      const dashArray = `${slice.strokeDash} ${circumference - slice.strokeDash}`;
      const rotation = slice.startAngle + 90;
      const svgCircle = `
        <circle
          class="donut-segment"
          cx="${center}"
          cy="${center}"
          r="${radius}"
          fill="transparent"
          stroke="${slice.color}"
          stroke-width="${strokeWidth}"
          stroke-dasharray="${dashArray}"
          stroke-dashoffset="${-currentOffset}"
          stroke-linecap="round"
          data-index="${i}"
          data-category="${slice.name}"
          data-amount="${formatCurrency(slice.amountMinor)}"
          data-percent="${slice.percentage}%"
          tabindex="0"
        />
      `;
      currentOffset += slice.strokeDash;
      return svgCircle;
    }).join('');

    container.innerHTML = `
      <div class="donut-chart-wrapper">
        <svg class="donut-svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%">
          <circle
            cx="${center}"
            cy="${center}"
            r="${radius}"
            fill="transparent"
            stroke="#F1F3F5"
            stroke-width="${strokeWidth}"
          />
          <g transform="rotate(-90 ${center} ${center})">
            ${pathsSvg}
          </g>
        </svg>
        <div class="donut-center-info" id="${containerId}-center-info">
          <span class="donut-center-label">Total Expenses</span>
          <span class="donut-center-value">${formatCurrency(totalExpensesMinor)}</span>
          <span class="donut-center-sub">${categoryData.length} categories</span>
        </div>
      </div>
    `;

    // Add hover interactions
    const segments = container.querySelectorAll('.donut-segment');
    const centerInfo = document.getElementById(`${containerId}-center-info`);

    segments.forEach((seg) => {
      seg.addEventListener('mouseenter', (e) => {
        const cat = seg.getAttribute('data-category');
        const amt = seg.getAttribute('data-amount');
        const pct = seg.getAttribute('data-percent');
        centerInfo.innerHTML = `
          <span class="donut-center-label">${cat}</span>
          <span class="donut-center-value">${amt}</span>
          <span class="donut-center-sub" style="color: #6366F1; font-weight: 700;">${pct}</span>
        `;
      });
      seg.addEventListener('mouseleave', () => {
        centerInfo.innerHTML = `
          <span class="donut-center-label">Total Expenses</span>
          <span class="donut-center-value">${formatCurrency(totalExpensesMinor)}</span>
          <span class="donut-center-sub">${categoryData.length} categories</span>
        `;
      });
    });
  }

  /**
   * Renders Income vs Expenses Visual Bar Comparison
   */
  static renderIncomeVsExpense(containerId, incomeMinor, expensesMinor, budgetMinor, formatCurrency) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const maxVal = Math.max(incomeMinor, expensesMinor, budgetMinor, 1);
    const incomePct = Math.round((incomeMinor / maxVal) * 100);
    const expensesPct = Math.round((expensesMinor / maxVal) * 100);
    const budgetPct = Math.round((budgetMinor / maxVal) * 100);
    const netSavingsMinor = incomeMinor - expensesMinor;

    container.innerHTML = `
      <div class="comparison-card-inner">
        <div class="comparison-bar-row">
          <div class="comparison-meta">
            <span class="comparison-label"><span class="comp-dot income-dot"></span> Income</span>
            <span class="comparison-amt income-val">${formatCurrency(incomeMinor)}</span>
          </div>
          <div class="comparison-track">
            <div class="comparison-fill income-fill" style="width: ${incomePct}%;"></div>
          </div>
        </div>

        <div class="comparison-bar-row">
          <div class="comparison-meta">
            <span class="comparison-label"><span class="comp-dot expense-dot"></span> Expenses</span>
            <span class="comparison-amt expense-val">${formatCurrency(expensesMinor)}</span>
          </div>
          <div class="comparison-track">
            <div class="comparison-fill expense-fill" style="width: ${expensesPct}%;"></div>
          </div>
        </div>

        <div class="comparison-bar-row">
          <div class="comparison-meta">
            <span class="comparison-label"><span class="comp-dot budget-dot"></span> Monthly Budget</span>
            <span class="comparison-amt budget-val">${formatCurrency(budgetMinor)}</span>
          </div>
          <div class="comparison-track">
            <div class="comparison-fill budget-fill" style="width: ${budgetPct}%;"></div>
          </div>
        </div>

        <div class="comparison-footer">
          <div class="net-pill ${netSavingsMinor >= 0 ? 'surplus' : 'deficit'}">
            <span>Net Monthly ${netSavingsMinor >= 0 ? 'Surplus' : 'Deficit'}:</span>
            <strong>${formatCurrency(netSavingsMinor)}</strong>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renders Dark Sleek Daily Spending Bar Chart (matching the Sleep Analysis card in screenshot)
   */
  static renderDailySpendingChart(containerId, transactions, monthStr, formatCurrency) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Filter only expenses for this month
    const expenseTxns = (transactions || []).filter(t => t.type === 'expense' && t.date.startsWith(monthStr));

    // Group by day of month (1 to 15)
    const [year, month] = monthStr.split('-').map(Number);
    const dailyExpenses = {};
    const dailyTxnsMap = {};

    for (let d = 1; d <= 15; d++) {
      const dStr = `${monthStr}-${String(d).padStart(2, '0')}`;
      dailyExpenses[dStr] = 0;
      dailyTxnsMap[dStr] = [];
    }

    expenseTxns.forEach(t => {
      if (dailyExpenses[t.date] !== undefined) {
        dailyExpenses[t.date] += t.amountMinor;
        dailyTxnsMap[t.date].push(t);
      }
    });

    const displayEntries = Object.entries(dailyExpenses);
    const maxDaySpending = Math.max(...displayEntries.map(([, amt]) => amt), 1);

    const barsHtml = displayEntries.map(([date, amountMinor]) => {
      const dayNum = parseInt(date.split('-')[2], 10);
      const dayLabel = String(dayNum).padStart(2, '0');
      const dayTxns = dailyTxnsMap[date] || [];
      const desc = dayTxns.length > 0 ? dayTxns.map(t => t.description || 'Expense').join(', ') : 'No spending';

      // Perceptual power-scaling: prevents ₹15k rent from flattening everyday ₹90-₹850 spending into invisible slivers
      let heightPct = 8;
      if (amountMinor > 0) {
        const normalized = amountMinor / maxDaySpending;
        heightPct = Math.round(18 + Math.pow(normalized, 0.40) * 68);
      }

      const isTopPeak = amountMinor === maxDaySpending;
      const isNotable = amountMinor >= 70000; // >= ₹700 (e.g. Groceries)

      return `
        <div class="trend-bar-col" 
             data-date="${date}" 
             data-amount="${formatCurrency(amountMinor)}" 
             data-desc="${desc}" 
             data-day="${dayNum}">
          <div class="trend-bar-wrapper">
            <div class="trend-bar ${isTopPeak ? 'highlight-lime peak-bar' : isNotable ? 'highlight-subtle' : 'pattern-bar'}" 
                 style="height: ${heightPct}%;">
              ${isTopPeak ? `<span class="trend-bar-badge">${formatCurrency(amountMinor)}</span>` : ''}
            </div>
          </div>
          <span class="trend-day-label ${isTopPeak ? 'active' : ''}">${dayLabel}${isTopPeak ? ' ↗' : ''}</span>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="trend-chart-header">
        <div>
          <span class="trend-sub" id="${containerId}-sub">OCTOBER 2026 DAILY EXPENSES</span>
          <h4 class="trend-title" id="${containerId}-detail">Daily Spending Rhythm</h4>
        </div>
        <div class="trend-badge-pill" id="${containerId}-pill">
          <span class="trend-dot"></span> Oct 01 - 15 (Hover a bar)
        </div>
      </div>
      <div class="trend-bars-container">
        ${barsHtml}
      </div>
    `;

    // Add interactive hover listener to inspect any day
    const detailEl = document.getElementById(`${containerId}-detail`);
    const subEl = document.getElementById(`${containerId}-sub`);
    const pillEl = document.getElementById(`${containerId}-pill`);
    const barCols = container.querySelectorAll('.trend-bar-col');

    barCols.forEach(col => {
      col.addEventListener('mouseenter', () => {
        const date = col.getAttribute('data-date');
        const amt = col.getAttribute('data-amount');
        const desc = col.getAttribute('data-desc');
        const day = col.getAttribute('data-day');

        if (detailEl) detailEl.innerHTML = `Oct ${day}: <span style="color: var(--lime-primary); font-weight:800;">${amt}</span>`;
        if (subEl) subEl.textContent = desc;
        if (pillEl) pillEl.innerHTML = `<span class="trend-dot"></span> Date: ${date}`;
      });

      col.addEventListener('mouseleave', () => {
        if (detailEl) detailEl.textContent = 'Daily Spending Rhythm';
        if (subEl) subEl.textContent = 'OCTOBER 2026 DAILY EXPENSES';
        if (pillEl) pillEl.innerHTML = `<span class="trend-dot"></span> Oct 01 - 15 (Hover a bar)`;
      });
    });
  }
}
