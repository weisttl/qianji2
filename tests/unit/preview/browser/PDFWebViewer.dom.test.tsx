import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PDFPreview from '@/renderer/pages/conversation/Preview/components/viewers/PDFViewer';
import { reloadViaViewer } from '@/renderer/pages/conversation/Preview/context/tabReloaderRegistry';

const { translate } = vi.hoisted(() => ({ translate: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: translate }) }));
vi.mock('@/renderer/utils/platform', () => ({ isElectronDesktop: () => false }));
vi.mock('@/renderer/pages/conversation/Preview/previewUrls', () => ({
  buildPdfSrc: (fileRef?: unknown, content?: string) => (fileRef ? '/api/files/stream' : content || ''),
}));

describe('PDF preview in a browser', () => {
  it('uses the browser PDF viewer without native system-app actions', () => {
    const { container } = render(<PDFPreview content='blob:example' file_path='/server/report.pdf' />);
    const frame = screen.getByTitle('preview.pdf.title');
    expect(frame).toHaveAttribute('src', 'blob:example');
    fireEvent.load(frame);
    expect(screen.queryByText('preview.loading')).not.toBeInTheDocument();
    expect(container.querySelector('webview')).toBeNull();
    expect(screen.queryByTitle('preview.openInSystemApp')).not.toBeInTheDocument();
  });

  it('loads server files through their stream URL', () => {
    render(<PDFPreview fileRef={{ kind: 'project', pe_id: 'project-1', relative_path: 'report.pdf' }} />);
    expect(screen.getByTitle('preview.pdf.title')).toHaveAttribute('src', '/api/files/stream');
  });

  it('shows a missing-document error instead of opening a server path', () => {
    render(<PDFPreview file_path='/server/missing.pdf' />);
    expect(screen.getByText(/preview.pdf.pathMissing/)).toBeInTheDocument();
    expect(screen.queryByTitle('preview.pdf.title')).not.toBeInTheDocument();
  });

  it('refreshes the browser viewer and removes its refresh handler on unmount', () => {
    const { unmount } = render(<PDFPreview tabId='pdf-1' content='blob:example' />);
    const oldFrame = screen.getByTitle('preview.pdf.title');
    fireEvent.load(oldFrame);
    act(() => {
      expect(reloadViaViewer('pdf-1')).toBe(true);
    });
    expect(screen.getByTitle('preview.pdf.title')).not.toBe(oldFrame);
    unmount();
    expect(reloadViaViewer('pdf-1')).toBe(false);
  });
});
