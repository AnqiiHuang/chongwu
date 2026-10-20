import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameApp } from './app/GameApp';
import './styles/global.css';

const root = document.getElementById('root');
const align = import.meta.env.DEV && new URLSearchParams(window.location.search).has('align');

if (root && align) {
  void import('./components/AlignStudio').then(({ AlignStudio }) => {
    createRoot(root).render(<StrictMode><AlignStudio /></StrictMode>);
  });
} else if (root) {
  createRoot(root).render(<StrictMode><GameApp /></StrictMode>);
}
