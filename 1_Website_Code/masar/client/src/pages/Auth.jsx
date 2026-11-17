import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormError } from '../components/States.jsx';

function Field({ id, label, hint, error, ...props }) {
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        aria-invalid={!!error}
        aria-describedby={hint || error ? `${id}-help` : undefined}
        {...props}
      />
      {(error || hint) && (
        <p id={`${id}-help`} className={error ? 'field__error' : 'field__hint'}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Register() {
  const { t } = useLang();
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', university: '', academicYear: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.name.trim().length < 2) errs.name = t('auth.fields.name');
    if (!EMAIL_RE.test(form.email.trim())) errs.email = t('auth.fields.email');
    if (form.password.length < 8) errs.password = t('auth.fields.password');
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    setError(null);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      if (err.details?.fields)
        setFieldErrors(Object.fromEntries(err.details.fields.map((f) => [f, t(`auth.fields.${f}`)])));
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="auth">
      <h1 className="page-title">{t('auth.registerTitle')}</h1>
      <p className="page-lead">{t('auth.registerLead')}</p>
      <form className="form" onSubmit={submit} noValidate>
        <Field
          id="name"
          label={t('auth.name')}
          value={form.name}
          onChange={update}
          autoComplete="name"
          error={fieldErrors.name}
          required
        />
        <Field
          id="email"
          type="email"
          dir="ltr"
          label={t('auth.email')}
          value={form.email}
          onChange={update}
          autoComplete="email"
          error={fieldErrors.email}
          required
        />
        <Field
          id="password"
          type="password"
          dir="ltr"
          label={t('auth.password')}
          hint={t('auth.passwordHint')}
          value={form.password}
          onChange={update}
          autoComplete="new-password"
          error={fieldErrors.password}
          required
        />
        <div className="form__row">
          <Field
            id="university"
            label={`${t('auth.university')} (${t('common.optional')})`}
            value={form.university}
            onChange={update}
          />
          <Field
            id="academicYear"
            label={`${t('auth.academicYear')} (${t('common.optional')})`}
            value={form.academicYear}
            onChange={update}
          />
        </div>
        <FormError error={error} />
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {t('auth.submitRegister')}
        </button>
      </form>
      <p className="auth__switch">
        <Link to="/login">{t('auth.toLogin')}</Link>
      </p>
    </section>
  );
}

export function Login() {
  const { t } = useLang();
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(form.email, form.password);
      navigate(location.state?.from || (u.role === 'admin' ? '/admin' : '/dashboard'));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="auth">
      <h1 className="page-title">{t('auth.loginTitle')}</h1>
      <p className="page-lead">{t('auth.loginLead')}</p>
      <form className="form" onSubmit={submit} noValidate>
        <Field
          id="email"
          type="email"
          dir="ltr"
          label={t('auth.email')}
          value={form.email}
          onChange={update}
          autoComplete="email"
          required
        />
        <Field
          id="password"
          type="password"
          dir="ltr"
          label={t('auth.password')}
          value={form.password}
          onChange={update}
          autoComplete="current-password"
          required
        />
        <FormError error={error} />
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {t('auth.submitLogin')}
        </button>
      </form>
      <p className="auth__switch">
        <Link to="/register">{t('auth.toRegister')}</Link>
      </p>
    </section>
  );
}
