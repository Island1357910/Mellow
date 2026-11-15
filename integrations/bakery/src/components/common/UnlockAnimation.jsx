export default function UnlockAnimation({ item, onDismiss }) {
  if (!item) return null;
  return (
    <div className="unlock-overlay" onClick={onDismiss}>
      <div className="unlock-anim" onClick={e => e.stopPropagation()}>
        <div className="unlock-glow" />
        <div className="icon">{item.icon}</div>
        <h2>解锁新原料：{item.name}！</h2>
        <p>{item.desc}</p>
        <button className="btn btn-primary" onClick={onDismiss}>太棒了！</button>
      </div>
    </div>
  );
}
