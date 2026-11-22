import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import AuthLoadingScreen from '../components/AuthLoadingScreen';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';
import styles from './AuthPage.module.css';

function FieldIcon({ type }) {
  if (type === 'email') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="m5 7 7 5.5L19 7"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></svg>;
}

function EyeIcon({ visible }) {
  return visible
    ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/><path d="m4 4 16 16"/></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>;
}

export default function AuthPage() {
  const { login, register, verifySignup, resendSignupCode, refreshUser, error, setError } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState('');
  const [postVerifyPhase, setPostVerifyPhase] = useState('idle');
  const [transitionPhase, setTransitionPhase] = useState('idle');
  const [transitionDirection, setTransitionDirection] = useState('left');
  const transitionTimer = useRef(null);
  const cardRef = useRef(null);
  const contentRef = useRef(null);
  const headingRef = useRef(null);
  const successModalRef = useRef(null);
  const otpRefs = useRef([]);
  const previousMode = useRef(mode);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => () => window.clearTimeout(transitionTimer.current), []);

  useEffect(() => {
    if (postVerifyPhase !== 'success') return undefined;
    successModalRef.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => setPostVerifyPhase('loading'), 5000);
    return () => window.clearTimeout(timer);
  }, [postVerifyPhase]);

  useEffect(() => {
    if (postVerifyPhase !== 'loading') return undefined;
    const timer = window.setTimeout(async () => {
      const activeUser = await refreshUser();
      if (!activeUser) {
        setPostVerifyPhase('idle');
        setMode('login');
        setNotice('Your account was created. Please sign in to continue.');
      }
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [postVerifyPhase, refreshUser]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const content = contentRef.current;
    if (!card || !content) return undefined;
    const measure = () => { card.style.height = `${content.getBoundingClientRect().height}px`; };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (previousMode.current !== mode) {
      headingRef.current?.focus({ preventScroll: true });
      previousMode.current = mode;
    }
  }, [mode]);

  useEffect(() => {
    if (mode === 'verify') otpRefs.current[0]?.focus();
  }, [mode]);

  const handleOtpChange = (index, value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length > 1) {
      const next = [...digits.slice(0, 6)];
      while (next.length < 6) next.push('');
      setOtp(next);
      otpRefs.current[Math.min(digits.length, 6) - 1]?.focus();
      return;
    }
    setOtp((current) => {
      const next = [...current];
      next[index] = digits.slice(-1);
      return next;
    });
    if (digits && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (event) => {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    event.preventDefault();
    const next = [...digits];
    while (next.length < 6) next.push('');
    setOtp(next);
    otpRefs.current[Math.min(digits.length, 6) - 1]?.focus();
  };

  const handleOtpKeyDown = (event, index) => {
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault(); otpRefs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < 5) {
      event.preventDefault(); otpRefs.current[index + 1]?.focus();
    } else if (event.key === 'Backspace' && !otp[index] && index > 0) {
      event.preventDefault(); otpRefs.current[index - 1]?.focus();
    }
  };

  const switchMode = () => {
    if (busy || mode === 'verify' || transitionPhase !== 'idle') return;
    if (reducedMotion) {
      setMode(mode === 'login' ? 'register' : 'login');
      setNotice('');
      setError('');
      return;
    }
    const direction = mode === 'login' ? 'left' : 'right';
    setTransitionDirection(direction);
    setTransitionPhase('exit');
    transitionTimer.current = window.setTimeout(() => {
      setMode((current) => current === 'login' ? 'register' : 'login');
      setNotice('');
      setError('');
      setTransitionPhase('enter');
      transitionTimer.current = window.setTimeout(() => setTransitionPhase('idle'), 220);
    }, 130);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy || transitionPhase !== 'idle') return;
    setBusy(true); setNotice(''); setError('');
    try {
      if (mode === 'verify') {
        await verifySignup(email, otp.join(''));
        setPostVerifyPhase('success');
      }
      else if (mode === 'login') await login(email, password);
      else {
        const result = await register(email, password);
        if (result.confirmationRequired) {
          setOtp(['', '', '', '', '', '']);
          setNotice('Check your inbox for a 6-digit verification code.');
          setMode('verify');
        }
      }
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };

  const resendCode = async () => {
    if (resending || busy) return;
    setResending(true); setNotice(''); setError('');
    try {
      await resendSignupCode(email);
      setNotice('A new confirmation code has been sent.');
    } catch (requestError) { setError(requestError.message); }
    finally { setResending(false); }
  };

  const backToSignup = () => {
    setMode('register'); setOtp(['', '', '', '', '', '']); setNotice(''); setError('');
  };

  if (postVerifyPhase === 'loading') return <AuthLoadingScreen/>;

  return <AuthLayout>
    <div className={styles.card} ref={cardRef}>
      <div ref={contentRef} className={styles.modeContent} data-phase={transitionPhase} data-direction={transitionDirection}>
      <h2 ref={headingRef} tabIndex="-1">{mode === 'verify' ? 'Check your email' : mode === 'login' ? 'Login Page' : 'Create account'}</h2>
      <p className={styles.intro}>{mode === 'verify' ? `Enter the 6-digit code sent to ${email}.` : 'Enter your credentials and begin learning'}</p>
      <form onSubmit={submit} className={styles.form}>
        {mode === 'verify' ? <>
          <label id="signup-otp-label" htmlFor="signup-otp-0">6-digit confirmation code</label>
          <div className={styles.otpBoxes} role="group" aria-labelledby="signup-otp-label">
            {otp.map((digit, index) => <input
              key={index}
              ref={(element) => { otpRefs.current[index] = element; }}
              id={`signup-otp-${index}`}
              className={`${styles.otpDigit} ${digit ? styles.otpFilled : ''}`}
              name={index === 0 ? 'otp' : undefined}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              pattern="[0-9]"
              maxLength={1}
              value={digit}
              onChange={(event) => handleOtpChange(index, event.target.value)}
              onPaste={handleOtpPaste}
              onKeyDown={(event) => handleOtpKeyDown(event, index)}
              aria-label={`Digit ${index + 1} of 6`}
              disabled={busy}
              required
            />)}
          </div>
        </> : <>
          <label htmlFor="login-email">Email</label>
          <div className={styles.inputWrap}>
            <span className={styles.fieldIcon}><FieldIcon type="email"/></span>
            <input id="login-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="email@gmail.com" required/>
          </div>
          <label htmlFor="login-password">Password</label>
          <div className={styles.inputWrap}>
            <span className={styles.fieldIcon}><FieldIcon type="password"/></span>
            <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Enter your password" minLength={8} required/>
            <button className={styles.visibilityToggle} type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}><EyeIcon visible={showPassword}/></button>
          </div>
        </>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        <button className={styles.submit} type="submit" disabled={busy || transitionPhase !== 'idle'}>
          {busy && <span className={styles.spinner} aria-hidden="true"/>}
          {busy ? (mode === 'verify' ? 'Verifying...' : mode === 'login' ? 'Signing in...' : 'Creating account...') : mode === 'verify' ? 'Verify email' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      {mode === 'verify' ? <div className={styles.verificationActions}>
        <button type="button" className={styles.resend} onClick={resendCode} disabled={resending || busy}>{resending ? 'Sending code...' : 'Resend code'}</button>
        <button type="button" className={styles.backToSignup} onClick={backToSignup} disabled={resending || busy}>Use a different email</button>
      </div> : <p className={styles.switch}>{mode === 'login' ? 'New to LinuxLab?' : 'Already have an account?'} <button type="button" onClick={switchMode} disabled={busy || transitionPhase !== 'idle'}>{mode === 'login' ? 'Create account' : 'Sign in'}</button></p>}
      </div>
    </div>
    {postVerifyPhase === 'success' && <div className={styles.successBackdrop}>
      <section ref={successModalRef} className={styles.successModal} role="dialog" aria-modal="true" aria-labelledby="activation-title" aria-describedby="activation-description" tabIndex="-1">
        <div className={styles.successIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.2 4.2L19 7"/></svg></div>
        <p className={styles.successEyebrow}>EMAIL VERIFIED</p>
        <h2 id="activation-title">Account created successfully</h2>
        <p id="activation-description">Your email is confirmed. We’re getting your LinuxLab workspace ready.</p>
        <div className={styles.successProgress} aria-hidden="true"><span/></div>
        <span className="sr-only" role="status" aria-live="polite">Your account was created successfully. Continuing in five seconds.</span>
      </section>
    </div>}
  </AuthLayout>;
}
