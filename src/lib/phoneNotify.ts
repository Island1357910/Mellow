import { App } from '@capacitor/app'
import { Capacitor, registerPlugin } from '@capacitor/core'

interface PhoneNotifyPlugin {
  permission(): Promise<{ granted: boolean }>
  requestPermission(): Promise<{ granted: boolean }>
  show(options: { title: string; body: string }): Promise<void>
  setStayAwake(options: { on: boolean }): Promise<void>
}

const native = registerPlugin<PhoneNotifyPlugin>('PhoneNotify')
const ASKED = 'mellow-notify-asked'

let watched = false
let awayNative = false
let away = false

function rememberAsked(): void {
  try { localStorage.setItem(ASKED, '1') } catch { /* 隐私模式写不进也不反复弹 */ }
}

function askedBefore(): boolean {
  try { return localStorage.getItem(ASKED) === '1' } catch { return true }
}

export function phoneIsAway(): boolean {
  if (typeof document === 'undefined') return awayNative
  return awayNative || away || document.hidden
}

function startWatch(): void {
  if (watched || typeof document === 'undefined') return
  watched = true
  away = document.hidden
  document.addEventListener('visibilitychange', () => { away = document.hidden })
  if (!Capacitor.isNativePlatform()) return
  void App.addListener('appStateChange', (state) => { awayNative = !state.isActive })
}

async function currentGrant(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try { return (await native.permission()).granted === true } catch { return false }
  }
  return typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

async function promptGrant(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try { return (await native.requestPermission()).granted === true } catch { return false }
  }
  if (typeof Notification === 'undefined' || Notification.permission === 'denied') return false
  try { return (await Notification.requestPermission()) === 'granted' } catch { return false }
}

export async function syncPhoneNotify(stay: boolean, askAgain: boolean): Promise<void> {
  startWatch()
  let granted = await currentGrant()
  if (!granted && (askAgain || !askedBefore())) {
    rememberAsked()
    granted = await promptGrant()
  }
  if (!Capacitor.isNativePlatform()) return
  try { await native.setStayAwake({ on: stay && granted }) } catch { /* 网页版没有后台服务 */ }
}

export async function showPhoneMessage(title: string, body: string): Promise<void> {
  startWatch()
  const cleanTitle = title.trim() || '半糖'
  const cleanBody = body.trim().slice(0, 80) || '有一条新消息'
  if (Capacitor.isNativePlatform()) {
    try { await native.show({ title: cleanTitle, body: cleanBody }) } catch { /* 没给通知权限时安静跳过 */ }
    return
  }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try { new Notification(cleanTitle, { body: cleanBody }) } catch { /* 浏览器拒绝时不打断聊天 */ }
}
