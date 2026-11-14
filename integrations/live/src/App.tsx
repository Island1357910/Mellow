import { useEffect, useState } from 'react';
import { embedded, host, MujianSdk } from './utils/mellowHost';
import AppShell from './components/Phone/AppShell';
import ScheduleReminderPopup from './components/Common/ScheduleReminderPopup';
import PKNotificationBanner from './components/Common/PKNotificationBanner';
import Toast from './components/Common/Toast';
import Loading from './components/Common/Loading';
import Onboarding from './pages/Onboarding';
import { usePlayerStore } from './stores/usePlayerStore';
import { useNavStore } from './stores/useNavStore';
import { useBackgroundBehaviors } from './hooks/useBackgroundBehaviors';
import { useApplyTheme } from './hooks/useApplyTheme';
import GlobalMusicPlayer from './components/Music/GlobalMusicPlayer';

import Home from './pages/Home';
import LiveList from './pages/LiveList';
import AnchorProfile from './pages/AnchorProfile';
import LiveRoom from './pages/LiveRoom';
import PKRoom from './pages/PKRoom';
import ChatList from './pages/ChatList';
import ChatDetail from './pages/ChatDetail';
import MomentsFeed from './pages/MomentsFeed';
import SocialFeed from './pages/SocialFeed';
import SocialProfile from './pages/SocialProfile';
import SocialPostDetail from './pages/SocialPostDetail';
import Shop from './pages/Shop';
import Delivery from './pages/Delivery';
import Wallet from './pages/Wallet';
import Settings from './pages/Settings';
import Music from './pages/Music';
import CustomAnchorEditor from './pages/CustomAnchorEditor';
import { useCustomAnchorStore } from './stores/useCustomAnchorStore';
import { waitForPersistHydration } from './utils/persistHydration';

// 确保自定义主播在路由前完成 hydrate 注册
void useCustomAnchorStore.getState();

type SdkStatus = 'loading' | 'ready' | 'error';

function App() {
  const [sdkStatus, setSdkStatus] = useState<SdkStatus>('loading');
  const [storesHydrated, setStoresHydrated] = useState(false);
  const hasOnboarded = usePlayerStore((s) => s.hasOnboarded);
  const currentScreen = useNavStore((s) => s.stack[s.stack.length - 1]?.name ?? (embedded ? 'liveList' : 'home'));
  const currentParams = useNavStore((s) => s.stack[s.stack.length - 1]?.params);

  useEffect(() => {
    let cancelled = false;
    void waitForPersistHydration()
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) setStoresHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const finish = () => {
      if (!cancelled) setSdkStatus('ready');
    };
    const timeout = window.setTimeout(finish, 2500);
    try {
      Promise.resolve(MujianSdk.getInstance().init())
        .then(finish)
        .catch(finish);
    } catch {
      finish();
    }
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  const booting = sdkStatus === 'loading' || !storesHydrated;
  const canEnter = embedded || hasOnboarded;

  useEffect(() => {
    if (!embedded || !storesHydrated) return;
    const syncIdentity = () => {
      const playerName = host()?.playerName;
      if (playerName && usePlayerStore.getState().playerName !== playerName) {
        usePlayerStore.getState().completeOnboarding(playerName);
      }
    };
    syncIdentity();
    window.addEventListener('mellow-live-host', syncIdentity);
    return () => window.removeEventListener('mellow-live-host', syncIdentity);
  }, [storesHydrated]);

  useBackgroundBehaviors(!booting && canEnter);
  useApplyTheme();

  return (
    <AppShell>
      {!embedded && <GlobalMusicPlayer />}
      <PKNotificationBanner />
      <ScheduleReminderPopup />
      <Toast />
      {booting && <Loading text="正在连接直播平台..." />}
      {!booting && !canEnter && <Onboarding />}
      {!booting && canEnter && (
        <div className="flex min-h-0 flex-1 flex-col">
          <ScreenRouter screen={currentScreen} params={currentParams} />
        </div>
      )}
    </AppShell>
  );
}

function ScreenRouter({ screen, params }: { screen: string; params?: Record<string, string> }) {
  switch (screen) {
    case 'home':
      return <Home />;
    case 'liveList':
      return <LiveList />;
    case 'anchorProfile':
      return <AnchorProfile anchorId={params?.anchorId ?? ''} />;
    case 'liveRoom':
      return <LiveRoom anchorId={params?.anchorId ?? ''} />;
    case 'pkRoom':
      return <PKRoom seedAnchorId={params?.seedAnchorId} />;
    case 'chatList':
      return <ChatList />;
    case 'chatDetail':
      return <ChatDetail anchorId={params?.anchorId ?? ''} />;
    case 'moments':
      return <MomentsFeed />;
    case 'wallet':
      return <Wallet />;
    case 'socialFeed':
      return <SocialFeed />;
    case 'socialProfile':
      return <SocialProfile anchorId={params?.anchorId ?? ''} />;
    case 'socialPostDetail':
      return <SocialPostDetail postId={params?.postId ?? ''} />;
    case 'shop':
      return <Shop />;
    case 'delivery':
      return <Delivery />;
    case 'settings':
      return <Settings />;
    case 'music':
      return <Music />;
    case 'customAnchorEditor':
      return <CustomAnchorEditor anchorId={params?.anchorId} />;
    default:
      return <Home />;
  }
}

export default App;
