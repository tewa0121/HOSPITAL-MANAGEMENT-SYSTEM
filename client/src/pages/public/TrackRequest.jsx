import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, Search } from 'lucide-react';
import PublicLayout from './PublicLayout';
import { CONTACT, langOf } from '../../utils/hospital';

const TXT = {
  en: {
    title: 'Patient Portal', sub: 'Check the progress of your online appointment request.',
    ref: 'Reference code', phone: 'Phone number you used', check: 'Check status', checking: 'Checking…',
    book: 'No request yet? Book an appointment', badInput: 'Enter the reference code and the phone number.',
    notFound: 'No request found with these details. Check the code and phone number.', fail: 'Could not check now. Please try again later.',
    department: 'Department', preferred: 'Preferred date', doctor: 'Doctor', when: 'Your appointment',
    status: {
      new: ['Received', 'We received your request. Our reception team will call you soon.'],
      contacted: ['We contacted you', 'Our team has contacted you about this request.'],
      scheduled: ['Appointment confirmed', 'Your appointment is booked. Please arrive 15 minutes early and bring your ID.'],
      cancelled: ['Cancelled', `This request was cancelled. Call ${CONTACT.phone} for help.`],
    },
    note: 'This page shows only the status of your request. Medical records are not available online.',
  },
  am: {
    title: 'የታካሚ ፖርታል', sub: 'የኦንላይን የቀጠሮ ጥያቄዎን ሁኔታ ይመልከቱ።',
    ref: 'የማጣቀሻ ኮድ', phone: 'የተጠቀሙበት ስልክ ቁጥር', check: 'ሁኔታውን ተመልከት', checking: 'በመመልከት ላይ…',
    book: 'ጥያቄ የለዎትም? ቀጠሮ ያስይዙ', badInput: 'የማጣቀሻ ኮዱንና ስልክ ቁጥሩን ያስገቡ።',
    notFound: 'በእነዚህ መረጃዎች ጥያቄ አልተገኘም። ኮዱንና ስልክ ቁጥሩን ያረጋግጡ።', fail: 'አሁን መመልከት አልተቻለም። እባክዎ ቆይተው ይሞክሩ።',
    department: 'ክፍል', preferred: 'የጠየቁት ቀን', doctor: 'ሐኪም', when: 'ቀጠሮዎ',
    status: {
      new: ['ተቀብለናል', 'ጥያቄዎን ተቀብለናል። የመቀበያ ክፍላችን በቅርቡ ይደውልልዎታል።'],
      contacted: ['ደውለናል', 'ቡድናችን ስለዚህ ጥያቄ አነጋግሮዎታል።'],
      scheduled: ['ቀጠሮ ተረጋግጧል', 'ቀጠሮዎ ተይዟል። እባክዎ 15 ደቂቃ ቀድመው መታወቂያዎን ይዘው ይምጡ።'],
      cancelled: ['ተሰርዟል', `ይህ ጥያቄ ተሰርዟል። ለእርዳታ ${CONTACT.phone} ይደውሉ።`],
    },
    note: 'ይህ ገጽ የጥያቄዎን ሁኔታ ብቻ ያሳያል። የሕክምና መዝገብ በኦንላይን አይገኝም።',
  },
};
const TONE = { new: 'bg-amber-50 text-amber-800', contacted: 'bg-blue-50 text-blue-800', scheduled: 'bg-green-50 text-green-800', cancelled: 'bg-red-50 text-red-800' };

export default function TrackRequest() {
  const { i18n } = useTranslation();
  const L = TXT[langOf(i18n)];
  const [params] = useSearchParams();
  const [reference, setReference] = useState((params.get('ref') || '').toUpperCase());
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setResult(null); setError('');
    if (reference.trim().length !== 8 || phone.replace(/\D/g, '').length < 9) { setError(L.badInput); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/public/appointment-requests/status?reference=${encodeURIComponent(reference.trim())}&phone=${encodeURIComponent(phone.trim())}`);
      if (res.status === 404) setError(L.notFound);
      else if (!res.ok) setError(res.status === 429 ? L.fail : L.badInput);
      else setResult((await res.json()).data);
    } catch { setError(L.fail); }
    setBusy(false);
  };

  const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100';
  const s = result && L.status[result.status];

  return (
    <PublicLayout>
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-bold text-slate-900">{L.title}</h1>
        <p className="mt-1 text-slate-500">{L.sub}</p>

        <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="mb-1.5 block text-sm font-medium">{L.ref}</label>
            <input value={reference} onChange={(e) => setReference(e.target.value.toUpperCase())} maxLength={8} placeholder="A1B2C3D4" className={`${input} font-mono tracking-widest`} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">{L.phone}</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" placeholder="+251 9XX XXX XXX" className={input} />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
            <Search className="h-4 w-4" /> {busy ? L.checking : L.check}
          </button>
        </form>

        {result && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className={`rounded-lg px-4 py-3 ${TONE[result.status]}`}>
              <p className="font-bold">{s[0]}</p>
              <p className="mt-0.5 text-sm">{s[1]}</p>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-slate-400">{L.department}</dt><dd className="font-medium">{result.department}</dd></div>
              <div><dt className="text-slate-400">{L.preferred}</dt><dd className="font-medium">{result.preferred_date}</dd></div>
              {result.status === 'scheduled' && result.appointment_date && (
                <div className="col-span-2 flex items-start gap-3 rounded-lg bg-green-50 p-3">
                  <CalendarCheck className="mt-0.5 h-5 w-5 text-green-700" />
                  <div>
                    <dt className="text-green-800">{L.when}</dt>
                    <dd className="font-semibold text-green-900">{result.appointment_date} · {String(result.start_time).slice(0, 5)}</dd>
                    {result.doctor_name && <dd className="text-green-800">{L.doctor}: {result.doctor_name}</dd>}
                  </div>
                </div>
              )}
            </dl>
          </div>
        )}

        <p className="mt-5 text-center text-xs text-slate-400">{L.note}</p>
        <p className="mt-3 text-center text-sm"><a href="/#appointment" className="font-semibold text-teal-700 hover:underline">{L.book}</a></p>
      </div>
    </PublicLayout>
  );
}
