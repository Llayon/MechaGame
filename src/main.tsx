import {createRoot} from 'react-dom/client';
import './index.css';

const root = createRoot(document.getElementById('root')!);
// The lab does not even import App: no mission state, enemies, audio or AI boot.
if (new URLSearchParams(location.search).get('demo') === 'infantry') {
  void import('./infantry/playground/InfantryDemo').then(({ default: Demo }) => root.render(<Demo />));
} else if (new URLSearchParams(location.search).get('lab') === 'infantry') {
  void import('./infantry/InfantryLab').then(({ default: Lab }) => root.render(<Lab />));
} else {
  void import('./App.tsx').then(({ default: App }) => root.render(<App />));
}
