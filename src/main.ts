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

const params = new URLSearchParams(location.search);
if (params.has('diagnostico')) {
  void import('./diagnostico').then((m) => m.runDiagnostics());
} else {
  const demo = import.meta.env.MODE === 'demo' || params.has('muestra');
  new App({ demo }).mount();
}
