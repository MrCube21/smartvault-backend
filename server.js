const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Dev-Token'],
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log('Headers:', {
    'x-dev-token': req.headers['x-dev-token'],
    'authorization': req.headers['authorization'] ? 'Bearer ***' : undefined,
  });
  next();
});

// In-memory storage (replace with database later)
let items = [];
let categories = new Set();

// Auth middleware - accept dev token
const authenticate = (req, res, next) => {
  const devToken = req.headers['x-dev-token'];
  const authHeader = req.headers.authorization;
  
  if (devToken === 'dev') {
    // Dev mode - set mock user
    req.user = {
      id: 'dev-user-123',
      email: 'dev@smartvault.app',
      name: 'Dev User'
    };
    return next();
  }
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // In production, verify JWT token here
    // For now, accept any token
    req.user = { id: 'user-123', email: 'user@example.com', name: 'User' };
    return next();
  }
  
  return res.status(401).json({ error: 'Unauthorized' });
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'SmartVault Backend API' });
});

// Auth endpoints
app.post('/api/login/google', (req, res) => {
  // Mock login - return a token
  res.json({
    token: 'mock-jwt-token',
    user: {
      id: 'user-123',
      email: 'user@example.com',
      name: 'Test User'
    }
  });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Items endpoints
app.get('/api/items', authenticate, (req, res) => {
  res.json({ items });
});

app.post('/api/save-link', authenticate, async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  // Mock AI processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const newItem = {
    id: Date.now().toString(),
    type: 'link',
    url,
    title: new URL(url).hostname,
    summary: `AI-generated summary for ${url}`,
    category: 'Technology',
    createdAt: new Date().toISOString(),
    userId: req.user.id,
  };
  
  items.push(newItem);
  categories.add(newItem.category);
  
  res.json({ success: true, item: newItem });
});

app.post('/api/save-note', authenticate, async (req, res) => {
  const { text } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }
  
  // Mock AI processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const newItem = {
    id: Date.now().toString(),
    type: 'note',
    text,
    summary: `AI-generated summary: ${text.substring(0, 50)}...`,
    category: 'Personal',
    createdAt: new Date().toISOString(),
    userId: req.user.id,
  };
  
  items.push(newItem);
  categories.add(newItem.category);
  
  res.json({ success: true, item: newItem });
});

app.get('/api/categories', authenticate, (req, res) => {
  res.json({ categories: Array.from(categories) });
});

app.delete('/api/items/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const index = items.findIndex(item => item.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }
  
  items.splice(index, 1);
  res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SmartVault Backend running on http://localhost:${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Also accessible via: http://127.0.0.1:${PORT}`);
});

