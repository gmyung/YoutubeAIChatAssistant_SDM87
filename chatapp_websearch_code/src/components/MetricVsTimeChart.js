import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import './MetricVsTimeChart.css';

export default function MetricVsTimeChart({ data, metricField = 'value', title }) {
  const [enlarged, setEnlarged] = useState(false);

  if (!data?.length) return null;

  const handleDownload = () => {
    const csv = [
      ['date', 'value', 'title'].join(','),
      ...data.map((d) => [d.date || d.time, d.value, (d.title || '').replace(/"/g, '""')].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `metric_vs_time_${metricField}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const chart = (
    <>
      <p className="metric-vs-time-label">{title || `${metricField} over time`}</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              color: '#e2e8f0',
            }}
            formatter={(value) => [value?.toLocaleString(), metricField]}
          />
          <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
      <div className="metric-vs-time-actions">
        <button type="button" className="metric-vs-time-download" onClick={handleDownload}>
          Download CSV
        </button>
      </div>
    </>
  );

  return (
    <div className="metric-vs-time-wrap">
      <div
        className="metric-vs-time-inner"
        role="button"
        tabIndex={0}
        onClick={() => setEnlarged(true)}
        onKeyDown={(e) => e.key === 'Enter' && setEnlarged(true)}
      >
        {chart}
      </div>
      {enlarged && (
        <div className="metric-vs-time-modal" onClick={() => setEnlarged(false)} role="dialog">
          <div className="metric-vs-time-modal-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="metric-vs-time-modal-close" onClick={() => setEnlarged(false)}>
              ×
            </button>
            {chart}
          </div>
        </div>
      )}
    </div>
  );
}
