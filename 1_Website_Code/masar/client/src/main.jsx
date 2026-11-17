import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import { ThemeProvider } from './theme/ThemeContext.jsx';
import App from './App.jsx';
// Variable fonts: one file per alphabet covers every weight the design uses.
import '@fontsource-variable/inter';
import '@fontsource-variable/readex-pro';
import './styles.css';

const app = (
  <ThemeProvider>
    <LanguageProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </LanguageProvider>
  </ThemeProvider>
);

// The offline demo (npm run build:demo) opens from a file, where only #/ addresses work.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    {import.meta.env.MODE === 'demo' ? <HashRouter>{app}</HashRouter> : <BrowserRouter>{app}</BrowserRouter>}
  </StrictMode>
);
