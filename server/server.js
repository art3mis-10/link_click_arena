const path = require('path');
// Automatically locates the .env file in the root folder
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('./User');
const GameManager = require('./gameRoom');

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const gameManager = new GameManager();

// Keep track of online users via sockets/login
const onlineUsers = new Set();
const usersDb = {}; // Replace with your actual database object/storage
const friendRequests = []; // [{ from: 'userA', to: 'userB' }]
const friendRelationships = []; // [{ user1: 'userA', user2: 'userB' }]


// Essential Middleware (Must be before routes)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Atlas Connected Successfully!'))
  .catch(err => console.error('Database connection error:', err));

// --- REGISTER ROUTE ---
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const userExists = await User.findOne({ username });
    if (userExists) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    const user = new User({ username, password });
    await user.save();

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET || 'fallback_secret'
    );

    return res.json({ token, username: user.username });
  } catch (err) {
    console.error('Registration Error:', err);
    return res.status(500).json({ message: err.message || 'Server error during registration' });
  }
});

// --- LOGIN ROUTE ---
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    const user = await User.findOne({ username });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET || 'fallback_secret'
    );

    return res.json({ token, username: user.username });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ message: 'Server error during login' });
  }
});

// --- REAL-TIME SOCKET.IO HANDLERS ---
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('player_login', (data) => {
    gameManager.addPlayer(socket.id, data.name);
  });

  socket.on('select_character', (char) => {
    gameManager.setPlayerCharacter(socket.id, char);
  });

  socket.on('player_move', (data) => {
    const updatedPlayer = gameManager.updatePlayerPosition(socket.id, data);
    if (updatedPlayer) {
      socket.broadcast.emit('player_moved', updatedPlayer);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    gameManager.removePlayer(socket.id);
    io.emit('player_left', socket.id);
  });
});

// --- GET USER PROFILE ---
app.get('/api/profile/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// --- UPDATE AVATAR ---
app.post('/api/profile/avatar', async (req, res) => {
  const { username, avatar } = req.body;
  try {
    const user = await User.findOneAndUpdate(
      { username },
      { avatar },
      { new: true }
    ).select('-password');
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ success: true, avatar: user.avatar });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update avatar' });
  }
});

// PROFILE ENDPOINT
app.get('/api/profile/:username', (req, res) => {
  const user = usersDb[req.params.username] || { username: req.params.username };
  const friendsCount = friendRelationships.filter(f => f.user1 === user.username || f.user2 === user.username).length;
  
  res.json({
    username: user.username,
    avatar: user.avatar || '',
    matchesPlayed: user.matchesPlayed || 0,
    friendsCount: friendsCount,
    isOnline: onlineUsers.has(user.username)
  });
});

// FRIENDS ENDPOINTS
app.get('/api/friends/list', (req, res) => {
  const { username } = req.query;
  const userFriends = friendRelationships
    .filter(f => f.user1 === username || f.user2 === username)
    .map(f => (f.user1 === username ? f.user2 : f.user1));

  const list = userFriends.map(friendName => ({
    username: friendName,
    avatar: usersDb[friendName]?.avatar || '',
    isOnline: onlineUsers.has(friendName)
  }));

  res.json(list);
});

app.get('/api/friends/search', (req, res) => {
  const { query, username } = req.query;
  const matches = Object.keys(usersDb)
    .filter(u => u.toLowerCase().includes(query.toLowerCase()) && u !== username)
    .map(u => ({ username: u, avatar: usersDb[u]?.avatar || '' }));

  res.json(matches);
});

app.post('/api/friends/request', (req, res) => {
  const { from, to } = req.body;
  if (!usersDb[to]) return res.status(404).json({ message: 'User not found' });
  
  const exists = friendRequests.some(r => r.from === from && r.to === to);
  if (!exists) friendRequests.push({ from, to });

  res.json({ message: 'Friend request sent!' });
});

app.get('/api/friends/requests', (req, res) => {
  const { username } = req.query;
  const incoming = friendRequests
    .filter(r => r.to === username)
    .map(r => ({ username: r.from, avatar: usersDb[r.from]?.avatar || '' }));

  res.json(incoming);
});

app.post('/api/friends/respond', (req, res) => {
  const { username, target, action } = req.body;
  const index = friendRequests.findIndex(r => r.from === target && r.to === username);
  if (index !== -1) friendRequests.splice(index, 1);

  if (action === 'accept') {
    friendRelationships.push({ user1: username, user2: target });
  }

  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server live at http://localhost:${PORT}`);
});