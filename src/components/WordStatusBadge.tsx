import { getWordStatusLabel, type WordUserStatus } from '../lib/wordStatus';

interface WordStatusBadgeProps {
  status: WordUserStatus;
}

export default function WordStatusBadge({ status }: WordStatusBadgeProps) {
  return (
    <span className={`word-status word-status--${status}`}>
      {getWordStatusLabel(status)}
    </span>
  );
}
