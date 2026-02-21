import { useState } from 'react';
import Auth from './components/Auth';
import Chat from './components/Chat';
import YouTubeChannelDownload from './components/YouTubeChannelDownload';
import './App.css';

function App() {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('chatapp_user');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed.username ? parsed : { username: raw };
    } catch {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState('chat');

  const handleLogin = (userObj) => {
    const u = typeof userObj === 'object' ? userObj : { username: userObj };
    localStorage.setItem('chatapp_user', JSON.stringify(u));
    setUser(u);
    setActiveTab('chat');
  };

  const handleLogout = () => {
    localStorage.removeItem('chatapp_user');
    setUser(null);
  };

  if (!user) return <Auth onLogin={handleLogin} />;

  return (
    <div className="app-tabs">
      <div className="app-tab-bar">
        <button
          className={`app-tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          Chat
        </button>
        <button
          className={`app-tab ${activeTab === 'youtube' ? 'active' : ''}`}
          onClick={() => setActiveTab('youtube')}
        >
          YouTube Channel Download
        </button>
      </div>
      {activeTab === 'chat' && <Chat user={user} onLogout={handleLogout} />}
      {activeTab === 'youtube' && <YouTubeChannelDownload />}
    </div>
  );
}

export default App;
