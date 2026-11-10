import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  Activity, ArrowRight, Baby, BedDouble, Bone, Brain, CalendarDays, ChevronLeft, ChevronRight,
  Clock, Eye, FlaskConical, Heart, HeartHandshake, HeartPulse, LogIn, Mail, MapPin, Menu,
  Phone, Pill, ScanLine, Scissors, Siren, Stethoscope, UserRound, X, Ambulance,
} from 'lucide-react';
import LanguageSwitch from '../components/ui/LanguageSwitch';
import { CONTACT, NAME } from '../utils/hospital'; // hospital name, phone, email: edit in utils/hospital.js

/* ================= EDIT THESE ================= */
// Banner photos: put them in client/public/images as hero1, hero2, hero3 ... hero8 (.jpg, .jpeg, .png or .webp).
// Add as many as you like (names below). Photos that do not exist are skipped automatically.
const SLIDES = ['hero1', 'hero2', 'hero3', 'team', 'hero5', 'hero6', ];
const ABOUT_IMG = 'hero2'; // photo used in the "About Our Hospital" card
const DOCTORS = [ // sample profiles, replace with your real specialists
  { name: 'Dr. Name Surname', spec: { en: 'Internal Medicine', am: 'ውስጥ ደዌ' } },
  { name: 'Dr. Name Surname', spec: { en: 'General Surgery', am: 'አጠቃላይ ቀዶ ሕክምና' } },
  { name: 'Dr. Name Surname', spec: { en: 'Pediatrics', am: 'የሕፃናት ሕክምና' } },
  { name: 'Dr. Name Surname', spec: { en: 'Obstetrics & Gynecology', am: 'የሴቶችና ጽንስ ሕክምና' } },
];
const NEWS = [ // sample announcements, replace with your real ones
  { date: '2026-03-15', img: 'lab.svg', en: ['Free Health Screening Campaign', 'Join us for free health screening at the hospital.'], am: ['ነፃ የጤና ምርመራ ዘመቻ', 'በሆስፒታላችን ነፃ የጤና ምርመራ ለማድረግ ይሳተፉ።'] },
  { date: '2026-02-28', img: 'pharmacy.svg', en: ['New Medical Equipment Inaugurated', 'Advanced diagnostic equipment is now in service.'], am: ['አዲስ የሕክምና መሣሪያ ተመረቀ', 'ዘመናዊ የምርመራ መሣሪያዎች አገልግሎት ጀምረዋል።'] },
  { date: '2026-02-10', img: 'reception.svg', en: ['24-Hour Emergency Service', 'Our emergency department is open every day of the week.'], am: ['የ24 ሰዓት የድንገተኛ አገልግሎት', 'የድንገተኛ ክፍላችን በሳምንት ሁሉም ቀን ክፍት ነው።'] },
];
/* ============================================== */

const SERVICE_ICONS = [Stethoscope, Ambulance, BedDouble, FlaskConical, Pill, ScanLine, HeartHandshake, Heart];
const DEPT_ICONS = [Heart, Brain, Bone, Baby, HeartHandshake, Stethoscope, Scissors, Eye];

