import { Component } from 'react';

// The offline demo uses #/ addresses (see main.jsx).
const JOURNEY_HREF = import.meta.env.MODE === 'demo' ? '#/dashboard' : '/dashboard';

// Catches render errors on a page so the shell (header, language, theme)
// stays usable and the student can go back or reload.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Masar page crashed:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    // A navigation gives the new page a fresh start.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const { lang } = this.props;
    const ar = lang === 'ar';
    return (
      <section className="state state--error" role="alert">
        <h1 className="page-title">{ar ? 'حدث خطأ في هذه الصفحة' : 'This page hit an error'}</h1>
        <p>
          {ar
            ? 'بياناتك محفوظة. أعد تحميل الصفحة أو ارجع إلى «رحلتي».'
            : 'Your data is safe. Reload the page or go back to your journey.'}
        </p>
        <div className="form__actions">
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            {ar ? 'إعادة التحميل' : 'Reload'}
          </button>
          <a className="btn btn--ghost" href={JOURNEY_HREF}>
            {ar ? 'رحلتي' : 'My journey'}
          </a>
        </div>
      </section>
    );
  }
}
