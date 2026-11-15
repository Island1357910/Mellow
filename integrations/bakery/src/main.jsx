import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameProvider } from './context/GameContext';
import GameErrorBoundary from './components/GameErrorBoundary';
import App from './App';
import './styles/index.css';

/** 幕间 Lite SDK：动态加载，失败时不阻塞游戏（避免 SDK 异常导致整页白屏） */

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GameProvider>
      <GameErrorBoundary>
        <App />
      </GameErrorBoundary>
    </GameProvider>
  </StrictMode>,
);
