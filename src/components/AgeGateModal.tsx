import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { DarlingWordmark } from './DarlingWordmark.tsx';

interface AgeGateModalProps {
  open: boolean;
  onConfirm18Plus: () => void;
}

function calculateAge(dobString: string): number | null {
  if (!dobString) return null;
  const parts = dobString.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [year, month, day] = parts;
  if (year < 1900 || year > new Date().getFullYear()) return null;
  const today = new Date();
  let age = today.getFullYear() - year;
  const mDiff = today.getMonth() + 1 - month;
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < day)) {
    age--;
  }
  return age;
}

export function AgeGateModal({ open, onConfirm18Plus }: AgeGateModalProps) {
  const [birthDate, setBirthDate] = useState('');
  const [confirmedCheck, setConfirmedCheck] = useState(false);
  const [deniedUnderage, setDeniedUnderage] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const age = calculateAge(birthDate);
    if (age === null) {
      setErrorMsg('Please enter your complete birth date to confirm your age.');
      return;
    }
    if (age < 18) {
      setDeniedUnderage(true);
      return;
    }
    if (!confirmedCheck) {
      setErrorMsg('Confirm the 18+ agreement box to enter and download.');
      return;
    }
    onConfirm18Plus();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="18+ Age Verification Gate"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#09080B]/95 backdrop-blur-md p-4"
    >
      <div className="w-full max-w-md rounded-3xl border border-[#E85D75]/35 bg-[#16141A] p-6 sm:p-8 text-center shadow-2xl">
        <div className="flex justify-center">
          <DarlingWordmark variant="hero" />
        </div>

        <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#E8C5A5]">
          <ShieldAlert className="h-4 w-4 text-[#E85D75]" />
          <span>STRICTLY 18 YEARS OLD &amp; ABOVE ONLY</span>
        </div>

        {deniedUnderage ? (
          <div className="mt-5 rounded-2xl border border-[#F47286]/40 bg-[#251319] p-5 text-left">
            <h2 className="text-base font-semibold text-[#F5F2EE]">
              Download &amp; Access Restricted (Under 18)
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-[#E3C6CC]">
              <strong>Watch me Darling</strong> is an adult sensory companion intended exclusively for individuals <strong>18 years of age and older</strong>. You are not permitted to download, install, or use this application.
            </p>
            <button
              type="button"
              onClick={() => {
                setDeniedUnderage(false);
                setBirthDate('');
              }}
              className="mt-4 min-h-[40px] rounded-xl border border-white/15 bg-[#0D0C0F] px-4 py-2 text-xs font-medium text-[#A099A8] hover:text-[#F5F2EE] cursor-pointer"
            >
              Re-enter Birth Date
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-left">
            <p className="text-center text-xs leading-relaxed text-[#A099A8]">
              Only adults aged <strong>18+</strong> are allowed to download, install, or access <strong>Watch me Darling</strong>, its smartwatch pulse features, and intimate AI chats.
            </p>

            <div>
              <label htmlFor="age-gate-dob" className="block text-xs font-medium text-[#D3CDD9]">
                Date of Birth (Must be 18 or older)
              </label>
              <input
                id="age-gate-dob"
                type="date"
                required
                max={new Date().toISOString().split('T')[0]}
                value={birthDate}
                onChange={(e) => {
                  setBirthDate(e.target.value);
                  setErrorMsg(null);
                }}
                className="mt-1.5 h-11 w-full rounded-xl border border-white/15 bg-[#0D0C0F] px-3.5 text-sm text-[#F5F2EE] focus:border-[#E85D75] focus:outline-none"
              />
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/[0.07] bg-[#0D0C0F] p-3 text-xs text-[#D3CDD9]">
              <input
                type="checkbox"
                checked={confirmedCheck}
                onChange={(e) => {
                  setConfirmedCheck(e.target.checked);
                  setErrorMsg(null);
                }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#E85D75]"
              />
              <span>
                I legally confirm that I am <strong>18 years old or above</strong> and consent to adult sensory entertainment.
              </span>
            </label>

            {errorMsg && <p className="text-xs text-[#F47286]">{errorMsg}</p>}

            <div className="grid gap-2.5 pt-1 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setDeniedUnderage(true)}
                className="min-h-[44px] rounded-xl border border-white/10 bg-[#0D0C0F] px-4 py-2 text-xs font-medium text-[#A099A8] hover:text-[#F5F2EE] cursor-pointer"
              >
                I am under 18
              </button>
              <button
                type="submit"
                className="min-h-[44px] rounded-xl bg-[#E85D75] px-4 py-2 text-xs font-semibold text-white hover:bg-[#d94d66] cursor-pointer"
              >
                Confirm 18+ &amp; Enter
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
