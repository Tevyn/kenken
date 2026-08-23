import { useCallback, useMemo, useState } from 'react'
import type { Difficulty, Puzzle } from './engine/types'
import { createErrorChecker, generatePuzzle } from './engine'
import { SAMPLE_PUZZLE } from './fixtures/samplePuzzle'
import type { Theme } from './game/preferences'
import { applyTheme, loadAutoClearMarks, loadTheme, saveAutoClearMarks, saveTheme } from './game/preferences'
import { useGame } from './game/useGame'
import { Board } from './ui/Board'
import { Controls } from './ui/Controls'
import type { OpenMenu } from './ui/Controls'
import { HintPanel } from './ui/HintPanel'
import { Keypad } from './ui/Keypad'
import { WinDialog } from './ui/WinDialog'
import './App.css'

function App() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /*
   * Which header popover is open lives here, not in `Controls`: an open panel
   * is modal enough to own the keyboard, so the game's shortcuts have to know
   * about it.
   */
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null)
  /*
   * The solved dialog, as two facts rather than one. `solvedSeen` mirrors the
   * game's own status, and `winDismissed` records that this solve has already
   * been acknowledged — a dismissal leaves the grid finished, so "solved" and
   * "still saying so" have to be able to disagree.
   *
   * Both live above `useGame` because, like `openMenu`, an open dialog takes
   * the keyboard away from the board. The reconciliation that keeps the mirror
   * honest is below, where the game's status is finally known.
   */
  const [solvedSeen, setSolvedSeen] = useState(false)
  const [winDismissed, setWinDismissed] = useState(false)
  const winOpen = solvedSeen && !winDismissed

  // Lazy initialiser so storage is read once, at mount, rather than on every render.
  const [initialAutoClearMarks] = useState(loadAutoClearMarks)

  /*
   * The theme is applied to <html> in `main.tsx`, before React mounts, so the
   * page never paints in the wrong palette. This state only mirrors it so the
   * picker can show which one is current.
   */
  const [theme, setTheme] = useState(loadTheme)

  const handleThemeChange = useCallback((next: Theme) => {
    setTheme(next)
    applyTheme(next)
    saveTheme(next)
  }, [])

  const game = useGame(SAMPLE_PUZZLE, {
    autoClearMarks: initialAutoClearMarks,
    suspended: openMenu !== null || winOpen,
  })

  const newPuzzle = game.newPuzzle
  const setAutoClearMarks = game.setAutoClearMarks

  /*
   * The dialog follows the status in both directions, and only on the change:
   * solving opens it, and anything that unsolves the grid — undo, restart, a
   * new puzzle — takes it away rather than leaving it stranded over a board
   * that is no longer finished. Solving again reopens it, dismissed or not.
   *
   * Adjusted during render rather than in an effect. React re-runs this render
   * before committing, so `useGame` above is called again with the corrected
   * `suspended` and nothing is ever painted with the mirror out of date; an
   * effect would commit one render in which the board is solved and the
   * keyboard still live.
   */
  const solved = game.state.status === 'solved'
  if (solved !== solvedSeen) {
    setSolvedSeen(solved)
    setWinDismissed(false)
  }

  const handleWinDismiss = useCallback(() => setWinDismissed(true), [])

  /*
   * "New game" from the solved dialog opens the wizard rather than starting
   * something itself: the size and the difficulty are still choices, and the
   * wizard is the one place that asks for them.
   */
  const handleWinNewGame = useCallback(() => {
    setWinDismissed(true)
    setOpenMenu('new-game')
  }, [])

  const handleAutoClearMarksChange = useCallback(
    (enabled: boolean) => {
      setAutoClearMarks(enabled)
      saveAutoClearMarks(enabled)
    },
    [setAutoClearMarks],
  )

  // Live error checking. The cage-combination tables are enumerated once per
  // puzzle and reused for every keystroke; the errors themselves are derived
  // state, so they are memoized here rather than kept in the reducer.
  const checkErrors = useMemo(() => createErrorChecker(game.state.puzzle), [game.state.puzzle])
  const errors = useMemo(() => checkErrors(game.state.values), [checkErrors, game.state.values])

  /*
   * The one commit point for a new game: the wizard collects both choices and
   * hands them over together, so nothing regenerates while the player is still
   * deciding.
   *
   * Nothing here records the requested size or difficulty — the puzzle in the
   * reducer is the only record of what is being played, so a generation failure
   * leaves the board and the wizard agreeing about the puzzle still on screen.
   */
  const handleStartGame = useCallback(
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

  /*
   * Generating never unmounts the game. Replacing it with one line of text
   * collapsed the page to a fraction of its height and bounced it back a
   * second later; the board it is about to replace is a better placeholder
   * than empty space, so it stays put and dims instead. The controls dim with
   * it, so nothing can be entered into a grid that is about to be replaced.
   */
  // Same capitalisation the wizard's own difficulty buttons use, so the two
  // places the word appears agree.
  const difficultyLabel =
    game.state.puzzle.difficulty[0].toUpperCase() + game.state.puzzle.difficulty.slice(1)

  const busyClass = loading ? 'kk-is-busy' : ''

  return (
    <div className="kk-app">
      <header className="kk-app__header">
        <div className="kk-app__identity">
          <h1 className="kk-app__title">KenKen</h1>
          {/*
            What you are playing, stated once and quietly. Nothing on screen
            said it before - not the size, not the difficulty - and the wizard
            is the only other place either appears.

            The visible form is split from the announced one because "9×9"
            reads as "nine times nine" aloud.
          */}
          <p className="kk-app__meta">
            <span aria-hidden="true">
              {game.state.puzzle.size}×{game.state.puzzle.size} {difficultyLabel}
            </span>
            <span className="kk-sr-only">
              {`Playing ${game.state.puzzle.size} by ${game.state.puzzle.size}, ${game.state.puzzle.difficulty}`}
            </span>
          </p>
        </div>
        <Controls
          size={game.state.puzzle.size}
          difficulty={game.state.puzzle.difficulty}
          onStartGame={handleStartGame}
          autoClearMarks={game.state.autoClearMarks}
          onAutoClearMarksChange={handleAutoClearMarksChange}
          theme={theme}
          onThemeChange={handleThemeChange}
          openMenu={openMenu}
          onOpenMenuChange={setOpenMenu}
          disabled={loading}
        />
      </header>

      {error && (
        <p role="alert" className="kk-app__error">
          {error}
        </p>
      )}

      {/*
        The play zone absorbs all the leftover height (STYLE_GUIDE.md §1.1), so
        the board sits centred in whatever the header and controls leave. The
        hint banner lives here rather than with the controls for the same
        reason: it can appear and disappear without the keypad moving.
      */}
      <main className="kk-app__play" aria-busy={loading || undefined}>
        <div className="kk-app__stage">
          <div className={busyClass}>
            <Board
              puzzle={game.state.puzzle}
              values={game.state.values}
              marks={game.state.marks}
              selected={game.state.selected}
              errors={errors}
              highlight={game.highlight}
              onSelect={game.select}
            />
          </div>

          {loading && (
            <p className="kk-app__loading" role="status">
              Generating…
            </p>
          )}
        </div>

        <HintPanel
          phase={game.state.hint}
          onDismiss={game.dismissHint}
          onReveal={game.revealCell}
        />
      </main>

      {/* Anchored to the bottom, in the thumb zone, and never moved by anything
          above it. */}
      <div className={`kk-app__controls ${busyClass}`}>
        <Keypad
          size={game.state.puzzle.size}
          mode={game.state.mode}
          onDigit={game.enterDigit}
          onErase={game.erase}
          onToggleMode={game.toggleMode}
          onUndo={game.undo}
          onRedo={game.redo}
          canUndo={game.canUndo}
          canRedo={game.canRedo}
          onHint={game.pressHint}
          hintPending={game.hintPending}
        />
      </div>

      {/*
        Floats over everything rather than sitting in a zone, so finishing the
        puzzle doesn't move the board or the keypad.
      */}
      <WinDialog visible={winOpen} onDismiss={handleWinDismiss} onNewGame={handleWinNewGame} />
    </div>
  )
}

export default App
