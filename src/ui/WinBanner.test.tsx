import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WinBanner } from './WinBanner'

describe('WinBanner', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(<WinBanner visible={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a status message when visible', () => {
    render(<WinBanner visible />)
    expect(screen.getByRole('status')).toHaveTextContent(/solved/i)
  })
})
