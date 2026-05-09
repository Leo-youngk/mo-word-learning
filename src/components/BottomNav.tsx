export type MainTab = 'today' | 'wordbook' | 'settings';

interface BottomNavProps {
  active: MainTab;
  onChange: (tab: MainTab) => void;
}

const NAV_ITEMS: { id: MainTab; label: string }[] = [
  { id: 'today', label: '今日' },
  { id: 'wordbook', label: '词库' },
  { id: 'settings', label: '设置' },
];

function NavIcon({ id }: { id: MainTab }) {
  if (id === 'today') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12.5c3-5 8-6.5 14-5.2-1 6.3-5 10.3-12.2 10.3" />
        <path d="M7 17.6c1.8-2.3 4-4.2 6.7-5.7" />
      </svg>
    );
  }

  if (id === 'wordbook') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 5.8c2.5-1.2 4.8-1.2 7 0v13c-2.2-1.2-4.5-1.2-7 0v-13Z" />
        <path d="M12 5.8c2.2-1.2 4.5-1.2 7 0v13c-2.5-1.2-4.8-1.2-7 0" />
        <path d="M12 5.8v13" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" />
      <path d="M19 12c0-.5-.1-.9-.2-1.4l1.5-1.2-1.6-2.8-1.8.7c-.7-.6-1.5-1-2.4-1.2L14.2 4h-4.4l-.3 2.1c-.9.2-1.7.6-2.4 1.2l-1.8-.7-1.6 2.8 1.5 1.2A7 7 0 0 0 5 12c0 .5.1.9.2 1.4l-1.5 1.2 1.6 2.8 1.8-.7c.7.6 1.5 1 2.4 1.2l.3 2.1h4.4l.3-2.1c.9-.2 1.7-.6 2.4-1.2l1.8.7 1.6-2.8-1.5-1.2c.1-.5.2-.9.2-1.4Z" />
    </svg>
  );
}

export default function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          className={`bottom-nav__item ${active === item.id ? 'bottom-nav__item--active' : ''}`}
          onClick={() => onChange(item.id)}
          type="button"
        >
          <span className="bottom-nav__icon"><NavIcon id={item.id} /></span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
