let currentSquad = null;

let isSquadHost = false;

let selectedCharacter = null;

let characterReady = false;

let previewCharacter = null;

let previewProfileStats = null;


let matchCharacterState = {

  selections: {},

  ready: {}
};


// ============================================
// INVITE BANNER
// ============================================

function setupInviteBannerDOM() {

  if (
    document.getElementById(
      'squad-invite-banner'
    )
  ) {

    return;
  }


  const banner =
    document.createElement(
      'div'
    );


  banner.id =
    'squad-invite-banner';


  banner.className =
    'invite-banner';


  banner.innerHTML = `

    <div class="invite-person-row">

      <div
        id="invite-banner-pfp"
        class="round-pfp small-pfp"
      ></div>


      <div>

        <div
          id="invite-banner-text"
          class="invite-banner-text"
        ></div>


        <div
          id="invite-banner-mode"
          class="invite-banner-mode"
        ></div>

      </div>

    </div>


    <div class="invite-actions">

      <button
        id="invite-accept-btn"
        class="action-btn-sm"
      >
        ACCEPT
      </button>


      <button
        id="invite-ignore-btn"
        class="
          action-btn-sm
          action-btn-danger
        "
      >
        IGNORE
      </button>

    </div>

  `;


  document.body.appendChild(
    banner
  );
}


// ============================================
// SHOW INVITE
// ============================================

function showInviteBanner(
  data
) {

  setupInviteBannerDOM();


  const banner =
    document.getElementById(
      'squad-invite-banner'
    );


  const pfp =
    document.getElementById(
      'invite-banner-pfp'
    );


  const text =
    document.getElementById(
      'invite-banner-text'
    );


  const mode =
    document.getElementById(
      'invite-banner-mode'
    );


  text.innerText =
    `${data.inviterUsername} invited you to their squad.`;


  mode.innerText =
    data.mode ===
      'pvp'

      ? 'PVP ARENA • up to 4 players'

      : 'MATCH • 2 players';


  if (
    data.inviterAvatar
  ) {

    pfp.innerHTML = `

      <img
        src="${data.inviterAvatar}"
        alt="${data.inviterUsername}"
        style="
          width:100%;
          height:100%;
          object-fit:cover;
          border-radius:50%;
        "
      >

    `;

  } else {

    pfp.innerText =
      data
        .inviterUsername
        .charAt(
          0
        )
        .toUpperCase();
  }


  banner
    .classList
    .add(
      'visible'
    );


  document
    .getElementById(
      'invite-accept-btn'
    )
    .onclick =
      () => {

        socket.emit(
          'accept_squad_invite',
          {

            hostUsername:
              data.hostUsername
          }
        );


        banner
          .classList
          .remove(
            'visible'
          );
      };


  document
    .getElementById(
      'invite-ignore-btn'
    )
    .onclick =
      () => {

        banner
          .classList
          .remove(
            'visible'
          );
      };
}


socket.on(
  'squad_invite_received',
  showInviteBanner
);


// ============================================
// JOINED SQUAD
// ============================================

socket.on(
  'joined_squad',
  ({
    mode
  }) => {

    currentMode =
      mode;


    showScreen(
      'team-screen'
    );


    loadSquadFriendsSidebar();


    socket.emit(
      'request_squad_state'
    );
  }
);


// ============================================
// SQUAD DISBANDED
// ============================================

socket.on(
  'squad_disbanded',
  ({
    message
  }) => {

    currentSquad =
      null;


    currentMode =
      null;


    showScreen(
      'lobby-screen'
    );


    if (
      message
    ) {

      alert(
        message
      );
    }
  }
);


// ============================================
// SQUAD ERROR
// ============================================

socket.on(
  'squad_error',
  ({
    message
  }) => {

    alert(
      message ||
      'Squad error'
    );
  }
);


// ============================================
// RENDER SQUAD MEMBER
// ============================================

