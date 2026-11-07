// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnalysisError, RankBraces } from '../shared';
import { rankBraces } from '../structures';
import { App } from './App';

afterEach(cleanup);
const failure: AnalysisError = { status: 'error', code: 'UNSTABLE', message: 'The structure is unstable.', nodeIds: ['B2'], memberIds: [] };

describe('live experiment', () => {
  it('hides computed results and does not solve until a legal prediction is committed', async () => {
    const user = userEvent.setup();
    const ranker = vi.fn(rankBraces);
    const { container } = render(<App ranker={ranker} />);
    await user.click(screen.getByRole('button', { name: 'Structural' }));
    expect(screen.getByRole('button', { name: 'Commit prediction' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Decision sheet/ })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'P2' }));
    await user.click(screen.getByRole('radio', { name: 'B2 Center' }));
    expect(container.querySelector('.bridge-svg')).toHaveAttribute('data-structural-plate', 'model');
    expect(container.querySelector('.bridge-svg')).toHaveTextContent('10 joints / 18 members');
    expect(container.querySelectorAll('[data-planar-panel]')).toHaveLength(4);
    expect(screen.getByText('Results hidden')).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-analysis-trace], [data-overlay="member-probe"]')).toHaveLength(0);
    expect(screen.queryByText(/0\.069936|10\.46/)).not.toBeInTheDocument();
    expect(ranker).not.toHaveBeenCalled();
  });

  it('commits P2/B1 once, retests at B2 with ties, and restores the first result', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Structural' }));
    await user.click(screen.getByRole('radio', { name: 'P2' }));
    await user.dblClick(screen.getByRole('button', { name: 'Commit prediction' }));
    expect(screen.getByRole('status')).toHaveTextContent('P2 ranks 4 of 4 at B1. Reduction 1.09%. Best: P1.');
    expect(screen.getByRole('heading', { name: 'Your trials 01' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'P2' })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'B2 Center' }));
    const retest = screen.getByRole('region', { name: 'Same-brace retest' });
    expect(retest).toHaveTextContent('0.069936');
    expect(retest).toHaveTextContent('0.062624');
    expect(retest).toHaveTextContent('10.46%');
    expect(retest).toHaveTextContent('Tied best: P2 + P3');
    expect(screen.getByRole('region', { name: 'Saved prediction: P2 at B1' })).toHaveTextContent('1.09%');
    expect(screen.getByRole('heading', { name: 'Your trials 01' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Show saved result' }));
    expect(screen.queryByRole('heading', { name: 'Same-brace retest' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'B1 Left' })).toBeChecked();
    expect(screen.getByRole('region', { name: 'Your prediction, tested' })).toHaveTextContent('1.09%');
    expect(screen.getByRole('status')).toHaveTextContent('Best: P1');
  });

  it('supports keyboard load and panel selection, commit and retest', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Structural' }));
    screen.getByRole('slider', { name: 'Load position on bridge' }).focus();
    await user.keyboard('{End}{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'B2 Center' })).toBeChecked();
    screen.getByRole('radio', { name: 'P1' }).focus();
    await user.keyboard(' {ArrowRight}');
    expect(screen.getByRole('radio', { name: 'P2' })).toBeChecked();
    screen.getByRole('button', { name: 'Commit prediction' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('Tied best: P2 and P3');
    screen.getByRole('slider', { name: 'Load position on bridge' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('heading', { name: 'Same-brace retest' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'P2' })).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('at B3');
  });

  it('hides new-round results, keeps multiple trials, and preserves them across navigation', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Structural' }));
    await user.click(screen.getByRole('radio', { name: 'P2' }));
    await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
    await user.click(screen.getByRole('button', { name: 'Start another prediction' }));
    expect(screen.getByRole('button', { name: 'Commit prediction' })).toBeDisabled();
    expect(screen.getByText('Results hidden')).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'P4' }));
    await user.click(screen.getByRole('radio', { name: 'B3 Right' }));
    await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
    expect(screen.getByRole('heading', { name: 'Your trials 02' })).toBeVisible();
    screen.getByRole('button', { name: 'Build costs' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getAllByText('No quote entered')).toHaveLength(2);
    expect(screen.queryByText(/19,000|21,000|234\.46/)).not.toBeInTheDocument();
    screen.getByRole('button', { name: 'Workbench' }).focus();
    await user.keyboard(' ');
    expect(screen.getByRole('region', { name: 'Your prediction, tested' })).toHaveTextContent('26.34%');
    await user.click(screen.getByRole('button', { name: /Trial 01 · Load B1 · Brace P2/ }));
    expect(screen.getByRole('status')).toHaveTextContent('P2 ranks 4 of 4 at B1');
    expect(screen.getByRole('heading', { name: 'Your trials 02' })).toBeVisible();
  });

  it('uses one magnification for both overlays and offers signed forces beyond color', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Structural' }));
    await user.click(screen.getByRole('radio', { name: 'P1' }));
    await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
    expect(screen.getByText('Displacements ×250 for both')).toBeVisible();
    expect(container.querySelector('.bridge-svg')).toHaveAttribute('data-structural-plate', 'deformation');
    expect(container.querySelectorAll('[data-member-id]')).toHaveLength(18);
    expect(container.querySelector('[data-analysis-trace]')).toHaveTextContent('Deck displacement');
    await user.click(screen.getByText('Structural overlays and comparison'));
    await user.click(screen.getByRole('radio', { name: 'Original' }));
    expect(container.querySelectorAll('[data-member-id]')).toHaveLength(0);
    expect(container.querySelector('.bridge-svg')).toHaveAttribute('data-structural-plate', 'deformation');
    await user.click(screen.getByRole('checkbox', { name: 'Deformed shape' }));
    expect(container.querySelector('.bridge-svg')).toHaveAttribute('data-structural-plate', 'model');
    expect(container.querySelector('[data-analysis-trace="deformation"]')).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'Axial force colors' }));
    expect(screen.getByText('Tension (+)')).toBeVisible();
    await user.click(screen.getByText('All placements, member forces and reactions'));
    await user.click(screen.getByText('Member forces and support reactions'));
    const forces = screen.getByRole('table', { name: 'Axial member forces for load B1' });
    expect(within(forces).getAllByText(/N · tension/).length).toBeGreaterThan(0);
    expect(within(forces).getAllByText(/N · compression/).length).toBeGreaterThan(0);
    expect(screen.getByRole('table', { name: 'Support reactions in N' })).toBeVisible();
  });

  it('clears active results after retest failure, retains the original, and can retry', async () => {
    const user = userEvent.setup();
    const ranker = vi.fn<RankBraces>().mockImplementationOnce(rankBraces).mockReturnValueOnce(failure).mockImplementation(rankBraces);
    const { container } = render(<App ranker={ranker} />);
    await user.click(screen.getByRole('button', { name: 'Structural' }));
    await user.click(screen.getByRole('radio', { name: 'P2' }));
    await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
    await user.click(screen.getByRole('radio', { name: 'B2 Center' }));
    expect(screen.getByRole('alert')).toHaveTextContent('The structure is unstable.');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(container.querySelector('[data-analysis-trace], [data-overlay="member-probe"]')).toBeNull();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.getByRole('region', { name: 'Saved prediction: P2 at B1' })).toHaveTextContent('1.09%');
    await user.click(screen.getByRole('button', { name: 'Retry retest' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('10.46%');
  });

  it('records no trial on a failed commit and supports a successful retry', async () => {
    const user = userEvent.setup();
    const ranker = vi.fn<RankBraces>().mockReturnValueOnce(failure).mockImplementation(rankBraces);
    render(<App ranker={ranker} />);
    await user.click(screen.getByRole('button', { name: 'Structural' }));
    await user.click(screen.getByRole('radio', { name: 'P2' }));
    await user.click(screen.getByRole('button', { name: 'Commit prediction' }));
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Your trials 00' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'P2' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Retry prediction' }));
    expect(screen.getByRole('heading', { name: 'Your trials 01' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
