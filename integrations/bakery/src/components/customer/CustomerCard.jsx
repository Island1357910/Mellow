import CustomerAvatar from './CustomerAvatar';
import InlineIngredient from '../InlineIngredient';

const PREF_ATTR_CLASS = {
  甜度: 'pref-tag--sweet',
  柔软度: 'pref-tag--soft',
  香气: 'pref-tag--aroma',
  复杂度: 'pref-tag--complex',
};

export default function CustomerCard({ customer, dialogue, satisfaction, children, variant = 'default' }) {
  const p = customer.personality;
  const fp = p.flavorProfile;
  const prefLabels = [
    { attr: '甜度', icon: '🍬' }, { attr: '柔软度', icon: '☁️' },
    { attr: '香气', icon: '🌸' }, { attr: '复杂度', icon: '🎭' },
  ];

  const barClass = satisfaction != null
    ? (satisfaction >= 80 ? 'high' : satisfaction >= 50 ? 'medium' : 'low')
    : '';

  const isBubble = variant === 'bubble';
  const isRequirementsOnly = variant === 'requirementsOnly';
  const isRequirementsSplit = variant === 'requirementsSplit';

  const prefsBlock = (
    <div className="customer-prefs">
      {customer.numericRequirements ? (
        prefLabels.map(({ attr, icon }) => {
          const r = customer.numericRequirements[attr];
          if (!r || (r.min == null && r.max == null)) return null;
          let label = `${icon} ${attr}`;
          if (r.min != null && r.max != null) label += ` ${r.min}-${r.max}`;
          else if (r.min != null) label += ` ≥${r.min}`;
          else label += ` ≤${r.max}`;
          const ac = PREF_ATTR_CLASS[attr] || 'pref-tag--neutral-num';
          return <span key={attr} className={`pref-tag ${ac}`}>{label}</span>;
        }).filter(Boolean)
      ) : (
        prefLabels.map(({ attr, icon }) => {
          const v = fp?.[attr];
          let cls = 'pref-tag--neutral-tone', label = `${icon} ${attr} 适中`;
          if (v > 7) { cls = PREF_ATTR_CLASS[attr] || 'pref-tag--sweet'; label = `${icon} 喜欢高${attr}`; }
          else if (v < 3) { cls = 'pref-tag--dislike-tone'; label = `${icon} 偏好低${attr}`; }
          return <span key={attr} className={`pref-tag ${cls}`}>{label}</span>;
        })
      )}
      {customer.flavorPreference ? (
        <span className="pref-tag pref-tag--flavor" title="风味偏好">
          🌿 风味：<InlineIngredient name={customer.flavorPreference} text={customer.flavorPreference} size="sm" />
        </span>
      ) : null}
    </div>
  );

  const dialogueBlock = (
    <div className={`dialogue-bubble${isBubble || isRequirementsOnly || isRequirementsSplit ? ' dialogue-bubble--in-bubble' : ''}`}>{dialogue}</div>
  );

  const satisfactionBlock = satisfaction != null && (
    <div className="satisfaction-bar">
      <label>满意度</label>
      <div className="bar-track">
        <div className={`bar-fill ${barClass}`} style={{ width: `${satisfaction}%` }} />
      </div>
      <span>{satisfaction}%</span>
    </div>
  );

  if (isRequirementsSplit) {
    return (
      <div className="customer-card customer-card--bubble customer-card--requirements-only customer-card--requirements-split">
        <div className="customer-requirements-split-grid">
          <div className="customer-requirements-split-left">
            {dialogueBlock}
            {prefsBlock}
          </div>
          <div className="customer-requirements-split-right">
            {satisfactionBlock}
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`customer-card${isBubble || isRequirementsOnly ? ' customer-card--bubble' : ''}${isRequirementsOnly ? ' customer-card--requirements-only' : ''}`}>
      {!isBubble && !isRequirementsOnly && (
        <div className="customer-top">
          <CustomerAvatar customer={customer} />
          <div className="customer-info">
            <h3>{customer.name}</h3>
            <span className="customer-type-badge"
              style={{ background: p.typeData.color + '20', color: p.typeData.color }}>
              {p.typeData.icon} {p.type}
            </span>
            <p className="customer-mood">心情：{p.mood}</p>
          </div>
        </div>
      )}
      {isBubble && !isRequirementsOnly && (
        <div className="customer-bubble-header">
          <h3 className="customer-bubble-name">{customer.name}</h3>
          <span className="customer-type-badge customer-bubble-badge"
            style={{ background: p.typeData.color + '25', color: p.typeData.color }}>
            {p.typeData.icon} {p.type}
          </span>
          <span className="customer-bubble-mood">心情：{p.mood}</span>
        </div>
      )}
      {dialogueBlock}
      {prefsBlock}
      {satisfactionBlock}
      {children}
    </div>
  );
}
