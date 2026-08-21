import { useCallback, useMemo, useState } from 'react'
import type { Difficulty, Puzzle } from './engine/types'
import { createErrorChecker, generatePuzzle } from './engine'
import { SAMPLE_PUZZLE } from './fixtures/samplePuzzle'
import { useGame } from './game/useGame'
import { Board } from './ui/Board'
import { Controls } from './ui/Controls'
import { HintPanel } from './ui/HintPanel'
import { Keypad } from './ui/Keypad'
import { WinBanner } from './ui/WinBanner'
import './App.css'

function App() {
  const [size, setSize] = useState(SAMPLE_PUZZLE.size)
  const [difficulty, setDifficulty] = useState<Difficulty>(SAMPLE_PUZZLE.difficulty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const game = useGame(SAMPLE_PUZZLE)

  const newPuzzle = game.newPuzzle

  // Live error checking. The cage-combination tables are enumerated once per
  // puzzle and reused for every keystroke; the errors themselves are derived
  // state, so they are memoized here rather than kept in the reducer.
  const checkErrors = useMemo(() => createErrorChecker(game.state.puzzle), [game.state.puzzle])
  const errors = useMemo(() => checkErrors(game.state.values), [checkErrors, game.state.values])

  const generate = useCallback(
    (nextSize: number, nextDifficulty: Difficulty) => {
      setLoading(true)
      setError(null)
      // Flip the loading flag, then let the browser paint before the (possibly ~1s)
      // synchronous generation work, so the UI doesn't appear to freeze.
      setTimeout(() => {
        let next: Puzzle | null = null
        try {
          next = generatePuzzle({ size: nextSize, difficulty: nextDifficulty })
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to generate puzzle.')
        }
        if (next) newPuzzle(next)
        setLoading(false)
      }, 0)
    },
    [newPuzzle],
  )

  const handleSizeChange = useCallback(
    (nextSize: number) => {
      setSize(nextSize)
      generate(nextSize, difficulty)
    },
    [difficulty, generate],
  )

  const handleDifficultyChange = useCallback(
    (nextDifficulty: Difficulty) => {
      setDifficulty(nextDifficulty)
      generate(size, nextDifficulty)
    },
    [size, generate],
  )

  const handleNewPuzzle = useCallback(() => generate(size, difficulty), [generate, size, difficulty])

  return (
    <div className="kk-app">
      <header className="kk-app__header">
        <h1>KenKen</h1>
      </header>

      <Controls
        size={size}
        difficulty={difficulty}
        onSizeChange={handleSizeChange}
        onDifficultyChange={handleDifficultyChange}
        onNewPuzzle={handleNewPuzzle}
        onUndo={game.undo}
        onRedo={game.redo}
        canUndo={game.canUndo}
        canRedo={game.canRedo}
        onHint={game.pressHint}
        hintPending={game.hintPending}
        disabled={loading}
      />

      {error && (
        <p role="alert" className="kk-app__error">
          {error}
        </p>
      )}

      {loading ? (
        <p className="kk-app__loading" role="status">
          Generating…
        </p>
      ) : (
        <main className="kk-app__main">
          <Board
            puzzle={game.state.puzzle}
            values={game.state.values}
            marks={game.state.marks}
            selected={game.state.selected}
            errors={errors}
            highlight={game.highlight}
            onSelect={game.select}
          />
          <HintPanel
            phase={game.state.hint}
            onDismiss={game.dismissHint}
            onReveal={game.revealCell}
          />
          <WinBanner visible={game.state.status === 'solved'} />
          <Keypad
            size={game.state.puzzle.size}
            mode={game.state.mode}
            onDigit={game.enterDigit}
            onErase={game.erase}
            onToggleMode={game.toggleMode}
          />
        </main>
      )}
    </div>
  )
}

export default App
