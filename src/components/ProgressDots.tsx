// ============================================================
// ProgressDots — 底部进度指示点
// 超过 20 个时只显示当前附近 7 个点 + 省略号
// ============================================================

interface ProgressDotsProps {
  total: number;
  current: number; // 0-based
}

export default function ProgressDots({ total, current }: ProgressDotsProps) {
  if (total <= 0) return null;

  const MAX_VISIBLE = 7;

  // 计算可见范围
  let start = 0;
  let end = total;

  if (total > MAX_VISIBLE + 2) {
    const half = Math.floor(MAX_VISIBLE / 2);
    start = current - half;
    end = current + half + 1;

    if (start < 2) {
      start = 0;
      end = MAX_VISIBLE;
    } else if (end > total - 2) {
      end = total;
      start = total - MAX_VISIBLE;
    }
  }

  const dots: React.ReactNode[] = [];
  if (start > 0) {
    dots.push(<span key="e-l" className="progress-dots__ellipsis">…</span>);
    dots.push(<span key="s" className="progress-dots__spacer" />);
  }

  for (let i = start; i < end; i++) {
    const cls = i < current
      ? 'progress-dots__dot progress-dots__dot--done'
      : i === current
        ? 'progress-dots__dot progress-dots__dot--active'
        : 'progress-dots__dot';
    dots.push(<span key={i} className={cls} />);
  }

  if (end < total) {
    dots.push(<span key="se" className="progress-dots__spacer" />);
    dots.push(<span key="e-r" className="progress-dots__ellipsis">…</span>);
  }

  return <div className="progress-dots">{dots}</div>;
}
