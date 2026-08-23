const socket = io();
let selectedCharacter = 'cheng_xiaoshi';
let playerName = '';
let authToken = '';
let userAvatar = '';
let isSquadHost = true;

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  document.getElementById(screenId).style.display = 'flex';
}

// --- AUTHENTICATION HANDLERS ---
async function handleRegister() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!username || !password) return showError('Please enter both username and password');

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!res.ok) return showError(data.message || 'Registration failed');

    authToken = data.token;
    playerName = data.username;
    userAvatar = data.avatar || '';
    onAuthSuccess(data.avatar);
  } catch (err) {
    showError('Server connection error');
  }
}

async function handleLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!username || !password) return showError('Please enter both username and password');

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!res.ok) return showError(data.message || 'Login failed');

    authToken = data.token;
    playerName = data.username;
    userAvatar = data.avatar || '';
    onAuthSuccess(data.avatar);
  } catch (err) {
    showError('Server connection error');
  }
}

function showError(msg) {
  const errorEl = document.getElementById('auth-error');
  if (errorEl) {
    errorEl.innerText = msg;
    errorEl.style.display = 'block';
  } else {
    alert(msg);
  }
}

function onAuthSuccess(avatarUrl = '') {
  document.getElementById('slot1-name').innerText = playerName;
  document.getElementById('top-username').innerText = playerName;
  updateAvatarUI(avatarUrl, playerName);

  socket.emit('player_login', { name: playerName, token: authToken });
  showScreen('lobby-screen');
  loadFriendRequests();
  setupInviteBannerDOM();
}

