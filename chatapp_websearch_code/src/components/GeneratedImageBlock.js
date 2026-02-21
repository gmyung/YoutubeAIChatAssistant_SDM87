import { useState } from 'react';
import './GeneratedImageBlock.css';

export default function GeneratedImageBlock({ imageBase64, mimeType = 'image/png' }) {
  const [enlarged, setEnlarged] = useState(false);
  const src = imageBase64 ? `data:${mimeType};base64,${imageBase64}` : null;

  if (!src) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = `generated_image_${Date.now()}.${mimeType === 'image/svg+xml' ? 'svg' : 'png'}`;
    a.click();
  };

  return (
    <div className="generated-image-wrap">
      <div
        className="generated-image-inner"
        role="button"
        tabIndex={0}
        onClick={() => setEnlarged(true)}
        onKeyDown={(e) => e.key === 'Enter' && setEnlarged(true)}
      >
        <img src={src} alt="Generated" className="generated-image-img" />
        <button type="button" className="generated-image-download" onClick={(e) => { e.stopPropagation(); handleDownload(); }}>
          Download
        </button>
      </div>
      {enlarged && (
        <div className="generated-image-modal" onClick={() => setEnlarged(false)} role="dialog">
          <div className="generated-image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="generated-image-modal-close" onClick={() => setEnlarged(false)}>
              ×
            </button>
            <img src={src} alt="Generated (enlarged)" className="generated-image-modal-img" />
            <button type="button" className="generated-image-download" onClick={handleDownload}>
              Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
