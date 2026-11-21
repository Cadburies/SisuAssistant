import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { initPoseidonTheme } from '../plugins/map/poseidonTheme';
import './App.css';

void initPoseidonTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
