import { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';

export default function NotificationStack() {
  const { subscribeNotifications } = useGame();
  const [items, setItems] = useState([]);

  useEffect(() => subscribeNotifications(setItems), [subscribeNotifications]);

  if (!items.length) return null;
  return (
    <div className="notification-stack">
      {items.map(n => (
        <div key={n.id} className={`notification ${n.type}`}>{n.text}</div>
      ))}
    </div>
  );
}
