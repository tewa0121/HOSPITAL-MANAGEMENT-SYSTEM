import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HeartPulse, X } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import { NAV_ITEMS, SECTION_ORDER } from '../../utils/navigation';

export default function Sidebar({ open, onClose }) {
  const { t } = useTranslation();
  const { can } = usePermission();

  const visible = NAV_ITEMS.filter((item) => can(item.permission));
  const groups = SECTION_ORDER
    .map((section) => ({ section, items: visible.filter((i) => i.section === section) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/50 print:hidden lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 text-slate-300 transition-transform duration-200 print:hidden lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500">
              <HeartPulse className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-white">HMS</p>
              <p className="max-w-[130px] truncate text-[11px] text-slate-400">{t('app.hospital')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups.map(({ section, items }) => (
            <div key={section}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {t(`sections.${section}`)}
              </p>
              <ul className="space-y-0.5">
                {items.map(({ key, path, icon: Icon }) => (
                  <li key={key}>
                    <NavLink
                      to={path}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                          isActive
                            ? 'bg-teal-600 text-white shadow'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`
                      }
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      <span className="truncate">{t(`nav.${key}`)}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}