// --- TOP-HANGING SQUAD INVITE POPUP BANNER ---
function setupInviteBannerDOM() {
  if (document.getElementById('squad-invite-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'squad-invite-banner';
  banner.style.cssText = `
    position: fixed;
    top: -100px;
    left: 50%;
    transform: translateX(-50%);
    width: 380px;
    background: #1a1d24;
    border: 2px solid #00ffff;
    border-radius: 0 0 12px 12px;
    box-shadow: 0 8px 24px rgba(0, 255, 255, 0.3);
    padding: 14px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    z-index: 9999;
    transition: top 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  `;

  banner.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; width:100%;">
      <div id="invite-banner-pfp" style="width:36px; height:36px; border-radius:50%; background:#333; display:flex; align-items:center; justify-content:center; overflow:hidden; border:1px solid #00ffff; font-weight:bold; color:#fff;"></div>
      <span id="invite-banner-text" style="color:#fff; font-size:13px; font-weight:600;"></span>
    </div>
    <div style="display:flex; gap:12px; width:100%; justify-content:flex-end;">
      <button id="invite-accept-btn" style="background:#00ffff; color:#000; border:none; padding:6px 16px; border-radius:4px; font-weight:bold; cursor:pointer;">Accept</button>
      <button id="invite-ignore-btn" style="background:#333; color:#aaa; border:none; padding:6px 16px; border-radius:4px; font-weight:bold; cursor:pointer;">Ignore</button>
    </div>
  `;

  document.body.appendChild(banner);
}

function showInviteBanner(hostUsername, hostAvatar) {
  setupInviteBannerDOM();
  const banner = document.getElementById('squad-invite-banner');
  const textEl = document.getElementById('invite-banner-text');
  const pfpEl = document.getElementById('invite-banner-pfp');

  textEl.innerText = `${hostUsername} invites you to join their squad.`;
  if (hostAvatar) {
    pfpEl.innerHTML = `<img src="${hostAvatar}" style="width:100%; height:100%; object-fit:cover;" />`;
  } else {
    pfpEl.innerText = hostUsername.charAt(0).toUpperCase();
  }

  banner.style.top = '0px';

  document.getElementById('invite-accept-btn').onclick = () => {
    socket.emit('accept_squad_invite', { hostUsername });
    banner.style.top = '-100px';
    goToTeamScreen();
  };

  document.getElementById('invite-ignore-btn').onclick = () => {
    banner.style.top = '-100px';
  };
}

socket.on('squad_invite_received', (data) => {
  showInviteBanner(data.hostUsername, data.hostAvatar);
});

// --- PROFILE & AVATAR HANDLERS ---
function updateAvatarUI(avatarUrl, username) {
  const topPfp = document.getElementById('top-pfp');
  const profilePfp = document.getElementById('profile-page-pfp');

  if (avatarUrl) {
    topPfp.innerHTML = `<img src="${avatarUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />`;
    profilePfp.innerHTML = `<img src="${avatarUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />`;
  } else {
    const initial = username ? username.charAt(0).toUpperCase() : '?';
    topPfp.innerText = initial;
    profilePfp.innerText = initial;
  }
}

async function openProfileScreen(targetUsername = null) {
  const usernameToFetch = targetUsername || playerName;
  const isOwnProfile = usernameToFetch === playerName;

  document.getElementById('pfp-overlay').style.display = isOwnProfile ? 'flex' : 'none';
  document.getElementById('pfp-wrapper').style.cursor = isOwnProfile ? 'pointer' : 'default';

  try {
    const res = await fetch(`/api/profile/${usernameToFetch}`);
    const data = await res.json();

    if (!res.ok) return alert(data.message || 'Failed to load profile');

    document.getElementById('profile-page-username').innerText = data.username;
    document.getElementById('profile-stat-matches').innerText = data.matchesPlayed || 0;
    document.getElementById('profile-stat-friends').innerText = data.friendsCount || 0;

    const badge = document.getElementById('profile-status-badge');
    badge.innerText = data.isOnline ? 'ONLINE' : 'OFFLINE';
    badge.className = `status-badge ${data.isOnline ? '' : 'offline'}`;

    const profilePfp = document.getElementById('profile-page-pfp');
    if (data.avatar) {
      profilePfp.innerHTML = `<img src="${data.avatar}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />`;
    } else {
      profilePfp.innerText = data.username.charAt(0).toUpperCase();
    }

    const actionBox = document.getElementById('profile-action-container');
    if (!isOwnProfile) {
      actionBox.innerHTML = `<button class="btn" style="width: 100%; font-size: 14px; padding: 12px;" onclick="sendFriendRequest('${data.username}')">ADD FRIEND</button>`;
    } else {
      actionBox.innerHTML = '';
    }

    showScreen('profile-screen');
  } catch (err) {
    alert('Error fetching user profile');
  }
}

function handlePfpUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (e) {
    const base64Image = e.target.result;
    
    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: playerName, avatar: base64Image })
      });
      const data = await res.json();

      if (res.ok) {
        userAvatar = data.avatar;
        updateAvatarUI(data.avatar, playerName);
      } else {
        alert(data.message || 'Failed to update avatar');
      }
    } catch (err) {
      alert('Error uploading profile picture');
    }
  };
  reader.readAsDataURL(file);
}

// --- FRIENDS SYSTEM HANDLERS ---
function openFriendsScreen() {
  showScreen('friends-screen');
  switchFriendsTab('list');
}

function switchFriendsTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  document.getElementById(`tab-btn-${tab}`).classList.add('active');
  document.getElementById(`tab-content-${tab}`).classList.add('active');

  if (tab === 'list') loadFriendsList();
  if (tab === 'requests') loadFriendRequests();
}

