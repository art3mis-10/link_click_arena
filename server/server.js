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

    return res.json({ token, username: user.username, avatar: user.avatar || '' });
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

    return res.json({ token, username: user.username, avatar: user.avatar || '' });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ message: 'Server error during login' });
  }
});

// --- REAL-TIME SOCKET.IO HANDLERS ---
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('player_login', (data) => {
    if (data && data.name) {
      onlineUsers.add(data.name);
    }
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
    const player = gameManager.players ? gameManager.players[socket.id] : null;
    if (player && player.name) {
      onlineUsers.delete(player.name);
    }
    gameManager.removePlayer(socket.id);
    io.emit('player_left', socket.id);
  });
});

// --- GET USER PROFILE ---
app.get('/api/profile/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      username: user.username,
      avatar: user.avatar || '',
      matchesPlayed: user.matchesPlayed || 0,
      friendsCount: user.friends ? user.friends.length : 0,
      isOnline: onlineUsers.has(user.username)
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching profile' });
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

// --- FRIENDS ENDPOINTS ---
app.get('/api/friends/list', async (req, res) => {
  const { username } = req.query;
  try {
    const user = await User.findOne({ username }).populate('friends', 'username avatar');
    if (!user) return res.json([]);

    const list = (user.friends || []).map(friend => ({
      username: friend.username,
      avatar: friend.avatar || '',
      isOnline: onlineUsers.has(friend.username)
    }));

    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load friends list' });
  }
});

// SEARCH USERS IN MONGO DB
app.get('/api/friends/search', async (req, res) => {
  const { query, username } = req.query;
  if (!query || query.trim() === '') return res.json([]);

  try {
    const matches = await User.find({
      username: { $regex: query, $options: 'i' },
      username: { $ne: username }
    })
    .select('username avatar')
    .limit(10);

    const formatted = matches.map(u => ({
      username: u.username,
      avatar: u.avatar || ''
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: 'Failed to search users' });
  }
});

app.post('/api/friends/request', async (req, res) => {
  const { from, to } = req.body;
  try {
    const targetUser = await User.findOne({ username: to });
    const senderUser = await User.findOne({ username: from });

    if (!targetUser || !senderUser) return res.status(404).json({ message: 'User not found' });

    await User.updateOne(
      { username: to },
      { $addToSet: { friendRequests: senderUser._id } }
    );

    res.json({ message: 'Friend request sent!' });
  } catch (err) {
    res.status(500).json({ message: 'Error sending friend request' });
  }
});

app.get('/api/friends/requests', async (req, res) => {
  const { username } = req.query;
  try {
    const user = await User.findOne({ username }).populate('friendRequests', 'username avatar');
    if (!user) return res.json([]);

    const incoming = (user.friendRequests || []).map(r => ({
      username: r.username,
      avatar: r.avatar || ''
    }));

    res.json(incoming);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load requests' });
  }
});

app.post('/api/friends/respond', async (req, res) => {
  const { username, target, action } = req.body;
  try {
    const user = await User.findOne({ username });
    const targetUser = await User.findOne({ username: target });

    if (!user || !targetUser) return res.status(404).json({ message: 'User not found' });

    // Remove from incoming requests
    await User.updateOne(
      { username },
      { $pull: { friendRequests: targetUser._id } }
    );

    if (action === 'accept') {
      await User.updateOne({ username }, { $addToSet: { friends: targetUser._id } });
      await User.updateOne({ username: target }, { $addToSet: { friends: user._id } });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Error responding to friend request' });
  }
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server live at http://localhost:${PORT}`);
});