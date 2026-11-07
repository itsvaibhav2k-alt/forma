import { useLayoutEffect, useRef, useState } from 'react';
import type { ReportPayload } from '../../shared';
import { DecisionSheet } from './DecisionSheet';
import './report.css';

export function ReportPreview({ report }: { report: ReportPayload }) {
  const frame = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(false);
  useLayoutEffect(() => {
    const sheet = frame.current?.querySelector<HTMLElement>('.decision-sheet');
    if (!sheet) return;
    const measure = () => setFits(sheet.scrollHeight <= 10.3 * 96 && sheet.scrollWidth <= 7.5 * 96 + 1);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(sheet);
    return () => observer?.disconnect();
  }, [report]);
  function downloadSnapshot() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `forma-decision-${report.reportId}.json`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="report-preview">
    <div className="report-actions"><div><h2>Captured decision sheet</h2><p>This sheet keeps the selected trial and inputs from capture time. Later edits do not change it.</p><p>Print: US Letter, portrait, 100% scale, browser headers and footers off. Choose Save as PDF in the print dialog.</p></div><div className="report-action-buttons"><button type="button" className="primary-button" disabled={!fits} onClick={() => window.print()}>Print / Save PDF</button><button type="button" className="outline-button" onClick={downloadSnapshot}>Download snapshot JSON</button></div></div>
    {!fits && <p className="report-overflow" role="alert">This snapshot exceeds one Letter page. Shorten scope, source references or notes and capture a new sheet. All content remains visible here and in the JSON download.</p>}
    <div className="report-paper-scroll" ref={frame}><DecisionSheet report={report} /></div>
  </div>;
}
