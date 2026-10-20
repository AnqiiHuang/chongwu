import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameApp } from './app/GameApp';
import './styles/global.css';

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><GameApp /></StrictMode>);