const TEXT = {
  en: {
    tagline: 'Quality Healthcare for a Better Life',
    nav: [['#home', 'Home'], ['/about', 'About Us'], ['#services', 'Services'], ['#doctors', 'Doctors'], ['#appointment', 'Appointment'], ['/portal', 'Patient Portal'], ['/news', 'News & Events'], ['#contact', 'Contact Us']],
    staff: 'Staff Login', dashboard: 'Open dashboard', portal: 'Patient Portal',
    welcome: 'Welcome to', h1a: 'Your Health', h1b: 'Our Priority',
    heroText: 'Delivering comprehensive, accessible and quality healthcare with compassion and excellence.',
    book: 'Book an Appointment', explore: 'Explore Our Services',
    services: ['Outpatient Services', 'Emergency Services', 'Inpatient Services', 'Laboratory Services', 'Pharmacy Services', 'Radiology & Imaging', 'Maternity Services', 'Cardiology Care'],
    aboutTitle: 'About Our Hospital', aboutText: 'is a leading healthcare institution providing specialized and comprehensive medical services to our community and beyond.',
    learn: 'Learn More',
    deptTitle: 'Our Departments', depts: ['Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Obstetrics & Gynecology', 'Internal Medicine', 'General Surgery', 'Ophthalmology'],
    docTitle: 'Our Doctors & Specialists',
    apTitle: 'Book an Appointment Online', apText: 'Fill in the form and our reception team will call you to confirm your visit.',
    fName: 'Full name', fPhone: 'Phone number', fDept: 'Department', fDate: 'Preferred date', fMsg: 'Reason for visit (optional)',
    send: 'Send request', sending: 'Sending…', okMsg: 'Request sent. We will call you to confirm.', badMsg: 'Could not send. Please check the form or call us.',
    newsTitle: 'Latest News & Events', viewAll: 'View all',
    refTitle: 'Your reference code', refHelp: 'Keep this code. With your phone number it lets you check your request in the Patient Portal.',
    track: 'Track my request', another: 'Send another request',
    emTitle: 'Emergency Medical Services', emHours: 'Available 24 Hours / 7 Days', emCall: 'Call for Immediate Assistance', commit: 'Your Health, Our Commitment', contactUs: 'Contact Us',
    links: 'Useful Links', contactInfo: 'Contact Information', rights: 'All Rights Reserved',
  },
  am: {
    tagline: 'ጥራት ያለው ጤና አገልግሎት ለተሻለ ሕይወት',
    nav: [['#home', 'መነሻ'], ['/about', 'ስለ እኛ'], ['#services', 'አገልግሎቶች'], ['#doctors', 'ሐኪሞች'], ['#appointment', 'ቀጠሮ'], ['/portal', 'የታካሚ ፖርታል'], ['/news', 'ዜና'], ['#contact', 'አግኙን']],
    staff: 'የሠራተኛ መግቢያ', dashboard: 'ዳሽቦርድ ክፈት', portal: 'የታካሚ ፖርታል',
    welcome: 'እንኳን ደህና መጡ', h1a: 'ጤናዎ', h1b: 'ቀዳሚ ጉዳያችን',
    heroText: 'ሁሉን አቀፍ፣ ተደራሽና ጥራት ያለው የጤና አገልግሎት በርኅራኄና በልህቀት እናቀርባለን።',
    book: 'ቀጠሮ ያስይዙ', explore: 'አገልግሎቶቻችንን ይመልከቱ',
    services: ['የተመላላሽ ሕክምና', 'የድንገተኛ ሕክምና', 'የተኝቶ ሕክምና', 'የላቦራቶሪ አገልግሎት', 'የፋርማሲ አገልግሎት', 'ራዲዮሎጂና ምስል', 'የወሊድ አገልግሎት', 'የልብ ሕክምና'],
    aboutTitle: 'ስለ ሆስፒታላችን', aboutText: 'ለማኅበረሰባችንና ከዚያም ባሻገር ልዩና ሁሉን አቀፍ የሕክምና አገልግሎት የሚሰጥ ቀዳሚ የጤና ተቋም ነው።',
    learn: 'ተጨማሪ ይወቁ',
    deptTitle: 'ክፍሎቻችን', depts: ['የልብ ሕክምና', 'የነርቭ ሕክምና', 'የአጥንት ሕክምና', 'የሕፃናት ሕክምና', 'የሴቶችና ጽንስ ሕክምና', 'ውስጥ ደዌ', 'አጠቃላይ ቀዶ ሕክምና', 'የዓይን ሕክምና'],
    docTitle: 'ሐኪሞቻችና ስፔሻሊስቶች',
    apTitle: 'በኦንላይን ቀጠሮ ያስይዙ', apText: 'ቅጹን ይሙሉ፤ የመቀበያ ክፍላችን ቀጠሮዎን ለማረጋገጥ ይደውልልዎታል።',
    fName: 'ሙሉ ስም', fPhone: 'ስልክ ቁጥር', fDept: 'ክፍል', fDate: 'የሚፈልጉት ቀን', fMsg: 'የመምጣት ምክንያት (አማራጭ)',
    send: 'ጥያቄ ላክ', sending: 'በመላክ ላይ…', okMsg: 'ጥያቄዎ ተልኳል። ለማረጋገጥ እንደውልልዎታለን።', badMsg: 'መላክ አልተቻለም። ቅጹን ያረጋግጡ ወይም ይደውሉልን።',
    newsTitle: 'የቅርብ ጊዜ ዜናዎች', viewAll: 'ሁሉንም ይመልከቱ',
    refTitle: 'የማጣቀሻ ኮድዎ', refHelp: 'ይህንን ኮድ ያስቀምጡ። ከስልክ ቁጥርዎ ጋር በታካሚ ፖርታል ውስጥ የጥያቄዎን ሁኔታ ለመመልከት ያስችልዎታል።',
    track: 'ጥያቄዬን ተከታተል', another: 'ሌላ ጥያቄ ላክ',
    emTitle: 'የድንገተኛ ሕክምና አገልግሎት', emHours: 'በ24 ሰዓት / በሳምንት 7 ቀናት ክፍት', emCall: 'ለአስቸኳይ እርዳታ ይደውሉ', commit: 'ጤናዎ፣ ቁርጠኝነታችን', contactUs: 'አግኙን',
    links: 'ጠቃሚ አገናኞች', contactInfo: 'የመገናኛ መረጃ', rights: 'መብቱ በሕግ የተጠበቀ ነው',
  },
};

