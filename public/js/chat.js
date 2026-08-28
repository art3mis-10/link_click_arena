// =====================================================
// LINK CLICK CHAT SYSTEM
//
// DIRECT MESSAGES:
// - friends only
// - stored in MongoDB
// - unread messages do not expire
// - 24-hour expiry begins when recipient reads
//
// SQUAD:
// - temporary
// - current squad lobby only
//
// ARENA:
// - temporary
// - everyone in current arena
// - Enter opens chat
// - gameplay input is suppressed while typing
// =====================================================


// =====================================================
// STATE
// =====================================================

let activeDmFriend =
  null;


let currentChatSquadHost =
  null;


let arenaChatTyping =
  false;


let arenaChatHadPointerLock =
  false;

let squadChatOpen =
  false;


// =====================================================
// GENERIC HELPERS
// =====================================================

function chatTime(
  value
) {

  if (
    !value
  ) {

    return '';
  }


  const date =
    new Date(
      value
    );


  return date
    .toLocaleTimeString(
      [],
      {

        hour:
          '2-digit',

        minute:
          '2-digit'
      }
    );
}


function clearChatElement(
  element
) {

  if (
    element
  ) {

    element.innerHTML =
      '';
  }
}


function scrollChatToBottom(
  element
) {

  if (
    !element
  ) {

    return;
  }


  element.scrollTop =
    element.scrollHeight;
}


// =====================================================
// CREATE SAFE MESSAGE ELEMENT
// =====================================================

function createChatMessageElement(
  message,
  {
    own =
      false,

    compact =
      false
  } = {}
) {

  const wrapper =
    document.createElement(
      'div'
    );


  wrapper.className =
    `chat-message ${
      own
        ? 'own'
        : ''
    } ${
      compact
        ? 'compact'
        : ''
    }`;


  const top =
    document.createElement(
      'div'
    );


  top.className =
    'chat-message-meta';


  const sender =
    document.createElement(
      'span'
    );


  sender.className =
    'chat-message-sender';


  sender.textContent =
    message.sender ||
    'Agent';


  const time =
    document.createElement(
      'span'
    );


  time.className =
    'chat-message-time';


  time.textContent =
    chatTime(

      message.createdAt ||
      message.sentAt
    );


  top.appendChild(
    sender
  );


  top.appendChild(
    time
  );


  const text =
    document.createElement(
      'div'
    );


  text.className =
    'chat-message-text';


  /*
    IMPORTANT:

    textContent prevents users from injecting
    HTML or scripts through chat.
  */

  text.textContent =
    message.text ||
    '';


  wrapper.appendChild(
    top
  );


  wrapper.appendChild(
    text
  );


  return wrapper;
}


// =====================================================
// DIRECT MESSAGE MODAL
// =====================================================

async function openLobbyChat() {

  const overlay =
    document.getElementById(
      'dm-chat-overlay'
    );


  if (
    !overlay
  ) {

    return;
  }


  overlay.style.display =
    'flex';


  await loadDmFriends();
}


function closeLobbyChat() {

  if (
    activeDmFriend
  ) {

    socket.emit(
      'dm_close',
      {

        friendUsername:
          activeDmFriend
      }
    );
  }


  activeDmFriend =
    null;


  const overlay =
    document.getElementById(
      'dm-chat-overlay'
    );


  if (
    overlay
  ) {

    overlay.style.display =
      'none';
  }
}


// =====================================================
// LOAD DM FRIENDS
// =====================================================

async function loadDmFriends() {

  const list =
    document.getElementById(
      'dm-friend-list'
    );


  if (
    !list ||
    !playerName
  ) {

    return;
  }


  list.innerHTML =
    '<div class="chat-empty">Loading...</div>';


  try {

    const response =
      await fetch(

        `/api/friends/list?username=${encodeURIComponent(
          playerName
        )}`
      );


    const friends =
      await response.json();


    clearChatElement(
      list
    );


    if (
      !friends.length
    ) {

      list.innerHTML =
        '<div class="chat-empty">No friends yet.</div>';


      return;
    }


    friends.forEach(
      friend => {

        const button =
          document.createElement(
            'button'
          );


        button.type =
          'button';


        button.className =
          'dm-friend-button';


        const avatar =
          document.createElement(
            'div'
          );


        avatar.className =
          'dm-friend-avatar';


        if (
          friend.avatar
        ) {

          const image =
            document.createElement(
              'img'
            );


          image.src =
            friend.avatar;


          image.alt =
            friend.username;


          avatar.appendChild(
            image
          );

        } else {

          avatar.textContent =
            friend
              .username
              .charAt(
                0
              )
              .toUpperCase();
        }


        const copy =
          document.createElement(
            'div'
          );


        copy.className =
          'dm-friend-copy';


        const name =
          document.createElement(
            'strong'
          );


        name.textContent =
          friend.username;


        const status =
          document.createElement(
            'span'
          );


        status.className =
          friend.isOnline
            ? 'dm-online'
            : 'dm-offline';


        status.textContent =
          friend.isOnline
            ? 'ONLINE'
            : 'OFFLINE';


        copy.appendChild(
          name
        );


        copy.appendChild(
          status
        );


        button.appendChild(
          avatar
        );


        button.appendChild(
          copy
        );


        button.addEventListener(
          'click',
          () => {

            openDirectMessage(
              friend.username
            );
          }
        );


        list.appendChild(
          button
        );
      }
    );

  } catch (error) {

    list.innerHTML =
      '<div class="chat-empty chat-error">Failed to load friends.</div>';
  }
}


