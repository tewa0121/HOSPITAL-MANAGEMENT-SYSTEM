import { useTranslation } from 'react-i18next';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import { todayISO } from '../../utils/formatters';

export default function NotesPanel({ notes, setNotes, editable, dirty, saving, onSave }) {
  const { t } = useTranslation();
  if (!notes) return null;
  const ro = !editable;
  const on = (k) => (e) => setNotes({ [k]: e.target.value });

  return (
    <Card title={t('consult.notes.title')} action={dirty && <Badge tone="amber">{t('consult.notes.unsaved')}</Badge>}>
      <div className="space-y-4">
        <Textarea label={t('consult.notes.chiefComplaint')} rows={2} value={notes.chief_complaint} onChange={on('chief_complaint')} disabled={ro} />
        <Textarea label={t('consult.notes.hpi')} rows={3} value={notes.history_present_illness} onChange={on('history_present_illness')} disabled={ro} />
        <Textarea label={t('consult.notes.examination')} rows={3} value={notes.examination} onChange={on('examination')} disabled={ro} />
        <Textarea label={t('consult.notes.plan')} rows={3} value={notes.treatment_plan} onChange={on('treatment_plan')} disabled={ro} />
        <Input
          label={t('consult.notes.followUp')} type="date" min={todayISO()} className="sm:w-60"
          value={notes.follow_up_date} onChange={on('follow_up_date')} disabled={ro}
        />
        {editable && (
          <div className="flex justify-end">
            <Button onClick={onSave} loading={saving} disabled={!dirty}>{t('form.save')}</Button>
          </div>
        )}
      </div>
    </Card>
  );
}