import './WinBanner.css'

export interface WinBannerProps {
  visible: boolean
}

/** Announces a solved puzzle. Renders nothing while playing. */
export function WinBanner({ visible }: WinBannerProps) {
  if (!visible) return null

  return (
    <div className="kk-win-banner" role="status" aria-live="polite">
      <p>Solved! Nice work.</p>
    </div>
  )
}
