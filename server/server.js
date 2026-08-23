const path = require('path');
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

// Active tracking maps
const onlineUsers = new Map(); // username -> socketId
const activeSquads = new Map(); // hostUsername -> { host, guest, ready }

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Atlas Connected Successfully!'))
  .catch(err => console.error('Database connection error:', err));

// --- REGISTER ROUTE ---
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    if (!username || !password) return res.status(400).json({ message: 'Username and password required' });
    if (username.length < 3) return res.status(400).json({ message: 'Username must be at least 3 characters' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const userExists = await User.findOne({ username });
    if (userExists) return res.status(400).json({ message: 'Username already taken' });

    const user = new User({ username, password });
    await user.save();

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET || 'fallback_secret');
    return res.json({ token, username: user.username, avatar: user.avatar || '' });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Server error during registration' });
  }
});

// --- LOGIN ROUTE ---
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

    const user = await User.findOne({ username });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET || 'fallback_secret');
    return res.json({ token, username: user.username, avatar: user.avatar || '' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error during login' });
  }
});

// --- REAL-TIME SOCKET.IO HANDLERS ---
io.on('connection', (socket) => {
  let authenticatedUser = null;

  socket.on('player_login', (data) => {
    if (data && data.name) {
      authenticatedUser = data.name;
      onlineUsers.set(data.name, socket.id);
      
      // Auto-create individual squad room as host
      if (!activeSquads.has(data.name)) {
        activeSquads.set(data.name, { host: data.name, guest: null });
      }
      socket.join(`squad_${data.name}`);
    }
    gameManager.addPlayer(socket.id, data ? data.name : 'Guest');
  });

  // --- SQUAD & INVITE SOCKET LOGIC ---
  socket.on('send_squad_invite', async ({ targetUsername }) => {
    const recipientSocketId = onlineUsers.get(targetUsername);
    if (!recipientSocketId) return;

    const senderUser = await User.findOne({ username: authenticatedUser }).select('avatar username');
    
    io.to(recipientSocketId).emit('squad_invite_received', {
      hostUsername: authenticatedUser,
      hostAvatar: senderUser ? senderUser.avatar : ''
    });
  });

  socket.on('accept_squad_invite', async ({ hostUsername }) => {
    const squad = activeSquads.get(hostUsername);
    if (!squad) return;

    const guestUser = await User.findOne({ username: authenticatedUser }).select('username avatar');
    squad.guest = { username: guestUser.username, avatar: guestUser.avatar || '' };

    socket.join(`squad_${hostUsername}`);

    const hostUser = await User.findOne({ username: hostUsername }).select('username avatar');

    // Notify everyone in squad of updated state
    io.to(`squad_${hostUsername}`).emit('squad_updated', {
      host: { username: hostUser.username, avatar: hostUser.avatar || '' },
      guest: squad.guest,
      isHost: false
    });
  });

  socket.on('request_squad_state', async () => {
    if (!authenticatedUser) return;
    const squad = activeSquads.get(authenticatedUser);
    const hostUser = await User.findOne({ username: authenticatedUser }).select('username avatar');

    socket.emit('squad_updated', {
      host: { username: hostUser.username, avatar: hostUser.avatar || '' },
      guest: squad ? squad.guest : null,
      isHost: true
    });
  });

  socket.on('start_game_request', () => {
    if (!authenticatedUser) return;
    const squad = activeSquads.get(authenticatedUser);
    if (squad && squad.host === authenticatedUser) {
      io.to(`squad_${authenticatedUser}`).emit('game_started_by_host');
    }
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
    if (authenticatedUser) {
      onlineUsers.delete(authenticatedUser);
      if (activeSquads.has(authenticatedUser)) {
        activeSquads.delete(authenticatedUser);
      }
    }
    gameManager.removePlayer(socket.id);
    io.emit('player_left', socket.id);
  });

  socket.on('send_friend_request', (data) => {
    const targetSocketId = userSockets[data.to]; // Map target's username to their socket ID
    if (targetSocketId) {
      io.to(targetSocketId).emit('friend_request_received', { from: data.from });
    }
  });
});

// --- PROFILE & FRIENDS ENDPOINTS ---
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

app.post('/api/profile/avatar', async (req, res) => {
  const { username, avatar } = req.body;
  try {
    const user = await User.findOneAndUpdate({ username }, { avatar }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ success: true, avatar: user.avatar });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update avatar' });
  }
});

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

app.get('/api/friends/search', async (req, res) => {
  const { query, username } = req.query;
  if (!query || query.trim() === '') return res.json([]);

  try {
    const matches = await User.find({
      username: { $regex: query, $options: 'i' },
      username: { $ne: username }
    }).select('username avatar').limit(10);

    res.json(matches.map(u => ({ username: u.username, avatar: u.avatar || '' })));
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

    await User.updateOne({ username: to }, { $addToSet: { friendRequests: senderUser._id } });
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

    res.json((user.friendRequests || []).map(r => ({ username: r.username, avatar: r.avatar || '' })));
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

    await User.updateOne({ username }, { $pull: { friendRequests: targetUser._id } });

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