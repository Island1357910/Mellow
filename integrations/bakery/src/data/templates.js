export const keywordMap = {
  甜: { attr: '甜度', dir: 'high' }, 甜蜜: { attr: '甜度', dir: 'high' },
  不甜: { attr: '甜度', dir: 'low' }, 微甜: { attr: '甜度', dir: 'medium' },
  软: { attr: '柔软度', dir: 'high' }, 柔软: { attr: '柔软度', dir: 'high' },
  松软: { attr: '柔软度', dir: 'high' }, 硬: { attr: '柔软度', dir: 'low' },
  酥脆: { attr: '柔软度', dir: 'low' }, 香: { attr: '香气', dir: 'high' },
  浓香: { attr: '香气', dir: 'high' }, 清淡: { attr: '香气', dir: 'low' },
  清新: { attr: '香气', dir: 'medium' }, 复杂: { attr: '复杂度', dir: 'high' },
  简单: { attr: '复杂度', dir: 'low' }, 朴素: { attr: '复杂度', dir: 'low' },
  丰富: { attr: '复杂度', dir: 'high' },
};

export const ingredientKeywords = {
  薰衣草: { category: '风味', name: '薰衣草' },
  肉桂: { category: '风味', name: '肉桂粉' },
  巧克力: { category: '馅料', name: '巧克力熔岩' },
  可可: { category: '风味', name: '可可粉' },
  抹茶: { category: '风味', name: '抹茶粉' },
  红豆: { category: '馅料', name: '红豆沙' },
  芝士: { category: '馅料', name: '奶油芝士' },
  奶油: { category: '液体', name: '淡奶油' },
  牛奶: { category: '液体', name: '全脂牛奶' },
  蜂蜜: { category: '液体', name: '蜂蜜水' },
  全麦: { category: '面粉', name: '全麦粉' },
  黑麦: { category: '面粉', name: '黑麦粉' },
  椰子: { category: '液体', name: '椰奶' },
  椰奶: { category: '液体', name: '椰奶' },
  坚果: { category: '馅料', name: '坚果碎' },
  焦糖: { category: '风味', name: '焦糖酱' },
  玫瑰: { category: '风味', name: '玫瑰露' },
  蓝莓: { category: '馅料', name: '蓝莓酱' },
  芒果: { category: '馅料', name: '芒果慕斯' },
  伯爵茶: { category: '风味', name: '伯爵茶' },
  香草: { category: '风味', name: '香草精' },
  松露: { category: '馅料', name: '松露酱' },
  培根: { category: '馅料', name: '培根芝士' },
  咖喱: { category: '馅料', name: '咖喱鸡肉' },
  海盐: { category: '风味', name: '海盐' },
  酵种: { category: '酵母', name: '天然酵种' },
  天然发酵: { category: '酵母', name: '天然酵种' },
  法式: { category: '面粉', name: '法式T65面粉' },
  日式: { category: '面粉', name: '日式上白粉' },
  北海道: { category: '面粉', name: '日式上白粉' },
};

export const nameTemplates = {
  prefixes: ['梦境', '午后', '晨光', '月光', '星辰', '微风', '花园', '森林', '海岸', '云端', '暖阳', '清晨', '黄昏', '秘境', '田野'],
  suffixes: ['吐司', '软欧', '贝果', '法棍', '可颂', '布里欧修', '恰巴塔', '面包卷', '圆面包', '编织面包'],
  modifiers: {
    甜度_high: ['甜蜜', '蜜糖', '糖霜'],
    甜度_low: ['素雅', '朴实', '原味'],
    香气_high: ['芬芳', '馥郁', '飘香'],
    柔软度_high: ['绵柔', '云朵', '棉花'],
    柔软度_low: ['酥脆', '嘎吱', '硬壳'],
    复杂度_high: ['层次', '交响', '奏鸣'],
  },
};

export const descriptionTemplates = [
  '这款面包使用了{flour}和{liquid}，由{yeast}慢慢发酵而成。{flavor_desc}{filling_desc}口感{texture_desc}，适合{occasion}。',
  '精选{flour}配上{liquid}，以{yeast}发酵，{flavor_desc}{filling_desc}带来{texture_desc}的独特体验。{occasion_desc}',
  '{flour}的醇厚与{liquid}的温润在{yeast}的催化下完美融合。{flavor_desc}{filling_desc}每一口都是{texture_desc}的享受。',
  '以{flour}为基底，融入{liquid}的灵魂，经{yeast}的魔法发酵。{flavor_desc}{filling_desc}呈现出{texture_desc}的美妙滋味。',
];

export const textureDescs = {
  柔软度_high: ['绵软如云', '入口即化', '柔软蓬松'],
  柔软度_medium: ['柔韧适中', '口感均衡', '软硬相宜'],
  柔软度_low: ['嚼劲十足', '外酥内韧', '质朴扎实'],
};

export const flavorDescs = [
  '加入{flavor}提升了层次感。',
  '{flavor}的点缀带来了意想不到的惊喜。',
  '一缕{flavor}的芬芳令人陶醉。',
];

export const fillingDescs = [
  '包裹着{filling}的馅心，',
  '内含满满的{filling}，',
  '{filling}的加入让这款面包更加丰盈。',
];

export const occasionDescs = ['早餐', '下午茶', '野餐出游', '深夜加餐', '朋友聚会', '独处时光', '约会时刻'];
