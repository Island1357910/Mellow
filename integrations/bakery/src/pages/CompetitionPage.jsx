import { useState, useEffect, useCallback } from 'react';

import { useGame } from '../context/GameContext';

import { calculateSatisfaction } from '../systems/customerEngine';

import { adjustIncomingGold } from '../systems/economyBalance';

import BreadCanvas from '../components/bread/BreadCanvas';

import CardBreadDecor from '../components/CardBreadDecor';

import { chatComplete, getActiveOpenAPIConfig } from '../services/aiService';



const STAT_ICONS = { 甜度: '🍬', 柔软度: '☁️', 香气: '🌸', 复杂度: '🎭' };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));



/** 无 AI 时的比赛池 */

const COMPETITIONS_FALLBACK = [

  { id: 'sweet_soft', title: '🍰 甜蜜松软大赛', desc: '追求甜度与柔软度的完美结合', requirements: { 甜度: { min: 8 }, 柔软度: { min: 8 } }, flavorPreference: '焦糖', goldReward: 180, repReward: 8, threshold: 75 },

  { id: 'aroma_complex', title: '🌸 香气层次赛', desc: '香气浓郁、层次丰富', requirements: { 香气: { min: 8 }, 复杂度: { min: 7 } }, flavorPreference: '伯爵茶', goldReward: 200, repReward: 9, threshold: 78 },

  { id: 'low_sugar', title: '🥗 低糖健康赛', desc: '不甜但有嚼劲，适合健康人士', requirements: { 甜度: { max: 4 }, 柔软度: { max: 6 } }, flavorPreference: '海盐', goldReward: 190, repReward: 8, threshold: 75 },

  { id: 'all_around', title: '🏆 全能烘焙王', desc: '四项属性均衡且出众', requirements: { 甜度: { min: 6 }, 柔软度: { min: 6 }, 香气: { min: 6 }, 复杂度: { min: 6 } }, flavorPreference: '香草', goldReward: 280, repReward: 12, threshold: 80 },

  { id: 'fluffy_cloud', title: '☁️ 云端柔软赛', desc: '极致柔软，入口即化', requirements: { 柔软度: { min: 9 } }, flavorPreference: '薰衣草', goldReward: 160, repReward: 7, threshold: 72 },

  { id: 'sweet_aroma', title: '🍬🌸 甜香双绝赛', desc: '甜度与香气双高', requirements: { 甜度: { min: 8 }, 香气: { min: 8 } }, flavorPreference: '肉桂', goldReward: 210, repReward: 9, threshold: 76 },

  { id: 'complex_art', title: '🎭 层次艺术赛', desc: '复杂度出众，层次丰富', requirements: { 复杂度: { min: 9 } }, flavorPreference: '抹茶', goldReward: 170, repReward: 7, threshold: 74 },

  { id: 'balanced_gold', title: '⚖️ 黄金平衡赛', desc: '甜软香兼顾，三项达标', requirements: { 甜度: { min: 6 }, 柔软度: { min: 7 }, 香气: { min: 6 } }, flavorPreference: '柚子蜜', goldReward: 240, repReward: 10, threshold: 78 },

];



function getFallbackWeekCompetitions(day) {

  const week = Math.floor(day / 7);

  const start = (week * 3) % COMPETITIONS_FALLBACK.length;

  return [

    COMPETITIONS_FALLBACK[start % COMPETITIONS_FALLBACK.length],

    COMPETITIONS_FALLBACK[(start + 1) % COMPETITIONS_FALLBACK.length],

    COMPETITIONS_FALLBACK[(start + 2) % COMPETITIONS_FALLBACK.length],

    COMPETITIONS_FALLBACK[(start + 3) % COMPETITIONS_FALLBACK.length],

    COMPETITIONS_FALLBACK[(start + 4) % COMPETITIONS_FALLBACK.length],

    COMPETITIONS_FALLBACK[(start + 5) % COMPETITIONS_FALLBACK.length],

  ].filter(Boolean);

}



