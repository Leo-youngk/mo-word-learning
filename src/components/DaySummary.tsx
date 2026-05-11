interface DaySummaryProps {
  streakCount: number;
  newWordsCount: number;
  reviewWordsCount: number;
  totalLearned: number;
  bookFinished: boolean;
  onContinueStudy?: () => void;
}

export default function DaySummary({
  streakCount,
  newWordsCount,
  reviewWordsCount,
  totalLearned,
  bookFinished,
  onContinueStudy,
}: DaySummaryProps) {
  return (
    <div className="card card-summary">
      <div className="card-summary__content">
        <h2 className="card-summary__day">Day {streakCount}</h2>

        <div className="card-summary__stats">
          <p className="card-summary__stat">
            新学 <span className="card-summary__num">{newWordsCount}</span> 词
          </p>
          <p className="card-summary__stat">
            复习 <span className="card-summary__num">{reviewWordsCount}</span> 词
          </p>
          <p className="card-summary__stat">
            累计 <span className="card-summary__num">{totalLearned}</span> 词
          </p>
        </div>

        {bookFinished && (
          <p className="card-summary__finished">本词库已全部学完！</p>
        )}

        {!bookFinished && onContinueStudy && (
          <button
            className="home__primary-btn"
            onClick={onContinueStudy}
            style={{ marginTop: '20px' }}
          >
            继续学习 →
          </button>
        )}

        <p className="card-summary__bye">明天见</p>
      </div>
    </div>
  );
}
