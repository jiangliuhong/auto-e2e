import { describe, expect, it, vi } from 'vitest';
import { renderDashboardHtml } from '../../src/server/web-ui.js';
import { fitEmbeddedLiveView } from '../../src/server/live-view-html.js';

function fullscreenHarness(supported = true) {
  const nodes = new Map<string, {
    textContent: string; disabled: boolean; title: string;
    setAttribute: ReturnType<typeof vi.fn>; classList: { remove: ReturnType<typeof vi.fn> };
    click: () => void;
    onclick?: () => Promise<void>; requestFullscreen?: () => Promise<void>;
  }>();
  for (const id of ['live-view-card', 'live-view-fullscreen', 'live-view-toggle']) {
    nodes.set(id, { textContent: '', disabled: false, title: '', setAttribute: vi.fn(), classList: { remove: vi.fn() }, click: vi.fn() });
  }
  const card = nodes.get('live-view-card')!;
  const listeners = new Map<string, (event?: { key: string; preventDefault: () => void }) => void>();
  const document = {
    fullscreenEnabled: supported,
    fullscreenElement: null as typeof card | null,
    addEventListener: (name: string, listener: (event?: { key: string; preventDefault: () => void }) => void) => listeners.set(name, listener),
    exitFullscreen: vi.fn(async () => { document.fullscreenElement = null; listeners.get('fullscreenchange')?.(); }),
  };
  card.requestFullscreen = vi.fn(async () => { document.fullscreenElement = card; listeners.get('fullscreenchange')?.(); });
  const toast = vi.fn();
  const html = renderDashboardHtml();
  const script = html.slice(html.indexOf('    function initLiveViewFullscreen()'), html.indexOf('    function setLiveViewStatus('));
  new Function('el', 'document', 'toast', script + '\ninitLiveViewFullscreen();')((id: string) => nodes.get(id), document, toast);
  const button = nodes.get('live-view-fullscreen')!;
  button.click = () => { void button.onclick!(); };
  return { card, button, toggle: nodes.get('live-view-toggle')!, document, toast, listeners };
}

describe('live browser fullscreen', () => {
  it('enters fullscreen from a collapsed card and exits using the button', async () => {
    const { card, button, toggle, document } = fullscreenHarness();
    await button.onclick!();
    expect(document.fullscreenElement).toBe(card);
    expect(card.classList.remove).toHaveBeenCalledWith('collapsed');
    expect(button.textContent).toBe('退出全屏');
    expect(button.setAttribute).toHaveBeenLastCalledWith('aria-pressed', 'true');
    expect(toggle.disabled).toBe(true);
    expect(toggle.textContent).toBe('收起');
    await button.onclick!();
    expect(document.exitFullscreen).toHaveBeenCalledOnce();
    expect(button.textContent).toBe('全屏');
    expect(toggle.disabled).toBe(false);
  });

  it('synchronizes the controls after browser-initiated exit (Escape)', async () => {
    const { button, document, toggle } = fullscreenHarness();
    await button.onclick!();
    await document.exitFullscreen();
    expect(button.textContent).toBe('全屏');
    expect(button.setAttribute).toHaveBeenLastCalledWith('aria-pressed', 'false');
    expect(toggle.disabled).toBe(false);
  });

  it('reports rejection without expanding the card and disables unsupported fullscreen', async () => {
    const { button, card, toast, toggle } = fullscreenHarness();
    card.requestFullscreen = vi.fn().mockRejectedValue(new Error('Permission denied'));
    await button.onclick!();
    expect(toast).toHaveBeenCalledWith('切换全屏失败：Permission denied', true);
    expect(card.classList.remove).not.toHaveBeenCalled();
    expect(button.textContent).toBe('全屏');
    expect(toggle.disabled).toBe(false);
    expect(fullscreenHarness(false).button.disabled).toBe(true);
  });

  it('handles Escape in embedded browser hosts that do not exit fullscreen themselves', async () => {
    const { button, listeners, document } = fullscreenHarness();
    const preventDefault = vi.fn();
    listeners.get('keydown')!({ key: 'Escape', preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
    await button.onclick!();
    listeners.get('keydown')!({ key: 'Escape', preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(document.exitFullscreen).toHaveBeenCalledOnce();
    expect(button.textContent).toBe('全屏');
  });
});

describe('embedded Live View layout', () => {
  it('adds contain sizing after upstream styles without changing the stream or input script', () => {
    const script = '<script>const url = location.href; const canvas = document.getElementById("screen");</script>';
    const html = '<html><head><style>canvas { width:100%; height:100%; }</style></head><body><canvas id="screen" width="1280" height="800"></canvas>' + script + '</body></html>';
    const result = fitEmbeddedLiveView(html);
    expect(result).toContain('position: absolute; inset: 0;');
    expect(result).toContain('object-fit: contain;');
    expect(result).toContain('width="1280" height="800"');
    expect(result.indexOf('auto-e2e-live-view-fit')).toBeGreaterThan(result.indexOf('canvas { width:100%'));
    expect(result.replace(/<style id="auto-e2e-live-view-fit">[\s\S]*?<\/style>/, '')).toBe(html);
  });
});