async function loadFriendsList() {
  const listEl = document.getElementById('friends-list');
  listEl.innerHTML = '<p style="color:#888; text-align:center;">Loading friends...</p>';

  try {
    const res = await fetch(`/api/friends/list?username=${playerName}`);
    const friends = await res.json();

    if (friends.length === 0) {
      listEl.innerHTML = '<p style="color:#888; text-align:center; margin-top:20px;">No friends added yet.</p>';
      return;
    }

    listEl.innerHTML = friends.map(f => `
      <div class="user-row">
        <div class="user-info" onclick="openProfileScreen('${f.username}')">
          <div class="round-pfp" style="width:36px; height:36px; font-size:14px;">
            ${f.avatar ? `<img src="${f.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>` : f.username.charAt(0).toUpperCase()}
          </div>
          <div class="user-name-box">
            <span class="user-name">${f.username}</span>
            <span class="status-badge ${f.isOnline ? '' : 'offline'}" style="font-size:9px; padding:1px 5px;">${f.isOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
        </div>
        <button class="action-btn-sm" onclick="openProfileScreen('${f.username}')">VIEW</button>
      </div>
    `).join('');
  } catch (err) {
    listEl.innerHTML = '<p style="color:#ff4d4d; text-align:center;">Failed to load friends.</p>';
  }
}

async function searchUsers() {
  const query = document.getElementById('friend-search-input').value.trim();
  const listEl = document.getElementById('search-results-list');

  if (!query) return;

  listEl.innerHTML = '<p style="color:#888; text-align:center;">Searching...</p>';

  try {
    const res = await fetch(`/api/friends/search?query=${query}&username=${playerName}`);
    const results = await res.json();

    if (results.length === 0) {
      listEl.innerHTML = '<p style="color:#888; text-align:center;">No players found.</p>';
      return;
    }

    listEl.innerHTML = results.map(u => `
      <div class="user-row">
        <div class="user-info" onclick="openProfileScreen('${u.username}')">
          <div class="round-pfp" style="width:36px; height:36px; font-size:14px;">
            ${u.avatar ? `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>` : u.username.charAt(0).toUpperCase()}
          </div>
          <span class="user-name">${u.username}</span>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="action-btn-sm" onclick="openProfileScreen('${u.username}')">PROFILE</button>
          <button class="action-btn-sm" onclick="sendFriendRequest('${u.username}')">+ ADD</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    listEl.innerHTML = '<p style="color:#ff4d4d; text-align:center;">Search failed.</p>';
  }
}

async function sendFriendRequest(targetUsername) {
  try {
    const res = await fetch('/api/friends/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: playerName, to: targetUsername })
    });
    const data = await res.json();
    alert(data.message);
  } catch (err) {
    alert('Error sending request');
  }
}

async function loadFriendRequests() {
  const listEl = document.getElementById('requests-list');
  try {
    const res = await fetch(`/api/friends/requests?username=${playerName}`);
    const requests = await res.json();

    const badge = document.getElementById('req-count-badge');
    if (requests.length > 0) {
      badge.innerText = requests.length;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }

    if (requests.length === 0) {
      listEl.innerHTML = '<p style="color:#888; text-align:center; margin-top:20px;">No pending requests.</p>';
      return;
    }

    listEl.innerHTML = requests.map(r => `
      <div class="user-row">
        <div class="user-info" onclick="openProfileScreen('${r.username}')">
          <div class="round-pfp" style="width:36px; height:36px; font-size:14px;">
            ${r.avatar ? `<img src="${r.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>` : r.username.charAt(0).toUpperCase()}
          </div>
          <span class="user-name">${r.username}</span>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="action-btn-sm" onclick="respondFriendRequest('${r.username}', 'accept')">ACCEPT</button>
          <button class="action-btn-sm action-btn-danger" onclick="respondFriendRequest('${r.username}', 'deny')">DENY</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    listEl.innerHTML = '<p style="color:#ff4d4d; text-align:center;">Error loading requests.</p>';
  }
}

async function respondFriendRequest(fromUsername, action) {
  try {
    await fetch('/api/friends/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: playerName, target: fromUsername, action })
    });
    loadFriendRequests();
  } catch (err) {
    alert('Error processing request');
  }
}

// --- SQUAD LOBBY SYSTEM ---
function goToTeamScreen() {
  showScreen('team-screen');
  socket.emit('request_squad_state');
  loadSquadFriendsSidebar();
}

async function loadSquadFriendsSidebar() {
  const sidebarEl = document.getElementById('squad-friends-sidebar');
  if (!sidebarEl) return;

  sidebarEl.innerHTML = '<p style="color:#888; text-align:center; font-size:12px;">Loading friends...</p>';

  try {
    const res = await fetch(`/api/friends/list?username=${playerName}`);
    const friends = await res.json();

    if (friends.length === 0) {
      sidebarEl.innerHTML = '<p style="color:#888; text-align:center; font-size:12px;">No friends added.</p>';
      return;
    }

    sidebarEl.innerHTML = friends.map(f => `
      <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.05); padding:8px 10px; border-radius:6px; margin-bottom:8px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="width:30px; height:30px; border-radius:50%; background:#333; overflow:hidden; display:flex; align-items:center; justify-content:center; color:#fff; font-size:12px;">
            ${f.avatar ? `<img src="${f.avatar}" style="width:100%;height:100%;object-fit:cover;"/>` : f.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="color:#fff; font-size:12px; font-weight:bold;">${f.username}</div>
            <div style="font-size:9px; color:${f.isOnline ? '#00ff88' : '#888'};">${f.isOnline ? 'ONLINE' : 'OFFLINE'}</div>
          </div>
        </div>
        ${f.isOnline ? `<button class="action-btn-sm" onclick="inviteFriendToSquad('${f.username}')" style="font-size:10px; padding:4px 8px;">INVITE</button>` : ''}
      </div>
    `).join('');
  } catch (err) {
    sidebarEl.innerHTML = '<p style="color:#ff4d4d; text-align:center; font-size:12px;">Error loading sidebar</p>';
  }
}

function inviteFriendToSquad(friendUsername) {
  socket.emit('send_squad_invite', { targetUsername: friendUsername });
  alert(`Invite sent to ${friendUsername}`);
}

socket.on('squad_updated', (data) => {
  // Update Host / Player 1 slot
  const slot1Pfp = document.getElementById('slot1-pfp');
  const slot1Name = document.getElementById('slot1-name');
  
  if (data.host) {
    slot1Name.innerText = data.host.username;
    if (data.host.avatar) {
      slot1Pfp.innerHTML = `<img src="${data.host.avatar}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />`;
    } else {
      slot1Pfp.innerText = data.host.username.charAt(0).toUpperCase();
    }
  }

  // Update Guest / Player 2 slot
  const slot2Pfp = document.getElementById('slot2-pfp');
  const slot2Name = document.getElementById('slot2-name');

  if (data.guest) {
    slot2Name.innerText = data.guest.username;
    if (data.guest.avatar) {
      slot2Pfp.innerHTML = `<img src="${data.guest.avatar}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />`;
    } else {
      slot2Pfp.innerText = data.guest.username.charAt(0).toUpperCase();
    }
  } else {
    slot2Name.innerText = 'P2 (EMPTY)';
    slot2Pfp.innerHTML = '<span style="font-size:24px; color:#555;">+</span>';
  }

  // Update Host controls vs Guest notice
  isSquadHost = (data.host && data.host.username === playerName);
  const startBtn = document.getElementById('start-battle-btn');
  if (startBtn) {
    if (isSquadHost) {
      startBtn.innerText = 'SELECT CHARACTER';
      startBtn.disabled = false;
      startBtn.onclick = () => goToCharScreen();
    } else {
      startBtn.innerText = 'WAITING FOR HOST...';
      startBtn.disabled = true;
      startBtn.onclick = null;
    }
  }
});

socket.on('game_started_by_host', () => {
  goToCharScreen();
});

function goToCharScreen() {
  if (isSquadHost) {
    socket.emit('start_game_request');
  }
  showScreen('char-screen');
}

function selectCharacter(char) {
  selectedCharacter = char;
  document.getElementById('card-cheng').classList.toggle('active', char === 'cheng_xiaoshi');
  document.getElementById('card-lu').classList.toggle('active', char === 'lu_guang');
  document.getElementById('p1-pick-display').innerText = char === 'cheng_xiaoshi' ? 'Cheng Xiaoshi' : 'Lu Guang';

  socket.emit('select_character', char);
}

function lockCharacterAndStart() {
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  document.getElementById('ui-layer').style.display = 'block';
  document.getElementById('hud-role').innerText = `ROLE: ${selectedCharacter.toUpperCase()}`;
  initGame();
}

// --- THREE.JS ENGINE ---
let scene, camera, renderer, localPlayerContainer;
const remotePlayers = {};
const keys = {};
let isLocked = false;
let yaw = 0, pitch = 0;

function initGame() {
  const canvas = document.getElementById('game-canvas');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111116);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshStandardMaterial({ color: 0x22252a }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  scene.add(new THREE.GridHelper(50, 50, 0x00ffff, 0x444444));
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);

  const playerColor = selectedCharacter === 'cheng_xiaoshi' ? 0x3388ff : 0xcccccc;
  localPlayerContainer = createPlayerObject(playerColor).container;
  scene.add(localPlayerContainer);

  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'Shift') {
      if (!isLocked) canvas.requestPointerLock();
      else document.exitPointerLock();
    }
  });
  window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

  document.addEventListener('pointerlockchange', () => {
    isLocked = (document.pointerLockElement === canvas);
  });

  document.addEventListener('mousemove', (e) => {
    if (!isLocked) return;
    yaw -= e.movementX * 0.003;
    pitch = Math.max(-Math.PI / 4, Math.min(Math.PI / 6, pitch - e.movementY * 0.003));
    localPlayerContainer.rotation.y = yaw;
  });

  animate();
}

