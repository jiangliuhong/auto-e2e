// Keep the streamed canvas inside its available space. Its intrinsic bitmap
// dimensions must not become a flex minimum when the viewer is embedded.
// BetterWright already maps pointer coordinates through object-fit: contain.
export function fitEmbeddedLiveView(html: string): string {
  const style = `<style id="auto-e2e-live-view-fit">
    #win { min-width: 0; min-height: 0; }
    #main { min-width: 0; min-height: 0; overflow: hidden; }
    #viewport { overflow: hidden; }
    #viewport > canvas#screen {
      position: absolute; inset: 0; display: block;
      width: 100%; height: 100%; min-width: 0; min-height: 0;
      object-fit: contain;
    }
  </style>`;
  return html.replace(/<\/head>/i, `${style}</head>`);
}
