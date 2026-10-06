import { rotateCamera, zoomCamera } from '../scene/CameraRig';

export function Controls() {
  return (
    <div className="controls">
      <div className="controls-buttons panel">
        <button className="icon-btn" onClick={() => rotateCamera(-1)} aria-label="Rotate left">
          <svg width="22" height="22" viewBox="0 0 24 24"><path d="M5 9a8 8 0 1 1 1.2 8" fill="none" stroke="#3b2b2b" strokeWidth="3" strokeLinecap="round" /><path d="M3 4v6h6" fill="none" stroke="#3b2b2b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button className="icon-btn" onClick={() => zoomCamera(1 / 1.25)} aria-label="Zoom out">
          <svg width="22" height="22" viewBox="0 0 24 24"><path d="M6 12h12" stroke="#3b2b2b" strokeWidth="3.4" strokeLinecap="round" /></svg>
        </button>
        <button className="icon-btn" onClick={() => zoomCamera(1.25)} aria-label="Zoom in">
          <svg width="22" height="22" viewBox="0 0 24 24"><path d="M6 12h12M12 6v12" stroke="#3b2b2b" strokeWidth="3.4" strokeLinecap="round" /></svg>
        </button>
        <button className="icon-btn" onClick={() => rotateCamera(1)} aria-label="Rotate right">
          <svg width="22" height="22" viewBox="0 0 24 24" style={{ transform: 'scaleX(-1)' }}><path d="M5 9a8 8 0 1 1 1.2 8" fill="none" stroke="#3b2b2b" strokeWidth="3" strokeLinecap="round" /><path d="M3 4v6h6" fill="none" stroke="#3b2b2b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      <div className="controls-hint">
        <span><kbd>Drag</kbd> pan</span>
        <span><kbd>Scroll</kbd> zoom</span>
        <span><kbd>Q</kbd><kbd>E</kbd> rotate</span>
      </div>
    </div>
  );
}
