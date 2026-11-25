export function isImageAvatar(value: string | undefined): boolean {
  return Boolean(value && /^(?:data:image\/|https?:\/\/|blob:|\/)/i.test(value))
}
