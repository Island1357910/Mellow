export const dailyEvents = [
  { id: 'honey_fest', title: '🍯 蜂蜜节', desc: '今天是城里的蜂蜜节！蜂蜜类面包需求大增。', effect: { keyword: '蜂蜜', demandUp: 1.5 }, icon: '🍯' },
  { id: 'rainy_day', title: '🌧️ 雨天', desc: '外面下着雨，客人们想要温暖的面包暖暖身子。', effect: { keyword: '温暖', demandUp: 1.3 }, icon: '🌧️' },
  { id: 'school_out', title: '🎒 放学时间', desc: '附近学校放假了，小朋友们会蜂拥而来！', effect: { customerType: '好奇小孩', spawnRate: 2 }, icon: '🎒' },
  { id: 'food_critic', title: '📰 美食评论', desc: '一位知名美食博主要来探店！表现好可以大幅提升声望。', effect: { customerType: '美食家', special: true, repBonus: 2 }, icon: '📰' },
  { id: 'full_moon', title: '🌕 月圆之夜', desc: '今晚月色明亮，据说会发生神奇的事情……', effect: { special: 'full_moon' }, icon: '🌕' },
  { id: 'farmers_market', title: '🌾 农夫市集', desc: '隔壁的农夫市集带来了新鲜的食材，原料成本-20%。', effect: { costDiscount: 0.8 }, icon: '🌾' },
  { id: 'normal', title: '☀️ 晴朗的一天', desc: '一个平静而美好的日子，适合烘焙美味面包。', effect: {}, icon: '☀️' },
  { id: 'normal2', title: '🌤️ 微风轻拂', desc: '微风带来了街对面咖啡店的香气，灵感涌上心头。', effect: {}, icon: '🌤️' },
  { id: 'weekend', title: '🎉 周末', desc: '周末到了！客人数量增加，大家都想享受美食。', effect: { guestCount: 1.5 }, icon: '🎉' },
  { id: 'health_day', title: '🥗 健康饮食日', desc: '全民健康日！低糖和全麦面包特别受欢迎。', effect: { customerType: '健康达人', spawnRate: 2 }, icon: '🥗' },
];

export const milestones = [
  { id: 'first_sale', name: '第一笔生意', condition: s => s.totalSales >= 1, reward: 'gold_10', desc: '完成第一笔交易' },
  { id: 'ten_recipes', name: '面包达人', condition: s => s.recipesCreated >= 10, reward: 'reputation_5', desc: '创造10款不同的配方' },
  { id: 'fifty_guests', name: '人气面包房', condition: s => s.totalGuests >= 50, reward: 'gold_30', desc: '累积接待50位客人' },
  { id: 'reputation_100', name: '远近闻名', condition: s => s.reputation >= 100, reward: 'reputation_10', desc: '声望达到100' },
  { id: 'twenty_recipes', name: '配方大师', condition: s => s.recipesCreated >= 20, reward: 'gold_40', desc: '创造20款不同配方' },
];
