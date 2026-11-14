import { render } from 'preact';
import './ui/style.css';
import { App } from './ui/App.tsx';
import { applyOpts, startLoop } from './ui/store.ts';

applyOpts();
render(<App />, document.getElementById('app')!);
startLoop();
