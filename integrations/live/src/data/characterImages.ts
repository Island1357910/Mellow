/** 主播立绘 URL + 发色（人类按 anchors.ts 中 anchor_1 ~ anchor_36 顺序；非人类按真名映射） */
export interface AnchorVisual {
  portraitUrl: string;
  hairColor: string;
}

export const ANCHOR_VISUALS: AnchorVisual[] = [
  { portraitUrl: 'https://drive-cdn.mujian.me/17/c98ef074-459c-48f7-8305-e49773d9a79f_mmexport1783681229479.png', hairColor: '棕发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/b929fef0-8f14-41a6-a9e1-4789d8b77a17_mmexport1783682533957.png', hairColor: '黑发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/5178fb40-0472-4bbc-b57a-0f8065d75e30_mmexport1783682843285.png', hairColor: '棕发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/08c8e8de-97fc-4b3c-86ab-1b8a2f43958e_mmexport1783683644317.png', hairColor: '褐发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/b8295587-a287-45ca-b03a-477dfb1a4fb5_mmexport1783684737268.png', hairColor: '棕发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/b74f2c0c-e620-4e59-997d-fe4cc169cbb6_mmexport1783685871200.png', hairColor: '棕发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/1d9b060e-49c1-4687-86e7-ca5ff6d6d137_mmexport1783686178499.png', hairColor: '浅棕色发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/e906d618-5132-4ab5-afd0-a4d4a546c345_mmexport1783688638301.png', hairColor: '黑发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/4a93c04e-e9e4-4d5f-85fb-4e7a6b092f72_mmexport1783689882725.png', hairColor: '黑发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/e4bcdf6e-c4d0-4d7a-93ef-aac168d148ff_mmexport1783690006596.png', hairColor: '棕发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/0c5e4cf9-2914-40a9-a9a2-d0c8ba9ca6a1_mmexport1783690328520.png', hairColor: '棕发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/5cb4e537-617e-4795-aef8-43ce72ccf688_mmexport1783690489121.png', hairColor: '黑发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/5e8a8e83-e14b-467d-a2b6-87db2a7cbc69_mmexport1783690787642.png', hairColor: '棕发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/14dcf8ee-8b1a-45dc-8ead-7fe28e085078_mmexport1783690897258.png', hairColor: '褐发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/3fe78faa-a3a7-4506-9522-8941115a90fa_mmexport1783691590157.png', hairColor: '黑发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/e3dce08a-1c98-4cb4-96fd-bf4f4d01d5c5_mmexport1783691831894.png', hairColor: '金发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/69b80487-e43f-4a7a-a81c-814528035adc_mmexport1783692047162.png', hairColor: '黑发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/6178fe76-c961-4ca7-9a4b-1b4cf6abaaa7_mmexport1783742606047.png', hairColor: '浅棕色发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/57c9ef23-4f35-4f2c-9216-bda042b85851_mmexport1783742870063.png', hairColor: '褐发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/54cc1166-338d-41fa-83bf-4e2e80bfbffc_mmexport1783743815422.png', hairColor: '褐发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/855b371b-ec72-47e2-9181-c03b374f3419_mmexport1783743933013.png', hairColor: '黑发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/d835c0f3-45b7-4ee2-b9a5-031d09979f43_mmexport1783744139216.png', hairColor: '金发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/027b30ba-f39b-49a9-94a8-73ab3a940cee_mmexport1783744239004.png', hairColor: '金发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/076da2e7-0e3d-4c48-9000-b706f1ff522c_mmexport1783744671204.png', hairColor: '红发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/04c0d498-6f93-49f6-9ad8-381a9cf58d44_mmexport1783745016426.png', hairColor: '浅棕色发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/48c00cd7-ca11-48cf-b06a-5dea59d7ec45_mmexport1783746229354.png', hairColor: '金发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/a8c439f8-49db-43ee-8c7c-366e360451e4_mmexport1783747191154.png', hairColor: '黑发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/6a584186-a67b-4517-8b89-0d8b8a022945_mmexport1783930030466.png', hairColor: '金发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/34c11673-2a78-4d1b-ba9b-6f6b1817bbf2_mmexport1783755670106.png', hairColor: '玫红色发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/fa8910c9-5b5f-4c02-af6f-18680966b2d6_mmexport1783774697670.png', hairColor: '棕发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/8cbfea4f-70c3-45f7-b250-5e15ea74a8b0_mmexport1783776068439.png', hairColor: '金发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/4b852040-d65b-4953-85f0-2cddb5b1818e_mmexport1783782846925.png', hairColor: '棕发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/d1079a2e-1860-4a18-b2ba-056a09a47b75_mmexport1783783408466.png', hairColor: '褐发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/f343607b-dcb3-4823-803e-d29cb7f0eac4_mmexport1783784032463.png', hairColor: '黑发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/a8cef491-685c-4232-8317-783c2b01c4cb_mmexport1783787300870.png', hairColor: '黑发' },
  { portraitUrl: 'https://drive-cdn.mujian.me/17/b5c49054-411e-4aaa-8f10-7d74f05d261b_mmexport1783787426743.png', hairColor: '黑发' },
];

