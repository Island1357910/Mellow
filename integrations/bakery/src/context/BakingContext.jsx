import { createContext, useContext, useState, useLayoutEffect, useRef, useCallback } from 'react';
import { useGame } from './GameContext';
import { generateRecipeAdvanced, buildInventoryRequirementsFromAdvanced, calculateBatchWeight } from '../systems/recipeEngine';
import { checkRecipeRatios, checkRecipeInferior } from '../systems/recipeQuality';
import { tryConsume } from '../systems/inventorySystem';
import { resolveBakeFillingConsumption, applyFillingAllocationToRecipe } from '../systems/bakeFilling';
import { getMoldById } from '../data/molds';
import { classicRecipes } from '../data/classicRecipes';
import {
  bakeSnapshotsMatch,
  findRecipeMatchingBakeSnapshot,
  getExpectedSnapshotForRecipe,
  mergeRecipeWithCanonIdentity,
  snapshotBakeOpts,
} from '../systems/recipeBakeIdentity';
import { setBakingPct } from './bakingPctStore';

const BAKE_MS = 25000;

const BakingContext = createContext(null);

export function BakingProvider({ children }) {
  const { state, notify } = useGame();
  const [baking, setBaking] = useState({ active: false, pending: null });
  const rafRef = useRef(null);
  const t0Ref = useRef(0);
  const optsRef = useRef(null);
  const lotsRef = useRef(null);
  const recipesMenuRef = useRef({ recipes: [], menuRecipes: [] });
  recipesMenuRef.current = { recipes: state.recipes || [], menuRecipes: state.menuRecipes || [] };
  const craftedFillingsRef = useRef(state.craftedFillings);
  craftedFillingsRef.current = state.craftedFillings;
  const onBakeCompleteRef = useRef(null);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const registerOnBakeComplete = useCallback((fn) => {
    onBakeCompleteRef.current = fn;
    return () => { onBakeCompleteRef.current = null; };
  }, []);

  const startBake = useCallback((opts, lots) => {
    if (!opts || !lots) return;
    optsRef.current = opts;
    lotsRef.current = lots;
    setBakingPct(0);
    setBaking({ active: true, pending: null });
  }, []);

  const clearPending = useCallback(() => {
    setBaking((b) => ({ ...b, pending: null }));
    onBakeCompleteRef.current?.();
  }, []);

  const rerollBake = useCallback(() => {
    const opts = optsRef.current;
    const lots = state.inventory?.lots || [];
    if (opts) {
      clearPending();
      startBake(opts, lots);
    }
  }, [state.inventory?.lots, clearPending, startBake]);

  /** 仅依赖 baking.active，避免 GameContext 重渲染时 notify 引用变化导致 effect 清理、取消 rAF、进度条不更新 */
  useLayoutEffect(() => {
    if (!baking.active) return;
    t0Ref.current = performance.now();
    const step = (now) => {
      const p = Math.min(100, ((now - t0Ref.current) / BAKE_MS) * 100);
      setBakingPct(p);
      if (p < 100) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        try {
          const opts = optsRef.current;
          const lots = lotsRef.current;
          if (!opts || !lots) return;
          const mold = getMoldById(opts.moldId);
          const totalG = calculateBatchWeight(opts);
          const ratioCheck = checkRecipeRatios(opts, totalG);
          const count = Math.max(1, Math.floor(totalG / (mold.volumeG || 350)));
          const doughReq = buildInventoryRequirementsFromAdvanced(opts);
          const nextLotsDough = tryConsume(lots, doughReq);
          if (!nextLotsDough) {
            notifyRef.current('面团原料库存不足', 'error');
            setBakingPct(0);
            setBaking({ active: false, pending: null });
            return;
          }
          let recipe = generateRecipeAdvanced(opts);
          const curSnap = snapshotBakeOpts(opts);
          const idRec = opts.identityRecipe;
          if (idRec && !ratioCheck.failed) {
            const exp = getExpectedSnapshotForRecipe(idRec);
            if (exp && bakeSnapshotsMatch(curSnap, exp)) {
              recipe = mergeRecipeWithCanonIdentity(recipe, idRec);
            }
          }
          if (!recipe.identityLocked && !ratioCheck.failed) {
            const canon = findRecipeMatchingBakeSnapshot({
              snap: curSnap,
              customRecipes: recipesMenuRef.current.recipes,
              classicRecipes,
              menuRecipes: recipesMenuRef.current.menuRecipes,
            });
            if (canon) {
              recipe = mergeRecipeWithCanonIdentity(recipe, canon);
            }
          }
          if (ratioCheck.failed) {
            recipe.isFailed = true;
            recipe.failReason = ratioCheck.reason;
          } else {
            const inferCheck = checkRecipeInferior(recipe);
            if (inferCheck.isInferior) {
              recipe.isInferior = true;
              recipe.inferiorReason = inferCheck.reason;
              recipe.price = Math.max(5, Math.round((recipe.price || 20) * 0.35));
            }
          }
          let nextLots = nextLotsDough;
          let nextCraftedFillings;
          if (!recipe.isFailed) {
            const alloc = resolveBakeFillingConsumption(
              opts,
              count,
              mold.volumeG || 350,
              nextLotsDough,
              craftedFillingsRef.current || [],
            );
            nextLots = alloc.nextLots;
            nextCraftedFillings = alloc.nextCraftedFillings;
            if (alloc.fillName) applyFillingAllocationToRecipe(recipe, alloc);
          }
          setBakingPct(0);
          setBaking({
            active: false,
            pending: {
              recipe,
              nextLots,
              nextCraftedFillings,
              count,
              craftedFillingId: opts.craftedFilling?.id || null,
              moldVolumeG: mold.volumeG || 350,
            },
          });
        } catch (e) {
          notifyRef.current(e?.message || '生成失败', 'error');
          setBakingPct(0);
          setBaking({ active: false, pending: null });
        }
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [baking.active]);

  return (
    <BakingContext.Provider value={{ baking, startBake, clearPending, rerollBake, registerOnBakeComplete }}>
      {children}
    </BakingContext.Provider>
  );
}

export function useBaking() {
  const ctx = useContext(BakingContext);
  if (!ctx) throw new Error('useBaking must be inside BakingProvider');
  return ctx;
}
