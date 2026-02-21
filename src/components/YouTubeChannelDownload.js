import { useState } from 'react';
import './YouTubeChannelDownload.css';

const API = process.env.REACT_APP_API_URL || '';

export default function YouTubeChannelDownload() {
  const [url, setUrl] = useState('https://www.youtube.com/@veritasium');
  const [maxVideos, setMaxVideos] = useState(10);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleDownload = async () => {
    setError('');
    setResult(null);
    setLoading(true);
    setProgress(10);
    try {
      const res = await fetch(`${API}/api/youtube/channel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), maxVideos: Math.min(100, Math.max(1, maxVideos)) }),
      });
      setProgress(90);
      const data = await res.json();
      if (!res.ok) {
        if (data.sample && data.error) {
          setError(data.error + ' Using sample data from public/veritasium_channel.json.');
          try {
            const sampleRes = await fetch('/veritasium_channel.json');
            if (sampleRes.ok) setResult(await sampleRes.json());
          } catch {}
        } else {
          setError(data.error || 'Download failed');
        }
        setLoading(false);
        setProgress(0);
        return;
      }
      setProgress(100);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Network error');
      setResult(null);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const handleDownloadJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `channel_${(result.channel_title || 'data').replace(/\W+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="youtube-download-page">
      <div className="youtube-download-card">
        <h1>YouTube Channel Download</h1>
        <p className="youtube-download-desc">
          Enter a YouTube channel page URL to download video metadata (title, description, duration, views, likes, comments, URL). Transcript is included when available.
        </p>
        <div className="youtube-download-form">
          <input
            type="url"
            placeholder="e.g. https://www.youtube.com/@veritasium"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
          />
          <div className="youtube-download-row">
            <label>
              Max videos: <input
                type="number"
                min={1}
                max={100}
                value={maxVideos}
                onChange={(e) => setMaxVideos(Number(e.target.value) || 10)}
                disabled={loading}
              />
            </label>
            <button
              type="button"
              className="youtube-download-btn"
              onClick={handleDownload}
              disabled={loading}
            >
              {loading ? 'Downloading…' : 'Download Channel Data'}
            </button>
          </div>
        </div>
        {loading && (
          <div className="youtube-progress-wrap">
            <div className="youtube-progress-bar">
              <div className="youtube-progress-fill" style={{ width: `${progress || 30}%` }} />
            </div>
          </div>
        )}
        {error && <p className="youtube-download-error">{error}</p>}
        {result && (
          <div className="youtube-result">
            <p className="youtube-result-meta">
              <strong>{result.channel_title}</strong> — {result.video_count} videos
            </p>
            <button type="button" className="youtube-download-json-btn" onClick={handleDownloadJson}>
              Download JSON file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