function createPlayerObject(color) {
  const container = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.4), new THREE.MeshStandardMaterial({ color }));
  body.position.y = 0.9;
  
  const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 3), new THREE.MeshStandardMaterial({ color: 0x00ffff }));
  pointer.rotation.x = -Math.PI / 2;
  pointer.position.set(0, 0.9, -0.4);

  container.add(body);
  container.add(pointer);
  return { container };
}

function animate() {
  requestAnimationFrame(animate);

  let moved = false;
  const moveVector = new THREE.Vector3();
  if (keys['w']) { moveVector.z -= 1; moved = true; }
  if (keys['s']) { moveVector.z += 1; moved = true; }
  if (keys['a']) { moveVector.x -= 1; moved = true; }
  if (keys['d']) { moveVector.x += 1; moved = true; }

  if (moved) {
    moveVector.normalize().multiplyScalar(0.15);
    moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    localPlayerContainer.position.add(moveVector);

    socket.emit('player_move', {
      x: localPlayerContainer.position.x,
      z: localPlayerContainer.position.z,
      rotation: yaw
    });
  }

  const cameraOffset = new THREE.Vector3(0, 2.5 + pitch * 3, 5);
  cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  camera.position.copy(localPlayerContainer.position).add(cameraOffset);
  camera.lookAt(localPlayerContainer.position.clone().add(new THREE.Vector3(0, 1.2, 0)));

  renderer.render(scene, camera);
}

socket.on('player_moved', (data) => {
  if (!remotePlayers[data.id]) {
    const peerColor = data.character === 'cheng_xiaoshi' ? 0x3388ff : 0xcccccc;
    const peer = createPlayerObject(peerColor);
    scene.add(peer.container);
    remotePlayers[data.id] = peer;
  }
  remotePlayers[data.id].container.position.set(data.x, 0, data.z);
  remotePlayers[data.id].container.rotation.y = data.rotation;
});

socket.on('player_left', (id) => {
  if (remotePlayers[id]) {
    scene.remove(remotePlayers[id].container);
    delete remotePlayers[id];
  }
});