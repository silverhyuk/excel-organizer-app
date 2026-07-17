import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

const CATEGORY_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)'
];

const tooltipStyle = {
  background: 'var(--surface-elevated)',
  borderColor: 'var(--border-glass)',
  borderRadius: 10,
  color: 'var(--text-primary)'
};

const formatWon = value => `₩${Number(value).toLocaleString()}`;

function buildCashFlowData(transactions) {
  const daily = new Map();
  transactions.forEach(transaction => {
    const date = String(transaction.date).slice(0, 10);
    const current = daily.get(date) || 0;
    daily.set(date, current + transaction.deposit - transaction.withdrawal);
  });

  let cumulative = 0;
  return [...daily.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, net]) => {
      cumulative += net;
      return { date: date.slice(5), net, cumulative };
    });
}

export default function FinancialCharts({ transactions, categoryStats }) {
  const expenseData = categoryStats
    .filter(category => category.key !== 'income' && category.amount > 0)
    .map(category => ({ name: category.name, value: category.amount }));
  const cashFlowData = buildCashFlowData(transactions);

  return (
    <section className="charts-grid" aria-label="거래 분석 차트">
      <div className="glass-panel chart-card">
        <div className="chart-card-header">
          <div>
            <span className="chart-eyebrow">EXPENSE MIX</span>
            <h3>카테고리별 지출</h3>
          </div>
          <span className="chart-caption">출금 기준</span>
        </div>
        {expenseData.length > 0 ? (
          <div className="donut-layout">
            <div className="donut-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expenseData} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={2} stroke="none">
                    {expenseData.map((entry, index) => <Cell key={entry.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    formatter={value => formatWon(value)}
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: 'var(--text-primary)' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-legend">
              {expenseData.map((entry, index) => (
                <div className="chart-legend-item" key={entry.name}>
                  <span className="legend-dot" style={{ background: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} />
                  <span>{entry.name}</span>
                  <strong>{formatWon(entry.value)}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : <div className="chart-empty">표시할 지출 데이터가 없습니다.</div>}
      </div>

      <div className="glass-panel chart-card">
        <div className="chart-card-header">
          <div>
            <span className="chart-eyebrow">CASH FLOW</span>
            <h3>누적 순 현금흐름</h3>
          </div>
          <span className="chart-caption">입금 - 출금</span>
        </div>
        {cashFlowData.length > 0 ? (
          <div className="cashflow-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlowData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cashFlowFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={value => `${Math.round(value / 10000)}만`} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                <Tooltip
                  formatter={(value, name) => [formatWon(value), name === 'cumulative' ? '누적 현금흐름' : name]}
                  labelFormatter={label => `날짜 ${label}`}
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: 'var(--text-primary)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Area type="monotone" dataKey="cumulative" stroke="var(--chart-3)" strokeWidth={2.5} fill="url(#cashFlowFill)" activeDot={{ r: 5, fill: 'var(--chart-1)' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : <div className="chart-empty">표시할 거래 데이터가 없습니다.</div>}
      </div>
    </section>
  );
}
