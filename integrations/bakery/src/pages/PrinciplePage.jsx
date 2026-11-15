import { useState } from 'react';
import CardBreadDecor from '../components/CardBreadDecor';
import { bakeTechniques } from '../data/techniques';
import { useUI, PAGE_IDS } from '../context/UIContext';

/**
 * 与 data/techniques.js 中 id 一一对应；理想炉温以数据源为准，此处补充实践要点与游戏内含义
 */
const TECHNIQUE_PRINCIPLE_EXTRA = {
  direct: {
    points:
      '流程最短，适合绝大多数甜软餐包、调理面包、基础吐司。含蛋、奶、糖较多时，可取理想区间中后段帮助上色；炉温明显偏低时外皮薄软、偏高时易深糊，品质系数都会下降。',
  },
  sponge: {
    points:
      '中种提前发酵，主面团搅打时间短、延展性好，成品不易老化。烘烤宜取理想区间中前段，避免表壳过快结皮导致「憋住」膨胀；比直接法略低温更符合组织需求。',
  },
  tangzhong: {
    points:
      '淀粉糊化锁住水分，口感特别柔软、第二天仍润。需偏低、偏慢烘烤；若炉温接近或超过上限，易外深内湿。游戏内品质系数最吃「落在区间内」，甜吐司、日式软包常选。',
  },
  poolish: {
    points:
      '湿态酵头带来细微发酵香与较均匀气孔，甜包、软欧、餐包皆可。理想炉温整体高于汤种、略接欧包思路，有助于定型气孔与香气；过低炉温易出现皮皱、结构塌。',
  },
  overnight: {
    points:
      '代表长时间·低温慢发酵，麦味与香气足。出炉宜用理想区间中后段让美拉德与上色到位；炉温不足时香气闷、皮偏韧，与「慢发」设定不匹配。',
  },
  laminated: {
    points:
      '黄油折叠形成层次，可颂、丹麦类核心工艺。忌长时间超高温，黄油易渗出、层次发「死」；也不宜明显低于下限，否则层次不酥、芯子发青。宜在区间内取中值附近微调。',
  },
  autolyse: {
    points:
      '先水合再投盐与酵母，减少打面时间、面筋更顺滑，适合高含水面团。理想炉温偏高，利于「脆壳 + 大孔洞」；与乡村、恰巴塔、高水量欧包模具相性最好，需足火上色。',
  },
  fold: {
    points:
      '发酵中多次折面代替长时间揉面，强化筋度与水合，常见于高含水配方。炉温区间偏硬欧，可与自解法、酸种法思路叠用；过低表壳绵软、结构不清晰。',
  },
  sourdough: {
    points:
      '天然酵种长时间发酵，酸香与代谢物风味突出。需要足够高的炉温形成薄脆厚壳、内里保持湿润；明显低于理想区间时酸味闷湿、皮厚嚼劲差，品质系数惩罚大。',
  },
};

const BREAD_TYPE_CARDS = [
  { title: '圆面包', desc: ' — 软欧或圆形餐包，组织松软，适合早餐。' },
  { title: '碱水包 / 德国结', desc: ' — 德式碱水浸泡面包，外表深棕、口感韧劲，略带咸香。' },
  { title: '可颂', desc: ' — 法式酥皮牛角包，开酥法制作，层次分明、外酥内软。' },
  { title: '吐司面包', desc: ' — 长方形切片面包，柔软拉丝，常用汤种或中种法。' },
  { title: '盐面包', desc: ' — 日式盐可颂，底部酥脆、内里柔软，带黄油与海盐香。' },
  { title: '长面包', desc: ' — 法式长棍形，外皮脆硬、麦香浓郁，高温烘烤。' },
  { title: '和风面包', desc: ' — 日式软包，常用日式上白粉与汤种，口感细腻。' },
  { title: '玛芬面包', desc: ' — 杯状小面包，可甜可咸，常见蓝莓、巧克力等口味。' },
  { title: '肉桂卷', desc: ' — 卷形甜包，肉桂与焦糖香气，折叠法或直接法。' },
  { title: '三角面包', desc: ' — 三角造型软包，常包馅料如奶油芝士。' },
  { title: '法棍', desc: ' — 经典法式长棍，外脆内软，法式 T65 或高筋面粉。' },
  { title: '贝果', desc: ' — 水煮后烘烤，口感韧劲，低糖油、适合搭配涂抹酱。' },
  { title: '花圈面包', desc: ' — 编花成圈，造型美观，常用于节庆。' },
  { title: '乡村面包', desc: ' — 恰巴塔等意大利乡村面包，大气孔、高含水量，自解法。' },
  { title: '大鼓面包', desc: ' — 日式大鼓造型，圆润饱满，常包红豆馅。' },
  { title: '欧包', desc: ' — 欧洲式圆形面包，多用天然酵种或隔夜发酵，麦香醇厚。' },
  { title: '佛卡夏面包', desc: ' — 意式扁平面包，橄榄油丰富，表面可撒香草与海盐。' },
];

const TABS = [
  { id: 'ratio', label: '原料配比' },
  { id: 'technique', label: '手法炉温' },
  { id: 'mold', label: '模具类型' },
  { id: 'bread', label: '面包介绍' },
  { id: 'tips', label: '小技巧' },
];