// =====================================================
// OPEN DIRECT MESSAGE
// =====================================================

function openDirectMessage(
  friendUsername
) {

  if (
    !friendUsername
  ) {

    return;
  }


  /*
    Tell server old conversation is no
    longer being viewed.
  */

  if (
    activeDmFriend &&
    activeDmFriend !==
      friendUsername
  ) {

    socket.emit(
      'dm_close',
      {

        friendUsername:
          activeDmFriend
      }
    );
  }


  activeDmFriend =
    friendUsername;


  const title =
    document.getElementById(
      'dm-conversation-title'
    );


  const list =
    document.getElementById(
      'dm-message-list'
    );


  const input =
    document.getElementById(
      'dm-message-input'
    );


  const sendButton =
    document.getElementById(
      'dm-send-btn'
    );


  title.textContent =
    friendUsername;


  list.innerHTML =
    '<div class="chat-empty">Loading conversation...</div>';


  input.disabled =
    true;


  sendButton.disabled =
    true;


  socket.emit(

    'dm_open',

    {
      friendUsername
    },

    response => {

      /*
        User may have clicked another friend
        while this callback was loading.
      */

      if (
        activeDmFriend !==
          friendUsername
      ) {

        return;
      }


      if (
        !response ||
        !response.success
      ) {

        list.innerHTML =
          '<div class="chat-empty chat-error">Could not open conversation.</div>';


        return;
      }


      clearChatElement(
        list
      );


      if (
        !response.messages.length
      ) {

        list.innerHTML =
          '<div class="chat-empty">No messages yet.</div>';

      } else {

        response
          .messages
          .forEach(
            message => {

              list.appendChild(

                createChatMessageElement(

                  message,

                  {

                    own:
                      message.sender ===
                      playerName
                  }
                )
              );
            }
          );
      }


      input.disabled =
        false;


      sendButton.disabled =
        false;


      input.focus();


      scrollChatToBottom(
        list
      );
    }
  );
}


// =====================================================
// SEND DIRECT MESSAGE
// =====================================================

function sendDirectMessage() {

  const input =
    document.getElementById(
      'dm-message-input'
    );


  if (
    !input ||
    !activeDmFriend
  ) {

    return;
  }


  const text =
    input
      .value
      .trim();


  if (
    !text
  ) {

    return;
  }


  socket.emit(

    'dm_send',

    {

      to:
        activeDmFriend,

      text
    },

    response => {

      if (
        !response ||
        !response.success
      ) {

        alert(
          response?.message ||
          'Failed to send message.'
        );


        return;
      }


      input.value =
        '';


      appendDirectMessage(
        response.message
      );


      input.focus();
    }
  );
}


// =====================================================
// APPEND DIRECT MESSAGE
// =====================================================

function appendDirectMessage(
  message
) {

  if (
    !message
  ) {

    return;
  }


  const list =
    document.getElementById(
      'dm-message-list'
    );


  if (
    !list
  ) {

    return;
  }


  const empty =
    list.querySelector(
      '.chat-empty'
    );


  if (
    empty
  ) {

    empty.remove();
  }


  list.appendChild(

    createChatMessageElement(

      message,

      {

        own:
          message.sender ===
          playerName
      }
    )
  );


  scrollChatToBottom(
    list
  );
}


// =====================================================
// INCOMING DIRECT MESSAGE
// =====================================================

socket.on(
  'dm_message',
  message => {

    if (
      !message
    ) {

      return;
    }


    /*
      Only append into the active conversation.

      Messages for other friends remain safely
      stored in MongoDB until that DM is opened.
    */

    if (
      activeDmFriend &&
      (
        message.sender ===
          activeDmFriend ||
        message.recipient ===
          activeDmFriend
      )
    ) {

      appendDirectMessage(
        message
      );
    }
  }
);


// =====================================================
// DM ENTER KEY
// =====================================================

