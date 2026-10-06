import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './hud/hud.css';

const root = createRoot(document.getElementById('root')!);
const portrait = import.meta.env.DEV ? new URLSearchParams(location.search).get('portrait') : null;

if (portrait) {
  // Development only: renders one character, used to make the PNGs in public/portraits.
  import('./tools/PortraitStudio').then(({ PortraitStudio }) => root.render(<PortraitStudio name={portrait} />));
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
