export type UnoColor = 'red' | 'yellow' | 'green' | 'blue'

export interface UnoCard {
  id: number
  color: UnoColor | null
  rank: string
}

export interface UnoMatch {
  draw: UnoCard[]
  discard: UnoCard[]
  hands: UnoCard[][]
  turn: number
  dir: 1 | -1
  wild: UnoColor | null
  names: string[]
  note: string
  winner: number | null
}

function shuffle<T>(list: T[]): T[] {
  const next = list.slice()
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    const left = next[index]
    const right = next[swap]
    if (left !== undefined && right !== undefined) {
      next[index] = right
      next[swap] = left
    }
  }
  return next
}

export function freshMatch(names: string[]): UnoMatch {
  let serial = 1
  const deck: UnoCard[] = []
  const colors: UnoColor[] = ['red', 'yellow', 'green', 'blue']
  for (const color of colors) {
    deck.push({ id: serial, color, rank: '0' })
    serial += 1
    for (const rank of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2']) {
      deck.push({ id: serial, color, rank })
      serial += 1
      deck.push({ id: serial, color, rank })
      serial += 1
    }
  }
  for (let index = 0; index < 4; index += 1) {
    deck.push({ id: serial, color: null, rank: 'wild' })
    serial += 1
    deck.push({ id: serial, color: null, rank: 'wild4' })
    serial += 1
  }
  const cards = shuffle(deck)
  const hands = names.map(() => cards.splice(0, 7))
  let top = cards.pop()
  while (top && !top.color) {
    cards.unshift(top)
    top = cards.pop()
  }
  return {
    draw: cards,
    discard: top ? [top] : [],
    hands,
    turn: 0,
    dir: 1,
    wild: null,
    names,
    note: '轮到你',
    winner: null,
  }
}

export function topCard(match: UnoMatch): UnoCard | null {
  return match.discard[match.discard.length - 1] ?? null
}

export function canPlay(card: UnoCard, top: UnoCard | null, wild: UnoColor | null): boolean {
  if (!top) return true
  if (card.rank === 'wild' || card.rank === 'wild4') return true
  if (card.rank === top.rank) return true
  if (card.color && card.color === top.color) return true
  return Boolean(card.color && top.color === null && card.color === wild)
}

function pull(match: UnoMatch, count: number): { draw: UnoCard[]; discard: UnoCard[]; cards: UnoCard[] } {
  const draw = match.draw.slice()
  const discard = match.discard.slice()
  const cards: UnoCard[] = []
  for (let index = 0; index < count; index += 1) {
    if (!draw.length) {
      const keep = discard.pop()
      draw.push(...shuffle(discard))
      discard.length = 0
      if (keep) discard.push(keep)
    }
    const card = draw.pop()
    if (card) cards.push(card)
  }
  return { draw, discard, cards }
}

function step(turn: number, dir: 1 | -1, count: number, skips: number): number {
  let next = turn
  for (let index = 0; index < skips; index += 1) next = (next + dir + count) % count
  return next
}

export function playCard(match: UnoMatch, handIndex: number, cardIndex: number, wild: UnoColor | null): UnoMatch | null {
  if (match.winner !== null || match.turn !== handIndex) return null
  const hand = match.hands[handIndex]
  const card = hand?.[cardIndex]
  const top = topCard(match)
  if (!hand || !card || !canPlay(card, top, match.wild)) return null
  if ((card.rank === 'wild' || card.rank === 'wild4') && !wild) return null
  const hands = match.hands.map((row) => row.slice())
  hands[handIndex] = hand.filter((_, index) => index !== cardIndex)
  let dir = match.dir
  let skips = 1
  let note = `${match.names[handIndex] ?? ''} 出了牌`
  const drawn = { draw: match.draw, discard: [...match.discard, card], cards: [] as UnoCard[] }
  if (card.rank === 'reverse') {
    dir = match.dir === 1 ? -1 : 1
    if (hands.length === 2) skips = 2
    note = '方向转了'
  } else if (card.rank === 'skip') {
    skips = 2
    note = '下一位被跳过'
  } else if (card.rank === 'draw2' || card.rank === 'wild4') {
    const victim = step(handIndex, dir, hands.length, 1)
    const pulled = pull(match, card.rank === 'wild4' ? 4 : 2)
    const victimHand = hands[victim]
    if (victimHand) hands[victim] = [...victimHand, ...pulled.cards]
    drawn.draw = pulled.draw
    skips = 2
    note = card.rank === 'wild4' ? '下一位摸四张' : '下一位摸两张'
  }
  const winner = hands[handIndex]?.length === 0 ? handIndex : null
  const turn = winner === null ? step(handIndex, dir, hands.length, skips) : handIndex
  return {
    ...match,
    draw: drawn.draw,
    discard: drawn.discard,
    hands,
    turn,
    dir,
    wild: card.color ?? wild,
    note: winner === null ? note : `${match.names[handIndex] ?? ''} 赢了`,
    winner,
  }
}

export function drawForTurn(match: UnoMatch): UnoMatch {
  if (match.winner !== null) return match
  const pulled = pull(match, 1)
  const hands = match.hands.map((row) => row.slice())
  const hand = hands[match.turn]
  const card = pulled.cards[0]
  if (hand && card) hand.push(card)
  const playable = card ? canPlay(card, topCard({ ...match, discard: pulled.discard }), match.wild) : false
  return {
    ...match,
    draw: pulled.draw,
    discard: pulled.discard,
    hands,
    turn: playable ? match.turn : step(match.turn, match.dir, hands.length, 1),
    note: playable ? '摸到一张能出的' : '摸了一张，过',
  }
}

export function aiChoice(match: UnoMatch): { index: number; color: UnoColor } | null {
  const hand = match.hands[match.turn]
  const top = topCard(match)
  if (!hand) return null
  const colors: UnoColor[] = ['red', 'yellow', 'green', 'blue']
  const tally = Object.fromEntries(colors.map((color) => [color, hand.filter((card) => card.color === color).length])) as Record<UnoColor, number>
  const favorite = colors.slice().sort((a, b) => tally[b] - tally[a])[0] ?? 'red'
  const index = hand.findIndex((card) => canPlay(card, top, match.wild) && card.rank !== 'wild' && card.rank !== 'wild4')
  const wildIndex = hand.findIndex((card) => card.rank === 'wild' || card.rank === 'wild4')
  const chosen = index >= 0 ? index : wildIndex
  if (chosen < 0) return null
  return { index: chosen, color: favorite }
}

export const UNO_LABEL: Record<string, string> = {
  skip: '禁',
  reverse: '转',
  draw2: '+2',
  wild: '变',
  wild4: '+4',
}

export const UNO_COLOR: Record<UnoColor, string> = {
  red: '#F3A8BA',
  yellow: '#F0D48A',
  green: '#9ED9C4',
  blue: '#A9CDE8',
}
