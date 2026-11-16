import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { unlockAudio } from './audio/sound';
import './styles.css';

// Nettlesere krever en brukerhandling før lyd kan spilles.
const unlock = () => unlockAudio();
window.addEventListener('pointerdown', unlock, { passive: true });
window.addEventListener('keydown', unlock);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