export default function PrinciplePage() {
  const [activeTab, setActiveTab] = useState('ratio');
  const { navigateTo } = useUI();
  return (
    <div className="page-view panel principle-panel">
      <div className="page-view-head">
        <div className="principle-head-row">
          <h2>📐 烘焙原理</h2>
          <button
            type="button"
            className="btn btn-secondary btn-tiny"
            onClick={() => navigateTo(PAGE_IDS.gameBakery)}
            title="回到面包房；制作页原料会保留（研发阶段）"
          >
            ← 返回面包房
          </button>
        </div>
        <p className="drawer-hint">了解面包制作的机制与原理，成为更好的烘焙师</p>
      </div>
      <div className="principle-header">
        <nav className="principle-tabs-row" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              className={`principle-tab${activeTab === t.id ? ' on' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      <div className={`page-view-body principle-content bakery-card-decor-host`}>
        <CardBreadDecor seed={`principle-tab-${activeTab}`} variant="chrome" />
        {activeTab === 'ratio' && (
          <section>
            <h3>🥣 原料配比</h3>
            <p>面团中各原料需保持合理比例，否则会导致失败：</p>
            <ul>
              <li><strong>面粉</strong>：约占 55%–65%，是骨架。过少面团过稀，过多则过干无法发酵。</li>
              <li><strong>液体</strong>：约占 30%–40%，包括水、牛奶等。过少面团过硬，过多则难以定型。</li>
              <li><strong>酵母</strong>：约占 1%–2%。过少发酵不足，过多会产生怪味。</li>
              <li><strong>辅料与风味</strong>：适量添加，可提升口感与层次。</li>
            </ul>
            <p className="principle-tip">💡 配比严重失调会做出失败品，无法售卖，只能丢弃。</p>
          </section>
        )}

        {activeTab === 'technique' && (
          <section>
            <h3>🫙 手法与炉温</h3>
            <p>
              制作页炉温滑条为 <strong>140–220°C</strong>。每种手法在程序里都有<strong>理想炉温区间</strong>（下表「游戏内理想炉温」）；
              越接近该区间，<strong>品质系数</strong>越高，成品四维越能「吃满」配方潜力；偏离越远，系数越低（有下限保护，不会归零）。
            </p>
            <p style={{ marginTop: 8, fontSize: '.9rem', color: 'var(--text-secondary)' }}>
              以下九种与制作页「手法」下拉一致，理想炉温与游戏计算同步；「要点」便于你对照真实烘焙习惯调整滑条。
            </p>
            <div className="principle-tech-list" role="list">
              {bakeTechniques.map((t) => {
                const extra = TECHNIQUE_PRINCIPLE_EXTRA[t.id] || { points: '' };
                return (
                  <article key={t.id} className="principle-tech-card" role="listitem">
                    <h4 className="principle-tech-title">{t.name}</h4>
                    <p className="principle-tech-game">
                      <span className="principle-tech-label">游戏内理想炉温</span>
                      <strong>
                        {t.idealTempMin}–{t.idealTempMax}°C
                      </strong>
                      <span className="principle-tech-mid">
                        （中点约 {Math.round((t.idealTempMin + t.idealTempMax) / 2)}°C）
                      </span>
                    </p>
                    <p className="principle-tech-desc">{t.desc}</p>
                    {extra.points ? (
                      <p className="principle-tech-points">
                        <span className="principle-tech-label">要点</span>
                        {extra.points}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
            <p className="principle-tip">
              💡 品质系数与理想炉温区间绑定：以区间中心为峰值，向两侧平滑衰减。配粉时请先把手法的炉温大致落在理想段内，再微调原料配比。
            </p>
          </section>
        )}

        {activeTab === 'mold' && (
          <section>
            <h3>📦 模具与面包类型</h3>
            <p>模具决定了面包的形状与类型：</p>
            <ul>
              <li><strong>圆模</strong> → 圆面包、软欧</li>
              <li><strong>吐司盒</strong> → 吐司面包</li>
              <li><strong>法棍槽</strong> → 法棍</li>
              <li><strong>长面包槽</strong> → 长面包</li>
              <li><strong>编花盘</strong> → 花圈面包</li>
              <li><strong>餐包盘</strong> → 圆面包</li>
              <li><strong>三角盘</strong> → 三角面包</li>
              <li><strong>肉桂卷模</strong> → 肉桂卷</li>
              <li><strong>德国结盘</strong> → 德国结、碱水包</li>
              <li><strong>盐面包模</strong> → 盐面包</li>
              <li><strong>大鼓模</strong> → 大鼓面包</li>
              <li><strong>欧包盘</strong> → 欧包</li>
              <li><strong>和风面包盘</strong> → 和风面包</li>
              <li><strong>玛芬杯</strong> → 玛芬面包</li>
              <li><strong>恰巴塔盘</strong> → 乡村面包</li>
              <li><strong>佛卡夏盘</strong> → 佛卡夏面包</li>
            </ul>
            <p className="principle-tip">💡 手法 + 炉温 + 模具共同决定面包的类型与品质。</p>
          </section>
        )}

        {activeTab === 'bread' && (
          <section>
            <h3>🥖 十八种面包类型介绍</h3>
            <p>游戏中支持以下经典面包类型，每种都有独特的口感与制作要点：</p>
            <div className="bread-types-grid">
              {BREAD_TYPE_CARDS.map((row, i) => (
                <div key={row.title} className="bread-type-card bakery-card-decor-host">
                  <CardBreadDecor seed={`pbt-${i}-${row.title}`} />
                  <strong>{row.title}</strong>
                  {row.desc}
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'tips' && (
          <section>
            <h3>✨ 小技巧</h3>
            <ul>
              <li>原料之间有<strong>协同效应</strong>，合理搭配可提升属性。</li>
              <li>品质系数由手法与炉温匹配度决定，越接近理想温度越好。</li>
              <li>模具会赋予对应属性的<strong>加成</strong>（如吐司盒+柔软度）。</li>
              <li>馅料不计入面团配方；出炉后在成品名后缀「（某某馅）」，并单独叠加少量四维。</li>
              <li>原料搭配不当可能做出<strong>劣质品</strong>，价格降低但仍可售卖。</li>
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
