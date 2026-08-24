const socket = io();

let playerName = '';
let authToken = '';
let userAvatar = '';
let currentMode = null;


function showScreen(screenId) {

  document
    .querySelectorAll('.screen')
    .forEach(screen => {
      screen.style.display = 'none';
    });

  const target =
    document.getElementById(screenId);

  if (target) {
    target.style.display = 'flex';
  }
}


function showError(message) {

  const errorEl =
    document.getElementById(
      'auth-error'
    );

  if (!errorEl) {
    return alert(message);
  }

  errorEl.innerText =
    message;

  errorEl.style.display =
    'block';
}


// ============================================
// REGISTER
// ============================================

async function handleRegister() {

  const username =
    document
      .getElementById('username')
      .value
      .trim();

  const password =
    document
      .getElementById('password')
      .value
      .trim();


  if (!username || !password) {

    return showError(
      'Please enter both username and password'
    );
  }


  try {

    const response =
      await fetch(
        '/api/register',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body: JSON.stringify({
            username,
            password
          })
        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      return showError(
        data.message ||
        'Registration failed'
      );
    }


    authToken =
      data.token;

    playerName =
      data.username;

    userAvatar =
      data.avatar || '';


    onAuthSuccess();

  } catch (error) {

    showError(
      'Server connection error'
    );
  }
}


// ============================================
// LOGIN
// ============================================

async function handleLogin() {

  const username =
    document
      .getElementById('username')
      .value
      .trim();

  const password =
    document
      .getElementById('password')
      .value
      .trim();


  if (!username || !password) {

    return showError(
      'Please enter both username and password'
    );
  }


  try {

    const response =
      await fetch(
        '/api/login',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body: JSON.stringify({
            username,
            password
          })
        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      return showError(
        data.message ||
        'Login failed'
      );
    }


    authToken =
      data.token;

    playerName =
      data.username;

    userAvatar =
      data.avatar || '';


    onAuthSuccess();

  } catch (error) {

    showError(
      'Server connection error'
    );
  }
}


// ============================================
// LOGIN SUCCESS
// ============================================

function onAuthSuccess() {

  document
    .getElementById(
      'top-username'
    )
    .innerText =
      playerName;


  updateAvatarUI(
    userAvatar,
    playerName
  );


  socket.emit(
    'player_login',
    {
      name: playerName,
      token: authToken
    }
  );


  setupInviteBannerDOM();

  loadFriendRequests();

  showScreen(
    'lobby-screen'
  );
}


// ============================================
// AVATAR
// ============================================

function updateAvatarUI(
  avatarUrl,
  username
) {

  const targets = [

    document.getElementById(
      'top-pfp'
    ),

    document.getElementById(
      'profile-page-pfp'
    )
  ];


  targets.forEach(target => {

    if (!target) {
      return;
    }


    if (avatarUrl) {

      target.innerHTML = `
        <img
          src="${avatarUrl}"
          alt="${username}"
          style="
            width:100%;
            height:100%;
            object-fit:cover;
            border-radius:50%;
          "
        >
      `;

    } else {

      target.innerText =
        username
          ? username
              .charAt(0)
              .toUpperCase()
          : '?';
    }
  });
}


// ============================================
// PROFILE
// ============================================

async function openProfileScreen(
  targetUsername = null
) {

  const usernameToFetch =
    targetUsername ||
    playerName;


  const isOwnProfile =
    usernameToFetch ===
    playerName;


  document
    .getElementById(
      'pfp-overlay'
    )
    .style.display =
      isOwnProfile
        ? 'flex'
        : 'none';


  document
    .getElementById(
      'pfp-wrapper'
    )
    .style.cursor =
      isOwnProfile
        ? 'pointer'
        : 'default';


  try {

    const response =
      await fetch(
        `/api/profile/${encodeURIComponent(
          usernameToFetch
        )}`
      );


    const data =
      await response.json();


    if (!response.ok) {

      return alert(
        data.message ||
        'Failed to load profile'
      );
    }


    document
      .getElementById(
        'profile-page-username'
      )
      .innerText =
        data.username;


    document
      .getElementById(
        'profile-stat-matches'
      )
      .innerText =
        data.matchesPlayed || 0;


    document
      .getElementById(
        'profile-stat-friends'
      )
      .innerText =
        data.friendsCount || 0;


    const badge =
      document.getElementById(
        'profile-status-badge'
      );


    badge.innerText =
      data.isOnline
        ? 'ONLINE'
        : 'OFFLINE';


    badge.className =
      `status-badge ${
        data.isOnline
          ? ''
          : 'offline'
      }`;


    const profilePfp =
      document.getElementById(
        'profile-page-pfp'
      );


    if (data.avatar) {

      profilePfp.innerHTML = `
        <img
          src="${data.avatar}"
          alt="${data.username}"
          style="
            width:100%;
            height:100%;
            object-fit:cover;
            border-radius:50%;
          "
        >
      `;

    } else {

      profilePfp.innerText =
        data.username
          .charAt(0)
          .toUpperCase();
    }


    const actionBox =
      document.getElementById(
        'profile-action-container'
      );


    actionBox.innerHTML =
      isOwnProfile
        ? ''
        : `
          <button
            class="btn"
            style="
              width:100%;
              font-size:14px;
              padding:12px;
            "
            onclick="
              sendFriendRequest(
                '${data.username}'
              )
            "
          >
            ADD FRIEND
          </button>
        `;


    showScreen(
      'profile-screen'
    );

  } catch (error) {

    alert(
      'Error fetching user profile'
    );
  }
}


// ============================================
// PROFILE PICTURE UPLOAD
// ============================================

function handlePfpUpload(event) {

  const file =
    event.target.files[0];


  if (!file) {
    return;
  }


  const reader =
    new FileReader();


  reader.onload =
    async event => {

      try {

        const response =
          await fetch(
            '/api/profile/avatar',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body: JSON.stringify({
                username:
                  playerName,

                avatar:
                  event.target.result
              })
            }
          );


        const data =
          await response.json();


        if (!response.ok) {

          return alert(
            data.message ||
            'Failed to update avatar'
          );
        }


        userAvatar =
          data.avatar;


        updateAvatarUI(
          userAvatar,
          playerName
        );

      } catch (error) {

        alert(
          'Error uploading profile picture'
        );
      }
    };


  reader.readAsDataURL(
    file
  );
}


// ============================================
// ENTER GAME MODE
// ============================================

function openMode(mode) {

  currentMode =
    mode;


  socket.emit(
    'enter_mode',
    {
      mode
    }
  );


  showScreen(
    'team-screen'
  );


  loadSquadFriendsSidebar();
}


// ============================================
// RETURN TO MAIN LOBBY
// ============================================

function returnToMainLobby() {

  socket.emit(
    'leave_squad'
  );


  currentMode =
    null;


  showScreen(
    'lobby-screen'
  );
}


socket.on(
  'left_squad',
  () => {

    currentMode =
      null;
  }
);