function renderSquadMember(
  slotIndex,
  member
) {

  const pfp =
    document.getElementById(
      `slot${slotIndex}-pfp`
    );


  const name =
    document.getElementById(
      `slot${slotIndex}-name`
    );


  const role =
    document.getElementById(
      `slot${slotIndex}-role`
    );


  const slot =
    document.getElementById(
      `team-slot-${slotIndex}`
    );


  if (
    !pfp ||
    !name ||
    !role ||
    !slot
  ) {

    return;
  }


  if (
    !member
  ) {

    slot
      .classList
      .remove(
        'filled'
      );


    pfp.innerHTML = `

      <span class="plus-symbol">
        +
      </span>

    `;


    name.innerText =
      'EMPTY SLOT';


    role.innerText =
      'INVITE FRIEND';


    return;
  }


  slot
    .classList
    .add(
      'filled'
    );


  name.innerText =
    member.username;


  role.innerText =
    slotIndex ===
      1

      ? 'PARTY LEADER'

      : 'SQUAD MEMBER';


  if (
    member.avatar
  ) {

    pfp.innerHTML = `

      <img
        src="${member.avatar}"
        alt="${member.username}"
        style="
          width:100%;
          height:100%;
          object-fit:cover;
          border-radius:50%;
        "
      >

    `;

  } else {

    pfp.innerText =
      member
        .username
        .charAt(
          0
        )
        .toUpperCase();
  }
}


// ============================================
// RENDER SQUAD
// ============================================

function renderSquadState(
  data
) {

  currentSquad =
    data;


  currentMode =
    data.mode;


  isSquadHost =
    data.hostUsername ===
    playerName;


  document
    .getElementById(
      'squad-mode-title'
    )
    .innerText =

      data.mode ===
        'pvp'

        ? 'PVP ARENA SQUAD'

        : 'MATCH SQUAD';


  document
    .getElementById(
      'squad-capacity'
    )
    .innerText =

      `${data.memberCount} / ${data.maxPlayers} PLAYERS`;


  for (
    let index = 1;
    index <= 4;
    index += 1
  ) {

    renderSquadMember(

      index,

      data.members[
        index - 1
      ] ||
      null
    );
  }


  const slot3 =
    document.getElementById(
      'team-slot-3'
    );


  const slot4 =
    document.getElementById(
      'team-slot-4'
    );


  if (
    slot3
  ) {

    slot3.style.display =
      data.mode ===
        'pvp'

        ? 'flex'

        : 'none';
  }


  if (
    slot4
  ) {

    slot4.style.display =
      data.mode ===
        'pvp'

        ? 'flex'

        : 'none';
  }


  const startButton =
    document.getElementById(
      'start-character-btn'
    );


  if (
    isSquadHost
  ) {

    if (
      data.mode ===
        'match' &&
      data.memberCount !==
        2
    ) {

      startButton.innerText =
        'WAITING FOR TEAMMATE';


      startButton.disabled =
        true;

    } else {

      startButton.innerText =
        'CHARACTER SELECT';


      startButton.disabled =
        false;
    }

  } else {

    startButton.innerText =
      'WAITING FOR HOST...';


    startButton.disabled =
      true;
  }


  loadSquadFriendsSidebar();
}


socket.on(
  'squad_updated',
  renderSquadState
);


// ============================================
// FRIEND SIDEBAR
// ============================================