async function generateCompetitionsAI(day, reputation, count = 6) {

  const cfg = getActiveOpenAPIConfig();

  if (!cfg) return null;

  try {

    const text = await chatComplete(

      [

        {

          role: 'system',

          content: `你是《千味面包房》的烘焙赛事策划，生成 ${count} 场社区面包比赛。输出纯 JSON 数组，不要 markdown。

每项字段：

- id: 英文短横线 slug，唯一

- title: 带一个 emoji 的赛事名（中文）

- theme: 与老城区、市集记忆、亲子、夜班清晨等相关的短主题句（≤35字）

- desc: 评审关注点（中文，≤60字），可呼应 theme

- requirements: 对象，键仅限「甜度」「柔软度」「香气」「复杂度」，值为 {"min":0-20} 或 {"max":0-20}，至少含 1 个键

- flavorPreference: 推荐风味词（如桂花、抹茶、海盐），字符串

- goldReward: 150-320 整数

- repReward: 6-14 整数

- threshold: 70-82 整数（获奖分数线）`,

        },

        {

          role: 'user',

          content: `第 ${day} 天、声望 ${reputation}。赛事之间规则要有差异，不要六项完全相同。`,

        },

      ],

      { temperature: 0.85, max_tokens: 1800 }

    );

    const m = text.match(/\[[\s\S]*\]/);

    if (!m) return null;

    const arr = JSON.parse(m[0]);

    if (!Array.isArray(arr) || !arr.length) return null;

    const weekNum = Math.floor(day / 7);

    const keys4 = ['甜度', '柔软度', '香气', '复杂度'];

    return arr.slice(0, count).map((item, i) => {

      const reqRaw = item.requirements || {};

      const requirements = {};

      for (const k of keys4) {

        const o = reqRaw[k];

        if (!o || typeof o !== 'object') continue;

        const r = {};

        if (o.min != null) r.min = clamp(Number(o.min), 0, 20);

        if (o.max != null) r.max = clamp(Number(o.max), 0, 20);

        if (Object.keys(r).length) requirements[k] = r;

      }

      if (Object.keys(requirements).length === 0) {

        requirements.甜度 = { min: 6 };

        requirements.香气 = { min: 6 };

      }

      const slug = String(item.id || `ai-${day}-${i}`).replace(/[^a-z0-9-]/gi, '-').slice(0, 48);

      const theme = item.theme != null ? String(item.theme).trim().slice(0, 40) : '';

      const descBase = String(item.desc || '欢迎提交作品').slice(0, 80);

      const desc = theme ? `${descBase}（${theme}）` : descBase;

      return {

        id: `ai_${slug}_w${weekNum}_${i}`,

        title: String(item.title || `🏅 创意赛 ${i + 1}`).slice(0, 36),

        desc,

        requirements,

        flavorPreference: String(item.flavorPreference || '蜂蜜').slice(0, 12),

        goldReward: clamp(Number(item.goldReward) || 200, 120, 350),

        repReward: clamp(Number(item.repReward) || 8, 4, 15),

        threshold: clamp(Number(item.threshold) || 75, 68, 85),

      };

    });

  } catch {

    return null;

  }

}



