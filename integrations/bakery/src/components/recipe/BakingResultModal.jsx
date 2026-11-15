import { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { useUI } from '../../context/UIContext';
import { useBaking } from '../../context/BakingContext';
import RecipePreview from './RecipePreview';
import { calculateSatisfaction } from '../../systems/customerEngine';
import { RECIPE_DISPLAY_NAME_MAX } from '../../constants/naming';
import { bakeSnapshotsMatch } from '../../systems/recipeBakeIdentity';
import { adjustIncomingGold } from '../../systems/economyBalance';

function sameBakeIdentityInLibrary(recipes, recipe) {
  const snap = recipe?.bakeSourceOpts;
  if (!snap || !Array.isArray(recipes)) return false;
  return recipes.some((x) => x?.bakeSourceOpts && bakeSnapshotsMatch(x.bakeSourceOpts, snap));
}

function BakingResultModal() {
  const { state, dispatch, notify } = useGame();
  const { pinRecipe } = useUI();
  const { baking, clearPending, rerollBake } = useBaking();
  const pending = baking.pending;

  const [breadName, setBreadName] = useState('');

  useEffect(() => {
    if (pending?.recipe) {
      setBreadName(String(pending.recipe.name || '').slice(0, RECIPE_DISPLAY_NAME_MAX));
    }
  }, [pending?.recipe?.id]);

  if (!pending?.recipe || !pending?.nextLots) return null;

  const count = pending.count ?? 1;
  const pendingOrder = state.pendingCustomOrder;
  const canDeliverCustom = pendingOrder && pending.recipe;

  const resolveRecipeWithDisplayName = () => {
    const r = pending.recipe;
    if (r.identityLocked) return { ...r };
    const name = (breadName.trim().slice(0, RECIPE_DISPLAY_NAME_MAX) || r.name || '面包').slice(0, RECIPE_DISPLAY_NAME_MAX);
    return { ...r, name };
  };

  const deliverToWaitingCustomer = () => {
    if (!pendingOrder || !pending.recipe) return;
    const out = resolveRecipeWithDisplayName();
    const snap = pendingOrder.customerSnapshot;
    const customer = snap
      ? {
          name: snap.name,
          numericRequirements: snap.numericRequirements,
          flavorPreference: snap.flavorPreference,
          personality: snap.personality || {},
        }
      : {
          name: '客人',
          personality: { flavorProfile: { 甜度: 5, 柔软度: 5, 香气: 5, 复杂度: 5 }, typeData: {} },
        };
    const sat = calculateSatisfaction(customer, out);
    const payment = Math.max(5, Math.round((out.price || 25) * (sat >= 90 ? 1.2 : sat < 60 ? 0.8 : 1)));
    dispatch({
      type: 'COMPLETE_CUSTOM_ORDER',
      gold: payment,
      reputation: sat >= 80 ? 3 : sat >= 60 ? 1 : -1,
      satisfaction: sat,
      craftedFillingId: pending.craftedFillingId || null,
      moldVolumeG: pending.moldVolumeG || 350,
      newCraftedFillings: pending.nextCraftedFillings,
      explorationRecipe: out,
    });
    notify(`${customer.name} 收到了「${out.name}」，满意！+${adjustIncomingGold(state, payment, 'custom_order')}💰`, 'success');
    clearPending();
  };

  const confirm = () => {
    if (pending.recipe?.isFailed) return;
    const recipe = resolveRecipeWithDisplayName();
    const mergeIntoMenu = recipe?.id != null && state.menuRecipes.some((m) => m.id === recipe.id);
    if (!mergeIntoMenu && state.menuRecipes.length >= 8) {
      notify('菜单最多 8 款面包', 'error');
      return;
    }
    if (state.gold < 5) {
      notify('上架需 5💰 手续费', 'error');
      return;
    }
    dispatch({
      type: 'ADD_RECIPE_TO_MENU',
      recipe,
      newLots: pending.nextLots,
      menuFee: 5,
      count,
      newCraftedFillings: pending.nextCraftedFillings,
    });
    notify(
      mergeIntoMenu
        ? `「${recipe.name}」与菜单中同款合并，+${count} 个`
        : `「${recipe.name}」已上架 x${count} 个`,
      'success',
    );
    clearPending();
  };

  if (pending.recipe?.isFailed) {
    const failName = pending.recipe.name?.trim();
    return (
      <div className="baking-result-overlay" role="dialog" aria-labelledby="baking-fail-title">
        <div className="baking-result-card baking-result-failed fade-in">
          <header className="baking-fail-head">
            <div className="baking-fail-icon" aria-hidden>🥖</div>
            <div className="baking-fail-head-text">
              <p className="baking-fail-badge">出炉结果</p>
              <h3 id="baking-fail-title" className="baking-fail-title">烘焙失败</h3>
              {failName ? <p className="baking-fail-subtitle">「{failName}」未能成型</p> : null}
            </div>
          </header>
          <section className="baking-fail-reason-block" aria-label="失败原因">
            <span className="baking-fail-reason-label">原因</span>
            <p className="baking-fail-reason-text">{pending.recipe.failReason || '配比或工艺异常'}</p>
          </section>
          <p className="baking-fail-tip">
            <span className="baking-fail-tip-icon" aria-hidden>💡</span>
            失败品无法上架售卖，请丢弃后调整原料比例再试。可参考「烘焙原理」中的配比范围。
          </p>
          <footer className="baking-fail-actions">
            <button type="button" className="btn btn-secondary btn-baking-fail-discard" onClick={clearPending}>
              丢弃失败品
            </button>
          </footer>
        </div>
      </div>
    );
  }

  const locked = !!pending.recipe.identityLocked;

  return (
    <div className="baking-result-overlay" role="dialog" aria-labelledby="baking-ok-title">
      <div className="baking-result-card">
        <header className="baking-result-modal-head">
          <h2 id="baking-ok-title">出炉结果</h2>
        </header>
        <div className="baking-result-modal-body">
          <RecipePreview
            recipe={pending.recipe}
            bakeCount={count}
            breadDisplayName={breadName}
            onBreadDisplayNameChange={locked ? undefined : setBreadName}
            nameInputLocked={locked}
            hideIngredientCapsules
            onConfirm={confirm}
            onReroll={rerollBake}
            onSave={() => {
              const r = resolveRecipeWithDisplayName();
              if (sameBakeIdentityInLibrary(state.recipes, r)) {
                notify('配方库已有相同面团配置，未重复保存', 'info');
                return;
              }
              dispatch({ type: 'ADD_CUSTOM_RECIPE', recipe: r });
              notify('已保存到配方页', 'success');
            }}
            onPin={() => pinRecipe(resolveRecipeWithDisplayName())}
            onClose={clearPending}
          />
        </div>
        {canDeliverCustom && (
          <div className="baking-custom-deliver">
            <button type="button" className="btn btn-accent" onClick={deliverToWaitingCustomer}>
              端给等待的客人（{pendingOrder.customerSnapshot?.name || '客人'}）
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default BakingResultModal;