async function loadSquadFriendsSidebar() {

  const sidebar =
    document.getElementById(
      'squad-friends-sidebar'
    );


  if (
    !sidebar ||
    !playerName
  ) {

    return;
  }


  sidebar.innerHTML =
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


    if (
      !friends.length
    ) {

      sidebar.innerHTML =
        '<p class="muted-center">No friends added yet.</p>';


      return;
    }


    const squadMembers =
      new Set(

        (
          currentSquad?.members ||
          []
        )
          .map(
            member =>
              member.username
          )
      );


    const full =
      currentSquad

        ? currentSquad.memberCount >=
          currentSquad.maxPlayers

        : false;


    sidebar.innerHTML =
      friends
        .map(
          friend => {

            const alreadyInSquad =
              squadMembers.has(
                friend.username
              );


            const canInvite =

              friend.isOnline &&

              !alreadyInSquad &&

              !full;


            return `

              <div class="squad-friend-row">

                <div class="squad-friend-main">

                  <div
                    class="round-pfp tiny-pfp"
                  >
                    ${friendAvatarMarkup(
                      friend
                    )}
                  </div>


                  <div class="squad-friend-copy">

                    <div class="squad-friend-name">
                      ${friend.username}
                    </div>


                    <div
                      class="
                        squad-friend-status
                        ${
                          friend.isOnline
                            ? 'online-text'
                            : ''
                        }
                      "
                    >

                      ${
                        alreadyInSquad
                          ? 'IN SQUAD'

                          : friend.isOnline
                            ? 'ONLINE'

                            : 'OFFLINE'
                      }

                    </div>

                  </div>

                </div>


                <button
                  class="action-btn-sm"
                  ${
                    canInvite
                      ? ''
                      : 'disabled'
                  }
                  onclick="
                    inviteFriendToSquad(
                      '${friend.username}'
                    )
                  "
                >
                  INVITE
                </button>

              </div>

            `;
          }
        )
        .join('');

  } catch (error) {

    sidebar.innerHTML =
      '<p class="error-center">Error loading friends.</p>';
  }
}


// ============================================
// INVITE FRIEND
// ============================================

function inviteFriendToSquad(
  friendUsername
) {

  socket.emit(
    'send_squad_invite',
    {

      targetUsername:
        friendUsername
    }
  );
}


// ============================================
// START CHARACTER SELECT
// ============================================

function startCharacterSelect() {

  if (
    !isSquadHost
  ) {

    return;
  }


  socket.emit(
    'start_character_select'
  );
}


// ============================================
// CHARACTER SELECT STARTED
// ============================================

socket.on(
  'character_select_started',
  ({
    mode,
    memberCount
  }) => {

    currentMode =
      mode;


    selectedCharacter =
      null;


    characterReady =
      false;


    previewCharacter =
      null;


    previewProfileStats =
      null;


    matchCharacterState = {

      selections: {},

      ready: {}
    };


    document
      .getElementById(
        'character-mode-label'
      )
      .innerText =

        mode ===
          'pvp'

          ? 'PVP ARENA'

          : 'MATCH';


    document
      .getElementById(
        'ready-character-btn'
      )
      .innerText =

        mode ===
          'pvp'

          ? 'READY'

          : 'LOCK CHARACTER';


    document
      .getElementById(
        'ready-character-btn'
      )
      .disabled =
        true;


    const privacyNote =
      document.getElementById(
        'selection-privacy-note'
      );


    const teammatePanel =
      document.getElementById(
        'match-teammate-panel'
      );


    const readyCounter =
      document.getElementById(
        'pvp-ready-counter'
      );


    if (
      mode ===
      'pvp'
    ) {

      privacyNote.innerText =
        'Character choices are hidden. Duplicate characters are allowed.';


      teammatePanel.style.display =
        'none';


      readyCounter.style.display =
        'block';


      readyCounter.innerText =
        `0 / ${memberCount} READY`;

    } else {

      privacyNote.innerText =
        'Your teammate can see your pick. Locked characters become unavailable.';


      teammatePanel.style.display =
        'flex';


      readyCounter.style.display =
        'none';
    }


    closeCharacterSelectPreview();


    renderCharacterCards();


    showScreen(
      'char-screen'
    );
  }
);


// ============================================
// CHARACTER DISPLAY NAME
// ============================================

function characterDisplayName(
  character
) {

  if (
    character ===
    'cheng_xiaoshi'
  ) {

    return 'Cheng Xiaoshi';
  }


  if (
    character ===
    'lu_guang'
  ) {

    return 'Lu Guang';
  }


  return 'Selecting...';
}


