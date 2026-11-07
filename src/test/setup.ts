import '@testing-library/jest-dom/vitest';

// jsdom has no scrolling viewport; navigation still exercises the view changes.
if (typeof window !== 'undefined') window.scrollTo = () => {};
