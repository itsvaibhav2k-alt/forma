
import { useState } from 'react';

import { useAppController } from './useAppController';
import { DecisionSheet } from './DecisionSheet';
import { CompareBuildOptions } from '../community/components/CompareBuildOptions';

type AppView = 'compare' | 'decision';

export function App() {
  const { community, decisionSheet } = useAppController();

  const [activeView, setActiveView] = useState<AppView>('compare');

  return (
    <main>
      <header>
        <h1>Forma</h1>
        <p>
          Compare community material packages and explore
          their financial implications.
        </p>
      </header>

      <nav aria-label="Main navigation">
        <button
          type="button"
          aria-pressed={activeView === 'compare'}
          onClick={() => setActiveView('compare')}
        >
          Compare build options
        </button>

        <button
          type="button"
          aria-pressed={activeView === 'decision'}
          onClick={() => setActiveView('decision')}
        >
          Decision sheet
        </button>
      </nav>

      <hr />

      {activeView === 'compare' ? (
        <CompareBuildOptions {...community} />
      ) : (
        <DecisionSheet {...decisionSheet} />
      )}
    </main>
  );
}