/** 非人类主播立绘（按真名中文匹配） */
export const NON_HUMAN_VISUALS: Record<string, AnchorVisual> = {
  阿波罗: { portraitUrl: 'https://drive-cdn.mujian.me/17/2e56b6a2-8e1f-4d8e-8fbd-d08623a598f3_%E9%98%BF%E6%B3%A2%E7%BD%97.png', hairColor: '金发' },
  波塞冬: { portraitUrl: 'https://drive-cdn.mujian.me/17/e8589abc-480d-4b6f-89d9-1e2fe2f5f3c8_%E6%B3%A2%E5%A1%9E%E5%86%AC.png', hairColor: '海蓝发' },
  伏尔甘: { portraitUrl: 'https://drive-cdn.mujian.me/17/a1ca84f7-9c2e-40dd-9b95-a08095304dd2_%E4%BC%8F%E5%B0%94%E7%94%98.png', hairColor: '赤红发' },
  泽菲尔: { portraitUrl: 'https://drive-cdn.mujian.me/17/d61fcff5-9e58-4496-861a-4553e68753aa_%E6%B3%BD%E8%8F%B2%E5%B0%94.png', hairColor: '银白发' },
  尼克斯: { portraitUrl: 'https://drive-cdn.mujian.me/17/09205629-e120-48c7-a092-c048b4c7e3bc_%E5%B0%BC%E5%85%8B%E6%96%AF.png', hairColor: '墨黑发' },
  赫利俄斯: { portraitUrl: 'https://drive-cdn.mujian.me/17/0cd2036b-4aa7-4a2b-a94a-3c4c51f6a496_%E8%B5%AB%E5%88%A9%E4%BF%84%E6%96%AF.png', hairColor: '金橙发' },
  梅菲斯托: { portraitUrl: 'https://drive-cdn.mujian.me/17/748674c8-c420-470f-bffa-93fac27ed37d_%E6%A2%85%E8%8F%B2%E6%96%AF%E6%89%98.png', hairColor: '酒红发' },
  阿兹拉尔: { portraitUrl: 'https://drive-cdn.mujian.me/17/ea3fda46-4a5f-42a0-8bad-fe433d87f361_%E9%98%BF%E5%85%B9%E6%8B%89%E5%B0%94.png', hairColor: '银灰发' },
  阿巴顿: { portraitUrl: 'https://drive-cdn.mujian.me/17/65eb2865-9d3e-4c5c-9269-b52bff58a74c_%E9%98%BF%E5%B7%B4%E9%A1%BF.png', hairColor: '深黑发' },
  彼列: { portraitUrl: 'https://drive-cdn.mujian.me/17/6dac883e-f1dc-4bab-8c1a-6b8e44415c4f_%E5%BD%BC%E5%88%97.png', hairColor: '粉紫发' },
  因普: { portraitUrl: 'https://drive-cdn.mujian.me/17/1e916d96-71d8-4fc4-8b95-02203a280672_%E5%9B%A0%E6%99%AE.png', hairColor: '浅棕发' },
  塔纳托斯: { portraitUrl: 'https://drive-cdn.mujian.me/17/ac75f787-f9cf-4db7-9dec-8b07c5ec5261_%E5%A1%94%E7%BA%B3%E6%89%98%E6%96%AF.png', hairColor: '苍白发' },
  拉斐尔: { portraitUrl: 'https://drive-cdn.mujian.me/17/314804e0-33d9-44ac-8d7b-082135e3b064_%E6%8B%89%E6%96%90%E5%B0%94.png', hairColor: '浅金发' },
  赫尔墨斯: { portraitUrl: 'https://drive-cdn.mujian.me/17/e7fa18ed-b2fa-45d0-b25b-bf5b0b325072_%E8%B5%AB%E5%B0%94%E5%A2%A8%E6%96%AF.png', hairColor: '浅棕发' },
  瑟拉菲尔: { portraitUrl: 'https://drive-cdn.mujian.me/17/5b5ed6da-aafa-40da-b38a-f982f86ef53d_%E7%91%9F%E6%8B%89%E8%8F%B2%E5%B0%94.png', hairColor: '玫瑰金发' },
  米迦勒: { portraitUrl: 'https://drive-cdn.mujian.me/17/0df54156-08c7-46a6-b8bc-1096c5dc2e5d_%E7%B1%B3%E8%BF%A6%E5%8B%92.png', hairColor: '铂金发' },
  加百列: { portraitUrl: 'https://drive-cdn.mujian.me/17/94f01ef7-f4a6-467d-8998-6b2ac0728387_%E5%8A%A0%E7%99%BE%E5%88%97.png', hairColor: '柔白发' },
  乌列尔: { portraitUrl: 'https://drive-cdn.mujian.me/17/e288b04a-988b-42c1-9015-736db1ca37c8_%E4%B9%8C%E5%88%97%E5%B0%94.png', hairColor: '金光发' },
  因库布斯: { portraitUrl: 'https://drive-cdn.mujian.me/17/41e80577-a9b2-4488-8f72-8531a471f89a_%E5%9B%A0%E5%BA%93%E5%B8%83%E6%96%AF.png', hairColor: '粉发' },
  摩耳甫斯: { portraitUrl: 'https://drive-cdn.mujian.me/17/95687e1c-b7bd-417b-89cc-47326aa70079_%E6%91%A9%E8%80%B3%E7%94%AB%E6%96%AF.png', hairColor: '深蓝发' },
  阿斯莫德: { portraitUrl: 'https://drive-cdn.mujian.me/17/ba12d43b-0c2f-487d-81de-5defa1413093_%E9%98%BF%E6%96%AF%E8%8E%AB%E5%BE%B7.png', hairColor: '暗紫发' },
  厄洛斯: { portraitUrl: 'https://drive-cdn.mujian.me/17/93eb390e-c46b-44ea-a6f3-af8e67aaba62_%E5%8E%84%E6%B4%9B%E6%96%AF.png', hairColor: '赤金发' },
  莉莉姆: { portraitUrl: 'https://drive-cdn.mujian.me/17/afe62f28-356c-4b15-ab35-85fcb43ea8e1_%E8%8E%89%E8%8E%89%E5%A7%86.png', hairColor: '墨绿发' },
  萨库巴斯: { portraitUrl: 'https://drive-cdn.mujian.me/17/e2d7bc18-ad1d-4e2c-a8e1-12fbf0fe3e01_%E8%90%A8%E5%BA%93%E5%B7%B4%E6%96%AF.png', hairColor: '绯红发' },
};

export function getAnchorVisual(index: number): AnchorVisual | undefined {
  return ANCHOR_VISUALS[index];
}

export function getNonHumanVisual(realNameZh: string): AnchorVisual | undefined {
  return NON_HUMAN_VISUALS[realNameZh];
}
