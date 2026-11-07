export type StageMotif = 'paper' | 'rain' | 'clock' | 'lamp' | 'leaf' | 'wave' | 'star' | 'window'

export interface StageKind {
  id: string
  name: string
  category: string
  hint: string
  motif: StageMotif
  wash: [string, string]
  ink: string
}

export const STAGE_CATEGORIES = ['纸上', '日子', '时间', '旁观', '相处', '物件', '节目', '心里'] as const

function kind(
  id: string,
  name: string,
  category: string,
  hint: string,
  motif: StageMotif,
  wash: [string, string],
  ink: string,
): StageKind {
  return { id, name, category, hint, motif, wash, ink }
}

export const STAGE_KINDS: StageKind[] = [
  kind('sleeve-note', '折进袖口的便笺', '纸上', '一张很小的纸条，边角有折痕，话写得很短', 'paper', ['#F6E7D4', '#E7C4A8'], '#8A5A42'),
  kind('unstamped', '没贴出去的邮票', '纸上', '信已经封好，邮票还捏在指尖', 'paper', ['#F8E4D8', '#E7B7A2'], '#8C4E46'),
  kind('half-reply', '写到一半的回信', '纸上', '句子停在逗号上，墨还没干', 'paper', ['#F3E6DC', '#D9C2AE'], '#6E5348'),
  kind('margin-line', '课本边角的空行', '纸上', '正经的字旁边，多出一行很轻的话', 'paper', ['#F7F1DE', '#E4D3AE'], '#74643A'),
  kind('fridge-magnet', '冰箱门上的磁贴', '纸上', '厨房的光，一句被吸在门上的话', 'window', ['#F8F3E4', '#D5E2C8'], '#5E6E52'),
  kind('rain-ink', '被雨洇开的字', '纸上', '纸湿了一角，字迹轻轻散开', 'rain', ['#E4EEF6', '#C5D4E4'], '#4C6278'),
  kind('drawer-paper', '抽屉深处的旧纸', '纸上', '很久没拉开的抽屉，纸边发黄', 'paper', ['#F3E6D2', '#D8C0A0'], '#7A5A38'),

  kind('first-glass', '清晨的第一杯水', '日子', '天刚亮，杯子沿上有一圈光', 'lamp', ['#F8F4E8', '#D7E6C8'], '#5C6A48'),
  kind('streetlamp', '路灯亮起的那一段', '日子', '天色转深，人还走在同一条路上', 'lamp', ['#E7E2F4', '#C9C4DE'], '#564E74'),
  kind('weekend-market', '周末的菜市场', '日子', '人声、塑料袋和刚称好的重量', 'leaf', ['#E7F2D8', '#C9DDA8'], '#4E6840'),
  kind('lit-window', '还亮着的那扇窗', '日子', '整栋楼暗了，只剩这一格暖光', 'window', ['#F8E8C8', '#E8C89A'], '#8A6232'),
  kind('wait-lift', '一起等电梯', '日子', '楼层数字往下跳，谁都先不说话', 'clock', ['#E8EEF4', '#C9D5E4'], '#4A5C72'),
  kind('share-umbrella', '雨天共一把伞', '日子', '伞沿滴水，肩膀靠得很近', 'rain', ['#E4F0F4', '#B7D0DC'], '#3E6474'),
  kind('after-dinner', '晚饭后谁洗碗', '日子', '水龙头开着，碗沿还热', 'lamp', ['#F8EEDC', '#E4CBA8'], '#7A5A36'),

  kind('slow-watch', '慢了三分钟的表', '时间', '表停在一个不太准的时刻', 'clock', ['#F4E8DC', '#E0C6B0'], '#7A5644'),
  kind('repeat-tuesday', '重复的星期二', '时间', '同一天又来了一遍，细节却偏了一点', 'clock', ['#E8E4F4', '#C8C0E0'], '#564E78'),
  kind('turn-corner', '路口如果转弯', '时间', '绿灯还在，另一条路只被看了一眼', 'wave', ['#E4F0E8', '#BFD6C8'], '#3E6450'),
  kind('rewind-afternoon', '倒着看的一个下午', '时间', '从黄昏往回，光一点点变亮', 'clock', ['#F8E4C8', '#E8C49A'], '#8A5A30'),
  kind('before-clear', '雨停之前', '时间', '雨还在，天边已经有一块浅色', 'rain', ['#E4EEF2', '#C5D6DE'], '#4A6270'),
  kind('half-awake-hall', '半醒的走廊', '时间', '灯是暖的，脚步还没完全醒', 'lamp', ['#F6E8D8', '#E4C8B0'], '#7A5844'),
  kind('torn-calendar', '被撕掉的日历页', '时间', '日期不在了，纸边留着撕痕', 'paper', ['#F6EFE4', '#E0D0B8'], '#6E5A40'),

  kind('downstairs-talk', '楼下传来的闲话', '旁观', '话从窗缝进来，人还没露面', 'wave', ['#F4E8E4', '#E4C8C0'], '#7A504C'),
  kind('anon-hollow', '树洞里的匿名', '旁观', '没有名字，只有一句被放进来的话', 'star', ['#E8E4F2', '#C8C0DC'], '#544C70'),
  kind('passing-danmaku', '飘过去的弹幕', '旁观', '字从画面边上一闪而过', 'star', ['#E4F0F8', '#C0D8EA'], '#3E5C74'),
  kind('back-row', '后排看热闹', '旁观', '人挤在后面，看得到，听不全', 'window', ['#F6E8D4', '#E4C8A4'], '#7A5A34'),
  kind('board-bottom', '留言板最底下', '旁观', '前面的话很多，最后一行才是要说的', 'paper', ['#F4EEE4', '#DDD0BC'], '#665848'),
  kind('photographed-back', '被拍到的背影', '旁观', '镜头对着离开的方向', 'window', ['#E8EEF2', '#C8D4DE'], '#4A5A68'),
  kind('half-heard', '只听见一半的对话', '旁观', '门没关严，句子断在半路', 'wave', ['#E8F2EE', '#C4DCD4'], '#3E6458'),

  kind('desk-pass', '从课桌那边递来', '相处', '一张纸从桌缝里推过来', 'paper', ['#F8F0DC', '#E8D4A8'], '#746034'),
  kind('photo-back-date', '合照背面的日期', '相处', '照片翻过去，只有一行铅笔字', 'paper', ['#F6E8DC', '#E4C8B4'], '#7A5648'),
  kind('unsent-voice', '没按发送的语音', '相处', '话录完了，拇指还停在发送旁边', 'wave', ['#E8E8F4', '#C8C8E0'], '#524E72'),
  kind('missed-last-bus', '错过的末班车', '相处', '车尾灯远了，两个人还站在站牌下', 'clock', ['#E4E8F2', '#C0C8DC'], '#46506C'),
  kind('quiet-match', '不用开口也对上', '相处', '谁都没解释，却同时伸手做了同一件事', 'star', ['#F8E8EE', '#E8C4D4'], '#7A4C60'),
  kind('after-argue', '吵完后的第一句', '相处', '声音已经低下去，第一句很短', 'lamp', ['#F8E4DC', '#E8C0B4'], '#7A4C44'),
  kind('side-by-side', '并肩的那段路', '相处', '步子慢慢对齐，话可有可无', 'leaf', ['#E8F2E4', '#C8DEC0'], '#466448'),

  kind('extra-box', '门口多出来的箱子', '物件', '门垫上多了一只箱子，上面有一行字', 'window', ['#F4E8D4', '#E0C4A4'], '#745434'),
  kind('chair-umbrella', '椅背上的一把伞', '物件', '伞还在滴水，主人先离开了座位', 'rain', ['#E4F2F4', '#C0DCE2'], '#3E646C'),
  kind('circled-due', '还书日期被圈起', '物件', '卡片上的日子被铅笔圈了一圈', 'paper', ['#F6F0E4', '#E0D2B4'], '#665840'),
  kind('keychain-story', '钥匙扣的来历', '物件', '一小块金属，背后有一句来处', 'star', ['#F8E8D4', '#E8C89A'], '#7A5830'),
  kind('old-stub', '夹层里的旧票根', '物件', '包的夹层里，一张已经褪色的票', 'paper', ['#F4E6DC', '#E0C4B4'], '#745044'),
  kind('same-song', '同一首歌的耳机', '物件', '一边一只耳机，歌还停在副歌前', 'wave', ['#E8E4F4', '#C8C0E4'], '#544878'),
  kind('pocket-receipt', '口袋里的小票', '物件', '皱掉的小票，时间印在最下面', 'paper', ['#F6F2E6', '#E4D8BC'], '#686048'),

  kind('night-radio', '深夜电台点歌', '节目', '电流声里，有人报出一个名字', 'star', ['#E6E4F4', '#C4C0E0'], '#4C4870'),
  kind('street-interview', '街角的小采访', '节目', '话筒递过来，问题只有一句', 'lamp', ['#F8EED8', '#E8D0A4'], '#746034'),
  kind('kitchen-match', '厨房里的对照', '节目', '两口锅并排，看谁先好', 'leaf', ['#E8F4DC', '#C8E0B0'], '#4A6438'),
  kind('travel-page', '旅行手账的一页', '节目', '一页纸上有地名、时间和一小块天气', 'paper', ['#F6ECDE', '#E4D0B4'], '#6E5638'),
  kind('two-player-game', '两个人的小游戏', '节目', '规则临时定的，输赢都不太认真', 'clock', ['#F8E4EE', '#E8C4D8'], '#7A4C64'),
  kind('balcony-stars', '阳台上数星星', '节目', '城市的光很亮，还是有人在数', 'star', ['#E4E8F6', '#C0C8E6'], '#44506E'),
  kind('three-seconds', '只留下三秒', '节目', '很长的一段里，只剪下很短的一声', 'window', ['#F4E8F0', '#E0C8D8'], '#6E4C60'),

  kind('unsaid-line', '没说出口的那句', '心里', '话到了嘴边，又被留下', 'lamp', ['#F8E8E4', '#E8C8C0'], '#7A524C'),
  kind('other-street', '另一条没走的街', '心里', '这条路是真的，那条只在心里', 'wave', ['#E4F0EA', '#C0D8CC'], '#3E6454'),
  kind('under-words', '嘴上没说的一层', '心里', '说出来的是一层，底下还有一层', 'star', ['#EEE8F6', '#D4CCE6'], '#564C70'),
  kind('public-slip', '当众出糗的回放', '心里', '那几秒被记得特别清', 'window', ['#F8E4DC', '#E8C0B0'], '#7A4E40'),
  kind('small-remember', '想被记住的小事', '心里', '小到别人可能忘了，自己还留着', 'leaf', ['#F4F0DC', '#DCE4C0'], '#5A6444'),
  kind('lamp-secret', '只在灯下说的事', '心里', '灯一暗，这句话才被说出来', 'lamp', ['#F8E8CC', '#E8C898'], '#7A5A2C'),
  kind('opposite-chair', '坐到对面的椅子', '心里', '同一张桌子，换成对方的位置看', 'window', ['#E8F0F2', '#C8D8DE'], '#466068'),
]

export function stageKind(id: string): StageKind | undefined {
  return STAGE_KINDS.find((item) => item.id === id)
}
