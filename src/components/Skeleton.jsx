// Skeleton — shimmer placeholders for loading states

const shimmerStyle = {
  background: 'linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-hover) 50%, var(--bg-tertiary) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: 'var(--radius-sm)',
}

function Block({ width = '100%', height = 16, radius, style }) {
  return (
    <div style={{
      ...shimmerStyle,
      width,
      height,
      borderRadius: radius || 'var(--radius-sm)',
      flexShrink: 0,
      ...style,
    }} />
  )
}

/* ── Page-level skeleton layouts ── */

export function SkeletonDashboard() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
      {/* Header controls */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[80, 60, 60, 60, 60].map((w, i) => <Block key={i} width={w} height={32} radius={20} />)}
      </div>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ padding: 20, background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Block width={80} height={12} />
            <Block width={140} height={28} />
            <Block width="100%" height={12} />
          </div>
        ))}
      </div>
      {/* Chart */}
      <Block width="100%" height={280} radius="var(--radius-md)" style={{ flex: 1, minHeight: 200 }} />
    </div>
  )
}

export function SkeletonEvolucion() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[100, 80, 80, 80].map((w, i) => <Block key={i} width={w} height={32} radius={20} />)}
      </div>
      <Block width="100%" height={260} radius="var(--radius-md)" style={{ flex: 1, minHeight: 200 }} />
      <Block width="100%" height={200} radius="var(--radius-md)" style={{ flex: 1, minHeight: 150 }} />
    </div>
  )
}

export function SkeletonGastos() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {[80, 60, 60, 60].map((w, i) => <Block key={i} width={w} height={32} radius={20} />)}
      </div>
      <Block width="100%" height={240} radius="var(--radius-md)" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[0, 1, 2, 3, 4].map(i => <Block key={i} width="100%" height={40} />)}
      </div>
    </div>
  )
}

export function SkeletonTable() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {[100, 100].map((w, i) => <Block key={i} width={w} height={36} radius={20} />)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Block width="100%" height={36} />
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
          <Block key={i} width="100%" height={44} style={{ opacity: 1 - i * 0.08 }} />
        ))}
      </div>
    </div>
  )
}

export function SkeletonForm() {
  return (
    <div className="app" style={{ padding: '0 20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 60 }}>
        {/* Type toggle */}
        <Block width="100%" height={40} radius="var(--radius-md)" />
        {/* Amount row */}
        <Block width="100%" height={52} radius="var(--radius-md)" />
        {/* Date + currency */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Block width="100%" height={44} />
          <Block width={80} height={44} />
        </div>
        {/* Category grid */}
        <Block width={80} height={10} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[0, 1, 2, 3, 4, 5].map(i => <Block key={i} height={48} radius="var(--radius-sm)" />)}
        </div>
        {/* Person pills */}
        <Block width={80} height={10} />
        <div style={{ display: 'flex', gap: 8 }}>
          <Block width="100%" height={42} radius="var(--radius-sm)" />
          <Block width="100%" height={42} radius="var(--radius-sm)" />
        </div>
        {/* Submit button */}
        <Block width="100%" height={50} radius="var(--radius-md)" style={{ marginTop: 8 }} />
      </div>
    </div>
  )
}

export function SkeletonList() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Block width={160} height={14} />
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <Block width={32} height={32} radius="50%" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Block width="60%" height={13} />
            <Block width="40%" height={10} />
          </div>
          <Block width={60} height={14} />
        </div>
      ))}
    </div>
  )
}

export function SkeletonConfig() {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
          <Block width="60%" height={14} />
          <div style={{ flex: 1 }} />
          <Block width={40} height={14} />
        </div>
      ))}
    </div>
  )
}