// ============================================
// CHARACTER SELECT PREVIEW DATA
// ============================================

function characterSelectPreviewData(
  character
) {

  /*
    PVP INFO.

    This is intentionally BRIEF.

    Full details remain in the
    Characters page.
  */

  if (
    currentMode ===
      'pvp'
  ) {

    if (
      character ===
      'cheng_xiaoshi'
    ) {

      return {

        name:
          'CHENG XIAOSHI',

        role:
          'TANK',

        image:
          '/assets/chengXiaoshi.jpg',

        description:
          '850 HP tank. Punch fights at close range, Control stuns and resets his basic attack, and Strengthen boosts his movement, damage, and attack speed.'
      };
    }


    if (
      character ===
      'lu_guang'
    ) {

      return {

        name:
          'LU GUANG',

        role:
          'ARCHER',

        image:
          '/assets/luGuang.jpg',

        description:
          '600 HP archer. Laser automatically attacks enemies within 15 units at high projectile speed, Shield absorbs incoming damage, and Strengthen creates stronger homing Lasers.'
      };
    }
  }


  /*
    CLASSIC MATCH.

    Completely separate definitions so
    changing PVP text never changes these.
  */

  if (
    character ===
    'cheng_xiaoshi'
  ) {

    return {

      name:
        'CHENG XIAOSHI',

      role:
        'COMBATER',

      image:
        '/assets/chengXiaoshi.jpg',

      description:
        'Enters photo dimensions directly. Classic Match abilities will be detailed separately.'
    };
  }


  if (
    character ===
    'lu_guang'
  ) {

    return {

      name:
        'LU GUANG',

      role:
        'INFORMANT',

      image:
        '/assets/luGuang.jpg',

      description:
        'Tracks information across the photo timeline. Classic Match abilities will be detailed separately.'
    };
  }


  return null;
}


// ============================================
// LOAD OWN PROFICIENCY
// ============================================

async function loadPreviewProfileStats() {

  if (
    previewProfileStats
  ) {

    return previewProfileStats;
  }


  try {

    const response =
      await fetch(

        `/api/profile/${encodeURIComponent(
          playerName
        )}?viewer=${encodeURIComponent(
          playerName
        )}`
      );


    const data =
      await response.json();


    if (
      !response.ok
    ) {

      return {};
    }


    previewProfileStats =
      data.characterStats ||
      {};


    return previewProfileStats;

  } catch (error) {

    console.error(
      'Could not load proficiency:',
      error
    );


    return {};
  }
}


// ============================================
// OPEN CHARACTER PREVIEW
// ============================================

async function openCharacterSelectPreview(
  character
) {

  if (
    characterReady
  ) {

    return;
  }


  /*
    Classic Match still respects
    teammate character locking.
  */

  if (
    currentMode ===
      'match'
  ) {

    const teammate =
      getMatchTeammateUsername();


    const teammateLockedCharacter =

      teammate &&

      matchCharacterState
        .ready[
          teammate
        ]

        ? matchCharacterState
            .selections[
              teammate
            ]

        : null;


    if (
      teammateLockedCharacter ===
      character
    ) {

      return;
    }
  }


  const info =
    characterSelectPreviewData(
      character
    );


  if (
    !info
  ) {

    return;
  }


  previewCharacter =
    character;


  const overlay =
    document.getElementById(
      'character-select-preview-overlay'
    );


  const name =
    document.getElementById(
      'character-preview-name'
    );


  const role =
    document.getElementById(
      'character-preview-role'
    );


  const image =
    document.getElementById(
      'character-preview-image'
    );


  const description =
    document.getElementById(
      'character-preview-description'
    );


  const badgeHolder =
    document.getElementById(
      'character-preview-badge'
    );


  const rankText =
    document.getElementById(
      'character-preview-rank'
    );


  const scoreText =
    document.getElementById(
      'character-preview-score'
    );


  name.innerText =
    info.name;


  role.innerText =
    `ROLE: ${info.role}`;


  image.src =
    info.image;


  image.alt =
    info.name;


  description.innerText =
    info.description;


  /*
    Profile proficiency only matters
    for PVP right now.
  */

  if (
    currentMode ===
      'pvp'
  ) {

    const stats =
      await loadPreviewProfileStats();


    const score =
      Number(

        stats[
          character
        ]?.proficiencyPoints

      ) ||
      0;


    const rank =
      typeof getProficiencyRank ===
        'function'

        ? getProficiencyRank(
            score
          )

        : {
            name:
              'BRONZE'
          };


    rankText.innerText =
      rank.name;


    scoreText.innerText =
      `${score} PROFICIENCY`;


    badgeHolder.innerHTML =
      '';


    if (
      typeof createProficiencyIcon ===
        'function'
    ) {

      badgeHolder.appendChild(

        createProficiencyIcon(
          score,
          60
        )
      );
    }

  } else {

    /*
      No Classic proficiency system
      yet.
    */

    rankText.innerText =
      'CLASSIC MATCH';


    scoreText.innerText =
      'PROFICIENCY COMING LATER';


    badgeHolder.innerHTML =
      '';
  }


  overlay.style.display =
    'flex';
}


