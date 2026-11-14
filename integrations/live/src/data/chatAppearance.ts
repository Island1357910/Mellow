export const CHAT_BG_PRESETS: Record<string, { label: string; style: string }> = {
  default: {
    label: '默认渐变',
    style: 'linear-gradient(180deg, #eaf5ff 0%, #ffffff 45%, #fdeef7 100%)',
  },
  warm: {
    label: '暖杏',
    style: 'linear-gradient(180deg, #fff7ed 0%, #ffedd5 50%, #fce7f3 100%)',
  },
  mint: {
    label: '薄荷',
    style: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 50%, #d1fae5 100%)',
  },
  night: {
    label: '深夜',
    style: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
  },
  paper: {
    label: '米纸',
    style: 'linear-gradient(180deg, #fafaf9 0%, #f5f5f4 100%)',
  },
};

export function resolveChatBackground(bg: string | undefined): Record<string, string> {
  if (!bg || bg === 'default') {
    return { background: CHAT_BG_PRESETS.default.style };
  }
  if (CHAT_BG_PRESETS[bg]) {
    return { background: CHAT_BG_PRESETS[bg].style };
  }
  if (bg.startsWith('http') || bg.startsWith('data:')) {
    return {
      backgroundImage: `url("${bg}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundColor: '#eaf5ff',
    };
  }
  return { background: CHAT_BG_PRESETS.default.style };
}