export default function CompetitionPage() {

  const { state, dispatch, notify } = useGame();

  const [pickingFor, setPickingFor] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  const [weekPool, setWeekPool] = useState(null);

  const [loadingAi, setLoadingAi] = useState(false);



  const week = Math.floor(state.day / 7);

  const completedIds = state.completedCompetitionIds || [];



  const loadWeekPool = useCallback(async () => {

    setLoadingAi(true);

    const ai = await generateCompetitionsAI(state.day, state.reputation, 6);

    const base = ai?.length >= 4 ? ai : getFallbackWeekCompetitions(state.day);

    setWeekPool({ week, comps: base });

    setLoadingAi(false);

  }, [state.day, state.reputation, week]);



  useEffect(() => {

    if (weekPool?.week === week && Array.isArray(weekPool.comps) && weekPool.comps.length > 0) return;

    loadWeekPool();

  }, [week, weekPool?.week, weekPool?.comps?.length, loadWeekPool]);



  const allForWeek =

    weekPool?.week === week && weekPool.comps?.length ? weekPool.comps : getFallbackWeekCompetitions(state.day);

  const competitions = allForWeek.filter((c) => !completedIds.includes(c.id));

  const menuRecipes = state.menuRecipes || [];



  const scoreRecipe = (recipe, comp) => {

    const fakeCustomer = {

      numericRequirements: comp.requirements,

      flavorPreference: comp.flavorPreference,

      personality: null,

    };

    return calculateSatisfaction(fakeCustomer, recipe);

  };



  const submitToCompetition = (comp, menuIndex) => {

    const recipe = menuRecipes[menuIndex];

    if (!recipe) return;

    setSubmitting(true);

    const score = scoreRecipe(recipe, comp);



    dispatch({ type: 'ADD_COMPLETED_COMPETITION', competitionId: comp.id });



    if (score >= comp.threshold) {

      dispatch({

        type: 'COMPLETE_OFFLINE_CUSTOM_ORDER',

        gold: comp.goldReward,

        reputation: comp.repReward,

        satisfaction: score,

        menuIndex,

        incomeKind: 'competition',

      });

      notify(`🎉 恭喜获胜！获得 ${adjustIncomingGold(state, comp.goldReward, 'competition')}💰 与 ${comp.repReward} 声望`, 'success');

    } else {

      const partGold = Math.round(comp.goldReward * 0.25);

      dispatch({

        type: 'COMPLETE_OFFLINE_CUSTOM_ORDER',

        gold: partGold,

        reputation: 1,

        satisfaction: score,

        menuIndex,

        incomeKind: 'competition',

      });

      notify(`未达获奖线（需 ${comp.threshold} 分，当前 ${score}），参与奖 ${adjustIncomingGold(state, partGold, 'competition')}💰`, 'info');

    }



    setPickingFor(null);

    setSubmitting(false);

  };



  return (

    <div className="page-view panel">

      <div className="page-view-head">

        <h2>🏅 烘焙比赛</h2>

        <p className="drawer-hint">

          比赛每周更新；已配置 AI 时将生成带故事主题的赛事。每项仅可参赛一次，达线即获奖。

        </p>

      </div>

      <div className="page-view-body bakery-card-decor-host">

        <CardBreadDecor seed="page-competition" variant="chrome" />

        {loadingAi && competitions.length === 0 ? (

          <p className="drawer-hint">正在生成本周赛事…</p>

        ) : null}

        {competitions.length === 0 ? (

          <p className="drawer-hint">本周比赛已全部参与，下周将更新新赛事。</p>

        ) : (

          <div className="competition-grid">

            {competitions.map((comp) => (

              <div key={comp.id} className="competition-card bakery-card-decor-host">

                <CardBreadDecor seed={`comp-${comp.id}`} />

                <h4>{comp.title}</h4>

                <p className="competition-desc">{comp.desc}</p>

                <div className="competition-reqs">

                  {Object.entries(comp.requirements).map(([k, v]) => (

                    <span key={k} className="req-tag">

                      {STAT_ICONS[k]}

                      {k}:{v.min != null && `≥${v.min}`}

                      {v.max != null && `≤${v.max}`}

                    </span>

                  ))}

                  {comp.flavorPreference ? (

                    <span className="req-tag">🌿风味：{comp.flavorPreference}</span>

                  ) : null}

                </div>

                <p className="competition-rewards">

                  🏆 获奖线 {comp.threshold} 分 · 奖励 {comp.goldReward}💰 + {comp.repReward} 声望

                </p>

                {pickingFor === comp.id ? (

                  <div className="competition-pick">

                    <p className="drawer-hint">选择作品提交：</p>

                    {menuRecipes.length === 0 ? (

                      <p className="drawer-hint">菜单暂无面包。</p>

                    ) : (

                      <div className="custom-order-menu-pick">

                        {menuRecipes.map((item, idx) => {

                          const sc = scoreRecipe(item, comp);

                          return (

                            <button

                              key={idx}

                              type="button"

                              className={`custom-order-pick-btn${sc >= comp.threshold ? ' ok' : ''}`}

                              disabled={submitting}

                              onClick={() => submitToCompetition(comp, idx)}

                            >

                              <BreadCanvas recipe={item} width={40} height={40} size={10} />

                              <span>{item.name}</span>

                              <span className="sat-badge">得分 {sc}</span>

                            </button>

                          );

                        })}

                      </div>

                    )}

                    <button type="button" className="btn btn-tiny" onClick={() => setPickingFor(null)}>

                      取消

                    </button>

                  </div>

                ) : (

                  <button

                    type="button"

                    className="btn btn-primary"

                    disabled={menuRecipes.length === 0}

                    onClick={() => setPickingFor(comp.id)}

                  >

                    提交作品

                  </button>

                )}

              </div>

            ))}

          </div>

        )}

      </div>

    </div>

  );

}