// ============================================
// CLOSE CHARACTER PREVIEW
// ============================================

function closeCharacterSelectPreview() {

  const overlay =
    document.getElementById(
      'character-select-preview-overlay'
    );


  if (
    overlay
  ) {

    overlay.style.display =
      'none';
  }


  previewCharacter =
    null;
}


// ============================================
// SELECT FROM POPUP
// ============================================

function confirmCharacterPreviewSelection() {

  if (
    !previewCharacter ||
    characterReady
  ) {

    return;
  }


  const character =
    previewCharacter;


  /*
    IMPORTANT:

    This ONLY selects.

    It DOES NOT set characterReady.

    User still needs to press the normal
    READY / LOCK CHARACTER button.
  */

  selectCharacter(
    character
  );


  closeCharacterSelectPreview();
}


// ============================================
// SELECT CHARACTER
// ============================================

function selectCharacter(
  character
) {

  if (
    characterReady
  ) {

    return;
  }


  if (
    currentMode ===
      'match'
  ) {

    const teammate =
      getMatchTeammateUsername();


    const teammateLockedCharacter =

      teammate &&

      matchCharacterState
        .ready[
          teammate
        ]

        ? matchCharacterState
            .selections[
              teammate
            ]

        : null;


    if (
      teammateLockedCharacter ===
      character
    ) {

      return;
    }
  }


  selectedCharacter =
    character;


  socket.emit(
    'select_character',
    character
  );


  renderCharacterCards();
}


// ============================================
// READY / LOCK
// ============================================

function readyCharacter() {

  if (
    !selectedCharacter ||
    characterReady
  ) {

    return;
  }


  /*
    PVP UI can show ready immediately.

    This is separate from selecting
    a character through the popup.
  */

  if (
    currentMode ===
      'pvp'
  ) {

    characterReady =
      true;


    renderCharacterCards();
  }


  socket.emit(
    'ready_character'
  );
}


// ============================================
// MATCH TEAMMATE
// ============================================

function getMatchTeammateUsername() {

  if (
    !currentSquad
  ) {

    return null;
  }


  const teammate =
    currentSquad
      .members
      .find(
        member =>

          member.username !==
          playerName
      );


  return teammate
    ? teammate.username
    : null;
}


// ============================================
// RENDER CHARACTER CARDS
// ============================================

