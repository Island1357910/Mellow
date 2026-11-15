import { useGame } from '../../context/GameContext';
import { useUI, PAGE_IDS } from '../../context/UIContext';
import CustomerStage from '../customer/CustomerStage';

export default function BusinessPhase() {
  const { dispatch } = useGame();
  const { navigateTo } = useUI();

  const handleDayEnd = () => {
    dispatch({ type: 'SET_PHASE', phase: 'night' });
    navigateTo(PAGE_IDS.gameBakery);
  };

  return (
    <div className="fade-in">
      <div className="phase-back-row">
        <button type="button" className="btn btn-secondary btn-tiny" onClick={() => dispatch({ type: 'SET_PHASE', phase: 'develop' })}>
          ← 返回研发
        </button>
      </div>
      <CustomerStage onDayEnd={handleDayEnd} />
    </div>
  );
}
