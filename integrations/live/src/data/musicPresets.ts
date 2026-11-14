export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  source: 'preset' | 'url' | 'file';
  url: string;
}

export const REMOVED_PRESET_IDS = ['preset_yunjian'];

export const MUSIC_PRESETS: MusicTrack[] = [
  {
    id: 'preset_still_water',
    title: 'Still Water',
    artist: '预设',
    source: 'preset',
    url: 'https://drive-cdn.mujian.me/17/6d10636b-9932-4011-80cd-da0b0bf279a2_Still%20Water.mp3',
  },
  {
    id: 'preset_late_night',
    title: 'Late Night Residue',
    artist: '预设',
    source: 'preset',
    url: 'https://drive-cdn.mujian.me/17/2a9136dc-5d60-4512-91a6-1659b520c4ca_Late%20Night%20Residue.mp3',
  },
  {
    id: 'preset_ledger',
    title: 'The Ledger',
    artist: '预设',
    source: 'preset',
    url: 'https://drive-cdn.mujian.me/17/ec895dcb-ceee-4967-8e1d-4e1046b9c746_The%20Ledger.mp3',
  },
  {
    id: 'preset_anyway',
    title: 'Anyway',
    artist: '预设',
    source: 'preset',
    url: 'https://drive-cdn.mujian.me/17/24e0c15f-ffbd-4189-8e1c-fe5ce3209ca2_Anyway.mp3',
  },
  {
    id: 'preset_proximity',
    title: 'Proximity Alert',
    artist: '预设',
    source: 'preset',
    url: 'https://drive-cdn.mujian.me/17/c64ac42d-6c32-45a3-8bba-9c693bb7c486_Proximity%20Alert.mp3',
  },
  {
    id: 'preset_sweet_time',
    title: '甜蜜时光',
    artist: '预设',
    source: 'preset',
    url: 'https://drive-cdn.mujian.me/17/7fb7e699-a8b6-47d4-a16e-9ac3ab77f81b_%E7%94%9C%E8%9C%9C%E6%97%B6%E5%85%89.mp3',
  },
  {
    id: 'preset_room_after',
    title: 'THE ROOM AFTER',
    artist: '预设',
    source: 'preset',
    url: 'https://drive-cdn.mujian.me/17/1b15eb32-01a8-4b68-b38c-0822eafa065e_THE%20ROOM%20AFTER.mp3',
  },
  {
    id: 'preset_north_window',
    title: 'North Window',
    artist: '预设',
    source: 'preset',
    url: 'https://drive-cdn.mujian.me/17/be5d9c29-b768-4690-baf5-bb53bfbf874a_North%20Window.mp3',
  },
  {
    id: 'preset_half_cup',
    title: 'Half A Cup',
    artist: '预设',
    source: 'preset',
    url: 'https://drive-cdn.mujian.me/17/7d3f328c-0666-479b-8d80-a5e4c5ac5226_Half%20A%20Cup.mp3',
  },
  {
    id: 'preset_white_jade',
    title: 'White Jade',
    artist: '预设',
    source: 'preset',
    url: 'https://drive-cdn.mujian.me/17/86220b2f-2002-4195-b638-5150c08ca1ad_White%20Jade.mp3',
  },
  {
    id: 'preset_one_degree',
    title: 'One Degree',
    artist: '预设',
    source: 'preset',
    url: 'https://drive-cdn.mujian.me/17/bd45774b-dd0d-4064-913f-98b9e80ba528_One%20Degree.mp3',
  },
];
