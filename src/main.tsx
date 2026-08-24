import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { applyTheme, loadTheme } from './game/preferences';

// Before the first render, so a stored theme that disagrees with the OS never
// flashes the wrong palette on the way in.
applyTheme(loadTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
