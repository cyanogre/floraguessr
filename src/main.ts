import '@fontsource/im-fell-english/latin-400.css';
import '@fontsource/im-fell-english/latin-400-italic.css';
import '@fontsource/alegreya/latin-400.css';
import '@fontsource/alegreya/latin-400-italic.css';
import '@fontsource/alegreya/latin-700.css';
import '@fontsource/courier-prime/latin-400.css';
import '@fontsource/courier-prime/latin-700.css';
import './styles/tokens.css';
import './styles/app.css';
import { App } from './ui/app';

const demo = import.meta.env.MODE === 'demo' || new URLSearchParams(location.search).has('muestra');
new App({ demo }).mount();
