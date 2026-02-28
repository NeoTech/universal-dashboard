import './styles/base.css';
import { render, createComponent } from 'solid-js/web';
import { App } from './App';
import { DEFAULT_CONFIG } from './config/config';

const rootEl =
  document.getElementById('wm-root') ??
  (() => {
    const d = document.createElement('div');
    d.id = 'wm-root';
    document.body.appendChild(d);
    return d;
  })();

render(() => createComponent(App, { config: DEFAULT_CONFIG }), rootEl);
