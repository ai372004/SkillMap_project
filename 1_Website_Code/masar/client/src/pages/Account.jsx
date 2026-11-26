import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { api, setToken } from '../api.js';
import { FormError } from '../components/States.jsx';

// Account page: change the password.
// A student whose password was reset by the supervisor is sent here first.
export default function Account() {
  const { t } = useLang();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.currentPassword) errs.currentPassword = t('account.fields.currentPassword');
    if (form.newPassword.length < 8) errs.newPassword = t('account.fields.newPassword');
    if (form.confirm !== form.newPassword) errs.confirm = t('account.fields.confirm');
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    setError(null);
    try {
      const d = await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
      });
      setToken(d.token);
      setUser(d.user);
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setDone(true);
      if (user?.mustChangePassword) navigate(user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      // Show the server's reason under the field it is about: "wrong password" and
      // "same password" have their own messages, not the field's "required" hint.
      const specific = ['WRONG_PASSWORD', 'SAME_PASSWORD'].includes(err.code) ? t(`errors.${err.code}`) : null;
      if (err.details?.fields)
        setFieldErrors(Object.fromEntries(err.details.fields.map((f) => [f, specific || t(`account.fields.${f}`)])));
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const field = (id, label, extra = {}) => (
    <div className={`field${fieldErrors[id] ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type="password"
        dir="ltr"
        value={form[id]}
        onChange={update}
        aria-invalid={!!fieldErrors[id]}
        aria-describedby={fieldErrors[id] || extra.hint ? `${id}-help` : undefined}
        required
        {...extra}
      />
      {(fieldErrors[id] || extra.hint) && (
        <p id={`${id}-help`} className={fieldErrors[id] ? 'field__error' : 'field__hint'}>
          {fieldErrors[id] || extra.hint}
        </p>
      )}
    </div>
  );

  return (
    <section className="auth">
      <h1 className="page-title">{t('account.title')}</h1>
      <p className="page-lead">{user?.name}</p>
      <p className="muted" dir="ltr">
        {user?.email}
      </p>

      {user?.mustChangePassword && (
        <p className="notice notice--warn" role="status">
          {t('account.mustChange')}
        </p>
      )}

      <h2 className="panel__title">{t('account.changePassword')}</h2>
      <form className="form" onSubmit={submit} noValidate>
        {field('currentPassword', t('account.currentPassword'), { autoComplete: 'current-password' })}
        {field('newPassword', t('account.newPassword'), { autoComplete: 'new-password', hint: t('auth.passwordHint') })}
        {field('confirm', t('account.confirm'), { autoComplete: 'new-password' })}
        {error && !Object.keys(fieldErrors).length && <FormError error={error} />}
        {done && (
          <p className="notice notice--ok" role="status">
            {t('account.saved')}
          </p>
        )}
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? t('common.loading') : t('account.submit')}
        </button>
      </form>
    </section>
  );
}
