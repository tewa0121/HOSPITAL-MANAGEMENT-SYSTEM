import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Ambulance, CalendarDays, Clock, Eye, Handshake, HeartPulse, Mail, MapPin, Phone, ShieldCheck, Sparkles, Target, Users,
} from 'lucide-react';
import PublicLayout from './PublicLayout';
import { CONTACT, NAME, langOf } from '../../utils/hospital';

/* Edit the texts below to match your hospital. */
const TXT = {
  en: {
    title: 'About Our Hospital',
    lead: 'is a general hospital that provides specialized and comprehensive medical services to the people of Injibara and the surrounding communities.',
    storyTitle: 'Who we are',
    story: [
      'We care for patients of every age through outpatient, emergency and inpatient services, supported by laboratory, pharmacy and radiology units.',
      'Our teams of doctors, nurses, laboratory technologists and pharmacists work together so that every patient is treated with respect, safety and compassion.',
      'Our hospital information system keeps patient records, appointments, laboratory results, prescriptions and billing in one secure place, so care is faster and more accurate.',
    ],
    missionTitle: 'Our mission',
    mission: 'To deliver comprehensive, accessible and quality healthcare to our community through skilled professionals, modern technology and compassionate service.',
    visionTitle: 'Our vision',
    vision: 'To be a trusted and leading hospital that every family in our region can rely on for better health and a better life.',
    valuesTitle: 'Our core values',
    values: [
      ['Compassion', 'We treat every patient with kindness and dignity.'],
      ['Excellence', 'We keep improving the quality and safety of our care.'],
      ['Integrity', 'We are honest, accountable and protect patient privacy.'],
      ['Teamwork', 'We work together across departments for the patient.'],
    ],
    servicesTitle: 'What we offer',
    services: ['Outpatient clinics', 'Emergency & trauma care', 'Inpatient wards', 'Laboratory services', 'Pharmacy', 'Radiology & imaging', 'Maternity care', 'Child health'],
    visitTitle: 'Visit us',
    hours: 'Open 24 hours, 7 days a week for emergencies.',
    bring: 'Please bring your ID card and any previous medical papers.',
    book: 'Book an Appointment', news: 'News & Events',
  },
  am: {
    title: 'ስለ ሆስፒታላችን',
    lead: 'ለእንጂባራና ለአካባቢው ማኅበረሰብ ልዩና ሁሉን አቀፍ የሕክምና አገልግሎት የሚሰጥ ጠቅላላ ሆስፒታል ነው።',
    storyTitle: 'እኛ ማን ነን',
    story: [
      'በተመላላሽ፣ በድንገተኛና በተኝቶ ሕክምና አገልግሎቶች የሁሉንም ዕድሜ ታካሚዎች እንንከባከባለን፤ ላቦራቶሪ፣ ፋርማሲና ራዲዮሎጂ ክፍሎች ይደግፉናል።',
      'ሐኪሞቻችን፣ ነርሶቻችን፣ የላቦራቶሪ ባለሙያዎቻችንና ፋርማሲስቶቻችን አንድ ላይ ይሠራሉ፤ ታካሚ ሁሉ በአክብሮት፣ በደኅንነትና በርኅራኄ እንዲስተናገድ።',
      'የሆስፒታል መረጃ ሥርዓታችን የታካሚ መዝገብ፣ ቀጠሮ፣ የላብ ውጤት፣ የመድኃኒት ትእዛዝና ክፍያን በአንድ ደኅንነቱ በተጠበቀ ቦታ ያስቀምጣል፤ አገልግሎቱም ፈጣንና ትክክለኛ ይሆናል።',
    ],
    missionTitle: 'ተልእኳችን',
    mission: 'በብቁ ባለሙያዎች፣ በዘመናዊ ቴክኖሎጂና በርኅራኄ አገልግሎት ሁሉን አቀፍ፣ ተደራሽና ጥራት ያለው የጤና አገልግሎት ለማኅበረሰባችን ማቅረብ።',
    visionTitle: 'ራዕያችን',
    vision: 'ለተሻለ ጤናና ለተሻለ ሕይወት በክልላችን ያለ ቤተሰብ ሁሉ የሚተማመንበት ቀዳሚ ሆስፒታል መሆን።',
    valuesTitle: 'መሠረታዊ እሴቶቻችን',
    values: [
      ['ርኅራኄ', 'ታካሚን ሁሉ በደግነትና በክብር እናስተናግዳለን።'],
      ['ልህቀት', 'የአገልግሎታችንን ጥራትና ደኅንነት ሁልጊዜ እናሻሽላለን።'],
      ['ሐቀኝነት', 'ሐቀኞች ነን፤ ተጠያቂነትና የታካሚ ምስጢራዊነትን እናስጠብቃለን።'],
      ['የቡድን ሥራ', 'ለታካሚው ስንል በክፍሎች መካከል በአንድነት እንሠራለን።'],
    ],
    servicesTitle: 'የምናቀርባቸው አገልግሎቶች',
    services: ['የተመላላሽ ክሊኒኮች', 'የድንገተኛና የአደጋ ሕክምና', 'የተኝቶ ሕክምና ክፍሎች', 'የላቦራቶሪ አገልግሎት', 'ፋርማሲ', 'ራዲዮሎጂና ምስል', 'የወሊድ አገልግሎት', 'የሕፃናት ጤና'],
    visitTitle: 'ይጎብኙን',
    hours: 'ለድንገተኛ ሁኔታ በ24 ሰዓት፣ በሳምንት 7 ቀናት ክፍት ነው።',
    bring: 'እባክዎ መታወቂያዎንና ቀደም ሲል የነበሩ የሕክምና ወረቀቶችን ይዘው ይምጡ።',
    book: 'ቀጠሮ ያስይዙ', news: 'ዜና እና ክስተቶች',
  },
};
const VALUE_ICONS = [HeartPulse, Sparkles, ShieldCheck, Handshake];

