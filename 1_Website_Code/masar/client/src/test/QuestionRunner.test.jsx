import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import QuestionRunner from '../components/QuestionRunner.jsx';
import { progressKey, saveProgress } from '../quizProgress.js';

const questions = [1, 2, 3].map((n) => ({
  id: `q${n}`,
  q: { ar: `سؤال ${n}`, en: `Question ${n}` },
  options: ['a', 'b'].map((o) => ({ id: o, text: { ar: `${o}${n}`, en: `${o}${n}` } })),
}));
const KEY = progressKey('u1', 'track-quiz');

function setup(props = {}) {
  const onFinish = vi.fn();
  render(
    <LanguageProvider>
      <QuestionRunner questions={questions} finishLabel="Submit" onFinish={onFinish} storageKey={KEY} {...props} />
    </LanguageProvider>
  );
  return { onFinish };
}
const next = () => fireEvent.click(screen.getByRole('button', { name: /Next|Review/ }));
const pickFirst = () => fireEvent.click(screen.getAllByRole('radio')[0]);

describe('QuestionRunner', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('masar.lang', 'en');
  });
  afterEach(cleanup);

  it('asks for an answer before moving on', () => {
    setup();
    next();
    expect(screen.getByText('Choose an answer to continue.')).toBeInTheDocument();
    expect(screen.getByText('Question 1 of 3')).toBeInTheDocument();
  });

  it('shows a review step and submits only from there', () => {
    const { onFinish } = setup({ retakeNote: 'You can retake it.' });
    for (let i = 0; i < 3; i++) {
      pickFirst();
      next();
    }
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Review before you submit' })).toBeInTheDocument();
    expect(screen.getByText('You can retake it.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onFinish).toHaveBeenCalledWith({ q1: 'a', q2: 'a', q3: 'a' });
  });

  it('jumps back to a question from the review', () => {
    setup();
    for (let i = 0; i < 3; i++) {
      pickFirst();
      next();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Question 2, answered' }));
    expect(screen.getByText('Question 2 of 3')).toBeInTheDocument();
  });

  it('saves answers and resumes at the same question', () => {
    setup();
    pickFirst();
    next();
    cleanup();
    setup();
    expect(screen.getByText(/Picked up where you left off: 1 of 3/)).toBeInTheDocument();
    expect(screen.getByText('Question 2 of 3')).toBeInTheDocument();
  });

  it('ignores saved answers that no longer match the questions', () => {
    saveProgress(KEY, { q1: 'z', old: 'a' }, 'q1');
    setup();
    expect(screen.queryByText(/Picked up where you left off/)).not.toBeInTheDocument();
    expect(screen.getByText('Question 1 of 3')).toBeInTheDocument();
  });

  it('starts over when asked', () => {
    saveProgress(KEY, { q1: 'a', q2: 'b' }, 'q3');
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(screen.getByText('Question 1 of 3')).toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe('QuestionRunner auto-advance and milestones', () => {
  const many = Array.from({ length: 10 }, (_, i) => ({
    id: `m${i + 1}`,
    q: { ar: `س ${i + 1}`, en: `Item ${i + 1}` },
    options: ['a', 'b'].map((o) => ({ id: o, text: { ar: o, en: o } })),
  }));
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('masar.lang', 'en');
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
  const mount = (props) =>
    render(
      <LanguageProvider>
        <QuestionRunner questions={many} finishLabel="Submit" onFinish={() => {}} {...props} />
      </LanguageProvider>
    );

  it('moves on by itself after a pointer choice', () => {
    mount({ autoAdvance: true });
    const label = screen.getAllByRole('radio')[0].closest('label');
    fireEvent.pointerDown(label);
    fireEvent.click(screen.getAllByRole('radio')[0]);
    expect(screen.getByText('Question 1 of 10')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByText('Question 2 of 10')).toBeInTheDocument();
  });

  it('never moves on by itself for keyboard choices', () => {
    mount({ autoAdvance: true });
    const radio = screen.getAllByRole('radio')[0];
    fireEvent.keyDown(radio, { key: 'ArrowDown' });
    fireEvent.click(radio);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('Question 1 of 10')).toBeInTheDocument();
  });

  it('does not move on by itself unless asked', () => {
    mount();
    const label = screen.getAllByRole('radio')[0].closest('label');
    fireEvent.pointerDown(label);
    fireEvent.click(screen.getAllByRole('radio')[0]);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('Question 1 of 10')).toBeInTheDocument();
  });

  it('cheers at halfway and then clears the message', () => {
    mount();
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getAllByRole('radio')[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    }
    expect(screen.getByText('Halfway there, nice work.')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3500));
    expect(screen.queryByText('Halfway there, nice work.')).not.toBeInTheDocument();
  });
});
