import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import App from './App.jsx';
import { AppProvider } from './context/AppContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* reducedMotion="user" makes every Framer animation honor the OS setting */}
    <MotionConfig
      reducedMotion="user"
      transition={{ type: 'spring', bounce: 0.28, duration: 0.5 }}
    >
      <AuthProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </AuthProvider>
    </MotionConfig>
  </StrictMode>
);