export default function AboutPage() {
  const { i18n } = useTranslation();
  const lang = langOf(i18n);
  const L = TXT[lang];
  const name = NAME[lang].split(' ').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ');

  return (
    <PublicLayout>
      {/* intro banner */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-teal-700 via-teal-800 to-sky-950 p-8 text-white shadow-lg sm:p-12">
        <HeartPulse className="h-10 w-10 text-teal-200" />
        <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">{L.title}</h1>
        <p className="mt-3 max-w-2xl text-lg text-teal-50"><strong>{name}</strong> {L.lead}</p>
      </section>

      {/* who we are */}
      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><Users className="h-6 w-6 text-teal-600" /> {L.storyTitle}</h2>
        <div className="mt-4 space-y-3 leading-relaxed">
          {L.story.map((p) => <p key={p}>{p}</p>)}
        </div>
      </section>

      {/* mission + vision */}
      <section className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-teal-100 bg-teal-50 p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold text-teal-900"><Target className="h-5 w-5" /> {L.missionTitle}</h2>
          <p className="mt-3 text-teal-950">{L.mission}</p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-sky-50 p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold text-sky-900"><Eye className="h-5 w-5" /> {L.visionTitle}</h2>
          <p className="mt-3 text-sky-950">{L.vision}</p>
        </div>
      </section>

      {/* values */}
      <section className="mt-8">
        <h2 className="text-2xl font-bold text-slate-900">{L.valuesTitle}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {L.values.map(([title, text], i) => {
            const Icon = VALUE_ICONS[i];
            return (
              <div key={title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50 text-teal-600"><Icon className="h-6 w-6" /></span>
                <p className="mt-3 font-bold text-slate-900">{title}</p>
                <p className="mt-1 text-sm text-slate-600">{text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* services */}
      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold text-slate-900">{L.servicesTitle}</h2>
        <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
          {L.services.map((s) => (
            <li key={s} className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full bg-teal-500" /> {s}</li>
          ))}
        </ul>
      </section>

      {/* visit */}
      <section className="mt-8 grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl bg-red-600 p-6 text-white shadow-lg">
          <Ambulance className="h-9 w-9" />
          <h2 className="mt-3 text-xl font-bold">{L.visitTitle}</h2>
          <p className="mt-2 flex items-start gap-2"><Clock className="mt-0.5 h-5 w-5 shrink-0" /> {L.hours}</p>
          <p className="mt-2 text-red-50">{L.bring}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="/#appointment" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"><CalendarDays className="h-4 w-4" /> {L.book}</a>
            <Link to="/news" className="rounded-lg border border-white/70 px-5 py-2.5 text-sm font-semibold hover:bg-white/10">{L.news}</Link>
          </div>
        </div>
        <ul className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <li className="flex items-center gap-3"><MapPin className="h-5 w-5 text-teal-600" /> {CONTACT.address}</li>
          <li className="flex items-center gap-3"><Phone className="h-5 w-5 text-teal-600" /> {CONTACT.phone}</li>
          <li className="flex items-center gap-3"><Mail className="h-5 w-5 text-teal-600" /> {CONTACT.email}</li>
          <li className="flex items-center gap-3"><Clock className="h-5 w-5 text-teal-600" /> {CONTACT.hours[lang]}</li>
        </ul>
      </section>
    </PublicLayout>
  );
}
