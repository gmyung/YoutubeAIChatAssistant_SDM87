import './PlayVideoCard.css';

export default function PlayVideoCard({ title, thumbnail_url, video_url }) {
  const openVideo = () => {
    if (video_url) window.open(video_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="play-video-wrap">
      <div
        className="play-video-card"
        role="button"
        tabIndex={0}
        onClick={openVideo}
        onKeyDown={(e) => e.key === 'Enter' && openVideo()}
      >
        {thumbnail_url && (
          <div className="play-video-thumb">
            <img src={thumbnail_url} alt="" />
            <span className="play-video-badge">▶ Play on YouTube</span>
          </div>
        )}
        <div className="play-video-title">{title || 'Video'}</div>
      </div>
    </div>
  );
}
