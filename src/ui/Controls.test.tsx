import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Controls } from './Controls'

function baseProps() {
  return {
    size: 4,
    difficulty: 'easy' as const,
    onSizeChange: vi.fn(),
    onDifficultyChange: vi.fn(),
    onNewPuzzle: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    canUndo: true,
    canRedo: false,
  }
}

describe('Controls', () => {
  it('renders size options 3..9 and the current difficulty', () => {
    render(<Controls {...baseProps()} />)
    const sizeSelect = screen.getByLabelText('Size') as HTMLSelectElement
    expect(sizeSelect.querySelectorAll('option')).toHaveLength(7)
    expect(sizeSelect.value).toBe('4')

    const difficultySelect = screen.getByLabelText('Difficulty') as HTMLSelectElement
    expect(difficultySelect.value).toBe('easy')
  })

  it('New puzzle button calls onNewPuzzle', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<Controls {...props} />)
    await user.click(screen.getByRole('button', { name: 'New puzzle' }))
    expect(props.onNewPuzzle).toHaveBeenCalledTimes(1)
  })

  it('undo enabled / redo disabled reflect canUndo / canRedo', () => {
    render(<Controls {...baseProps()} />)
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
  })

  it('disabled prop disables all controls', () => {
    render(<Controls {...baseProps()} disabled canUndo canRedo />)
    expect(screen.getByRole('button', { name: 'New puzzle' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
    expect(screen.getByLabelText('Size')).toBeDisabled()
    expect(screen.getByLabelText('Difficulty')).toBeDisabled()
  })

  it('changing size and difficulty selects fires their callbacks', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<Controls {...props} />)
    await user.selectOptions(screen.getByLabelText('Size'), '6')
    expect(props.onSizeChange).toHaveBeenCalledWith(6)
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'hard')
    expect(props.onDifficultyChange).toHaveBeenCalledWith('hard')
  })
})
