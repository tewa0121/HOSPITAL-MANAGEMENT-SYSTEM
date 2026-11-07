import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appointmentsApi } from '../../api/appointments.api';
import Spinner from '../../components/ui/Spinner';

export default function SlotPicker({ doctorId, date, value, onChange, refreshKey = 0 }) {
  const { t } = useTranslation();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!doctorId || !date) { setSlots([]); return undefined; }
    let off = false;
    setLoading(true);
    appointmentsApi.slots({ doctor_id: doctorId, date })
      .then((res) => { if (!off) setSlots(res.data.data); })
      .catch(() => { if (!off) setSlots([]); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [doctorId, date, refreshKey]);

  if (!doctorId || !date) {
    return <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">{t('appointments.selectDoctorDate')}</p>;
  }
  if (loading) return <Spinner />;
  if (slots.length === 0) return <p className="text-sm text-slate-500">{t('appointments.noSlots')}</p>;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {slots.map((s) => {
          const selected = value === s.start;
          return (
            <button
              key={s.start}
              type="button"
              disabled={!s.available}
              onClick={() => onChange(s.start)}
              className={`rounded-lg border px-2 py-2 text-sm font-medium transition ${
                selected
                  ? 'border-teal-600 bg-teal-600 text-white shadow'
                  : s.available
                    ? 'border-slate-300 bg-white text-slate-700 hover:border-teal-500 hover:bg-teal-50'
                    : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through'
              }`}
            >
              {s.start}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-slate-300 bg-white" /> {t('appointments.legendAvailable')}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-200" /> {t('appointments.legendBooked')}</span>
      </div>
    </div>
  );
}