// Shows /images/<name>.jpg; if that file does not exist it tries .jpeg, .png, .webp, then the .svg illustration.
const EXTS = ['jpg', 'jpeg', 'png', 'webp', 'svg'];
function Photo({ name, onMissing, ...props }) {
  const next = (e) => {
    const el = e.currentTarget;
    const i = Number(el.dataset.i || 0) + 1;
    if (i >= EXTS.length) { el.style.display = 'none'; if (onMissing) onMissing(name); return; }
    el.dataset.i = i;
    el.src = `/images/${name}.${EXTS[i]}`;
  };
  return <img src={`/images/${name}.jpg`} data-i="0" onError={next} {...props} />;
}

function SectionHead({ children, right }) {
  return (
    <div className="flex items-center justify-between rounded-t-xl bg-gradient-to-r from-teal-700 to-teal-500 px-5 py-3">
      <h2 className="text-lg font-bold text-white">{children}</h2>
      {right}
    </div>
  );
}

const KIND_IMG = { news: 'lab.svg', event: 'reception.svg', announcement: 'ward.svg' };

function NavA({ to, className, onClick, children }) {
  return to.startsWith('/')
    ? <Link to={to} className={className} onClick={onClick}>{children}</Link>
    : <a href={to} className={className} onClick={onClick}>{children}</a>;
}

