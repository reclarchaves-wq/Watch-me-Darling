import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  RecaptchaVerifier,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  updateProfile,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import {
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  auth,
  googleProvider,
  isUserContactVerified,
  syncVerifiedUserProfile,
  type VerifiedAccountProfile,
} from '../firebase.ts';
import { DarlingWordmark } from './DarlingWordmark.tsx';

interface AccountAuthModalProps {
  open: boolean;
  isMandatoryOnboarding: boolean;
  currentUser: User | null;
  profile: VerifiedAccountProfile | null;
  onClose: () => void;
  onVerifiedComplete: (profile: VerifiedAccountProfile) => void;
}

function normalizePhoneNumber(raw: string): string {
  const cleaned = raw.trim().replace(/[\s()-]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;
  // Default Philippines local format 09XXXXXXXXX -> +639XXXXXXXXX
  if (/^09\d{9}$/.test(cleaned)) {
    return `+63${cleaned.slice(1)}`;
  }
  if (/^63\d{10}$/.test(cleaned)) {
    return `+${cleaned}`;
  }
  return `+${cleaned.replace(/^\+/, '')}`;
}

function mobileToAliasEmail(e164Phone: string): string {
  const digits = e164Phone.replace(/[^0-9]/g, '');
  return `m${digits}@mobile.watchmedarling.app`;
}

function friendlyAuthError(err: unknown): string {
  if (!(err instanceof Error)) return 'Authentication failed. Please check your details and try again.';
  const msg = err.message;
  if (msg.includes('auth/operation-not-allowed')) {
    return 'Enable Email/Password & Phone Sign-In in Firebase Console -> Authentication -> Sign-in method (or use Continue with Google below).';
  }
  if (msg.includes('auth/email-already-in-use')) {
    return 'That email is already registered. Switch to Sign In above.';
  }
  if (msg.includes('auth/invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (msg.includes('auth/weak-password')) {
    return 'Password must be at least 8 characters long.';
  }
  if (msg.includes('auth/wrong-password') || msg.includes('auth/invalid-credential')) {
    return 'Incorrect email/mobile or password. Please check and try again.';
  }
  if (msg.includes('auth/invalid-phone-number')) {
    return 'Enter a valid mobile number with country code (e.g. +639171234567 or 09171234567).';
  }
  if (msg.includes('auth/invalid-verification-code')) {
    return 'Incorrect 6-digit SMS verification code. Please check your message and retry.';
  }
  if (msg.includes('auth/too-many-requests')) {
    return 'Too many verification attempts. Wait a moment before requesting another code.';
  }
  if (msg.includes('auth/popup-closed-by-user')) {
    return 'Google sign-in popup was closed before completing.';
  }
  return msg;
}

export function AccountAuthModal({
  open,
  isMandatoryOnboarding,
  currentUser,
  profile,
  onClose,
  onVerifiedComplete,
}: AccountAuthModalProps) {
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');
  const [channel, setChannel] = useState<'email' | 'mobile'>('email');
  const [step, setStep] = useState<'form' | 'verify-email' | 'verify-mobile'>('form');

  const [displayName, setDisplayName] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [mobileInput, setMobileInput] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const [otpCode, setOtpCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [pendingMobileE164, setPendingMobileE164] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (currentUser && !isUserContactVerified(currentUser) && currentUser.email) {
      setPendingEmail(currentUser.email);
      setStep('verify-email');
    } else if (!currentUser) {
      setStep('form');
    }
  }, [currentUser]);

  useEffect(() => {
    return () => {
      if (recaptchaRef.current) {
        try {
          recaptchaRef.current.clear();
        } catch {
          // Ignore recaptcha teardown error
        }
        recaptchaRef.current = null;
      }
    };
  }, []);

  if (!open) return null;

  const isAlreadyVerified = Boolean(currentUser && isUserContactVerified(currentUser));

  const getRecaptcha = (): RecaptchaVerifier => {
    if (recaptchaRef.current) {
      try {
        recaptchaRef.current.clear();
      } catch {
        // Ignore stale verifier cleanup
      }
    }
    const verifier = new RecaptchaVerifier(auth, 'recaptcha-watchmedarling', {
      size: 'invisible',
    });
    recaptchaRef.current = verifier;
    return verifier;
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);

    if (authMode === 'signup') {
      if (password.length < 8) {
        setErrorMsg('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match. Re-enter your password identically both times.');
        return;
      }
    }

    setBusy(true);
    try {
      if (channel === 'email') {
        const cleanEmail = emailInput.trim();
        if (!cleanEmail) {
          setErrorMsg('Please enter your email address.');
          return;
        }

        if (authMode === 'signup') {
          const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          const cleanName = displayName.trim() || cleanEmail.split('@')[0] || 'Darling';
          await updateProfile(cred.user, { displayName: cleanName });
          await sendEmailVerification(cred.user);
          setPendingEmail(cleanEmail);
          setStep('verify-email');
          setStatusMsg(
            `Verification link sent to ${cleanEmail}. Open your inbox and verify to unlock your account.`
          );
        } else {
          const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
          await reload(cred.user);
          if (!cred.user.emailVerified) {
            await sendEmailVerification(cred.user);
            setPendingEmail(cleanEmail);
            setStep('verify-email');
            setStatusMsg('Your email is not verified yet. We sent a fresh verification link.');
            return;
          }
          const synced = await syncVerifiedUserProfile({
            user: cred.user,
            displayName: cred.user.displayName || cleanEmail.split('@')[0] || 'Darling',
            contactMethod: 'email',
            email: cred.user.email || cleanEmail,
            phoneNumber: cred.user.phoneNumber || '',
          });
          onVerifiedComplete(synced);
        }
        return;
      }

      // Mobile Number channel
      const e164Phone = normalizePhoneNumber(mobileInput);
      if (!/^\+\d{8,15}$/.test(e164Phone)) {
        setErrorMsg('Enter a valid mobile number (e.g. +639171234567 or 09171234567).');
        return;
      }

      if (authMode === 'signin') {
        if (password.length >= 6) {
          try {
            const cred = await signInWithEmailAndPassword(
              auth,
              mobileToAliasEmail(e164Phone),
              password
            );
            const synced = await syncVerifiedUserProfile({
              user: cred.user,
              displayName: cred.user.displayName || e164Phone,
              contactMethod: 'mobile',
              email: '',
              phoneNumber: e164Phone,
            });
            onVerifiedComplete(synced);
            return;
          } catch {
            // Fall through to real SMS OTP sign-in if password alias was not linked
          }
        }
      }

      const verifier = getRecaptcha();
      const confirmation = await signInWithPhoneNumber(auth, e164Phone, verifier);
      setConfirmationResult(confirmation);
      setPendingMobileE164(e164Phone);
      setStep('verify-mobile');
      setStatusMsg(`6-digit SMS verification code sent to ${e164Phone}.`);
    } catch (err) {
      setErrorMsg(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCheckEmailVerified = async () => {
    if (!auth.currentUser) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await reload(auth.currentUser);
      if (!auth.currentUser.emailVerified) {
        setErrorMsg(
          'Email is not verified yet. Click the verification link in your inbox (check Spam too), then tap this button again.'
        );
        return;
      }
      const synced = await syncVerifiedUserProfile({
        user: auth.currentUser,
        displayName:
          displayName.trim() ||
          auth.currentUser.displayName ||
          pendingEmail.split('@')[0] ||
          'Darling',
        contactMethod: 'email',
        email: auth.currentUser.email || pendingEmail,
        phoneNumber: auth.currentUser.phoneNumber || '',
      });
      onVerifiedComplete(synced);
    } catch (err) {
      setErrorMsg(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleResendEmail = async () => {
    if (!auth.currentUser) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await sendEmailVerification(auth.currentUser);
      setStatusMsg(`New verification email sent to ${pendingEmail || auth.currentUser.email}.`);
    } catch (err) {
      setErrorMsg(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyMobileOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    const trimmedOtp = otpCode.trim();
    if (trimmedOtp.length < 4) {
      setErrorMsg('Enter the 6-digit SMS verification code sent to your mobile number.');
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    try {
      const cred = await confirmationResult.confirm(trimmedOtp);
      const cleanName = displayName.trim() || cred.user.displayName || pendingMobileE164;

      if (displayName.trim()) {
        await updateProfile(cred.user, { displayName: cleanName });
      }

      // Attach verified password credential for mobile + password future sign-ins when enabled
      if (authMode === 'signup' && password.length >= 8) {
        try {
          const pwCred = EmailAuthProvider.credential(
            mobileToAliasEmail(pendingMobileE164),
            password
          );
          await linkWithCredential(cred.user, pwCred);
        } catch {
          // Non-fatal if Email/Password provider isn't enabled or already linked
        }
      }

      const synced = await syncVerifiedUserProfile({
        user: cred.user,
        displayName: cleanName,
        contactMethod: 'mobile',
        email: '',
        phoneNumber: cred.user.phoneNumber || pendingMobileE164,
      });
      onVerifiedComplete(synced);
    } catch (err) {
      setErrorMsg(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const synced = await syncVerifiedUserProfile({
        user: cred.user,
        displayName: cred.user.displayName || cred.user.email?.split('@')[0] || 'Darling',
        contactMethod: 'google',
        email: cred.user.email || '',
        phoneNumber: cred.user.phoneNumber || '',
      });
      onVerifiedComplete(synced);
    } catch (err) {
      setErrorMsg(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setStep('form');
    setPassword('');
    setConfirmPassword('');
    setOtpCode('');
  };

  const passwordsMatch = password.length >= 8 && password === confirmPassword;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Account Sign Up and Verification"
      className="fixed inset-0 z-[85] flex items-center justify-center overflow-y-auto bg-[#09080B]/92 backdrop-blur-md p-4"
    >
      <div className="my-auto max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl border border-[#E85D75]/35 bg-[#16141A] p-6 sm:p-7 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DarlingWordmark variant="compact" />
            <h2 className="font-display mt-3 text-2xl font-medium text-[#F5F2EE]">
              {isAlreadyVerified
                ? 'Verified Account'
                : step === 'verify-email'
                ? 'Verify Through Email'
                : step === 'verify-mobile'
                ? 'Verify Through Mobile'
                : authMode === 'signup'
                ? 'Create Your 18+ Account'
                : 'Sign In to Watch me Darling'}
            </h2>
            <p className="mt-1 text-xs text-[#A099A8]">
              {isAlreadyVerified
                ? 'Your verified adult profile is synced across devices.'
                : step === 'form'
                ? 'Sign up with mobile number or email and verify your password twice.'
                : 'Complete verification to protect and unlock your account.'}
            </p>
          </div>

          {!isMandatoryOnboarding && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close account modal"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#0D0C0F] text-[#A099A8] hover:text-[#F5F2EE] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div id="recaptcha-watchmedarling" />

        {isAlreadyVerified && currentUser ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-[#E8C5A5]/40 bg-[#0D0C0F] p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-semibold text-[#E8C5A5]">
                <CheckCircle2 className="h-4 w-4" />
                <span>Verified 18+ Member</span>
              </div>
              <div className="text-sm font-semibold text-[#F5F2EE]">
                {profile?.displayName || currentUser.displayName || 'Darling'}
              </div>
              <div className="text-[#A099A8]">
                {currentUser.email || currentUser.phoneNumber || profile?.email || profile?.phoneNumber}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] rounded-xl bg-[#E85D75] px-4 py-2 text-xs font-semibold text-white hover:bg-[#d94d66] cursor-pointer"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#0D0C0F] px-4 py-2 text-xs font-medium text-[#A099A8] hover:text-[#F5F2EE] cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        ) : step === 'verify-email' ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-[#E8C5A5]/35 bg-[#0D0C0F] p-4 text-xs leading-relaxed text-[#D3CDD9]">
              <div className="flex items-center gap-2 font-semibold text-[#E8C5A5]">
                <Mail className="h-4 w-4" />
                <span>Verification Link Sent</span>
              </div>
              <p className="mt-2">
                Open the verification email sent to{' '}
                <strong className="text-[#F5F2EE]">{pendingEmail}</strong> and tap the confirmation link, then click below.
              </p>
            </div>

            {statusMsg && <p className="text-xs text-[#E8C5A5]">{statusMsg}</p>}
            {errorMsg && <p className="text-xs text-[#F47286]">{errorMsg}</p>}

            <button
              type="button"
              disabled={busy}
              onClick={() => void handleCheckEmailVerified()}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#E85D75] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#d94d66] disabled:opacity-60 cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{busy ? 'Checking...' : "I've Verified My Email — Enter"}</span>
            </button>

            <div className="flex items-center justify-between gap-2 text-xs">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleResendEmail()}
                className="inline-flex items-center gap-1 text-[#E8C5A5] hover:underline cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Resend email
              </button>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="text-[#8F8898] hover:text-[#F5F2EE] cursor-pointer"
              >
                Use another email / mobile
              </button>
            </div>
          </div>
        ) : step === 'verify-mobile' ? (
          <form onSubmit={(e) => void handleVerifyMobileOtp(e)} className="mt-5 space-y-4">
            <div className="rounded-2xl border border-[#E8C5A5]/35 bg-[#0D0C0F] p-4 text-xs text-[#D3CDD9]">
              <div className="flex items-center gap-2 font-semibold text-[#E8C5A5]">
                <Smartphone className="h-4 w-4" />
                <span>SMS Verification Code Sent</span>
              </div>
              <p className="mt-1.5">
                Enter the 6-digit verification code sent via SMS to{' '}
                <strong className="text-[#F5F2EE]">{pendingMobileE164}</strong>.
              </p>
            </div>

            <div>
              <label htmlFor="mobile-otp-input" className="block text-xs font-medium text-[#D3CDD9]">
                6-Digit SMS Verification Code
              </label>
              <input
                id="mobile-otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="123456"
                className="font-mono-tabular mt-1.5 h-11 w-full rounded-xl border border-white/15 bg-[#0D0C0F] px-3.5 text-center text-base tracking-[0.25em] text-[#F5F2EE] focus:border-[#E85D75] focus:outline-none"
              />
            </div>

            {statusMsg && <p className="text-xs text-[#E8C5A5]">{statusMsg}</p>}
            {errorMsg && <p className="text-xs text-[#F47286]">{errorMsg}</p>}

            <button
              type="submit"
              disabled={busy}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#E85D75] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#d94d66] disabled:opacity-60 cursor-pointer"
            >
              {busy ? 'Verifying SMS Code...' : 'Verify Mobile & Enter'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('form');
                setOtpCode('');
                setErrorMsg(null);
              }}
              className="w-full text-center text-xs text-[#8F8898] hover:text-[#F5F2EE] cursor-pointer"
            >
              Change mobile number
            </button>
          </form>
        ) : (
          <div className="mt-5 space-y-4">
            {/* Sign Up / Sign In Switcher */}
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-[#0D0C0F] p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setErrorMsg(null);
                }}
                className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  authMode === 'signup'
                    ? 'bg-[#E85D75] text-white'
                    : 'text-[#A099A8] hover:text-[#F5F2EE]'
                }`}
              >
                Sign Up
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setErrorMsg(null);
                }}
                className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  authMode === 'signin'
                    ? 'bg-[#E85D75] text-white'
                    : 'text-[#A099A8] hover:text-[#F5F2EE]'
                }`}
              >
                Sign In
              </button>
            </div>

            {/* Email vs Mobile Channel Switcher */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setChannel('email');
                  setErrorMsg(null);
                }}
                className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                  channel === 'email'
                    ? 'border-[#E8C5A5]/60 bg-[#211C26] text-[#F5F2EE]'
                    : 'border-white/[0.08] bg-[#0D0C0F] text-[#A099A8] hover:text-[#F5F2EE]'
                }`}
              >
                <Mail className="h-3.5 w-3.5 text-[#E8C5A5]" />
                Email
              </button>
              <button
                type="button"
                onClick={() => {
                  setChannel('mobile');
                  setErrorMsg(null);
                }}
                className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                  channel === 'mobile'
                    ? 'border-[#E8C5A5]/60 bg-[#211C26] text-[#F5F2EE]'
                    : 'border-white/[0.08] bg-[#0D0C0F] text-[#A099A8] hover:text-[#F5F2EE]'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5 text-[#E85D75]" />
                Mobile Number
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmitForm(e)} className="space-y-3">
              {authMode === 'signup' && (
                <div>
                  <label htmlFor="auth-display-name" className="block text-xs font-medium text-[#D3CDD9]">
                    Display Name
                  </label>
                  <input
                    id="auth-display-name"
                    type="text"
                    maxLength={48}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your nickname (e.g. Darling)"
                    className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#0D0C0F] px-3.5 text-sm text-[#F5F2EE] placeholder:text-[#6E6778] focus:border-[#E85D75] focus:outline-none"
                  />
                </div>
              )}

              {channel === 'email' ? (
                <div>
                  <label htmlFor="auth-email" className="block text-xs font-medium text-[#D3CDD9]">
                    Email Address
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    maxLength={160}
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#0D0C0F] px-3.5 text-sm text-[#F5F2EE] placeholder:text-[#6E6778] focus:border-[#E85D75] focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label htmlFor="auth-mobile" className="block text-xs font-medium text-[#D3CDD9]">
                    Mobile Number (SMS Verification)
                  </label>
                  <input
                    id="auth-mobile"
                    type="tel"
                    required
                    autoComplete="tel"
                    maxLength={24}
                    value={mobileInput}
                    onChange={(e) => setMobileInput(e.target.value)}
                    placeholder="+639171234567 or 09171234567"
                    className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#0D0C0F] px-3.5 text-sm text-[#F5F2EE] placeholder:text-[#6E6778] focus:border-[#E85D75] focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label htmlFor="auth-password-1" className="block text-xs font-medium text-[#D3CDD9]">
                  Password {authMode === 'signup' ? '(Minimum 8 characters)' : '(Optional for Mobile SMS)'}
                </label>
                <div className="relative mt-1">
                  <input
                    id="auth-password-1"
                    type={showPass ? 'text' : 'password'}
                    required={authMode === 'signup' || channel === 'email'}
                    minLength={authMode === 'signup' ? 8 : undefined}
                    autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="h-10 w-full rounded-xl border border-white/10 bg-[#0D0C0F] pl-3.5 pr-10 text-sm text-[#F5F2EE] placeholder:text-[#6E6778] focus:border-[#E85D75] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8F8898] hover:text-[#F5F2EE] cursor-pointer"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {authMode === 'signup' && (
                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="auth-password-2"
                      className="block text-xs font-medium text-[#D3CDD9]"
                    >
                      Verify Password (Enter 2nd Time)
                    </label>
                    {confirmPassword.length > 0 && (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                          passwordsMatch ? 'text-[#E8C5A5]' : 'text-[#F47286]'
                        }`}
                      >
                        {passwordsMatch && <Check className="h-3 w-3" />}
                        {passwordsMatch
                          ? 'Passwords match'
                          : password.length < 8
                          ? 'Min 8 chars'
                          : 'Does not match'}
                      </span>
                    )}
                  </div>
                  <input
                    id="auth-password-2"
                    type={showPass ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password to verify"
                    className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#0D0C0F] px-3.5 text-sm text-[#F5F2EE] placeholder:text-[#6E6778] focus:border-[#E85D75] focus:outline-none"
                  />
                </div>
              )}

              {statusMsg && <p className="text-xs text-[#E8C5A5]">{statusMsg}</p>}
              {errorMsg && <p className="text-xs leading-relaxed text-[#F47286]">{errorMsg}</p>}

              <button
                type="submit"
                disabled={busy}
                className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#E85D75] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#d94d66] disabled:opacity-60 cursor-pointer"
              >
                {busy
                  ? 'Sending Verification...'
                  : authMode === 'signup'
                  ? channel === 'email'
                    ? 'Sign Up & Verify via Email'
                    : 'Sign Up & Verify via Mobile SMS'
                  : channel === 'email'
                  ? 'Sign In with Email'
                  : 'Sign In via Mobile / SMS'}
              </button>
            </form>

            <div className="relative py-1 text-center text-[11px] text-[#8F8898]">
              <span className="bg-[#16141A] px-2 relative z-10">or instant verified login</span>
              <div className="absolute inset-x-0 top-1/2 h-[1px] bg-white/[0.08]" />
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void handleGoogleSignIn()}
              className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0D0C0F] px-4 py-2 text-xs font-medium text-[#F5F2EE] hover:bg-[#231F2B] disabled:opacity-60 cursor-pointer"
            >
              <span>Continue with Google</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
