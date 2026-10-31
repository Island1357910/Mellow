import { Capacitor } from '@capacitor/core'

export async function setupNativeApp(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const [{ App }, { useMellow }] = await Promise.all([
    import('@capacitor/app'),
    import('../store/useMellow.ts'),
  ])
  await App.addListener('backButton', () => {
    const state = useMellow.getState()
    if (state.controlOpen) state.setControl(false)
    else if (state.identitySheet) state.setIdentitySheet(false)
    else if (state.activeApp) state.closeApp()
    else void App.minimizeApp()
  })
}
