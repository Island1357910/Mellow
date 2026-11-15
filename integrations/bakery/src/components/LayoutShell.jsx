import { useGame } from '../context/GameContext';
import BakeryBreadDecor from './BakeryBreadDecor';
import './LayoutShell.css';

/**
 * 参考《比特啤酒花》Layout：全屏氛围底、颗粒、边缘粒子、按阶段切换顶光、暗角。
 */
export default function LayoutShell({ children }) {
  const { state } = useGame();
  const phase = state.phase || 'morning';

  return (
    <div className={`bakery-layout bakery-scene-${phase}`} data-phase={phase}>
      <div className="bakery-bg-photo" aria-hidden />
      <div className="bakery-bg-veil" aria-hidden />
      <div className="bakery-grain-layer" aria-hidden />
      <div className="bakery-particle-layer" aria-hidden>
        <span className="bakery-particle bakery-p-1" />
        <span className="bakery-particle bakery-p-2" />
        <span className="bakery-particle bakery-p-3" />
        <span className="bakery-particle bakery-p-4" />
        <span className="bakery-particle bakery-p-5" />
      </div>
      <BakeryBreadDecor />
      <div className="bakery-layout-stack">{children}</div>
    </div>
  );
}
