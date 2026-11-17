// A small "demo version" note in the corner: what this copy is, the demo
// accounts, and a button to start over. Plain DOM, so it stays out of the app.
import { resetDemo } from './server.js';
import { DEMO_ADMIN, DEMO_STUDENT, GUEST_MODE } from './seed.js';

const TEXT = {
  ar: {
    pill: 'نسخة عرض',
    title: 'نسخة عرض بدون سيرفر',
    body: 'كل ما تفعله هنا محفوظ في هذا المتصفح فقط، ولا يُرسل لأي مكان.',
    admin: 'دخول المشرف',
    student: 'طالب لديه تقدم',
    reset: 'ابدأ العرض من جديد',
    confirm: 'سيُحذف كل ما أضفته في هذه النسخة وتعود البيانات التجريبية. متابعة؟',
    close: 'إغلاق',
  },
  en: {
    pill: 'Demo',
    title: 'Demo version, no server',
    body: 'Everything you do here is saved in this browser only and sent nowhere.',
    admin: 'Supervisor login',
    student: 'Student with progress',
    reset: 'Start the demo over',
    confirm: 'Everything you added in this demo will be removed and the sample data restored. Continue?',
    close: 'Close',
  },
};

const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  Object.assign(node, attrs);
  node.append(...children);
  return node;
};

export function mountDemoBanner() {
  const root = el('div', { className: 'demo-note' });
  document.body.append(root);

  const render = () => {
    const t = TEXT[document.documentElement.lang === 'en' ? 'en' : 'ar'];
    const open = root.dataset.open === 'true';
    const pill = el('button', { type: 'button', className: 'demo-note__pill', textContent: t.pill });
    pill.setAttribute('aria-expanded', String(open));
    pill.addEventListener('click', () => {
      root.dataset.open = String(!open);
      render();
    });

    // The address and password stay together, left to right, even inside Arabic text.
    const account = (label, { email, password }) =>
      el(
        'p',
        {},
        el('strong', { textContent: `${label}: ` }),
        el('span', { dir: 'ltr', className: 'demo-note__cred', textContent: `${email}  ·  ${password}` })
      );

    const reset = el('button', { type: 'button', className: 'demo-note__reset', textContent: t.reset });
    reset.addEventListener('click', () => {
      if (!window.confirm(t.confirm)) return;
      resetDemo();
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith('masar.') && k !== 'masar.lang' && k !== 'masar.theme')
          .forEach((k) => localStorage.removeItem(k));
      } catch {
        /* ignore */
      }
      window.location.hash = '#/';
      window.location.reload();
    });

    const panel = el(
      'div',
      { className: 'demo-note__panel', hidden: !open },
      el('p', { className: 'demo-note__title', textContent: t.title }),
      el('p', { textContent: t.body }),
      ...(GUEST_MODE ? [] : [account(t.admin, DEMO_ADMIN), account(t.student, DEMO_STUDENT)]),
      reset
    );
    root.replaceChildren(panel, pill);
  };

  render();
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
}
