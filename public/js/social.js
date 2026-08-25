function openFriendsScreen() {

    showScreen(
      'friends-screen'
    );
  
    switchFriendsTab(
      'list'
    );
  }
  
  
  function switchFriendsTab(tab) {
  
    document
      .querySelectorAll(
        '.tab-btn'
      )
      .forEach(button => {
  
        button
          .classList
          .remove('active');
      });
  
  
    document
      .querySelectorAll(
        '.tab-content'
      )
      .forEach(content => {
  
        content
          .classList
          .remove('active');
      });
  
  
    document
      .getElementById(
        `tab-btn-${tab}`
      )
      .classList
      .add('active');
  
  
    document
      .getElementById(
        `tab-content-${tab}`
      )
      .classList
      .add('active');
  
  
    if (tab === 'list') {
      loadFriendsList();
    }
  
  
    if (tab === 'requests') {
      loadFriendRequests();
    }
  }
  
  
  function friendAvatarMarkup(
    friend
  ) {
  
    if (friend.avatar) {
  
      return `
        <img
          src="${friend.avatar}"
          alt="${friend.username}"
          style="
            width:100%;
            height:100%;
            object-fit:cover;
            border-radius:50%;
          "
        >
      `;
    }
  
  
    return friend.username
      .charAt(0)
      .toUpperCase();
  }
  
  
  // ============================================
  // FRIEND LIST
  // ============================================
  
  async function loadFriendsList() {
  
    const listEl =
      document.getElementById(
        'friends-list'
      );
  
  
    listEl.innerHTML =
      '<p class="muted-center">Loading friends...</p>';
  
  
    try {
  
      const response =
        await fetch(
          `/api/friends/list?username=${encodeURIComponent(
            playerName
          )}`
        );
  
  
      const friends =
        await response.json();
  
  
      if (!friends.length) {
  
        listEl.innerHTML =
          '<p class="muted-center">No friends added yet.</p>';
  
        return;
      }
  
  
      listEl.innerHTML =
        friends
          .map(friend => `
  
            <div class="user-row">
  
              <div
                class="user-info"
                onclick="
                  openProfileScreen(
                    '${friend.username}'
                  )
                "
              >
  
                <div
                  class="round-pfp small-pfp"
                >
                  ${friendAvatarMarkup(friend)}
                </div>
  
  
                <div class="user-name-box">
  
                  <span class="user-name">
                    ${friend.username}
                  </span>
  
  
                  <span
                    class="
                      status-badge
                      ${
                        friend.isOnline
                          ? ''
                          : 'offline'
                      }
                      mini-status
                    "
                  >
                    ${
                      friend.isOnline
                        ? 'ONLINE'
                        : 'OFFLINE'
                    }
                  </span>
  
                </div>
  
              </div>
  
  
              <button
                class="action-btn-sm"
                onclick="
                  openProfileScreen(
                    '${friend.username}'
                  )
                "
              >
                VIEW
              </button>
  
            </div>
  
          `)
          .join('');
  
    } catch (error) {
  
      listEl.innerHTML =
        '<p class="error-center">Failed to load friends.</p>';
    }
  }
  
  
  // ============================================
  // EXACT USERNAME SEARCH
  // ============================================
  
  async function searchUsers() {
  
    const query =
      document
        .getElementById(
          'friend-search-input'
        )
        .value
        .trim();
  
  
    const listEl =
      document.getElementById(
        'search-results-list'
      );
  
  
    if (!query) {
      return;
    }
  
  
    listEl.innerHTML =
      '<p class="muted-center">Searching...</p>';
  
  
    try {
  
      const response =
        await fetch(
          `/api/friends/search?query=${encodeURIComponent(
            query
          )}&username=${encodeURIComponent(
            playerName
          )}`
        );
  
  
      const results =
        await response.json();
  
  
      if (!results.length) {
        listEl.innerHTML = `
        
          <p class="muted-center">No available user found.</p>`;
        
          return;
      }
  
  
      listEl.innerHTML =
        results
          .map(user => `
  
            <div class="user-row">
  
              <div
                class="user-info"
                onclick="
                  openProfileScreen(
                    '${user.username}'
                  )
                "
              >
  
                <div
                  class="round-pfp small-pfp"
                >
                  ${friendAvatarMarkup(user)}
                </div>
  
                <span class="user-name">
                  ${user.username}
                </span>
  
              </div>
  
  
              <div
                style="
                  display:flex;
                  gap:6px;
                "
              >
  
                <button
                  class="action-btn-sm"
                  onclick="
                    openProfileScreen(
                      '${user.username}'
                    )
                  "
                >
                  PROFILE
                </button>
  
  
                <button
                  class="action-btn-sm"
                  onclick="
                    sendFriendRequest(
                      '${user.username}'
                    )
                  "
                >
                  + ADD
                </button>
  
              </div>
  
            </div>
  
          `)
          .join('');
  
    } catch (error) {
  
      listEl.innerHTML =
        '<p class="error-center">Search failed.</p>';
    }
  }
  
  
  // ============================================
  // SEND FRIEND REQUEST
  // ============================================
  
  async function sendFriendRequest(
    targetUsername
  ) {
  
    try {
  
      const response =
        await fetch(
          '/api/friends/request',
          {
            method: 'POST',
  
            headers: {
              'Content-Type':
                'application/json'
            },
  
            body: JSON.stringify({
              from:
                playerName,
  
              to:
                targetUsername
            })
          }
        );
  
  
      const data =
        await response.json();
  
  
      if (response.ok) {
  
        socket.emit(
          'send_friend_request',
          {
            from:
              playerName,
  
            to:
              targetUsername
          }
        );
      }
  
  
      alert(
        data.message
      );
  
    } catch (error) {
  
      alert(
        'Error sending request'
      );
    }
  }
  
  
  // ============================================
  // FRIEND REQUESTS
  // ============================================
  
  async function loadFriendRequests() {
  
    const listEl =
      document.getElementById(
        'requests-list'
      );
  
  
    try {
  
      const response =
        await fetch(
          `/api/friends/requests?username=${encodeURIComponent(
            playerName
          )}`
        );
  
  
      const requests =
        await response.json();
  
  
      const badge =
        document.getElementById(
          'req-count-badge'
        );
  
  
      badge.innerText =
        requests.length;
  
  
      badge.style.display =
        requests.length
          ? 'inline-block'
          : 'none';
  
  
      if (!requests.length) {
  
        listEl.innerHTML =
          '<p class="muted-center">No pending requests.</p>';
  
        return;
      }
  
  
      listEl.innerHTML =
        requests
          .map(request => `
  
            <div class="user-row">
  
              <div
                class="user-info"
                onclick="
                  openProfileScreen(
                    '${request.username}'
                  )
                "
              >
  
                <div
                  class="round-pfp small-pfp"
                >
                  ${friendAvatarMarkup(request)}
                </div>
  
  
                <span class="user-name">
                  ${request.username}
                </span>
  
              </div>
  
  
              <div
                style="
                  display:flex;
                  gap:6px;
                "
              >
  
                <button
                  class="action-btn-sm"
                  onclick="
                    respondFriendRequest(
                      '${request.username}',
                      'accept'
                    )
                  "
                >
                  ACCEPT
                </button>
  
  
                <button
                  class="
                    action-btn-sm
                    action-btn-danger
                  "
                  onclick="
                    respondFriendRequest(
                      '${request.username}',
                      'deny'
                    )
                  "
                >
                  DENY
                </button>
  
              </div>
  
            </div>
  
          `)
          .join('');
  
    } catch (error) {
  
      listEl.innerHTML =
        '<p class="error-center">Error loading requests.</p>';
    }
  }
  
  
  // ============================================
  // RESPOND FRIEND REQUEST
  // ============================================
  
  async function respondFriendRequest(
    fromUsername,
    action
  ) {
  
    try {
  
      await fetch(
        '/api/friends/respond',
        {
          method: 'POST',
  
          headers: {
            'Content-Type':
              'application/json'
          },
  
          body: JSON.stringify({
            username:
              playerName,
  
            target:
              fromUsername,
  
            action
          })
        }
      );
  
  
      loadFriendRequests();
  
    } catch (error) {
  
      alert(
        'Error processing request'
      );
    }
  }
  
  
  // ============================================
  // REAL TIME REQUEST ALERT
  // ============================================
  
  socket.on(
    'friend_request_received',
    () => {
  
      loadFriendRequests();
    }
  );