document
  .getElementById(
    'dm-message-input'
  )
  ?.addEventListener(
    'keydown',
    event => {

      if (
        event.key ===
        'Enter'
      ) {

        event.preventDefault();


        sendDirectMessage();
      }
    }
  );


// =====================================================
// SQUAD CHAT
// =====================================================

function sendSquadChat() {

  const input =
    document.getElementById(
      'squad-chat-input'
    );


  if (
    !input
  ) {

    return;
  }


  const text =
    input
      .value
      .trim();


  if (
    !text
  ) {

    return;
  }


  socket.emit(

    'squad_chat_send',

    {
      text
    },

    response => {

      if (
        response &&
        response.success
      ) {

        input.value =
          '';

      } else if (
        response?.message
      ) {

        alert(
          response.message
        );
      }
    }
  );
}


document
  .getElementById(
    'squad-chat-input'
  )
  ?.addEventListener(
    'keydown',
    event => {

      if (
        event.key ===
        'Enter'
      ) {

        event.preventDefault();


        event.stopPropagation();


        sendSquadChat();
      }
    }
  );


socket.on(
  'squad_chat_message',
  message => {

    const list =
      document.getElementById(
        'squad-chat-messages'
      );


    if (
      !list
    ) {

      return;
    }


    list.appendChild(

      createChatMessageElement(

        message,

        {

          own:
            message.sender ===
            playerName,

          compact:
            true
        }
      )
    );


    scrollChatToBottom(
      list
    );
  }
);


// =====================================================
// OPEN / CLOSE SQUAD CHAT
// =====================================================

function toggleSquadChat() {

  const panel =
    document.getElementById(
      'squad-chat-panel'
    );


  const input =
    document.getElementById(
      'squad-chat-input'
    );


  if (
    !panel
  ) {

    return;
  }


  squadChatOpen =
    !squadChatOpen;


  panel.classList.toggle(
    'open',
    squadChatOpen
  );


  /*
    Messages are NOT cleared here.

    Closing the panel only collapses it,
    so previous squad messages are still
    there when the player opens it again.
  */

  if (
    squadChatOpen
  ) {

    const messages =
      document.getElementById(
        'squad-chat-messages'
      );


    if (
      messages
    ) {

      messages.scrollTop =
        messages.scrollHeight;
    }


    setTimeout(
      () => {

        input?.focus();

      },
      120
    );
  }
}


// =====================================================
// TRACK SQUAD CHANGES
// =====================================================

socket.on(
  'squad_updated',
  data => {

    if (
      !data
    ) {

      return;
    }


    if (
      currentChatSquadHost &&
      currentChatSquadHost !==
        data.hostUsername
    ) {

      clearChatElement(

        document.getElementById(
          'squad-chat-messages'
        )
      );
    }


    currentChatSquadHost =
      data.hostUsername ||
      null;
  }
);


socket.on(
  'squad_disbanded',
  () => {

    currentChatSquadHost =
      null;


    clearChatElement(

      document.getElementById(
        'squad-chat-messages'
      )
    );
  }
);


socket.on(
  'left_squad',
  () => {

    currentChatSquadHost =
      null;


    clearChatElement(

      document.getElementById(
        'squad-chat-messages'
      )
    );
  }
);


// =====================================================
// ARENA CHAT
// =====================================================

function clearArenaChat() {

  clearChatElement(

    document.getElementById(
      'arena-chat-messages'
    )
  );
}


// =====================================================
// ENTER ARENA CHAT MODE
// =====================================================

function startArenaChatTyping() {

  if (
    arenaChatTyping
  ) {

    return;
  }


  const inputRow =
    document.getElementById(
      'arena-chat-input-row'
    );


  const input =
    document.getElementById(
      'arena-chat-input'
    );


  const hint =
    document.getElementById(
      'arena-chat-hint'
    );


  const canvas =
    document.getElementById(
      'game-canvas'
    );


  if (
    !inputRow ||
    !input
  ) {

    return;
  }


  arenaChatTyping =
    true;


  /*
    Remember whether Shift-lock / pointer
    lock was active.
  */

  arenaChatHadPointerLock =

    document.pointerLockElement ===
      canvas;


  if (
    document.pointerLockElement
  ) {

    document
      .exitPointerLock();
  }


  /*
    Make sure held WASD movement is released.

    Arena's existing keyup listener receives
    these events and clears its movement state.
  */

  [
    'w',
    'a',
    's',
    'd'
  ]
    .forEach(
      key => {

        window.dispatchEvent(

          new KeyboardEvent(
            'keyup',
            {
              key
            }
          )
        );
      }
    );


  inputRow.style.display =
    'flex';


  if (
    hint
  ) {

    hint.style.display =
      'none';
  }


  input.value =
    '';


  input.focus();
}


// =====================================================
// EXIT ARENA CHAT MODE
// =====================================================

