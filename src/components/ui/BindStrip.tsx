import { initialOf } from '../../lib/format.ts'
import type { Character } from '../../types/index.ts'

function PersonAvatar(props: { character: Character }) {
  const avatar = props.character.avatar?.trim()
  if (avatar?.startsWith('data:')) {
    return <img src={avatar} alt="" className="bind-person-avatar" />
  }
  return <span className="bind-person-avatar">{avatar || initialOf(props.character.name)}</span>
}

export function BindStrip(props: {
  characters: Character[]
  bound?: string
  onPick: (id: string) => void
}) {
  if (props.characters.length === 0) return null
  return (
    <div className="bind-strip" role="list" aria-label="绑定角色">
      {props.characters.map((character) => {
        const active = character.id === props.bound
        return (
          <button
            key={character.id}
            type="button"
            role="listitem"
            aria-pressed={active}
            className={`bind-person${active ? ' is-active' : ''}`}
            onClick={() => props.onPick(character.id)}
          >
            <PersonAvatar character={character} />
            <span className="bind-person-body">
              <span className="bind-person-name">{character.name}</span>
              {active ? <span className="bind-person-hint">正在看 TA 的手机</span> : null}
            </span>
            {active ? <span className="bind-person-dot" aria-hidden /> : null}
          </button>
        )
      })}
    </div>
  )
}
