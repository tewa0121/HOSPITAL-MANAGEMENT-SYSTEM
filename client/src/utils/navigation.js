import {
  LayoutDashboard, Users, CalendarDays, Stethoscope, FlaskConical, Pill, Boxes,
  Receipt, BedDouble, ClipboardList, BarChart3, UserCog, ShieldCheck, ScrollText, Settings,Inbox,Newspaper
} from 'lucide-react';

export const SECTION_ORDER = ['main', 'clinical', 'services', 'finance', 'inpatient', 'insights', 'admin'];

export const NAV_ITEMS = [
  { key: 'dashboard',    path: '/dashboard',         icon: LayoutDashboard, permission: 'dashboard.view',       section: 'main' },
  { key: 'patients',     path: '/patients',          icon: Users,           permission: 'patients.read',        section: 'clinical' },
  { key: 'appointments', path: '/appointments',      icon: CalendarDays,    permission: 'appointments.read',    section: 'clinical' },
  { key: 'opd',          path: '/opd',               icon: Stethoscope,     permission: 'encounters.read',      section: 'clinical' },
  { key: 'lab',          path: '/lab',               icon: FlaskConical,    permission: 'lab.read',             section: 'services' },
  { key: 'pharmacy',     path: '/pharmacy',          icon: Pill,            permission: 'prescriptions.read',   section: 'services' },
  { key: 'stock',        path: '/stock',             icon: Boxes,           permission: 'pharmacy.stock_read',  section: 'services' },
  { key: 'billing',      path: '/billing',           icon: Receipt,         permission: 'billing.invoice_read', section: 'finance' },
  { key: 'wards',        path: '/wards',             icon: BedDouble,       permission: 'wards.read',           section: 'inpatient' },
  { key: 'admissions',   path: '/admissions',        icon: ClipboardList,   permission: 'admissions.read',      section: 'inpatient' },
  { key: 'reports',      path: '/reports',           icon: BarChart3,       permission: 'reports.read',         section: 'insights' },
  { key: 'users',        path: '/admin/users',       icon: UserCog,         permission: 'users.read',           section: 'admin' },
  { key: 'roles',        path: '/admin/roles',       icon: ShieldCheck,     permission: 'roles.read',           section: 'admin' },
  { key: 'audit',        path: '/admin/audit-logs',  icon: ScrollText,      permission: 'audit.read',           section: 'admin' },
  { key: 'settings',     path: '/admin/settings',    icon: Settings,        permission: 'settings.manage',      section: 'admin' },
  { key: 'requests', path: '/requests',   icon: Inbox,     permission: 'appointments.requests', section: 'clinical' },
{ key: 'news',     path: '/admin/news', icon: Newspaper, permission: 'news.manage',           section: 'admin' },
  
];