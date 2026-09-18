import { BrandMark } from './BrandMark'

type LandingBrandBarProps = {
  health: string
  onPingApi: () => void
}

export function LandingBrandBar({ health, onPingApi }: LandingBrandBarProps) {
  return (
    <header className="landing-brand-bar">
      <BrandMark />
      <div className="header-actions">
        <button type="button" className="ghost" onClick={onPingApi}>
          Ping API
        </button>
        <span className="health">{health}</span>
      </div>
    </header>
  )
}
