import { BREAD_DECOR_IMAGES, BREAD_DECOR_SLOTS } from '../data/breadDecorAssets';
import './BakeryBreadDecor.css';

export default function BakeryBreadDecor() {
  return (
    <div className="bakery-bread-decor-layer" aria-hidden>
      {BREAD_DECOR_SLOTS.map((slot, i) => (
        <img
          key={`${slot.left}-${slot.top}-${i}`}
          className="bakery-bread-decor-img"
          style={{
            left: slot.left,
            top: slot.top,
            width: slot.size,
            height: 'auto',
            animationDelay: `${slot.delay}s`,
          }}
          src={BREAD_DECOR_IMAGES[i % BREAD_DECOR_IMAGES.length]}
          alt=""
          draggable={false}
        />
      ))}
    </div>
  );
}
