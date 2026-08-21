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
    onHint: vi.fn(),
    canUndo: true,
    canRedo: false,
    autoClearMarks: true,
    onAutoClearMarksChange: vi.fn(),
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
    expect(screen.getByRole('button', { name: 'Hint' })).toBeDisabled()
    expect(screen.getByLabelText('Size')).toBeDisabled()
    expect(screen.getByLabelText('Difficulty')).toBeDisabled()
  })

  it('hint button calls onHint and advertises its shortcut', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<Controls {...props} />)
    const hint = screen.getByRole('button', { name: 'Hint' })
    expect(hint).toHaveAttribute('aria-keyshortcuts', 'H')
    await user.click(hint)
    expect(props.onHint).toHaveBeenCalledTimes(1)
  })

  it('hint button reads "Apply" once a hint is waiting to be applied', () => {
    render(<Controls {...baseProps()} hintPending />)
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Hint' })).not.toBeInTheDocument()
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

  it('auto-clear-marks checkbox reflects the prop when off', () => {
    render(<Controls {...baseProps()} autoClearMarks={false} />)
    expect(screen.getByLabelText('Auto-clear marks')).not.toBeChecked()
  })

  it('auto-clear-marks checkbox reflects the prop when on', () => {
    render(<Controls {...baseProps()} autoClearMarks />)
    expect(screen.getByLabelText('Auto-clear marks')).toBeChecked()
  })

  it('clicking the auto-clear-marks checkbox or its label calls onAutoClearMarksChange with the negated value', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    render(<Controls {...props} autoClearMarks />)

    await user.click(screen.getByLabelText('Auto-clear marks'))
    expect(props.onAutoClearMarksChange).toHaveBeenNthCalledWith(1, false)

    await user.click(screen.getByText('Auto-clear marks'))
    expect(props.onAutoClearMarksChange).toHaveBeenNthCalledWith(2, false)
  })

  it('auto-clear-marks checkbox is not disabled while a puzzle is generating', () => {
    render(<Controls {...baseProps()} disabled />)
    expect(screen.getByLabelText('Auto-clear marks')).toBeEnabled()
  })
})