function BookingForm({ L, depts }) {
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState(null);
  const [f, setF] = useState({ fullName: '', phone: '', department: '', preferredDate: '', message: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const today = new Date().toISOString().slice(0, 10);
  const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/public/appointment-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
      });
      if (!res.ok) throw new Error();
      const j = await res.json().catch(() => ({}));
      toast.success(L.okMsg);
      setRef(j.reference || null);
      setF({ fullName: '', phone: '', department: '', preferredDate: '', message: '' });
    } catch { toast.error(L.badMsg); }
    setBusy(false);
  };

  if (ref) {
    return (
      <div className="rounded-lg bg-green-50 p-5 text-sm text-green-900">
        <p className="font-semibold">{L.okMsg}</p>
        <p className="mt-3">{L.refTitle}</p>
        <p className="mt-1 font-mono text-3xl font-bold tracking-widest">{ref}</p>
        <p className="mt-2">{L.refHelp}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to={`/portal?ref=${ref}`} className="rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white hover:bg-teal-700">{L.track}</Link>
          <button type="button" onClick={() => setRef(null)} className="rounded-lg border border-green-700/30 px-4 py-2 font-semibold hover:bg-green-100">{L.another}</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <input required minLength={3} maxLength={120} placeholder={L.fName} value={f.fullName} onChange={set('fullName')} className={input} />
      <input required type="tel" inputMode="tel" placeholder={`${L.fPhone} (+251…)`} value={f.phone} onChange={set('phone')} className={input} />
      <select required value={f.department} onChange={set('department')} className={input}>
        <option value="">{L.fDept}</option>
        {depts.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <input required type="date" min={today} value={f.preferredDate} onChange={set('preferredDate')} className={input} aria-label={L.fDate} />
      <textarea maxLength={500} rows={3} placeholder={L.fMsg} value={f.message} onChange={set('message')} className={`${input} sm:col-span-2`} />
      <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60 sm:col-span-2 sm:justify-self-start">
        <CalendarDays className="h-4 w-4" /> {busy ? L.sending : L.send}
      </button>
    </form>
  );
}

export default function Home() {
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('am') ? 'am' : 'en';
  const L = TEXT[lang];
  const name = NAME[lang];
  const target = '/login'; // the public site always shows Staff Login (a logged-in user is sent on to the dashboard by /login)
  const cta = L.staff;
  const [menu, setMenu] = useState(false);
  const [slide, setSlide] = useState(0);
  const [missing, setMissing] = useState({});
  const [posts, setPosts] = useState(null);
  const [active, setActive] = useState('home');
  const [bookOpen, setBookOpen] = useState(false);
  const location = useLocation();
  const lock = useRef(0); // after a menu click, ignore scroll events while the page glides to the section

  // clicked menu item turns green immediately and stays green until the page arrives
  const pick = (to) => {
    if (!to.startsWith('#')) return;
    setActive(to.slice(1));
    lock.current = Date.now() + 1000;
  };

  // only banner photos that really exist take part in the slider
  const slides = SLIDES.filter((s) => !missing[s]);
  const count = Math.max(slides.length, 1);
  const cur = slide % count;
  const markMissing = (n) => setMissing((m) => (m[n] ? m : { ...m, [n]: true }));

  // smooth scrolling for the menu links
  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => { document.documentElement.style.scrollBehavior = prev; };
  }, []);

  // the green menu item follows the section you are looking at
  useEffect(() => {
    const ids = ['home', 'services', 'doctors', 'appointment', 'contact'];
    const onScroll = () => {
      if (Date.now() < lock.current) return;
      const y = window.scrollY + 140;
      let now = 'home';
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top + window.scrollY <= y) now = id;
      });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) now = 'contact';
      setActive(now);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // arriving from another page with /#appointment or /?book=1
  useEffect(() => {
    if (new URLSearchParams(location.search).get('book')) setBookOpen(true);
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) setTimeout(() => el.scrollIntoView(), 60);
    }
  }, [location.hash, location.search]);

  // Escape closes the booking window
  useEffect(() => {
    if (!bookOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setBookOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bookOpen]);

  useEffect(() => {
    fetch('/api/public/news?limit=3')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => setPosts(j.data))
      .catch(() => setPosts([]));
  }, []);

  // real posts from the database; the sample items only show while there are none
  const shownNews = posts && posts.length
    ? posts.slice(0, 3).map((p) => ({
      key: p.id, to: `/news/${p.id}`, img: KIND_IMG[p.kind] || 'lab.svg',
      title: (lang === 'am' && p.title_am) || p.title_en,
      date: String(p.published_at).slice(0, 10),
      text: (lang === 'am' && p.excerpt_am) || p.excerpt_en,
    }))
    : NEWS.map((n) => ({ key: n.date, to: '/news', img: n.img, title: n[lang][0], date: n.date, text: n[lang][1] }));

  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % count), 6000);
    return () => clearInterval(id);
  }, [count]);
  const go = (d) => setSlide((s) => (s % count + d + count) % count);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700">
      {/* top info bar */}
      <div className="hidden bg-sky-950 text-xs text-white md:block">
        <div className="mx-auto flex h-10 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {CONTACT.phone}</span>
            <span className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {CONTACT.email}</span>
            <span className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {CONTACT.address}</span>
          </div>
          <span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> {CONTACT.hours[lang]}</span>
        </div>
      </div>

      {/* header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6">
          <a href="#home" className="flex shrink-0 items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600"><HeartPulse className="h-6 w-6 text-white" /></span>
            <span className="leading-tight">
              <span className="block text-sm font-extrabold tracking-wide text-sky-950 sm:text-base">{name}</span>
              <span className="hidden text-xs italic text-teal-700 xl:block">{L.tagline}</span>
            </span>
          </a>
          <nav className="hidden items-center gap-1 lg:flex">
            {L.nav.map(([to, label]) => (
              <NavA
                key={to} to={to} onClick={() => pick(to)}
                className={`rounded-md px-2.5 py-1.5 text-center text-[13px] font-medium leading-tight ${to === `#${active}` ? 'bg-teal-600 text-white' : 'text-slate-700 hover:bg-teal-50 hover:text-teal-700'}`}
              >{label}</NavA>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitch />
            <Link to={target} className="hidden items-center gap-2 rounded-lg bg-sky-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-900 sm:inline-flex lg:max-xl:px-3" title={cta}>
              <UserRound className="h-4 w-4" /> <span className="lg:max-xl:hidden">{cta}</span>
            </Link>
            <button onClick={() => setMenu(!menu)} className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden" aria-label="Menu">
              {menu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
        {menu && (
          <div className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
            {L.nav.map(([to, label]) => (
              <NavA key={to} to={to} onClick={() => { setMenu(false); pick(to); }} className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${to === `#${active}` ? 'bg-teal-600 text-white' : 'hover:bg-teal-50'}`}>{label}</NavA>
            ))}
            <Link to={target} className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-sky-950 px-4 py-2.5 text-sm font-semibold text-white"><LogIn className="h-4 w-4" /> {cta}</Link>
          </div>
        )}
      </header>

      {/* hero slider */}
      <section id="home" className="relative h-[420px] scroll-mt-[72px] overflow-hidden bg-sky-950 sm:h-[480px]">
        {slides.map((s, i) => (
          <Photo key={s} name={s} onMissing={markMissing} alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === cur ? 'opacity-100' : 'opacity-0'}`} />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-sky-950/90 via-sky-900/65 to-transparent" />
        <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-center px-6 sm:px-16">
          <p className="border-b border-white/40 pb-1 text-base font-semibold text-white sm:w-fit sm:text-lg">{L.welcome} {name.split(' ').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ')}</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight text-white sm:text-6xl">
            {L.h1a}<br /><span className="text-cyan-400">{L.h1b}</span>
          </h1>
          <p className="mt-4 max-w-md text-sm text-white/90 sm:text-base">{L.heroText}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => setBookOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-600"><CalendarDays className="h-4 w-4" /> {L.book} <ArrowRight className="h-4 w-4" /></button>
            <a href="#services" className="inline-flex items-center gap-2 rounded-lg border border-white px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">{L.explore}</a>
          </div>
        </div>
        <button onClick={() => go(-1)} aria-label="Previous" className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 sm:flex"><ChevronLeft /></button>
        <button onClick={() => go(1)} aria-label="Next" className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 sm:flex"><ChevronRight /></button>
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          {slides.map((s, i) => <button key={s} onClick={() => setSlide(i)} aria-label={`Slide ${i + 1}`} className={`h-2.5 rounded-full transition-all ${i === cur ? 'w-6 bg-white' : 'w-2.5 bg-white/50'}`} />)}
        </div>
      </section>

      {/* quick services */}
      <section id="services" className="scroll-mt-[72px] mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {L.services.map((s, i) => {
            const Icon = SERVICE_ICONS[i];
            return (
              <div key={s} className="flex flex-col items-center gap-2 rounded-lg bg-sky-50 px-2 py-4 text-center text-sm font-semibold text-sky-900 transition hover:-translate-y-0.5 hover:bg-teal-50 hover:shadow">
                <Icon className="h-7 w-7 text-teal-600" /> {s}
              </div>
            );
          })}
        </div>
      </section>

      {/* about + departments + news */}
      <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-8 sm:px-6 lg:grid-cols-3">
        <div id="about" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <SectionHead>{L.aboutTitle}</SectionHead>
          <div className="p-4">
            <div className="aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-teal-600 to-emerald-800">
              <Photo name={ABOUT_IMG} alt="" className="h-full w-full object-cover" />
            </div>
            <p className="mt-4 text-sm leading-relaxed"><strong className="text-slate-900">{name.split(' ').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ')}</strong> {L.aboutText}</p>
            <Link to="/about" className="mt-4 inline-flex items-center gap-1 rounded-lg border border-teal-600 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50">{L.learn} <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>

        <div id="departments" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <SectionHead>{L.deptTitle}</SectionHead>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-3 p-5 text-sm">
            {L.depts.map((d, i) => {
              const Icon = DEPT_ICONS[i];
              return <li key={d} className="flex items-center gap-2.5"><Icon className="h-5 w-5 shrink-0 text-teal-600" /> {d}</li>;
            })}
          </ul>
        </div>

        <div id="news" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <SectionHead right={<Link to="/news" className="text-xs font-semibold text-white/90 hover:underline">{L.viewAll} →</Link>}>{L.newsTitle}</SectionHead>
          <div className="divide-y divide-slate-100 p-4">
            {shownNews.map((n) => (
              <Link key={n.key} to={n.to} className="flex gap-3 py-3 first:pt-0 last:pb-0 hover:opacity-80">
                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-md bg-teal-50">
                  <img src={`/images/${n.img}`} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{n.title}</p>
                  <p className="text-[11px] text-slate-500">{n.date}</p>
                  <p className="line-clamp-2 text-xs">{n.text}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* doctors */}
      <section id="doctors" className="scroll-mt-[72px] mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <SectionHead>{L.docTitle}</SectionHead>
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {DOCTORS.map((d, i) => (
              <div key={i} className="flex items-center gap-4 rounded-lg bg-slate-50 p-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700"><UserRound className="h-7 w-7" /></span>
                <div>
                  <p className="font-semibold text-slate-900">{d.name}</p>
                  <p className="text-sm text-teal-700">{d.spec[lang]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* appointment */}
      <section id="appointment" className="scroll-mt-[72px] mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <SectionHead>{L.apTitle}</SectionHead>
          <div className="p-5">
            <p className="mb-4 text-sm">{L.apText}</p>
            <BookingForm L={L} depts={L.depts} />
          </div>
        </div>
      </section>

      {/* emergency strip */}
      <section id="contact" className="scroll-mt-[72px] bg-sky-950 text-white">
        <div className="mx-auto grid max-w-7xl items-stretch md:grid-cols-[1.1fr_1fr_1fr_auto]">
          <div className="flex items-center gap-4 bg-red-600 px-6 py-5">
            <Siren className="h-10 w-10 shrink-0" />
            <div><p className="text-xl font-bold">{L.emTitle}</p><p className="text-sm">{L.emHours}</p></div>
          </div>
          <div className="flex items-center gap-4 px-6 py-5">
            <Phone className="h-9 w-9 shrink-0" />
            <div><p className="text-xl font-bold">{CONTACT.phone}</p><p className="text-sm text-sky-100">{L.emCall}</p></div>
          </div>
          <div className="flex items-center px-6 py-5 italic text-sky-100 md:border-l md:border-sky-800">{L.commit}</div>
          <div className="flex items-center px-6 py-5">
            <a href={`tel:${CONTACT.phone.replace(/\s/g, '')}`} className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-sky-950 hover:bg-sky-50">{L.contactUs} →</a>
          </div>
        </div>
      </section>

      {/* booking window opened by the "Book an Appointment" button */}
      {bookOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center" onClick={() => setBookOpen(false)} role="dialog" aria-modal="true">
          <div className="relative my-6 w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setBookOpen(false)} className="absolute right-3 top-3 rounded-full p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button>
            <h2 className="pr-8 text-xl font-bold text-slate-900">{L.apTitle}</h2>
            <p className="mb-4 mt-1 text-sm">{L.apText}</p>
            <BookingForm L={L} depts={L.depts} />
          </div>
        </div>
      )}

      {/* footer */}
      <footer className="bg-slate-950 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 md:grid-cols-3">
          <div>
            <p className="font-extrabold tracking-wide text-white">{name}</p>
            <p className="mt-1 text-sm italic text-teal-300">{L.tagline}</p>
          </div>
          <div>
            <p className="font-semibold text-white">{L.links}</p>
            <ul className="mt-3 grid grid-cols-2 gap-y-1.5 text-sm">
              {L.nav.slice(1).map(([to, label]) => <li key={to}><NavA to={to} className="hover:text-white">{label}</NavA></li>)}
              <li><Link to={target} className="hover:text-white">{cta}</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white">{L.contactInfo}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-teal-400" /> {CONTACT.address}</li>
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-teal-400" /> {CONTACT.phone}</li>
              <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-teal-400" /> {CONTACT.email}</li>
              <li className="flex items-center gap-2"><Activity className="h-4 w-4 text-teal-400" /> {CONTACT.hours[lang]}</li>
            </ul>
          </div>
        </div>
        <p className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">© {new Date().getFullYear()} {name}. {L.rights}.</p>
      </footer>
    </div>
  );
}