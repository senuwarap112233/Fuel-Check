const summaryStats = [
  { title: 'Total Users', value: '1302' },
  { title: 'Total Sheds', value: '256' },
  { title: 'Today Reports', value: '32' },
  { title: 'Active Sheds', value: '242' },
];

const criticalStats = [
  { title: 'Longest Queue', location: 'Singhe associate, Gampaha', accent: 'orange' },
  { title: 'High User Reports', location: 'Singhe associate, Gampaha', accent: 'yellow' },
  { title: 'Highest Demand', location: 'Singhe associate, Gampaha', accent: 'green' },
  { title: 'Low Fuel Stock', location: 'Singhe associate, Gampaha', accent: 'red' },
];

export default function OverviewPage() {
  return (
    <section>
      <h2 className="overview-title">System summary page.</h2>

      <div className="stat-grid">
        {summaryStats.map((card) => (
          <article key={card.title} className="stat-card">
            <p className="stat-label">{card.title}</p>
            <p className="stat-value">{card.value}</p>
          </article>
        ))}
      </div>

      <h3 className="section-title">Critical Fuel Status</h3>

      <div className="critical-grid">
        {criticalStats.map((item) => (
          <article key={item.title} className={`critical-card ${item.accent}`}>
            <p className="critical-title">{item.title}</p>
            <p className="critical-note">{item.location}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
