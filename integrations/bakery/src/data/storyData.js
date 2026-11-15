/** 主线分支键、结局、人物小传；主线对话数据见 mainStoryChapters.js */

import { computeEndingIdFromChoices, mainStoryChapters, MAIN_STORY_BG_BY_CHAPTER } from './mainStoryChapters';

export const STORY_CHOICE_KEYS = {
  ch1: 'branch_ch1',
  ch2: 'branch_ch2',
  ch3: 'branch_ch3',
  ch4: 'branch_ch4',
  ch5: 'branch_ch5',
};

export { mainStoryChapters, MAIN_STORY_BG_BY_CHAPTER, computeEndingIdFromChoices };

export function computeEndingId(choices) {
  return computeEndingIdFromChoices(choices);
}

export const endingDescriptions = {
  true_end:
    '千味之心：原谅与创造同在，小店照见母亲的梦与千穗自己的手。她做出「千穗的面包」，故事仍在炉火里延续。',
  inheritance: '传承之光：有些选择艰难，但面包仍是连结人心的线。',
  commercial_queen: '商业女王（旧存档分支）：曾面临离开巷子的抉择时走向职场高峰，内心仍搜寻一种叫家的味道。',
  forgotten: '遗忘之味：心结凝结时，甜香也变得遥远；或许某一天，炉火会再次亮起。',
  ordinary_happy: '平凡幸福：不紧不慢的经营里，日常即是史诗。',
  hidden_echo: '永恒发酵：温柔的选择叠在一起，像窑温里悄悄成型的面筋。',
};

export const characters = [
  {
    name: '林千穗',
    role: '主人公 · 店主',
    age: '28 岁',
    lines: [
      '前「麦香世家」研发主管，现「千味面包房」店主。',
      '从复刻母亲笔记本到揉进自己的故事：「面包不是配方，是想给谁留一口的热气。」',
    ],
  },
  {
    name: '沈若棠',
    role: '母亲（已故）',
    age: '去世时约 42 岁',
    lines: [
      '天赋极强的面包师，曾为家庭收起远方；笔记本与桂花信，是留给女儿最温柔的地图。',
      '「只卖让每个孩子笑着吃的面包」——她未完成的话，由千穗续写。',
    ],
  },
  {
    name: '陈曼华',
    role: '母亲旧友',
    age: '52 岁',
    lines: [
      '退休教师，与若棠因时代与误会走散；黑麦核桃包是未寄到的和解。',
      '「她咽下了苦，只给你们看甜。」三十年后，她在千味面包房把这句话说给穗听。',
    ],
  },
  {
    name: '方河',
    role: '美食评论家 · 《都市面包考》作者',
    age: '约 48 岁',
    lines: [
      '清瘦寡言，笔锋犀利；年轻时在烘焙学校旁听过沈若棠的课，坐在最后一排看她整形。',
      '公开评论冷峻，私下却会把「风味结构」的书放在柜台上：嘴上说技术，心里等的是「你愿意为谁做面包」。',
      '「我做了半辈子评论……最难忘的还是有人把面团当成情书来揉。」',
    ],
  },
  {
    name: '小晴',
    role: '隔壁花店 · 挚友',
    age: '24 岁',
    lines: [
      '抱绿萝闯进店的第一位客人，会给面包取花一样的名字。',
      '从「妈妈的桂花信」到「向阳花」，她用花语帮千穗把说不出口的心情说出口。',
    ],
  },
  {
    name: '林国栋',
    role: '父亲',
    age: '58 岁',
    lines: [
      '退休工程师，笨手笨脚却年年为女儿烤生日蛋糕——若棠留下的嘱咐。',
      '藏起「若棠的面包房」手绘太久，怕女儿背债；终于学会在说「好吃」时，也不害羞。',
    ],
  },
  {
    name: '外祖父',
    role: '沈若棠之父（沈国良）',
    age: '晚年',
    lines: [
      '曾拦下曼华来信，以为安稳即爱；晚年把信与悔一并交到穗的手心。',
      '「下辈子你去做面包，爸爸不拦了。」——纸条上的字，比任何家训都轻，又比山重。',
    ],
  },
  {
    name: '外祖母',
    role: '沈若棠之母（赵秀英）',
    age: '晚年',
    lines: [
      '葱油饼的香气里藏着三代女人：食堂面点的手，若棠的童年，千穗的研发灵感。',
      '话不多，擀面时最温柔。',
    ],
  },
];
