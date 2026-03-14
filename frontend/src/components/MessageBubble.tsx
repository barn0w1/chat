import type { ChatMsg } from '../types'

interface Props {
  msg: ChatMsg
  isOwn: boolean
  grouped: boolean
}

export function MessageBubble({ msg, isOwn, grouped }: Props) {
  const radiusOwn    = grouped
    ? 'rounded-md-large'
    : 'rounded-tl-md-large rounded-tr-md-extra-small rounded-br-md-large rounded-bl-md-large'

  const radiusOther  = grouped
    ? 'rounded-md-large'
    : 'rounded-tl-md-extra-small rounded-tr-md-large rounded-br-md-large rounded-bl-md-large'

  return (
    <div className={`flex items-end gap-2 px-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${grouped ? 'mt-0.5' : 'mt-3'}`}>
      {/* Avatar — only for others, hidden when grouped */}
      {!isOwn && (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0"
          style={{
            background: grouped ? 'transparent' : 'var(--md-sys-color-secondary-container)',
            visibility: grouped ? 'hidden' : 'visible',
          }}
        >
          {msg.emoji}
        </div>
      )}

      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%]`}>
        {/* Sender name — others only, hidden when grouped */}
        {!isOwn && !grouped && (
          <span
            className="mb-0.5 px-1"
            style={{
              fontSize: 'var(--md-type-label-medium)',
              color: 'var(--md-sys-color-on-surface-variant)',
            }}
          >
            {msg.name}
          </span>
        )}

        {/* Bubble */}
        <div
          className={`px-4 py-2 ${isOwn ? radiusOwn : radiusOther} ${msg.live ? 'animate-slide-up-fade' : ''}`}
          style={{
            background: isOwn
              ? 'var(--md-sys-color-primary-container)'
              : 'var(--md-sys-color-surface-container)',
            color: isOwn
              ? 'var(--md-sys-color-on-primary-container)'
              : 'var(--md-sys-color-on-surface)',
            fontSize: 'var(--md-type-body-large)',
            wordBreak: 'break-word',
          }}
        >
          {msg.text}
        </div>

        {/* Timestamp */}
        <span
          className="mt-0.5 px-1"
          style={{
            fontSize: 'var(--md-type-label-small)',
            color: 'var(--md-sys-color-on-surface-variant)',
            opacity: 0.7,
          }}
        >
          {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}
