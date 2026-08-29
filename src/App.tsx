import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Difficulty, Puzzle } from './engine/types';
import { createErrorChecker, generatePuzzle } from './engine';
import { SAMPLE_PUZZLE } from './fixtures/samplePuzzle';
import type { Theme } from './game/preferences';
import {
  applyTheme,
  loadAutoClearMarks,
  loadAutoFillSingleCages,
  loadTheme,
  saveAutoClearMarks,
  saveAutoFillSingleCages,
  saveTheme,
} from './game/preferences';
import { loadSession, saveSession } from './game/session';
import { hasProgress } from './game/state';
import { useGame } from './game/useGame';
import { Board } from './ui/Board';
import { puzzleFinishSweepMs, useCompletionGlow } from './ui/completionGlow';
import { Controls } from './ui/Controls';
import { Cover } from './ui/Cover';
import { HamburgerIcon } from './ui/icons';
import { Keypad } from './ui/Keypad';
import type { OpenMenu } from './ui/Popover';
import { WinOverlay } from './ui/WinOverlay';
import './App.css';

/** Which screen is on: the title/cover page, or the board itself. */
type Screen = 'cover' | 'game';

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * Always open on the cover (a settled product decision), and only ever leave
   * it deliberately — Continue, or a committed new game.
   */
  const [screen, setScreen] = useState<Screen>('cover');

  /*
   * The game saved from a previous visit, read once at mount. It seeds the
   * reducer below, so Continue restores the board with nothing to re-hydrate;
   * it is also the answer to "is there anything to continue" on first launch,
   * before the player has started anything this session.
   */
  const [savedSession] = useState(loadSession);

  /*
   * Whether a game is in play this session — set by Continue and by a committed
   * new game. It is the other half of "can you continue": once you have started
   * or resumed a game, going back to the cover must leave Continue live, even
   * though `savedSession` was captured before any of that.
   */
  const [sessionActive, setSessionActive] = useState(false);
  const canContinue = sessionActive || savedSession != null;
  /*
   * Which popover is open lives here, not with any of them: an open panel is
   * modal enough to own the keyboard, so the game's shortcuts have to know
   * about it. One slot for all three, so opening the hint panel closes the
   * wizard and vice versa.
   */
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
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
  const [solvedSeen, setSolvedSeen] = useState(false);
  const [winDismissed, setWinDismissed] = useState(false);
  /*
   * The overlay does not arrive the instant the grid is solved: the finishing
   * move fires the whole-board glow, and the success screen waits for that sweep
   * to play out before it fades in over the board. `winReady` is that gate,
   * flipped by a timer below once the sweep is done.
   */
  const [winReady, setWinReady] = useState(false);
  const winOpen = solvedSeen && winReady && !winDismissed;

  const openHint = useCallback(() => setOpenMenu('hint'), []);

  // Lazy initialiser so storage is read once, at mount, rather than on every render.
  const [initialAutoClearMarks] = useState(loadAutoClearMarks);
  const [initialAutoFillSingleCages] = useState(loadAutoFillSingleCages);

  /*
   * The theme is applied to <html> in `main.tsx`, before React mounts, so the
   * page never paints in the wrong palette. This state only mirrors it so the
   * picker can show which one is current.
   */
  const [theme, setTheme] = useState(loadTheme);

  const handleThemeChange = useCallback((next: Theme) => {
    setTheme(next);
    applyTheme(next);
    saveTheme(next);
  }, []);

  /*
   * The reducer starts from the saved game when there is one, so Continue is
   * just a screen change — the board is already in memory, exactly as it was
   * left. With nothing saved it starts from the sample fixture, which the cover
   * keeps hidden until the player picks a real game.
   */
  const game = useGame(savedSession?.puzzle ?? SAMPLE_PUZZLE, {
    autoClearMarks: initialAutoClearMarks,
    autoFillSingleCages: initialAutoFillSingleCages,
    seed: savedSession ? { values: savedSession.values, marks: savedSession.marks } : undefined,
    /*
     * The board's keyboard is the game's alone, so it stays suspended while the
     * cover is up: a digit pressed on the title screen must not edit the game
     * hidden behind it. On the game screen the usual rule applies — an open
     * popover takes the keyboard too, as does a solve: from the moment the grid
     * is finished until the win is acknowledged the board is frozen, so a stray
     * keystroke can't un-solve it out from under the finish animation or the
     * overlay that follows.
     */
    suspended: screen !== 'game' || openMenu !== null || (solvedSeen && !winDismissed),
    onRequestHint: openHint,
  });

  /*
   * Closing the panel also drops whatever it was explaining, so the board's
   * highlight lives and dies with the open panel rather than lingering until
   * the next edit. `dismissHint` is a no-op when nothing is shown, so closing a
   * panel that only ever displayed the three choices costs nothing.
   */
  const dismissHint = game.dismissHint;
  const handleHintOpenChange = useCallback(
    (open: boolean) => {
      setOpenMenu(open ? 'hint' : null);
      if (!open) dismissHint();
    },
    [dismissHint],
  );

  /*
   * The panel prints whatever the game last worked out, whichever choice asked
   * for it — a hint, or the reason there was no number to place. `secondary` is
   * deliberately not shown: the technique's proper name is still on the type,
   * but naming it here would put jargon in front of a player who asked for a
   * sentence.
   */
  const hintText =
    game.state.hint.kind === 'shown'
      ? game.state.hint.hint.text
      : game.state.hint.kind === 'message'
        ? game.state.hint.message.text
        : null;

  const newPuzzle = game.newPuzzle;
  const setAutoClearMarks = game.setAutoClearMarks;
  const setAutoFillSingleCages = game.setAutoFillSingleCages;

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
  const solved = game.state.status === 'solved';
  if (solved !== solvedSeen) {
    setSolvedSeen(solved);
    setWinDismissed(false);
    // Every solve starts the reveal clock from zero, and unsolving stops it: the
    // gate is armed here and flipped open by the timer below once the sweep ends.
    setWinReady(false);
  }

  /*
   * Hold the success overlay back until the board's finish sweep has run, then
   * let it fade in. The wait is the sweep's own length (shorter under reduced
   * motion, where the ripple collapses to a single bloom); unsolving the grid
   * before it elapses — an undo on the winning move — cancels the reveal, since
   * the effect re-runs with `solvedSeen` false and clears the pending timer.
   */
  const puzzleSize = game.state.puzzle.size;
  useEffect(() => {
    if (!solvedSeen) return;
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(
      () => setWinReady(true),
      puzzleFinishSweepMs(puzzleSize, reduced),
    );
    return () => window.clearTimeout(timer);
  }, [solvedSeen, puzzleSize]);

  const handleWinDismiss = useCallback(() => setWinDismissed(true), []);

  /* Nothing filled in is nothing for the check to judge. Marks are not entries,
     so they do not count: `checkCorrectness` only ever looks at values. */
  const canCheck = useMemo(
    () => game.state.values.some((value) => value != null),
    [game.state.values],
  );

  /* Combinations lists the selected cell's cage, so it needs a selection. */
  const canCombine = game.state.selected != null;

  /* Restarting an untouched board would do nothing but add an undo entry. With
     auto-fill on the freebies are already on a fresh board, so "untouched" has
     to mean "nothing but the freebies" — `hasProgress` draws that line. */
  const canRestart = useMemo(() => hasProgress(game.state), [game.state]);

  const handleAutoClearMarksChange = useCallback(
    (enabled: boolean) => {
      setAutoClearMarks(enabled);
      saveAutoClearMarks(enabled);
    },
    [setAutoClearMarks],
  );

  const handleAutoFillSingleCagesChange = useCallback(
    (enabled: boolean) => {
      setAutoFillSingleCages(enabled);
      saveAutoFillSingleCages(enabled);
    },
    [setAutoFillSingleCages],
  );

  // Live error checking. The cage-combination tables are enumerated once per
  // puzzle and reused for every keystroke; the errors themselves are derived
  // state, so they are memoized here rather than kept in the reducer.
  const checkErrors = useMemo(() => createErrorChecker(game.state.puzzle), [game.state.puzzle]);
  const errors = useMemo(() => checkErrors(game.state.values), [checkErrors, game.state.values]);

  /*
   * The completion glow: a bloom that ripples through a cage, row, column, or
   * the whole grid the moment it is finished with no red digit in it. Derived
   * from the same board state and error/verdict marks the Board already draws —
   * it starts and clears itself, and never enters the reducer.
   */
  const glow = useCompletionGlow(game.state.puzzle, game.state.values, errors, game.state.verdict);

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
      setLoading(true);
      setError(null);
      // Flip the loading flag, then let the browser paint before the (possibly ~1s)
      // synchronous generation work, so the UI doesn't appear to freeze.
      // Starting a game leaves no win to acknowledge: drop any open success
      // screen now, so it never lingers over the board about to be generated.
      setWinDismissed(true);
      setTimeout(() => {
        let next: Puzzle | null = null;
        try {
          next = generatePuzzle({ size: nextSize, difficulty: nextDifficulty });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to generate puzzle.');
        }
        if (next) {
          newPuzzle(next);
          // The one place a game begins: from here the autosave effect owns the
          // record, and Continue has something to return to. Also the moment the
          // cover hands off to the board — a no-op when already on it.
          setSessionActive(true);
          setScreen('game');
        }
        setLoading(false);
      }, 0);
    },
    [newPuzzle],
  );

  /*
   * "New game" on the success screen: a fresh puzzle of the very shape just
   * solved, generated straight away. The wizard is skipped — both choices are
   * already made — so this is the header's start path with the current size and
   * difficulty handed back to it.
   */
  const handleWinNewGame = useCallback(
    () => handleStartGame(game.state.puzzle.size, game.state.puzzle.difficulty),
    [handleStartGame, game.state.puzzle.size, game.state.puzzle.difficulty],
  );

  /*
   * Resume the game already in memory — the board is either the seeded save or
   * whatever was last played this session, so there is nothing to load, only a
   * screen to change. The cover only offers this when `canContinue`.
   */
  const handleContinue = useCallback(() => {
    setError(null);
    setSessionActive(true);
    setScreen('game');
  }, []);

  /*
   * Back to the cover, without disturbing the game: the board stays in memory
   * and stays saved, so Continue brings it straight back. Any open popover is
   * closed on the way out so the cover opens clean.
   */
  const handleBack = useCallback(() => {
    setOpenMenu(null);
    setError(null);
    setScreen('cover');
  }, []);

  /*
   * Autosave, board only (no undo history — a settled decision): the game is
   * written on every change to the puzzle, values or marks, but only once it is
   * actually in play. The sample fixture behind the cover must never masquerade
   * as a saved game, so nothing is written until Continue or a new game sets
   * `sessionActive`.
   */
  useEffect(() => {
    if (!sessionActive) return;
    saveSession({
      puzzle: game.state.puzzle,
      values: game.state.values,
      marks: game.state.marks,
    });
  }, [sessionActive, game.state.puzzle, game.state.values, game.state.marks]);

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
    game.state.puzzle.difficulty[0].toUpperCase() + game.state.puzzle.difficulty.slice(1);

  const busyClass = loading ? 'kk-is-busy' : '';

  /*
   * The cover shares the app's popover machinery — its New game and Settings are
   * the very same panels the header opens, only with a cover-styled trigger — so
   * it reads the same `openMenu` slot and generation state. It never mounts
   * alongside the game, so the two instances of those menus never collide.
   */
  if (screen === 'cover') {
    return (
      <Cover
        canContinue={canContinue}
        onContinue={handleContinue}
        size={game.state.puzzle.size}
        difficulty={game.state.puzzle.difficulty}
        onStartGame={handleStartGame}
        autoClearMarks={game.state.autoClearMarks}
        onAutoClearMarksChange={handleAutoClearMarksChange}
        autoFillSingleCages={game.state.autoFillSingleCages}
        onAutoFillSingleCagesChange={handleAutoFillSingleCagesChange}
        theme={theme}
        onThemeChange={handleThemeChange}
        openMenu={openMenu}
        onOpenMenuChange={setOpenMenu}
        loading={loading}
        error={error}
      />
    );
  }

  return (
    <div className="kk-app">
      <header className="kk-app__header">
        {/*
          The wordmark that used to sit here has moved to the cover; the board's
          header leads with the way back to it instead. The cover is the game's
          menu, so the control is a hamburger labelled "Menu" — a bare stacked
          control like every other in the app, so it reads as one of the app's
          controls rather than browser chrome.
        */}
        <button
          type="button"
          className="kk-control kk-control--stack kk-app__back"
          onClick={handleBack}
        >
          <HamburgerIcon size={22} />
          <span className="kk-control__label">Menu</span>
        </button>

        {/*
          What you are playing, stated once and quietly. Centred between the back
          control and the toolbar now that the wordmark no longer anchors the
          left — the header's one piece of state, holding the middle.

          The visible form is split from the announced one because "9×9" reads as
          "nine times nine" aloud.
        */}
        <p className="kk-app__meta">
          <span aria-hidden="true">
            {game.state.puzzle.size}×{game.state.puzzle.size} {difficultyLabel}
          </span>
          <span className="kk-sr-only">
            {`Playing ${game.state.puzzle.size} by ${game.state.puzzle.size}, ${game.state.puzzle.difficulty}`}
          </span>
        </p>

        <Controls
          size={game.state.puzzle.size}
          difficulty={game.state.puzzle.difficulty}
          onStartGame={handleStartGame}
          onRestart={game.reset}
          canRestart={canRestart}
          autoClearMarks={game.state.autoClearMarks}
          onAutoClearMarksChange={handleAutoClearMarksChange}
          autoFillSingleCages={game.state.autoFillSingleCages}
          onAutoFillSingleCagesChange={handleAutoFillSingleCagesChange}
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
        the board sits centred in whatever the header and controls leave.
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
              verdict={game.state.verdict}
              placed={game.state.placed}
              glow={glow}
              onSelect={game.select}
            />
          </div>

          {loading && (
            <p className="kk-app__loading" role="status">
              Generating…
            </p>
          )}
        </div>
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
          hint={{
            open: openMenu === 'hint',
            onOpenChange: handleHintOpenChange,
            text: hintText,
            canCheck,
            canCombine,
            onCorrectness: game.checkBoard,
            onTip: game.showHint,
            onNumber: game.placeNumber,
            onCombinations: game.combinationsFor,
          }}
        />
      </div>

      {/*
        Fills the page over everything rather than sitting in a zone, so
        finishing the puzzle doesn't move the board or the keypad. It waits for
        the board's finish sweep, then fades in. Its two moves are the header's
        own: Menu returns to the cover, New game starts a fresh puzzle of the
        same shape.
      */}
      <WinOverlay
        visible={winOpen}
        onMenu={handleBack}
        onNewGame={handleWinNewGame}
        onDismiss={handleWinDismiss}
      />
    </div>
  );
}

export default App;
