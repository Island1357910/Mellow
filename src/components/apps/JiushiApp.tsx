import { useMellow } from '../../store/useMellow.ts'
import { JiushiPhoneShell } from './jiushi/JiushiPhoneShell.tsx'

export function JiushiApp(props: { onBack: () => void }) {
  const identities = useMellow((state) => state.identities)
  const activeIdentityId = useMellow((state) => state.activeIdentityId)
  const phone = identities.find((item) => item.id === activeIdentityId)
  if (!phone) return null
  return (
    <div className="sms-shell relative h-full min-h-0 bg-[#EDE4D3] p-2">
      <JiushiPhoneShell phone={phone} onExit={props.onBack} />
    </div>
  )
}