function stopArenaChatTyping(
  restorePointerLock =
    true
) {

  if (
    !arenaChatTyping
  ) {

    return;
  }


  const inputRow =
    document.getElementById(
      'arena-chat-input-row'
    );


  const input =
    document.getElementById(
      'arena-chat-input'
    );


  const hint =
    document.getElementById(
      'arena-chat-hint'
    );


  arenaChatTyping =
    false;


  if (
    input
  ) {

    input.blur();


    input.value =
      '';
  }


  if (
    inputRow
  ) {

    inputRow.style.display =
      'none';
  }


  if (
    hint
  ) {

    hint.style.display =
      'block';
  }


  /*
    DO NOT automatically request pointer lock here.

    Browser pointer lock requires a direct
    user gesture.

    The player can press SHIFT once after
    closing/sending chat to restore Shift-lock.
  */

  arenaChatHadPointerLock =
    false;
}


// =====================================================
// SEND ARENA CHAT
// =====================================================

function sendArenaChat() {

  const input =
    document.getElementById(
      'arena-chat-input'
    );


  if (
    !input
  ) {

    return;
  }


  const text =
    input
      .value
      .trim();


  if (
    !text
  ) {

    stopArenaChatTyping();


    return;
  }


  socket.emit(

    'arena_chat_send',

    {
      text
    },

    () => {

      stopArenaChatTyping();
    }
  );
}


// =====================================================
// ARENA CHAT MESSAGE
// =====================================================

socket.on(
  'arena_chat_message',
  message => {

    const list =
      document.getElementById(
        'arena-chat-messages'
      );


    if (
      !list
    ) {

      return;
    }


    const element =
      createChatMessageElement(

        message,

        {

          own:
            message.sender ===
            playerName,

          compact:
            true
        }
      );


    list.appendChild(
      element
    );


    scrollChatToBottom(
      list
    );


    /*
      Arena messages fade visually after
      several seconds, but remain in the
      small feed until the match finishes.
    */

    setTimeout(
      () => {

        element.classList.add(
          'arena-chat-old'
        );

      },
      6500
    );
  }
);


// =====================================================
// MATCH START / END
// =====================================================

socket.on(
  'arena_started',
  () => {

    const panel =
      document.getElementById(
        'arena-chat-panel'
      );


    clearArenaChat();


    arenaChatTyping =
      false;


    arenaChatHadPointerLock =
      false;


    if (
      panel
    ) {

      panel.style.display =
        'flex';
    }
  }
);


socket.on(
  'return_to_squad',
  () => {

    const panel =
      document.getElementById(
        'arena-chat-panel'
      );


    stopArenaChatTyping(
      false
    );


    clearArenaChat();


    if (
      panel
    ) {

      panel.style.display =
        'none';
    }
  }
);


// =====================================================
// IMPORTANT — STOP GAMEPLAY INPUT WHILE CHATTING
// =====================================================

function chatInputFocused() {

  const active =
    document.activeElement;


  if (
    !active
  ) {

    return false;
  }


  return (

    active.classList
      ?.contains(
        'chat-input'
      ) ||

    active.classList
      ?.contains(
        'squad-chat-input'
      )
  );
}


/*
  This listener is loaded BEFORE arena.js.

  Therefore when a chat input is focused,
  it stops the event from reaching arena.js's
  gameplay keydown listener.

  This means typing:
    W
    A
    S
    D
    Q
    E
    SPACE

  does NOT move or attack.
*/

window.addEventListener(
  'keydown',
  event => {

    // =============================================
    // CURRENTLY TYPING IN ANY CHAT INPUT
    // =============================================

    if (
      chatInputFocused()
    ) {

      /*
        Arena chat has special Enter/Escape
        behavior.
      */

      if (
        arenaChatTyping
      ) {

        if (
          event.key ===
          'Enter'
        ) {

          event.preventDefault();


          event.stopImmediatePropagation();


          sendArenaChat();


          return;
        }


        if (
          event.key ===
          'Escape'
        ) {

          event.preventDefault();


          event.stopImmediatePropagation();


          stopArenaChatTyping();


          return;
        }
      }


      /*
        The browser still processes normal text
        input before default completion, but the
        event is prevented from reaching arena's
        window keydown listener.
      */

      event.stopImmediatePropagation();


      return;
    }


    // =============================================
    // ENTER OPENS ARENA CHAT
    // =============================================

    const panel =
      document.getElementById(
        'arena-chat-panel'
      );


    const arenaVisible =

      panel &&

      panel.style.display !==
        'none';


    if (
      arenaVisible &&
      event.key ===
        'Enter'
    ) {

      event.preventDefault();


      event.stopImmediatePropagation();


      startArenaChatTyping();
    }
  }
);