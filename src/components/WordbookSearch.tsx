interface WordbookSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export default function WordbookSearch({ value, onChange }: WordbookSearchProps) {
  return (
    <label className="wordbook-search">
      <span className="wordbook-search__icon">⌕</span>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder="搜索单词或释义"
      />
    </label>
  );
}
