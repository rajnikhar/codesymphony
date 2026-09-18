import type { AppStatus } from '../../utils/status'

type StatusBannerProps = {
  status: AppStatus
  onDismiss?: () => void
}

export function StatusBanner({ status, onDismiss }: StatusBannerProps) {
  if (!status) {
    return null
  }

  return (
    <div
      className={`status-banner status-${status.tone}`}
      role={status.tone === 'error' ? 'alert' : 'status'}
    >
      <div className="status-copy">
        <strong>{status.title}</strong>
        <p>{status.detail}</p>
      </div>
      {onDismiss && (
        <button type="button" className="ghost status-dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  )
}
