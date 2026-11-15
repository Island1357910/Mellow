import { useRef, useEffect } from 'react';
import { drawAvatar } from '../../systems/visualEngine';
import { resolveCustomerPortraitUrl } from '../../data/customerPortraits';

/** 有立绘 URL 时用像素图，否则画布生成头像 */
export default function CustomerAvatar({ customer, size = 80 }) {
  const ref = useRef(null);
  const url = customer ? resolveCustomerPortraitUrl(customer) : null;
  useEffect(() => {
    if (!url && ref.current && customer) drawAvatar(ref.current, customer);
  }, [customer, url]);
  if (url) {
    return (
      <img
        className="customer-avatar-pixel"
        src={url}
        alt=""
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          imageRendering: 'crisp-edges',
          borderRadius: 10,
          flexShrink: 0,
          background: 'var(--bg-dark)',
          border: '1px solid var(--border-light)',
        }}
      />
    );
  }
  return <canvas ref={ref} width={size} height={size} style={{ borderRadius: '50%', background: 'var(--bg-dark)', flexShrink: 0 }} />;
}
