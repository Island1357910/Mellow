type PersistApi = {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (fn: () => void) => () => void;
  };
};

function waitStore(store: PersistApi): Promise<void> {
  if (store.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = store.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

export async function waitForPersistHydration(timeoutMs = 4000): Promise<void> {
  const [
    { usePlayerStore },
    { useSettingsStore },
    { useCustomAnchorStore },
    { useAnchorStore },
    { useChatStore },
    { useSocialStore },
    { useCommerceStore },
    { useGameTimeStore },
    { useMusicStore },
    { useMomentsStore },
  ] = await Promise.all([
    import('../stores/usePlayerStore'),
    import('../stores/useSettingsStore'),
    import('../stores/useCustomAnchorStore'),
    import('../stores/useAnchorStore'),
    import('../stores/useChatStore'),
    import('../stores/useSocialStore'),
    import('../stores/useCommerceStore'),
    import('../stores/useGameTimeStore'),
    import('../stores/useMusicStore'),
    import('../stores/useMomentsStore'),
  ]);

  await Promise.race([
    Promise.all([
      waitStore(usePlayerStore),
      waitStore(useSettingsStore),
      waitStore(useCustomAnchorStore),
      waitStore(useAnchorStore),
      waitStore(useChatStore),
      waitStore(useSocialStore),
      waitStore(useCommerceStore),
      waitStore(useGameTimeStore),
      waitStore(useMusicStore),
      waitStore(useMomentsStore),
    ]),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, timeoutMs);
    }),
  ]);
}
