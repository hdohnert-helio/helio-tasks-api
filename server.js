const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const GH_TOKEN = process.env.GH_TOKEN;
const GH_REPO  = process.env.GH_REPO;
const APP_PASS  = process.env.APP_PASS;

if (!GH_TOKEN || !GH_REPO || !APP_PASS) {
  console.error('Missing required environment variables: GH_TOKEN, GH_REPO, APP_PASS');
}

const GH_API = `https://api.github.com/repos/${GH_REPO}/contents/data/tasks.json`;
const GH_HEADERS = {
  Authorization: `token ${GH_TOKEN}`,
  Accept: 'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
};

// Simple password check middleware
function requireAuth(req, res, next) {
  const pass = req.headers['x-app-password'];
  if (!pass || pass !== APP_PASS) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// GET /tasks — fetch tasks from GitHub
app.get('/tasks', requireAuth, async (req, res) => {
  try {
    const r = await fetch(GH_API, { headers: GH_HEADERS });
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    const json = await r.json();
    const tasks = JSON.parse(Buffer.from(json.content, 'base64').toString('utf8'));
    res.json({ tasks, sha: json.sha });
  } catch (e) {
    console.error('GET error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PUT /tasks — save tasks to GitHub
app.put('/tasks', requireAuth, async (req, res) => {
  try {
    const { tasks, sha } = req.body;
    if (!tasks) return res.status(400).json({ error: 'Missing tasks' });
    const content = Buffer.from(JSON.stringify(tasks, null, 2)).toString('base64');
    const body = { message: 'Update tasks', content, ...(sha ? { sha } : {}) };
    const r = await fetch(GH_API, { method: 'PUT', headers: GH_HEADERS, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    const json = await r.json();
    res.json({ sha: json.content.sha });
  } catch (e) {
    console.error('PUT error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Health check
app.get('/', (req, res) => res.send('Helio Solar Task API — OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
