const path = require('path');

// Load .env from project root (same folder as package.json), not cwd
const envPath = path.join(__dirname, '..', '.env');
const result = require('dotenv').config({ path: envPath });

if (result.error) {
  console.error(".env load failed:", result.error.message);
  console.error("Tried path:", envPath);
} else {
  console.log(".env loaded from:", envPath);
}

console.log("URI from ENV:", process.env.REACT_APP_MONGODB_URI ? "(set)" : "(missing)");

const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const URI = process.env.REACT_APP_MONGODB_URI || process.env.MONGODB_URI || process.env.REACT_APP_MONGO_URI;
const DB = 'chatapp';

let db;

async function connect() {
  const client = await MongoClient.connect(URI);
  db = client.db(DB);
  console.log('MongoDB connected');
}

app.get('/', (req, res) => {
  res.send(`
    <html>
      <body style="font-family:sans-serif;padding:2rem;background:#00356b;color:white;min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0">
        <div style="text-align:center">
          <h1>Chat API Server</h1>
          <p>Backend is running. Use the React app at <a href="http://localhost:3000" style="color:#ffd700">localhost:3000</a></p>
          <p><a href="/api/status" style="color:#ffd700">Check DB status</a></p>
        </div>
      </body>
    </html>
  `);
});

app.get('/api/status', async (req, res) => {
  try {
    const usersCount = await db.collection('users').countDocuments();
    const sessionsCount = await db.collection('sessions').countDocuments();
    res.json({ usersCount, sessionsCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Users ────────────────────────────────────────────────────────────────────

app.post('/api/users', async (req, res) => {
  try {
    const { username, password, email, firstName, lastName } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password required' });
    const name = String(username).trim().toLowerCase();
    const existing = await db.collection('users').findOne({ username: name });
    if (existing) return res.status(400).json({ error: 'Username already exists' });
    const hashed = await bcrypt.hash(password, 10);
    await db.collection('users').insertOne({
      username: name,
      password: hashed,
      email: email ? String(email).trim().toLowerCase() : null,
      firstName: firstName ? String(firstName).trim() : null,
      lastName: lastName ? String(lastName).trim() : null,
      createdAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password required' });
    const name = username.trim().toLowerCase();
    const user = await db.collection('users').findOne({ username: name });
    if (!user) return res.status(401).json({ error: 'User not found' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid password' });
    res.json({
      ok: true,
      username: name,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Sessions ─────────────────────────────────────────────────────────────────

app.get('/api/sessions', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'username required' });
    const sessions = await db
      .collection('sessions')
      .find({ username })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(
      sessions.map((s) => ({
        id: s._id.toString(),
        agent: s.agent || null,
        title: s.title || null,
        createdAt: s.createdAt,
        messageCount: (s.messages || []).length,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const { username, agent } = req.body;
    if (!username) return res.status(400).json({ error: 'username required' });
    const { title } = req.body;
    const result = await db.collection('sessions').insertOne({
      username,
      agent: agent || null,
      title: title || null,
      createdAt: new Date().toISOString(),
      messages: [],
    });
    res.json({ id: result.insertedId.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
  try {
    await db.collection('sessions').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/sessions/:id/title', async (req, res) => {
  try {
    const { title } = req.body;
    await db.collection('sessions').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { title } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── YouTube channel data (optional: set YOUTUBE_API_KEY in .env) ──────────────

function parseChannelUrl(url) {
  if (!url || typeof url !== 'string') return { type: 'unknown', value: null };
  const u = url.trim();
  const channelIdMatch = u.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/);
  if (channelIdMatch) return { type: 'channelId', value: channelIdMatch[1] };
  const handleMatch = u.match(/youtube\.com\/@([a-zA-Z0-9_.-]+)/);
  if (handleMatch) return { type: 'handle', value: handleMatch[1] };
  const userMatch = u.match(/youtube\.com\/user\/([a-zA-Z0-9_-]+)/);
  if (userMatch) return { type: 'username', value: userMatch[1] };
  return { type: 'unknown', value: null };
}

async function resolveChannelId(apiKey, parsed) {
  if (parsed.type === 'channelId') return parsed.value;
  const base = 'https://www.googleapis.com/youtube/v3';
  if (parsed.type === 'handle') {
    const r = await fetch(
      `${base}/search?part=snippet&type=channel&q=@${encodeURIComponent(parsed.value)}&key=${apiKey}`
    );
    const data = await r.json();
    const ch = data.items?.[0];
    if (ch?.snippet?.channelId) return ch.snippet.channelId;
  }
  if (parsed.type === 'username') {
    const r = await fetch(
      `${base}/channels?part=id&forUsername=${encodeURIComponent(parsed.value)}&key=${apiKey}`
    );
    const data = await r.json();
    if (data.items?.[0]?.id) return data.items[0].id;
  }
  return null;
}

function parseDuration(iso) {
  if (!iso) return 0;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const h = parseInt(match?.[1] || '0', 10);
  const m = parseInt(match?.[2] || '0', 10);
  const s = parseInt(match?.[3] || '0', 10);
  return h * 3600 + m * 60 + s;
}

app.post('/api/youtube/channel', async (req, res) => {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY || process.env.REACT_APP_YOUTUBE_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: 'YouTube API key not configured. Add YOUTUBE_API_KEY to .env',
        sample: true,
      });
    }
    const { url, maxVideos = 10 } = req.body;
    const max = Math.min(Math.max(parseInt(maxVideos, 10) || 10, 1), 100);
    const parsed = parseChannelUrl(url);
    if (!parsed.value) {
      return res.status(400).json({ error: 'Invalid channel URL. Use e.g. https://www.youtube.com/@veritasium' });
    }
    const channelId = await resolveChannelId(apiKey, parsed);
    if (!channelId) {
      return res.status(400).json({ error: 'Could not resolve channel. Check the URL.' });
    }
    const base = 'https://www.googleapis.com/youtube/v3';
    const chRes = await fetch(
      `${base}/channels?part=snippet,contentDetails&id=${channelId}&key=${apiKey}`
    );
    const chData = await chRes.json();
    const uploadsId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsId) {
      return res.status(400).json({ error: 'Channel has no uploads playlist.' });
    }
    const channelTitle = chData.items?.[0]?.snippet?.title || 'Unknown';
    const videoIds = [];
    let nextPageToken = '';
    do {
      const listRes = await fetch(
        `${base}/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=${Math.min(50, max - videoIds.length)}&pageToken=${encodeURIComponent(nextPageToken)}&key=${apiKey}`
      );
      const listData = await listRes.json();
      for (const item of listData.items || []) {
        const vid = item.snippet?.resourceId?.videoId;
        if (vid) videoIds.push(vid);
        if (videoIds.length >= max) break;
      }
      nextPageToken = listData.nextPageToken || '';
    } while (nextPageToken && videoIds.length < max);
    const ids = videoIds.slice(0, max);
    const videos = [];
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      const vRes = await fetch(
        `${base}/videos?part=snippet,contentDetails,statistics&id=${batch.join(',')}&key=${apiKey}`
      );
      const vData = await vRes.json();
      for (const v of vData.items || []) {
        const stat = v.statistics || {};
        videos.push({
          video_id: v.id,
          title: v.snippet?.title || '',
          description: (v.snippet?.description || '').slice(0, 5000),
          duration_seconds: parseDuration(v.contentDetails?.duration),
          published_at: v.snippet?.publishedAt || null,
          view_count: parseInt(stat.viewCount, 10) || 0,
          like_count: parseInt(stat.likeCount, 10) || 0,
          comment_count: parseInt(stat.commentCount, 10) || 0,
          video_url: `https://www.youtube.com/watch?v=${v.id}`,
          thumbnail_url: v.snippet?.thumbnails?.high?.url || v.snippet?.thumbnails?.default?.url || '',
          transcript: null,
        });
      }
    }
    const payload = {
      channel_id: channelId,
      channel_title: channelTitle,
      channel_url: url,
      fetched_at: new Date().toISOString(),
      video_count: videos.length,
      videos: videos.sort((a, b) => new Date(b.published_at) - new Date(a.published_at)),
    };
    const isVeritasium = /veritasium/i.test(channelTitle) || /veritasium/i.test(url);
    if (isVeritasium && db) {
      const fs = require('fs');
      const publicDir = path.join(__dirname, '..', 'public');
      const outPath = path.join(publicDir, 'veritasium_channel.json');
      try {
        fs.mkdirSync(publicDir, { recursive: true });
        fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
        console.log('[YouTube] Wrote', outPath);
      } catch (e) {
        console.warn('[YouTube] Could not write to public:', e.message);
      }
    }
    res.json(payload);
  } catch (err) {
    console.error('[YouTube]', err);
    res.status(500).json({ error: err.message || 'Failed to fetch channel data' });
  }
});

// ── Image generation (for generateImage tool) ─────────────────────────────────
// Uses Gemini's image generation when available; otherwise returns placeholder.

app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, imageBase64, mimeType } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt required' });
    }
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const parts = [{ text: `Generate an image: ${prompt}. Respond with a detailed description only; the client will render a placeholder.` }];
    if (imageBase64 && mimeType) {
      parts.push({ inlineData: { mimeType: mimeType || 'image/png', data: imageBase64 } });
    }
    const result = await model.generateContent(parts);
    const text = result.response.text();
    const hasImage = result.response.candidates?.[0]?.content?.parts?.some(
      (p) => p.inlineData && p.inlineData.data
    );
    if (hasImage) {
      const part = result.response.candidates[0].content.parts.find((p) => p.inlineData);
      return res.json({
        imageBase64: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'image/png',
        description: text?.slice(0, 200),
      });
    }
    const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect fill="#1e293b" width="400" height="300"/><text x="200" y="155" fill="#94a3b8" text-anchor="middle" font-size="14" font-family="sans-serif">Generated: ${(prompt || '').slice(0, 40)}…</text></svg>`;
    const placeholderBase64 = Buffer.from(placeholderSvg).toString('base64');
    res.json({
      imageBase64: placeholderBase64,
      mimeType: 'image/svg+xml',
      description: text?.slice(0, 200) || prompt,
    });
  } catch (err) {
    console.error('[generate-image]', err);
    res.status(500).json({ error: err.message || 'Image generation failed' });
  }
});

// ── Messages ─────────────────────────────────────────────────────────────────

app.post('/api/messages', async (req, res) => {
  try {
    const { session_id, role, content, imageData, charts, toolCalls } = req.body;
    if (!session_id || !role || content === undefined)
      return res.status(400).json({ error: 'session_id, role, content required' });
    const msg = {
      role,
      content,
      timestamp: new Date().toISOString(),
      ...(imageData && {
        imageData: Array.isArray(imageData) ? imageData : [imageData],
      }),
      ...(charts?.length && { charts }),
      ...(toolCalls?.length && { toolCalls }),
    };
    await db.collection('sessions').updateOne(
      { _id: new ObjectId(session_id) },
      { $push: { messages: msg } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    const doc = await db
      .collection('sessions')
      .findOne({ _id: new ObjectId(session_id) });
    const raw = doc?.messages || [];
    const msgs = raw.map((m, i) => {
      const arr = m.imageData
        ? Array.isArray(m.imageData)
          ? m.imageData
          : [m.imageData]
        : [];
      return {
        id: `${doc._id}-${i}`,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        images: arr.length
          ? arr.map((img) => ({ data: img.data, mimeType: img.mimeType }))
          : undefined,
        charts: m.charts?.length ? m.charts : undefined,
        toolCalls: m.toolCalls?.length ? m.toolCalls : undefined,
      };
    });
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

connect()
  .then(() => {
    console.log("Success!");
    app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("Auth failed because:", err.message);
    process.exit(1);
  });
