// Entry point of the offline demo: the in-browser API first, then the app
// exactly as it ships, then the small "demo version" note.
import './install.js';
import './demo.css';
import '../src/main.jsx';
import { mountDemoBanner } from './banner.js';

mountDemoBanner();