function renderCharacterCards() {

  const cards = {

    cheng_xiaoshi:
      document.getElementById(
        'card-cheng'
      ),

    lu_guang:
      document.getElementById(
        'card-lu'
      )
  };


  let teammateLockedCharacter =
    null;


  if (
    currentMode ===
      'match'
  ) {

    const teammate =
      getMatchTeammateUsername();


    if (
      teammate &&
      matchCharacterState
        .ready[
          teammate
        ]
    ) {

      teammateLockedCharacter =
        matchCharacterState
          .selections[
            teammate
          ];
    }
  }


  Object
    .entries(
      cards
    )
    .forEach(
      ([
        character,
        card
      ]) => {

        if (
          !card
        ) {

          return;
        }


        const disabled =

          teammateLockedCharacter ===
            character &&

          selectedCharacter !==
            character;


        card
          .classList
          .toggle(

            'active',

            selectedCharacter ===
              character
          );


        card
          .classList
          .toggle(

            'character-disabled',

            disabled
          );


        card
          .classList
          .toggle(

            'character-locked',

            characterReady &&
            selectedCharacter ===
              character
          );
      }
    );


  document
    .getElementById(
      'my-pick-display'
    )
    .innerText =

      `You: ${characterDisplayName(
        selectedCharacter
      )}${
        characterReady
          ? ' 🔒'
          : ''
      }`;


  document
    .getElementById(
      'ready-character-btn'
    )
    .disabled =

      !selectedCharacter ||
      characterReady;


  const message =
    document.getElementById(
      'character-select-message'
    );


  if (
    characterReady
  ) {

    message.innerText =

      currentMode ===
        'pvp'

        ? 'Ready. Waiting for the rest of the squad...'

        : 'Character locked. Waiting for your teammate...';

  } else if (
    selectedCharacter
  ) {

    message.innerText =

      currentMode ===
        'pvp'

        ? `${characterDisplayName(
            selectedCharacter
          )} selected. Press READY to confirm.`

        : `${characterDisplayName(
            selectedCharacter
          )} selected. Press LOCK CHARACTER to confirm.`;

  } else {

    message.innerText =
      'Click a character to view their information.';
  }
}


// ============================================
// PVP OWN SELECTION
// ============================================

socket.on(
  'pvp_own_selection',
  ({
    character
  }) => {

    selectedCharacter =
      character;


    renderCharacterCards();
  }
);


// ============================================
// PVP READY COUNT
// ============================================

socket.on(
  'pvp_ready_state',
  ({
    readyCount,
    memberCount
  }) => {

    document
      .getElementById(
        'pvp-ready-counter'
      )
      .innerText =

        `${readyCount} / ${memberCount} READY`;


    renderCharacterCards();
  }
);


// ============================================
// MATCH CHARACTER STATE
// ============================================

socket.on(
  'match_character_state',
  data => {

    matchCharacterState = {

      selections:
        data.selections ||
        {},

      ready:
        data.ready ||
        {}
    };


    selectedCharacter =

      matchCharacterState
        .selections[
          playerName
        ] ||

      selectedCharacter;


    characterReady =
      Boolean(

        matchCharacterState
          .ready[
            playerName
          ]
      );


    const teammate =
      getMatchTeammateUsername();


    const teammateDisplay =
      document.getElementById(
        'teammate-pick-display'
      );


    if (
      teammateDisplay
    ) {

      const teammateSelection =
        teammate

          ? matchCharacterState
              .selections[
                teammate
              ]

          : null;


      const teammateReady =
        teammate

          ? matchCharacterState
              .ready[
                teammate
              ]

          : false;


      teammateDisplay.innerText =

        `${
          teammate ||
          'Teammate'
        }: ${
          characterDisplayName(
            teammateSelection
          )
        }${
          teammateReady
            ? ' 🔒'
            : ''
        }`;
    }


    renderCharacterCards();
  }
);


// ============================================
// CHARACTER ERROR
// ============================================

socket.on(
  'character_error',
  ({
    message
  }) => {

    /*
      If server rejects something,
      make sure local PVP state
      does not remain falsely locked.
    */

    if (
      currentMode ===
      'pvp'
    ) {

      characterReady =
        false;


      renderCharacterCards();
    }


    document
      .getElementById(
        'character-select-message'
      )
      .innerText =

        message ||
        'Character selection error.';
  }
);