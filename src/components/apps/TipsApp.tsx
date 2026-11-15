import { Lightbulb } from 'lucide-react'
import { Screen } from '../ui/primitives.tsx'

const tips = [
  ['快捷应用怎么拉出来？', '从屏幕左上侧的细把手往右拉，拉住约半秒。侧栏的齿轮可以选常用应用。点应用后会打开小窗，拖动窗体可移动，拖右下角可缩放。'],
  ['一句话不知道怎么回？', '在短信、线下、番外或旧世的输入区开启「帮回复」。对方的新回复出现后会给出四种回法。也能先写自己的想法，再点「润色草稿」，改满意了再发送。'],
  ['桌宠怎么收起来？', '长按底部横条可以召唤桌宠，再长按一次收起。快捷应用有自己的右侧把手。'],
  ['先搭世界，再挑要用的设定', '在世界搭建里可以请 AI 参考已有角色、预览并修订草稿。导入后去世界书查看各条设定，只启用当前剧情需要的条目。'],
  ['把短信里的约定接到线下', '在短信里约好时间地点，再去线下从见面的第一步写起。想试试另一种走向，可以在番外写一个平行版本。'],
  ['把主播加进小手机', '在直播间互动后，可以添加主播为短信联系人，也可以发起线下见面。送礼会扣当前身份的余额。'],
  ['给故事换一种开场', '试一句具体但未完成的动作，比如「我把没拆的信推到他面前」。如果想慢一点，可以写「只写这一小步，先等我接话」。'],
  ['让应用自然配图', '到「设置 → 连接 → 图片 API」配置好生图接口，再开启想配图的应用。短信角色、朋友圈和星博动态，以及多淘、闪送的找货结果，都可以按情境配图。'],
  ['面包房可以单独选模型', '从短信进入千味面包房，在游戏设置里选择使用小手机 API，或者保存面包房专用的接口。'],
] as const

export function TipsApp({ onBack }: { onBack: () => void }) {
  return <Screen title="玩机技巧" onBack={onBack}>
    <div className="space-y-3 px-4 pb-6">
      <details className="menu-card">
        <summary className="cursor-pointer font-semibold">免费生图 API 怎么接？</summary>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-6">
          <li>注册 Cloudflare，复制账户 ID，创建带 Workers AI 读取权限的 API Token。</li>
          <li>到「设置 → 连接 → 图片 API」，地址填 <code className="break-all">https://api.cloudflare.com/client/v4/accounts/账户ID/ai/run/@cf/black-forest-labs/flux-1-schnell</code>，模型填 <code className="break-all">@cf/black-forest-labs/flux-1-schnell</code>，密钥填刚创建的 Token。</li>
          <li>保存后开启想配图的应用。Workers AI 免费计划每天有 10,000 Neurons 额度，其他 Workers AI 调用也会占用这份额度。</li>
        </ol>
        <p className="mt-2 text-sm leading-6">已有硅基流动活动券的玩家，也可以填 <code>https://api.siliconflow.cn/v1</code>，从模型广场复制可用的生图模型 ID。先检查券能否抵扣该模型。</p>
        <p className="mt-2 text-sm"><a className="underline" href={`${import.meta.env.BASE_URL}guide.html#free-image-api`} target="_blank" rel="noreferrer">查看完整生图教程与排错</a></p>
      </details>
      {tips.map(([title, body]) => <details key={title} className="menu-card">
        <summary className="cursor-pointer font-semibold"><Lightbulb size={16} className="mr-2 inline" aria-hidden="true" />{title}</summary>
        <p className="mt-2 text-sm leading-6">{body}</p>
      </details>)}
    </div>
  </Screen>
}
