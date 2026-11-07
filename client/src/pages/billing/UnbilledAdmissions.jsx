import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FilePlus2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { billingApi } from '../../api/billing.api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { wardName } from '../../utils/wards';
import { formatDateTime } from '../../utils/formatters';
import { errMsg } from '../../utils/errors';

export default function UnbilledAdmissions({ query, tick }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let off = false;
    billingApi.unbilledAdmissions({ search: query })
      .then((r) => { if (!off) setRows(r.data.data); })
      .catch(() => {});
    return () => { off = true; };
  }, [query, tick]);

  if (!rows.length) return null;

  const create = async (a) => {
    setBusyId(a.id);
    try {
      const res = await billingApi.createForAdmission(a.id);
      toast.success(`${t('bill.msg.created')}: ${res.data.data.invoice_no}`);
      navigate(`/billing/${res.data.data.id}`);
    } catch (err) {
      toast.error(errMsg(err));
      setBusyId(null);
    }
  };

  return (
    <Card className="overflow-hidden !p-0">
      <div className="border-b border-slate-100 px-5 py-3.5">
        <h3 className="font-semibold text-slate-800">{t('bill.adm.title')}</h3>
        <p className="text-xs text-slate-500">{t('bill.adm.note')}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">{t('bill.col.patient')}</th>
              <th className="px-5 py-3">{t('bill.adm.bed')}</th>
              <th className="px-5 py-3">{t('bill.adm.admitted')}</th>
              <th className="px-5 py-3">{t('bill.adm.days')}</th>
              <th className="px-5 py-3">{t('bill.col.status')}</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <p className="font-medium text-slate-800">{a.patient_name}</p>
                  <p className="font-mono text-xs text-slate-400">{a.mrn}</p>
                </td>
                <td className="px-5 py-3">
                  <span className="font-mono text-xs font-semibold">{a.bed_number}</span>
                  <p className="text-xs text-slate-400">{wardName(a, i18n.language)}</p>
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-slate-500">{formatDateTime(a.admitted_at)}</td>
                <td className="px-5 py-3 font-medium">{a.days}</td>
                <td className="px-5 py-3">
                  <Badge tone={a.status === 'admitted' ? 'teal' : 'slate'}>{t(`bill.adm.status.${a.status}`)}</Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  <Button className="!px-3 !py-1.5" loading={busyId === a.id} onClick={() => create(a)}>
                    <FilePlus2 className="h-4 w-4" /> {t('bill.adm.create')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}