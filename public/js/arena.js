let scene;

let camera;

let renderer;

let localPlayerContainer;

let localRenderedPlayer =
  null;

let localPlayerId =
  null;

let arenaInitialized =
  false;

let animationStarted =
  false;

let pointerLocked =
  false;

let yaw =
  0;

let pitch =
  0;

let lastFrameTime =
  performance.now();

let lastNetworkSend =
  0;

let lastSentYaw =
  0;

let lastSentPitch =
  0;

let isSpectator =
  false;

let spectatorIndex =
  0;

let matchEnded =
  false;


// =====================================================
// QIAO ULT CAMERA STATE
// =====================================================

/*
  IMPORTANT:

  This is NOT a second camera.

  There is still only the normal Three.js
  `camera`.

  This number simply controls how much the
  normal Shift-lock camera has transitioned
  into Qiao's temporary aerial view.

  0 = completely normal Shift-lock
  1 = Qiao DAMAGE airborne view
*/

let qiaoUltCameraBlend =
  0;


/*
  True only while LOCAL Qiao is airborne.
*/

let qiaoUltCameraActive =
  false;


// =====================================================
// RENDERED STATE
// =====================================================

const remotePlayers =
  {};

const keys =
  {};

const projectiles =
  {};

const punchAnimations =
  {};

const deathAnimations =
  {};

const qiaoBoxingAnimations =
  {};

const qiaoDamageVisuals =
  {};

const qiaoImpactAnimations =
  [];


// =====================================================
// LOCAL COMBAT STATE
// =====================================================

let selfCombat = {

  character:
    null,

  hp:
    850,

  maxHp:
    850,

  alive:
    true,

  stunnedUntil:
    0,

  /*
    Everyone briefly stops moving
    during their basic attack.
  */

  attackLockedUntil:
    0,

  /*
    Prevents actions during things such
    as Qiao's airborne DAMAGE animation.

    Does NOT stop WASD movement.
  */

  actionLockedUntil:
    0,

  // CHENG

  speedBuffUntil:
    0,

  // QIAO

  mobilityUntil:
    0,

  airborneUntil:
    0,

  // GENERAL

  strengthenUntil:
    0,

  // COOLDOWNS

  basicReadyAt:
    0,

  controlReadyAt:
    0,

  strengthenReadyAt:
    0,

  // LU SHIELD

  shieldHp:
    0,

  shieldMaxHp:
    0,

  shieldUntil:
    0
};


// =====================================================
// ARENA START
// =====================================================

socket.on(
  'arena_started',
  ({
    mode,
    players
  }) => {

    currentMode =
      mode;


    characterReady =
      true;


    matchEnded =
      false;


    isSpectator =
      false;


    spectatorIndex =
      0;


    qiaoUltCameraActive =
      false;


    qiaoUltCameraBlend =
      0;


    const me =
      players.find(
        player =>
          player.name ===
          playerName
      );


    if (
      me
    ) {

      localPlayerId =
        me.id;


      selectedCharacter =
        me.character;


      selfCombat.character =
        me.character;


      selfCombat.hp =
        me.hp ??
        850;


      selfCombat.maxHp =
        me.maxHp ??
        850;


      selfCombat.alive =
        me.alive !==
        false;


      selfCombat.shieldHp =
        me.shieldHp ||
        0;


      selfCombat.shieldMaxHp =
        me.shieldMaxHp ||
        0;


      selfCombat.shieldUntil =
        me.shieldUntil ||
        0;


      updateAbilityNames();
    }


    document
      .querySelectorAll(
        '.screen'
      )
      .forEach(
        screen => {

          screen.style.display =
            'none';
        }
      );


    document
      .getElementById(
        'ui-layer'
      )
      .style.display =
        'block';


    document
      .getElementById(
        'hud-role'
      )
      .innerText =

        `${
          mode ===
            'pvp'

            ? 'PVP ARENA'

            : 'MATCH'
        } • ${
          characterDisplayName(
            selectedCharacter
          ).toUpperCase()
        }`;


    document
      .getElementById(
        'match-result'
      )
      .innerText =
        '';


    document
      .getElementById(
        'spectator-controls'
      )
      .style.display =
        'none';


    if (
      !arenaInitialized
    ) {

      initArena(
        players
      );


      arenaInitialized =
        true;

    } else {

      syncArenaPlayers(
        players
      );
    }


    socket.emit(
      'combat_request_state'
    );
  }
);


// =====================================================
// ABILITY HUD NAMES
// =====================================================

function updateAbilityNames() {

  const basicName =
    document.getElementById(
      'basic-name'
    );


  const abilityName =
    document.getElementById(
      'ability-name'
    );


  const ultName =
    document.getElementById(
      'ult-name'
    );


  const instructions =
    document.getElementById(
      'instructions'
    );


  // CHENG

  if (
    selectedCharacter ===
      'cheng_xiaoshi'
  ) {

    basicName.innerText =
      'PUNCH';


    abilityName.innerText =
      'CONTROL';


    ultName.innerText =
      'STRENGTHEN';


    instructions.innerText =
      'WASD Move • SHIFT Camera • SPACE Punch • Q Control • E Strengthen';


    return;
  }


  // LU

  if (
    selectedCharacter ===
      'lu_guang'
  ) {

    basicName.innerText =
      'LASER';


    abilityName.innerText =
      'SHIELD';


    ultName.innerText =
      'STRENGTHEN';


    instructions.innerText =
      'WASD Move • SHIFT Camera • SPACE Laser • Q Shield • E Strengthen';


    return;
  }


  // QIAO

  if (
    selectedCharacter ===
      'qiao_ling'
  ) {

    basicName.innerText =
      'BOXING';


    abilityName.innerText =
      'MOBILITY';


    ultName.innerText =
      'DAMAGE';


    instructions.innerText =
      'WASD Move • SHIFT Camera • SPACE Boxing • Q Mobility • E Damage';


    return;
  }


  basicName.innerText =
    'BASIC';


  abilityName.innerText =
    'ABILITY';


  ultName.innerText =
    'ULTIMATE';


  instructions.innerText =
    'WASD Move • SHIFT Camera • SPACE Basic • Q Ability • E Ultimate';
}


// =====================================================
// NAMEPLATE TEXTURE
// =====================================================

function makeNameplateTexture(
  player
) {

  const canvas =
    document.createElement(
      'canvas'
    );


  canvas.width =
    512;


  canvas.height =
    128;


  const ctx =
    canvas.getContext(
      '2d'
    );


  const hp =
    Math.max(
      0,
      player.hp ??
      player.maxHp ??
      850
    );


  const maxHp =
    Math.max(
      1,
      player.maxHp ??
      850
    );


  const ratio =
    hp /
    maxHp;


  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  // NAME

  ctx.font =
    'bold 34px Segoe UI';


  ctx.textAlign =
    'center';


  ctx.textBaseline =
    'middle';


  ctx.fillStyle =
    '#ffffff';


  ctx.strokeStyle =
    'rgba(0,0,0,0.9)';


  ctx.lineWidth =
    7;


  ctx.strokeText(
    player.name ||
    'Agent',
    256,
    30
  );


  ctx.fillText(
    player.name ||
    'Agent',
    256,
    30
  );


  // HEALTH BAR

  const barX =
    76;

  const barY =
    62;

  const barW =
    360;

  const barH =
    28;


  ctx.fillStyle =
    'rgba(0,0,0,0.8)';


  ctx.fillRect(
    barX - 4,
    barY - 4,
    barW + 8,
    barH + 8
  );


  ctx.fillStyle =
    '#3a3a3a';


  ctx.fillRect(
    barX,
    barY,
    barW,
    barH
  );


  if (
    ratio >
    0.5
  ) {

    ctx.fillStyle =
      '#39e66d';

  } else if (
    ratio >
    0.25
  ) {

    ctx.fillStyle =
      '#f6c945';

  } else {

    ctx.fillStyle =
      '#ff4d4d';
  }


  ctx.fillRect(
    barX,
    barY,
    barW * ratio,
    barH
  );


  // HP NUMBER

  ctx.font =
    'bold 22px Segoe UI';


  ctx.fillStyle =
    '#ffffff';


  ctx.strokeStyle =
    'rgba(0,0,0,0.9)';


  ctx.lineWidth =
    5;


  const hpText =
    `${Math.ceil(
      hp
    )} / ${Math.ceil(
      maxHp
    )}`;


  ctx.strokeText(
    hpText,
    256,
    108
  );


  ctx.fillText(
    hpText,
    256,
    108
  );


  return new THREE.CanvasTexture(
    canvas
  );
}


// =====================================================
// UPDATE NAMEPLATE
// =====================================================

function updateNameplate(
  rendered,
  hp,
  maxHp
) {

  if (
    !rendered ||
    !rendered.nameplate
  ) {

    return;
  }


  rendered.playerData.hp =
    hp;


  rendered.playerData.maxHp =
    maxHp;


  const oldMap =
    rendered
      .nameplate
      .material
      .map;


  rendered
    .nameplate
    .material
    .map =

      makeNameplateTexture(
        rendered.playerData
      );


  rendered
    .nameplate
    .material
    .needsUpdate =
      true;


  if (
    oldMap
  ) {

    oldMap.dispose();
  }
}


// =====================================================
// PLAYER MODEL
// =====================================================

function createPlayerObject(
  player
) {

  const container =
    new THREE.Group();


  const isLocalPlayer =
    player.name ===
    playerName;


  const color =

    player.character ===
      'cheng_xiaoshi'

      ? 0x3388ff

      : player.character ===
          'lu_guang'

        ? 0xe6e6e6

        : player.character ===
            'qiao_ling'

          ? 0xff6f91

          : 0xcccccc;


  // BODY

  const body =
    new THREE.Mesh(

      new THREE.BoxGeometry(
        0.8,
        1.8,
        0.4
      ),

      new THREE.MeshStandardMaterial({

        color,

        transparent:
          isLocalPlayer,

        opacity:
          isLocalPlayer
            ? 0.6
            : 1,

        depthWrite:
          !isLocalPlayer
      })
    );


  body.position.y =
    0.9;


  // FACING POINTER

  const pointer =
    new THREE.Mesh(

      new THREE.ConeGeometry(
        0.3,
        0.6,
        3
      ),

      new THREE.MeshStandardMaterial({
        color:
          0x00ffff
      })
    );


  pointer.rotation.x =
    -Math.PI /
    2;


  pointer.position.set(
    0,
    0.9,
    -0.4
  );


  // RIGHT ARM

  const rightArm =
    new THREE.Group();


  rightArm.position.set(
    0.25,
    1.35,
    -0.15
  );


  const armMesh =
    new THREE.Mesh(

      new THREE.BoxGeometry(
        0.24,
        0.24,
        0.8
      ),

      new THREE.MeshStandardMaterial({

        color,

        transparent:
          isLocalPlayer,

        opacity:
          isLocalPlayer
            ? 0.8
            : 1,

        depthWrite:
          !isLocalPlayer
      })
    );


  armMesh.position.z =
    -0.32;


  rightArm.add(
    armMesh
  );


  // RIGHT LEG

  const rightLeg =
    new THREE.Group();


  rightLeg.position.set(
    0.22,
    0.75,
    0
  );


  const legMesh =
    new THREE.Mesh(

      new THREE.BoxGeometry(
        0.30,
        1.0,
        0.30
      ),

      new THREE.MeshStandardMaterial({

        color,

        transparent:
          isLocalPlayer,

        opacity:
          isLocalPlayer
            ? 0.8
            : 1,

        depthWrite:
          !isLocalPlayer
      })
    );


  legMesh.position.y =
    -0.42;


  rightLeg.add(
    legMesh
  );


  // QIAO MOBILITY AURA

  const mobilityAura =
    new THREE.Mesh(

      new THREE.TorusGeometry(
        0.82,
        0.05,
        6,
        28
      ),

      new THREE.MeshBasicMaterial({

        color:
          0xff6f91,

        transparent:
          true,

        opacity:
          0,

        depthWrite:
          false
      })
    );


  mobilityAura.rotation.x =
    Math.PI /
    2;


  mobilityAura.position.y =
    0.08;


  // NAMEPLATE

  const nameplateMaterial =
    new THREE.SpriteMaterial({

      map:
        makeNameplateTexture(
          player
        ),

      transparent:
        true,

      depthTest:
        false
    });


  const nameplate =
    new THREE.Sprite(
      nameplateMaterial
    );


  nameplate.position.set(
    0,
    2.55,
    0
  );


  nameplate.scale.set(
    3.8,
    0.95,
    1
  );


  nameplate.renderOrder =
    999;


  // STRENGTHEN AURA

  const aura =
    new THREE.Mesh(

      new THREE.TorusGeometry(
        0.75,
        0.08,
        8,
        32
      ),

      new THREE.MeshBasicMaterial({

        color:
          0x66fcf1,

        transparent:
          true,

        opacity:
          0
      })
    );


  aura.rotation.x =
    Math.PI /
    2;


  aura.position.y =
    0.08;


  // LU SHIELD

  const shield =
    new THREE.Mesh(

      new THREE.SphereGeometry(
        1.15,
        20,
        14
      ),

      new THREE.MeshBasicMaterial({

        color:
          0x66fcf1,

        transparent:
          true,

        opacity:
          0,

        wireframe:
          true,

        depthWrite:
          false
      })
    );


  shield.position.y =
    1.0;


  container.add(
    body
  );


  container.add(
    pointer
  );


  container.add(
    rightArm
  );


  container.add(
    rightLeg
  );


  container.add(
    mobilityAura
  );


  container.add(
    nameplate
  );


  container.add(
    aura
  );


  container.add(
    shield
  );


  return {

    container,

    body,

    rightArm,

    rightLeg,

    mobilityAura,

    nameplate,

    aura,

    shield,

    strengthenUntil:
      0,

    mobilityUntil:
      0,

    playerData: {
      ...player
    },

    targetPosition:
      new THREE.Vector3(
        player.x ||
        0,
        0,
        player.z ||
        0
      ),

    targetRotation:
      player.rotation ||
      0
  };
}


// =====================================================
// INITIALIZE THREE.JS
// =====================================================

function initArena(
  initialPlayers
) {

  const canvas =
    document.getElementById(
      'game-canvas'
    );


  scene =
    new THREE.Scene();


  scene.background =
    new THREE.Color(
      0x111116
    );


  camera =
    new THREE.PerspectiveCamera(

      60,

      window.innerWidth /
      window.innerHeight,

      0.1,

      1000
    );


  renderer =
    new THREE.WebGLRenderer({

      canvas,

      antialias:
        true
    });


  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );


  // FLOOR

  const floor =
    new THREE.Mesh(

      new THREE.PlaneGeometry(
        50,
        50
      ),

      new THREE.MeshStandardMaterial({
        color:
          0x22252a
      })
    );


  floor.rotation.x =
    -Math.PI /
    2;


  scene.add(
    floor
  );


  scene.add(

    new THREE.GridHelper(
      50,
      50,
      0x00ffff,
      0x444444
    )
  );


  scene.add(

    new THREE.AmbientLight(
      0xffffff,
      0.6
    )
  );


  const directionalLight =
    new THREE.DirectionalLight(
      0xffffff,
      0.8
    );


  directionalLight
    .position
    .set(
      10,
      20,
      10
    );


  scene.add(
    directionalLight
  );


  syncArenaPlayers(
    initialPlayers
  );


  // ===================================================
  // KEY DOWN
  // ===================================================

  window.addEventListener(
    'keydown',
    event => {

      const key =
        event.key
          .toLowerCase();


      keys[key] =
        true;


      // SPECTATOR

      if (
        isSpectator
      ) {

        if (
          event.key ===
            'ArrowLeft' ||
          key ===
            'a'
        ) {

          cycleSpectator(
            -1
          );
        }


        if (
          event.key ===
            'ArrowRight' ||
          key ===
            'd'
        ) {

          cycleSpectator(
            1
          );
        }


        return;
      }


      // SPACE

      if (
        event.code ===
        'Space'
      ) {

        event.preventDefault();


        tryBasicAttack();
      }


      // Q

      if (
        key ===
        'q'
      ) {

        tryAbility();
      }


      // E

      if (
        key ===
        'e'
      ) {

        tryUlt();
      }


      // SHIFT

      if (
        event.key ===
        'Shift'
      ) {

        if (
          !pointerLocked
        ) {

          canvas
            .requestPointerLock();

        } else {

          document
            .exitPointerLock();
        }
      }
    }
  );


  // ===================================================
  // KEY UP
  // ===================================================

  window.addEventListener(
    'keyup',
    event => {

      keys[
        event.key
          .toLowerCase()
      ] =
        false;
    }
  );


  // ===================================================
  // POINTER LOCK
  // ===================================================

  document.addEventListener(
    'pointerlockchange',
    () => {

      pointerLocked =
        document
          .pointerLockElement ===
        canvas;
    }
  );


  // ===================================================
  // MOUSE / SHIFT-LOCK CAMERA
  // ===================================================

  document.addEventListener(
    'mousemove',
    event => {

      if (
        !pointerLocked ||
        !localPlayerContainer ||
        isSpectator ||
        !selfCombat.alive
      ) {

        return;
      }


      /*
        Horizontal mouse movement ALWAYS works.

        This includes Qiao's DAMAGE.

        So during the ult you can still turn
        around exactly like normal Shift-lock.
      */

      yaw -=
        event.movementX *
        0.003;


      /*
        Normally:
        mouse Y changes pitch.

        During Qiao DAMAGE:
        vertical mouse input is simply ignored.

        We do NOT overwrite `pitch`.

        Therefore whatever angle you had before
        the ult is preserved and restored after.
      */

      if (
        !qiaoUltCameraActive
      ) {

        pitch =
          Math.max(

            -Math.PI /
            3,

            Math.min(

              Math.PI /
              6,

              pitch -
              event.movementY *
              0.003
            )
          );
      }


      localPlayerContainer
        .rotation
        .y =
          yaw;
    }
  );


  // ===================================================
  // RESIZE
  // ===================================================

  window.addEventListener(
    'resize',
    () => {

      if (
        !camera ||
        !renderer
      ) {

        return;
      }


      camera.aspect =
        window.innerWidth /
        window.innerHeight;


      camera
        .updateProjectionMatrix();


      renderer.setSize(
        window.innerWidth,
        window.innerHeight
      );
    }
  );


  // ===================================================
  // ANIMATION LOOP
  // ===================================================

  if (
    !animationStarted
  ) {

    animationStarted =
      true;


    lastFrameTime =
      performance.now();


    animateArena();
  }
}


// =====================================================
// CLEAR ARENA PLAYERS
// =====================================================

function clearArenaPlayers() {

  if (
    localPlayerContainer &&
    scene
  ) {

    scene.remove(
      localPlayerContainer
    );
  }


  localPlayerContainer =
    null;


  localRenderedPlayer =
    null;


  localPlayerId =
    null;


  Object
    .keys(
      remotePlayers
    )
    .forEach(
      id => {

        if (
          scene
        ) {

          scene.remove(
            remotePlayers[
              id
            ].container
          );
        }


        delete remotePlayers[
          id
        ];
      }
    );


  Object
    .keys(
      projectiles
    )
    .forEach(
      id => {

        removeProjectile(
          id
        );
      }
    );


  Object
    .keys(
      qiaoDamageVisuals
    )
    .forEach(
      playerId => {

        const visual =
          qiaoDamageVisuals[
            playerId
          ];


        if (
          scene &&
          visual.circle
        ) {

          scene.remove(
            visual.circle
          );
        }


        if (
          visual.circle
        ) {

          visual
            .circle
            .geometry
            .dispose();


          visual
            .circle
            .material
            .dispose();
        }


        delete qiaoDamageVisuals[
          playerId
        ];
      }
    );


  while (
    qiaoImpactAnimations.length
  ) {

    const animation =
      qiaoImpactAnimations.pop();


    if (
      scene &&
      animation.mesh
    ) {

      scene.remove(
        animation.mesh
      );
    }


    if (
      animation.mesh
    ) {

      animation
        .mesh
        .geometry
        .dispose();


      animation
        .mesh
        .material
        .dispose();
    }
  }
}


// =====================================================
// INITIAL PLAYER SYNC
// =====================================================

function syncArenaPlayers(
  players
) {

  if (
    !scene
  ) {

    return;
  }


  clearArenaPlayers();


  players.forEach(
    player => {

      const rendered =
        createPlayerObject(
          player
        );


      rendered
        .container
        .position
        .set(

          player.x ||
          0,

          0,

          player.z ||
          0
        );


      rendered
        .container
        .rotation
        .y =
          player.rotation ||
          0;


      scene.add(
        rendered.container
      );


      if (
        player.name ===
        playerName
      ) {

        localPlayerId =
          player.id;


        localPlayerContainer =
          rendered.container;


        localRenderedPlayer =
          rendered;


        yaw =
          player.rotation ||
          0;


        pitch =
          player.pitch ||
          0;

      } else {

        remotePlayers[
          player.id
        ] =
          rendered;
      }
    }
  );
}


// =====================================================
// GET RENDERED PLAYER
// =====================================================

function getRenderedPlayer(
  id
) {

  if (
    id ===
    localPlayerId
  ) {

    return localRenderedPlayer;
  }


  return (
    remotePlayers[
      id
    ] ||
    null
  );
}


// =====================================================
// INPUT
// =====================================================

function tryBasicAttack() {

  if (
    !canLocalAct()
  ) {

    return;
  }


  socket.emit(
    'combat_basic_input'
  );
}


function tryAbility() {

  if (
    !canLocalAct()
  ) {

    return;
  }


  socket.emit(
    'combat_control_input'
  );
}


function tryUlt() {

  if (
    !canLocalAct()
  ) {

    return;
  }


  socket.emit(
    'combat_strengthen_input'
  );
}


// =====================================================
// CAN LOCAL PLAYER ACT?
// =====================================================

function canLocalAct() {

  if (
    currentMode !==
    'pvp'
  ) {

    return false;
  }


  if (
    !selectedCharacter
  ) {

    return false;
  }


  if (
    !selfCombat.alive ||
    isSpectator ||
    matchEnded
  ) {

    return false;
  }


  const now =
    Date.now();


  if (
    now <
    selfCombat.stunnedUntil
  ) {

    return false;
  }


  if (
    now <
    selfCombat.actionLockedUntil
  ) {

    return false;
  }


  return true;
}


// =====================================================
// LOCAL MOVEMENT MULTIPLIER
// =====================================================

function getLocalMovementMultiplier() {

  const now =
    Date.now();


  // CHENG

  if (
    selectedCharacter ===
      'cheng_xiaoshi'
  ) {

    let multiplier =
      1;


    if (
      now <
      selfCombat.speedBuffUntil
    ) {

      multiplier +=
        0.50;
    }


    if (
      now <
      selfCombat.strengthenUntil
    ) {

      multiplier +=
        0.15;
    }


    return multiplier;
  }


  // LU

  if (
    selectedCharacter ===
      'lu_guang'
  ) {

    let multiplier =
      1;


    if (
      now <
      selfCombat.strengthenUntil
    ) {

      multiplier +=
        0.20;
    }


    return multiplier;
  }


  // QIAO

  if (
    selectedCharacter ===
      'qiao_ling'
  ) {

    if (
      now <
      selfCombat.mobilityUntil
    ) {

      /*
        Normal speed = 9.
        Mobility speed = 70.
      */

      return 70 / 9;
    }


    return 1;
  }


  return 1;
}


// =====================================================
// CHENG PUNCH
// =====================================================

function animatePunch(
  playerId
) {

  punchAnimations[
    playerId
  ] = {

    startedAt:
      performance.now(),

    duration:
      220
  };
}


function updatePunchAnimations(
  now
) {

  Object
    .entries(
      punchAnimations
    )
    .forEach(
      ([
        playerId,
        animation
      ]) => {

        const rendered =
          getRenderedPlayer(
            playerId
          );


        if (
          !rendered
        ) {

          delete punchAnimations[
            playerId
          ];


          return;
        }


        const t =
          Math.min(

            1,

            (
              now -
              animation.startedAt
            ) /
            animation.duration
          );


        const punch =
          Math.sin(
            t *
            Math.PI
          );


        rendered
          .rightArm
          .position
          .z =

            -0.15 -
            punch *
            1.35;


        rendered
          .rightArm
          .rotation
          .x =

            -punch *
            0.35;


        if (
          t >=
          1
        ) {

          rendered
            .rightArm
            .position
            .z =
              -0.15;


          rendered
            .rightArm
            .rotation
            .x =
              0;


          delete punchAnimations[
            playerId
          ];
        }
      }
    );
}


// =====================================================
// QIAO BOXING
// =====================================================

function animateQiaoBoxing(
  playerId,
  phase
) {

  qiaoBoxingAnimations[
    playerId
  ] = {

    phase,

    startedAt:
      performance.now(),

    duration:
      phase ===
        'fist'

        ? 120

        : 170
  };
}


function updateQiaoBoxingAnimations(
  now
) {

  Object
    .entries(
      qiaoBoxingAnimations
    )
    .forEach(
      ([
        playerId,
        animation
      ]) => {

        const rendered =
          getRenderedPlayer(
            playerId
          );


        if (
          !rendered
        ) {

          delete qiaoBoxingAnimations[
            playerId
          ];


          return;
        }


        const t =
          Math.min(

            1,

            (
              now -
              animation.startedAt
            ) /
            animation.duration
          );


        const motion =
          Math.sin(
            t *
            Math.PI
          );


        if (
          animation.phase ===
          'fist'
        ) {

          rendered
            .rightArm
            .position
            .z =

              -0.15 -
              motion *
              1.45;


          rendered
            .rightArm
            .rotation
            .x =

              -motion *
              0.25;

        } else {

          /*
            LEG SWEEP
          */

          rendered
            .rightLeg
            .rotation
            .y =

              motion *
              Math.PI *
              0.95;


          rendered
            .rightLeg
            .rotation
            .x =

              -motion *
              0.55;


          rendered
            .body
            .rotation
            .y =

              -motion *
              0.22;
        }


        if (
          t >=
          1
        ) {

          rendered
            .rightArm
            .position
            .z =
              -0.15;


          rendered
            .rightArm
            .rotation
            .x =
              0;


          rendered
            .rightLeg
            .rotation
            .x =
              0;


          rendered
            .rightLeg
            .rotation
            .y =
              0;


          rendered
            .body
            .rotation
            .y =
              0;


          delete qiaoBoxingAnimations[
            playerId
          ];
        }
      }
    );
}


// =====================================================
// QIAO MOBILITY VISUAL
// =====================================================

function updateQiaoMobilityVisuals() {

  const now =
    Date.now();


  const renderedPlayers = [

    localRenderedPlayer,

    ...Object.values(
      remotePlayers
    )

  ].filter(
    Boolean
  );


  renderedPlayers.forEach(
    rendered => {

      const active =
        now <
        (
          rendered.mobilityUntil ||
          0
        );


      rendered
        .mobilityAura
        .material
        .opacity =

          active
            ? 0.72
            : 0;


      if (
        active
      ) {

        rendered
          .mobilityAura
          .rotation
          .z +=
            0.28;


        rendered
          .body
          .rotation
          .x =
            -0.22;

      } else {

        const damageVisual =
          qiaoDamageVisuals[
            rendered
              .playerData
              .id
          ];


        if (
          !damageVisual
        ) {

          rendered
            .body
            .rotation
            .x =
              0;
        }
      }
    }
  );
}


// =====================================================
// QIAO DAMAGE START VISUAL
// =====================================================

function startQiaoDamageVisual(
  data
) {

  const rendered =
    getRenderedPlayer(
      data.playerId
    );


  if (
    !rendered ||
    !scene
  ) {

    return;
  }


  const previous =
    qiaoDamageVisuals[
      data.playerId
    ];


  if (
    previous
  ) {

    scene.remove(
      previous.circle
    );


    previous
      .circle
      .geometry
      .dispose();


    previous
      .circle
      .material
      .dispose();
  }


  /*
    DAMAGE radius = 5.
  */

  const radius =
    data.radius ||
    5;


  /*
    Filled red landing circle.
  */

  const circle =
    new THREE.Mesh(

      new THREE.CircleGeometry(
        radius,
        64
      ),

      new THREE.MeshBasicMaterial({

        color:
          0xff1818,

        transparent:
          true,

        opacity:
          0.40,

        side:
          THREE.DoubleSide,

        depthWrite:
          false
      })
    );


  circle.rotation.x =
    -Math.PI /
    2;


  circle.position.set(

    rendered
      .container
      .position
      .x,

    0.03,

    rendered
      .container
      .position
      .z
  );


  circle.renderOrder =
    20;


  scene.add(
    circle
  );


  qiaoDamageVisuals[
    data.playerId
  ] = {

    playerId:
      data.playerId,

    rendered,

    circle,

    startedAt:
      performance.now(),

    /*
      Airborne for 1 second.
    */

    duration:
      1000,

    /*
      Height = 5.5.
    */

    height:
      data.height ||
      5.5,

    radius
  };
}


// =====================================================
// QIAO DAMAGE LANDING
// =====================================================

function finishQiaoDamageVisual(
  data
) {

  const visual =
    qiaoDamageVisuals[
      data.playerId
    ];


  if (
    visual
  ) {

    visual
      .rendered
      .container
      .position
      .y =
        0;


    visual
      .rendered
      .body
      .rotation
      .x =
        0;


    if (
      scene
    ) {

      scene.remove(
        visual.circle
      );
    }


    visual
      .circle
      .geometry
      .dispose();


    visual
      .circle
      .material
      .dispose();


    delete qiaoDamageVisuals[
      data.playerId
    ];
  }


  if (
    !scene
  ) {

    return;
  }


  // LANDING SHOCKWAVE

  const ring =
    new THREE.Mesh(

      new THREE.RingGeometry(
        0.7,
        1.1,
        64
      ),

      new THREE.MeshBasicMaterial({

        color:
          0xff2020,

        transparent:
          true,

        opacity:
          0.85,

        side:
          THREE.DoubleSide,

        depthWrite:
          false
      })
    );


  ring.rotation.x =
    -Math.PI /
    2;


  ring.position.set(

    data.x,

    0.04,

    data.z
  );


  ring.renderOrder =
    21;


  scene.add(
    ring
  );


  qiaoImpactAnimations.push({

    mesh:
      ring,

    startedAt:
      performance.now(),

    duration:
      300,

    maxScale:

      (
        data.radius ||
        5
      ) /
      1.1
  });
}


// =====================================================
// UPDATE QIAO DAMAGE
// =====================================================

function updateQiaoDamageVisuals(
  now
) {

  Object
    .values(
      qiaoDamageVisuals
    )
    .forEach(
      visual => {

        const rendered =
          visual.rendered;


        if (
          !rendered ||
          !rendered.container
        ) {

          return;
        }


        const elapsed =
          now -
          visual.startedAt;


        const t =
          Math.min(

            1,

            elapsed /
            visual.duration
          );


        /*
          ANIMATION:

          0.00 - 0.20
          fast smooth rise

          0.20 - 0.78
          full-height airborne movement

          0.78 - 1.00
          fast axe-kick descent
        */

        let heightFactor =
          0;


        if (
          t <
          0.20
        ) {

          const riseT =
            t /
            0.20;


          heightFactor =
            Math.sin(

              riseT *
              Math.PI /
              2
            );

        } else if (
          t <
          0.78
        ) {

          heightFactor =
            1;

        } else {

          const fallT =

            (
              t -
              0.78
            ) /
            0.22;


          heightFactor =

            1 -
            Math.pow(
              fallT,
              2.2
            );


          heightFactor =
            Math.max(
              0,
              heightFactor
            );
        }


        rendered
          .container
          .position
          .y =

            visual.height *
            heightFactor;


        /*
          Body animation.
        */

        if (
          t <
          0.78
        ) {

          rendered
            .body
            .rotation
            .x =
              -0.10;

        } else {

          const diveT =

            (
              t -
              0.78
            ) /
            0.22;


          rendered
            .body
            .rotation
            .x =

              -0.10 -
              diveT *
              0.90;
        }


        /*
          Circle follows Qiao's CURRENT
          X and Z location.
        */

        visual
          .circle
          .position
          .x =

            rendered
              .container
              .position
              .x;


        visual
          .circle
          .position
          .z =

            rendered
              .container
              .position
              .z;


        /*
          Circle ALWAYS stays on floor.
        */

        visual
          .circle
          .position
          .y =
            0.03;


        /*
          Warning pulse.
        */

        const opacityPulse =

          0.36 +
          Math.sin(
            elapsed *
            0.025
          ) *
          0.08;


        visual
          .circle
          .material
          .opacity =
            opacityPulse;


        /*
          Small visual breathing pulse.

          Actual damage radius remains
          exactly 5 on server.
        */

        const scalePulse =

          1 +
          Math.sin(
            elapsed *
            0.018
          ) *
          0.025;


        visual
          .circle
          .scale
          .set(

            scalePulse,

            scalePulse,

            scalePulse
          );
      }
    );


  // LANDING IMPACT RINGS

  for (
    let index =
      qiaoImpactAnimations.length -
      1;

    index >=
      0;

    index -=
      1
  ) {

    const animation =
      qiaoImpactAnimations[
        index
      ];


    const t =
      Math.min(

        1,

        (
          now -
          animation.startedAt
        ) /
        animation.duration
      );


    const scale =

      1 +

      (
        animation.maxScale -
        1
      ) *
      t;


    animation
      .mesh
      .scale
      .set(

        scale,

        scale,

        scale
      );


    animation
      .mesh
      .material
      .opacity =

        0.85 *
        (
          1 -
          t
        );


    if (
      t >=
      1
    ) {

      scene.remove(
        animation.mesh
      );


      animation
        .mesh
        .geometry
        .dispose();


      animation
        .mesh
        .material
        .dispose();


      qiaoImpactAnimations.splice(
        index,
        1
      );
    }
  }
}


// =====================================================
// PROJECTILE VISUAL
// =====================================================

function spawnProjectile(
  data
) {

  let geometry;

  let material;


  // LU LASER

  if (
    data.kind ===
      'lu_laser'
  ) {

    geometry =
      new THREE.BoxGeometry(
        0.13,
        0.13,
        1.25
      );


    material =
      new THREE.MeshBasicMaterial({

        color:
          data.strengthened
            ? 0xffffff
            : 0x66fcf1,

        transparent:
          true,

        opacity:
          0.95
      });

  } else {

    // CHENG CONTROL

    geometry =
      new THREE.SphereGeometry(
        0.34,
        12,
        12
      );


    material =
      new THREE.MeshBasicMaterial({

        color:
          0x66fcf1
      });
  }


  const mesh =
    new THREE.Mesh(
      geometry,
      material
    );


  mesh.position.set(
    data.x,
    1.05,
    data.z
  );


  if (
    data.kind ===
      'lu_laser'
  ) {

    rotateLaserTowardDirection(
      mesh,
      data.direction
    );
  }


  scene.add(
    mesh
  );


  projectiles[
    data.id
  ] = {

    ...data,

    mesh,

    visualLastUpdate:
      performance.now()
  };
}


// =====================================================
// ROTATE LASER
// =====================================================

function rotateLaserTowardDirection(
  mesh,
  direction
) {

  if (
    !mesh ||
    !direction
  ) {

    return;
  }


  mesh.rotation.y =
    Math.atan2(

      direction.x,

      direction.z
    );
}


// =====================================================
// REMOVE PROJECTILE
// =====================================================

function removeProjectile(
  id
) {

  const projectile =
    projectiles[
      id
    ];


  if (
    !projectile
  ) {

    return;
  }


  if (
    scene
  ) {

    scene.remove(
      projectile.mesh
    );
  }


  projectile
    .mesh
    .geometry
    .dispose();


  projectile
    .mesh
    .material
    .dispose();


  delete projectiles[
    id
  ];
}


// =====================================================
// UPDATE PROJECTILES
// =====================================================

function updateProjectiles(
  frameNow
) {

  const serverNow =
    Date.now();


  Object
    .values(
      projectiles
    )
    .forEach(
      projectile => {

        // LU STRENGTHENED HOMING LASER

        if (
          projectile.kind ===
            'lu_laser' &&
          projectile.homing &&
          projectile.targetId
        ) {

          const target =
            getRenderedPlayer(
              projectile.targetId
            );


          if (
            !target
          ) {

            return;
          }


          const previousUpdate =
            projectile.visualLastUpdate ||
            frameNow;


          const dt =
            Math.max(

              0,

              Math.min(

                0.05,

                (
                  frameNow -
                  previousUpdate
                ) /
                1000
              )
            );


          projectile.visualLastUpdate =
            frameNow;


          const targetPosition =
            target
              .container
              .position;


          const dx =
            targetPosition.x -
            projectile
              .mesh
              .position
              .x;


          const dz =
            targetPosition.z -
            projectile
              .mesh
              .position
              .z;


          const distance =
            Math.hypot(
              dx,
              dz
            );


          if (
            distance >
            0
          ) {

            const direction = {

              x:
                dx /
                distance,

              z:
                dz /
                distance
            };


            projectile.direction =
              direction;


            const movement =
              projectile.speed *
              dt;


            const amount =
              Math.min(
                movement,
                distance
              );


            projectile
              .mesh
              .position
              .x +=

                direction.x *
                amount;


            projectile
              .mesh
              .position
              .z +=

                direction.z *
                amount;


            rotateLaserTowardDirection(

              projectile.mesh,

              direction
            );
          }


          return;
        }


        // NORMAL STRAIGHT PROJECTILE

        const elapsed =
          Math.max(

            0,

            (
              serverNow -
              projectile.spawnedAt
            ) /
            1000
          );


        const distance =
          Math.min(

            projectile.maxRange,

            projectile.speed *
            elapsed
          );


        projectile
          .mesh
          .position
          .x =

            projectile.x +
            projectile
              .direction
              .x *
            distance;


        projectile
          .mesh
          .position
          .z =

            projectile.z +
            projectile
              .direction
              .z *
            distance;


        if (
          projectile.kind ===
            'lu_laser'
        ) {

          rotateLaserTowardDirection(

            projectile.mesh,

            projectile.direction
          );

        } else {

          projectile
            .mesh
            .rotation
            .x +=
              0.15;


          projectile
            .mesh
            .rotation
            .y +=
              0.20;
        }
      }
    );
}


// =====================================================
// STRENGTHEN VISUAL
// =====================================================

function updateStrengthenVisuals() {

  const now =
    Date.now();


  const renderedPlayers = [

    localRenderedPlayer,

    ...Object.values(
      remotePlayers
    )

  ].filter(
    Boolean
  );


  renderedPlayers.forEach(
    rendered => {

      const until =
        rendered
          .strengthenUntil ||
        0;


      const active =
        now <
        until;


      rendered
        .aura
        .material
        .opacity =

          active
            ? 0.75
            : 0;


      if (
        active
      ) {

        rendered
          .aura
          .rotation
          .z +=
            0.04;
      }
    }
  );
}


// =====================================================
// SHIELD VISUAL
// =====================================================

function updateShieldVisuals() {

  const now =
    Date.now();


  const renderedPlayers = [

    localRenderedPlayer,

    ...Object.values(
      remotePlayers
    )

  ].filter(
    Boolean
  );


  renderedPlayers.forEach(
    rendered => {

      const shieldHp =
        rendered
          .playerData
          .shieldHp ||
        0;


      const shieldUntil =
        rendered
          .playerData
          .shieldUntil ||
        0;


      const active =

        shieldHp >
        0 &&

        now <
        shieldUntil;


      rendered
        .shield
        .material
        .opacity =

          active
            ? 0.35
            : 0;


      if (
        active
      ) {

        rendered
          .shield
          .rotation
          .y +=
            0.02;


        rendered
          .shield
          .rotation
          .x +=
            0.008;
      }
    }
  );
}


// =====================================================
// DEATH
// =====================================================

function animateDeath(
  playerId
) {

  const rendered =
    getRenderedPlayer(
      playerId
    );


  if (
    !rendered
  ) {

    return;
  }


  deathAnimations[
    playerId
  ] = {

    rendered,

    startedAt:
      performance.now(),

    duration:
      850
  };
}


function updateDeathAnimations(
  now
) {

  Object
    .entries(
      deathAnimations
    )
    .forEach(
      ([
        playerId,
        animation
      ]) => {

        const t =
          Math.min(

            1,

            (
              now -
              animation.startedAt
            ) /
            animation.duration
          );


        animation
          .rendered
          .container
          .rotation
          .z =

            -t *
            Math.PI /
            2;


        const scale =
          Math.max(

            0.01,

            1 -
            Math.max(

              0,

              (
                t -
                0.45
              ) /
              0.55
            )
          );


        animation
          .rendered
          .container
          .scale
          .setScalar(
            scale
          );


        if (
          t >=
          1
        ) {

          if (
            scene
          ) {

            scene.remove(
              animation
                .rendered
                .container
            );
          }


          if (
            playerId !==
            localPlayerId
          ) {

            delete remotePlayers[
              playerId
            ];
          }


          delete deathAnimations[
            playerId
          ];
        }
      }
    );
}


// =====================================================
// COOLDOWN HUD
// =====================================================

function updateCooldownHud() {

  const now =
    Date.now();


  document
    .getElementById(
      'combat-hp'
    )
    .innerText =

      `${Math.ceil(
        selfCombat.hp
      )} / ${Math.ceil(
        selfCombat.maxHp
      )}`;


  const basic =
    document.getElementById(
      'basic-status'
    );


  const ability =
    document.getElementById(
      'control-status'
    );


  const ult =
    document.getElementById(
      'strengthen-status'
    );


  const status =
    document.getElementById(
      'stun-status'
    );


  basic.innerText =
    cooldownText(
      selfCombat.basicReadyAt,
      now
    );


  ability.innerText =
    cooldownText(
      selfCombat.controlReadyAt,
      now
    );


  ult.innerText =
    cooldownText(
      selfCombat.strengthenReadyAt,
      now
    );


  // STUN FIRST

  if (
    now <
    selfCombat.stunnedUntil
  ) {

    status.innerText =
      `STUNNED ${formatSeconds(
        selfCombat.stunnedUntil -
        now
      )}`;


    return;
  }


  // CHENG

  if (
    selectedCharacter ===
      'cheng_xiaoshi'
  ) {

    if (
      now <
      selfCombat.strengthenUntil
    ) {

      status.innerText =
        `STRENGTHEN ACTIVE ${formatSeconds(
          selfCombat.strengthenUntil -
          now
        )}`;

    } else if (
      now <
      selfCombat.speedBuffUntil
    ) {

      status.innerText =
        `CONTROL SPEED +50% ${formatSeconds(
          selfCombat.speedBuffUntil -
          now
        )}`;

    } else {

      status.innerText =
        '';
    }


    return;
  }


  // LU

  if (
    selectedCharacter ===
      'lu_guang'
  ) {

    if (
      now <
      selfCombat.strengthenUntil
    ) {

      status.innerText =
        `STRENGTHEN ACTIVE ${formatSeconds(
          selfCombat.strengthenUntil -
          now
        )}`;

    } else if (
      selfCombat.shieldHp >
      0 &&
      now <
      selfCombat.shieldUntil
    ) {

      status.innerText =
        `SHIELD ${Math.ceil(
          selfCombat.shieldHp
        )} / ${Math.ceil(
          selfCombat.shieldMaxHp
        )} • ${formatSeconds(
          selfCombat.shieldUntil -
          now
        )}`;

    } else {

      status.innerText =
        '';
    }


    return;
  }


  // QIAO

  if (
    selectedCharacter ===
      'qiao_ling'
  ) {

    if (
      now <
      selfCombat.airborneUntil
    ) {

      status.innerText =
        `DAMAGE AIRBORNE ${formatSeconds(
          selfCombat.airborneUntil -
          now
        )}`;

    } else if (
      now <
      selfCombat.mobilityUntil
    ) {

      status.innerText =
        `MOBILITY ${formatSeconds(
          selfCombat.mobilityUntil -
          now
        )}`;

    } else {

      status.innerText =
        '';
    }


    return;
  }


  status.innerText =
    '';
}


// =====================================================
// COOLDOWN TEXT
// =====================================================

function cooldownText(
  readyAt,
  now
) {

  const remaining =
    Math.max(
      0,
      readyAt -
      now
    );


  if (
    remaining <=
    0
  ) {

    return 'READY';
  }


  return formatSeconds(
    remaining
  );
}


// =====================================================
// FORMAT SECONDS
// =====================================================

function formatSeconds(
  milliseconds
) {

  return `${
    (
      milliseconds /
      1000
    ).toFixed(
      1
    )
  }s`;
}


// =====================================================
// REMOTE MOVEMENT
// =====================================================

function updateRemoteInterpolation(
  dt
) {

  Object
    .values(
      remotePlayers
    )
    .forEach(
      rendered => {

        /*
          IMPORTANT:

          Interpolate X/Z only.

          Qiao DAMAGE animation controls Y.
        */

        rendered
          .container
          .position
          .x =

            THREE.MathUtils.lerp(

              rendered
                .container
                .position
                .x,

              rendered
                .targetPosition
                .x,

              Math.min(
                1,
                dt *
                18
              )
            );


        rendered
          .container
          .position
          .z =

            THREE.MathUtils.lerp(

              rendered
                .container
                .position
                .z,

              rendered
                .targetPosition
                .z,

              Math.min(
                1,
                dt *
                18
              )
            );


        const current =
          rendered
            .container
            .rotation
            .y;


        let difference =
          rendered
            .targetRotation -
          current;


        difference =
          Math.atan2(

            Math.sin(
              difference
            ),

            Math.cos(
              difference
            )
          );


        rendered
          .container
          .rotation
          .y +=

            difference *
            Math.min(
              1,
              dt *
              20
            );
      }
    );
}


// =====================================================
// UPDATE QIAO CAMERA BLEND
// =====================================================

function updateQiaoUltCameraBlend(
  dt
) {

  /*
    Fast and smooth.

    We are NOT changing cameras.

    We are simply changing where the SAME
    camera wants to sit.
  */

  const targetBlend =
    qiaoUltCameraActive
      ? 1
      : 0;


  /*
    16 makes the transition quick enough
    for a 1-second ult without snapping.
  */

  const transitionAmount =
    Math.min(
      1,
      dt *
      16
    );


  qiaoUltCameraBlend =
    THREE.MathUtils.lerp(

      qiaoUltCameraBlend,

      targetBlend,

      transitionAmount
    );


  if (
    qiaoUltCameraBlend >
    0.998
  ) {

    qiaoUltCameraBlend =
      1;
  }


  if (
    qiaoUltCameraBlend <
    0.002
  ) {

    qiaoUltCameraBlend =
      0;
  }
}


// =====================================================
// UPDATE NORMAL + QIAO SHIFT-LOCK CAMERA
// =====================================================

function updatePlayerCamera(
  dt
) {

  if (
    !localPlayerContainer ||
    !camera
  ) {

    return;
  }


  updateQiaoUltCameraBlend(
    dt
  );


  /*
    =====================================================
    NORMAL SHIFT-LOCK CAMERA
    =====================================================

    This preserves your original camera
    behavior outside Qiao's ult.
  */

  const normalCameraOffset =
    new THREE.Vector3(

      0,

      2.5 +
      pitch *
      3,

      5
    );


  normalCameraOffset
    .applyAxisAngle(

      new THREE.Vector3(
        0,
        1,
        0
      ),

      yaw
    );


  const normalCameraPosition =
    localPlayerContainer
      .position
      .clone()
      .add(
        normalCameraOffset
      );


  const normalLookTarget =
    localPlayerContainer
      .position
      .clone()
      .add(

        new THREE.Vector3(
          0,
          1.2,
          0
        )
      );


  /*
    =====================================================
    QIAO DAMAGE SHIFT-LOCK CAMERA
    =====================================================

    SAME camera.

    SAME yaw.

    SAME player follow.

    The only differences are:

    - camera moves much higher
    - camera moves slightly farther back
    - camera aims almost straight down
    - vertical mouse movement is locked
  */


  /*
    Horizontal distance behind Qiao.

    Keeping SOME distance behind her instead
    of exactly above her means horizontal yaw
    is still visually meaningful.

    You can rotate around her during the ult
    exactly like Shift-lock.
  */

  const ultBackDistance =
    2.2;


  /*
    Direction behind the character based
    on the SAME normal yaw.
  */

  const ultBackwardOffset =
    new THREE.Vector3(

      Math.sin(
        yaw
      ) *
      ultBackDistance,

      0,

      Math.cos(
        yaw
      ) *
      ultBackDistance
    );


  /*
    Qiao itself rises to 5.5 units.

    This camera position is relative to her
    current position, so it follows her
    smoothly while she is moving in air.
  */

  const ultCameraPosition =
    localPlayerContainer
      .position
      .clone()
      .add(

        new THREE.Vector3(
          0,
          8.5,
          0
        )
      )
      .add(
        ultBackwardOffset
      );


  /*
    Aim at the FLOOR below Qiao.

    This is why the radius-5 red circle is
    clearly visible while choosing landing.

    Since the camera retains that 2.2-unit
    horizontal offset, it is nearly vertical
    but does not become an unnatural perfectly
    fixed 90-degree security-camera view.
  */

  const ultLookTarget =
    new THREE.Vector3(

      localPlayerContainer
        .position
        .x,

      0,

      localPlayerContainer
        .position
        .z
    );


  /*
    =====================================================
    BLEND THE SAME CAMERA BETWEEN THE TWO POSITIONS
    =====================================================

    There is never a camera switch.

    We calculate where the normal Shift-lock
    camera wants to be and where the temporary
    Qiao Shift-lock position wants to be, then
    smoothly move the SAME camera between them.
  */

  const desiredCameraPosition =
    normalCameraPosition
      .clone()
      .lerp(

        ultCameraPosition,

        qiaoUltCameraBlend
      );


  const desiredLookTarget =
    normalLookTarget
      .clone()
      .lerp(

        ultLookTarget,

        qiaoUltCameraBlend
      );


  /*
    Extra physical smoothing of the camera.

    This prevents even the desired-position
    transition itself from looking jerky.
  */

  const cameraFollowAmount =
    Math.min(
      1,
      dt *
      20
    );


  camera
    .position
    .lerp(

      desiredCameraPosition,

      cameraFollowAmount
    );


  /*
    Store a persistent look target so the
    camera rotation is also interpolated
    instead of abruptly calling lookAt()
    on a completely different point.
  */

  if (
    !camera.userData
      .smoothLookTarget
  ) {

    camera.userData
      .smoothLookTarget =
        normalLookTarget.clone();
  }


  camera
    .userData
    .smoothLookTarget
    .lerp(

      desiredLookTarget,

      cameraFollowAmount
    );


  camera.lookAt(

    camera
      .userData
      .smoothLookTarget
  );
}


// =====================================================
// MAIN LOOP
// =====================================================

function animateArena(
  now =
    performance.now()
) {

  requestAnimationFrame(
    animateArena
  );


  if (
    !renderer ||
    !scene ||
    !camera
  ) {

    return;
  }


  const dt =
    Math.min(

      0.05,

      Math.max(

        0,

        (
          now -
          lastFrameTime
        ) /
        1000
      )
    );


  lastFrameTime =
    now;


  // ANIMATIONS

  updatePunchAnimations(
    now
  );


  updateQiaoBoxingAnimations(
    now
  );


  updateDeathAnimations(
    now
  );


  updateProjectiles(
    now
  );


  updateStrengthenVisuals();


  updateShieldVisuals();


  updateQiaoMobilityVisuals();


  /*
    Remote movement first.
  */

  updateRemoteInterpolation(
    dt
  );


  /*
    Then Qiao Y animation so interpolation
    cannot force her back onto the floor.
  */

  updateQiaoDamageVisuals(
    now
  );


  updateCooldownHud();


  // ===================================================
  // SPECTATOR
  // ===================================================

  if (
    isSpectator
  ) {

    updateSpectatorCamera();


    renderer.render(
      scene,
      camera
    );


    return;
  }


  if (
    !localPlayerContainer ||
    !selfCombat.alive
  ) {

    renderer.render(
      scene,
      camera
    );


    return;
  }


  // ===================================================
  // MOVEMENT
  // ===================================================

  const nowMs =
    Date.now();


  const stunned =
    nowMs <
    selfCombat.stunnedUntil;


  const basicMovementLocked =
    nowMs <
    selfCombat.attackLockedUntil;


  let moved =
    false;


  const moveVector =
    new THREE.Vector3();


  /*
    Qiao CAN move during DAMAGE.

    actionLockedUntil only prevents actions.

    Movement is prevented by:
    - stun
    - basic attack lock
    - match ending
  */

  if (
    !stunned &&
    !basicMovementLocked &&
    !matchEnded
  ) {

    if (
      keys.w
    ) {

      moveVector.z -=
        1;


      moved =
        true;
    }


    if (
      keys.s
    ) {

      moveVector.z +=
        1;


      moved =
        true;
    }


    if (
      keys.a
    ) {

      moveVector.x -=
        1;


      moved =
        true;
    }


    if (
      keys.d
    ) {

      moveVector.x +=
        1;


      moved =
        true;
    }
  }


  if (
    moved
  ) {

    const baseSpeed =
      9;


    const movement =

      baseSpeed *

      getLocalMovementMultiplier() *

      dt;


    moveVector
      .normalize()
      .multiplyScalar(
        movement
      );


    moveVector
      .applyAxisAngle(

        new THREE.Vector3(
          0,
          1,
          0
        ),

        yaw
      );


    /*
      Change X/Z only.

      Never add movement to Y because
      Qiao's airborne animation owns Y.
    */

    localPlayerContainer
      .position
      .x +=
        moveVector.x;


    localPlayerContainer
      .position
      .z +=
        moveVector.z;


    // ARENA LIMIT

    localPlayerContainer
      .position
      .x =

        Math.max(

          -24,

          Math.min(

            24,

            localPlayerContainer
              .position
              .x
          )
        );


    localPlayerContainer
      .position
      .z =

        Math.max(

          -24,

          Math.min(

            24,

            localPlayerContainer
              .position
              .z
          )
        );
  }


  localPlayerContainer
    .rotation
    .y =
      yaw;


  // ===================================================
  // NETWORK MOVEMENT
  // ===================================================

  const orientationChanged =

    Math.abs(
      yaw -
      lastSentYaw
    ) >
    0.002 ||

    Math.abs(
      pitch -
      lastSentPitch
    ) >
    0.002;


  if (
    (
      moved ||
      orientationChanged
    ) &&
    now -
    lastNetworkSend >=
    33
  ) {

    socket.emit(
      'player_move',
      {

        x:
          localPlayerContainer
            .position
            .x,

        z:
          localPlayerContainer
            .position
            .z,

        rotation:
          yaw,

        pitch
      }
    );


    lastNetworkSend =
      now;


    lastSentYaw =
      yaw;


    lastSentPitch =
      pitch;
  }


  // ===================================================
  // SAME SMOOTH SHIFT-LOCK CAMERA
  // ===================================================

  updatePlayerCamera(
    dt
  );


  renderer.render(
    scene,
    camera
  );
}


// =====================================================
// SPECTATOR
// =====================================================

function livingSpectatorTargets() {

  return Object
    .values(
      remotePlayers
    )
    .filter(
      rendered =>

        rendered
          .playerData
          .alive !==
        false &&

        rendered
          .container
          .parent
    );
}


function cycleSpectator(
  direction
) {

  const targets =
    livingSpectatorTargets();


  if (
    !targets.length
  ) {

    return;
  }


  spectatorIndex =

    (
      spectatorIndex +
      direction +
      targets.length
    ) %
    targets.length;


  showSpectatorTarget(
    targets[
      spectatorIndex
    ]
  );
}


function showSpectatorTarget(
  target
) {

  document
    .getElementById(
      'spectator-target'
    )
    .innerText =

      `SPECTATING: ${
        target
          .playerData
          .name
      }`;
}


function updateSpectatorCamera() {

  const targets =
    livingSpectatorTargets();


  if (
    !targets.length
  ) {

    return;
  }


  spectatorIndex =
    Math.min(

      spectatorIndex,

      targets.length -
      1
    );


  const target =
    targets[
      spectatorIndex
    ];


  showSpectatorTarget(
    target
  );


  const targetYaw =
    target
      .container
      .rotation
      .y ||
    0;


  const targetPitch =
    target
      .playerData
      .pitch ||
    0;


  const cameraOffset =
    new THREE.Vector3(

      0,

      2.5 +
      targetPitch *
      3,

      5
    );


  cameraOffset
    .applyAxisAngle(

      new THREE.Vector3(
        0,
        1,
        0
      ),

      targetYaw
    );


  const desiredPosition =
    target
      .container
      .position
      .clone()
      .add(
        cameraOffset
      );


  /*
    Keep spectator camera smooth too.
  */

  camera
    .position
    .lerp(

      desiredPosition,

      0.22
    );


  const lookTarget =
    target
      .container
      .position
      .clone()
      .add(

        new THREE.Vector3(
          0,
          1.2,
          0
        )
      );


  camera.lookAt(
    lookTarget
  );
}


// =====================================================
// REMOTE PLAYER MOVEMENT
// =====================================================

socket.on(
  'player_moved',
  data => {

    if (
      !scene ||
      !data ||
      data.name ===
        playerName
    ) {

      return;
    }


    if (
      !remotePlayers[
        data.id
      ]
    ) {

      const rendered =
        createPlayerObject(
          data
        );


      remotePlayers[
        data.id
      ] =
        rendered;


      scene.add(
        rendered.container
      );
    }


    const rendered =
      remotePlayers[
        data.id
      ];


    rendered
      .playerData
      .x =
        data.x;


    rendered
      .playerData
      .z =
        data.z;


    rendered
      .playerData
      .rotation =
        data.rotation;


    rendered
      .playerData
      .pitch =
        data.pitch ||
        0;


    if (
      data.hp !==
      undefined
    ) {

      rendered
        .playerData
        .hp =
          data.hp;
    }


    if (
      data.maxHp !==
      undefined
    ) {

      rendered
        .playerData
        .maxHp =
          data.maxHp;
    }


    if (
      data.shieldHp !==
      undefined
    ) {

      rendered
        .playerData
        .shieldHp =
          data.shieldHp;
    }


    if (
      data.shieldUntil !==
      undefined
    ) {

      rendered
        .playerData
        .shieldUntil =
          data.shieldUntil;
    }


    rendered
      .targetPosition
      .set(

        data.x,

        0,

        data.z
      );


    rendered
      .targetRotation =
        data.rotation;
  }
);


// =====================================================
// POSITION CORRECTION
// =====================================================

socket.on(
  'player_position_correction',
  data => {

    if (
      !localPlayerContainer
    ) {

      return;
    }


    /*
      Preserve Y.

      Qiao DAMAGE owns vertical position.
    */

    localPlayerContainer
      .position
      .x =
        data.x;


    localPlayerContainer
      .position
      .z =
        data.z;


    yaw =
      data.rotation ??
      yaw;


    pitch =
      data.pitch ??
      pitch;
  }
);


// =====================================================
// SELF COMBAT STATE
// =====================================================

socket.on(
  'combat_self_state',
  data => {

    selfCombat = {

      ...selfCombat,

      ...data
    };


    if (
      data.character
    ) {

      selfCombat.character =
        data.character;


      selectedCharacter =
        data.character;


      updateAbilityNames();
    }
  }
);


// =====================================================
// BASIC RESET
// =====================================================

socket.on(
  'combat_basic_reset',
  () => {

    selfCombat.basicReadyAt =
      0;
  }
);


// =====================================================
// CHENG BASIC
// =====================================================

socket.on(
  'combat_basic_attack',
  data => {

    if (
      !data.character ||
      data.character ===
        'cheng_xiaoshi'
    ) {

      animatePunch(
        data.attackerId
      );
    }
  }
);


// =====================================================
// UNIVERSAL BASIC MOVEMENT LOCK
// =====================================================

socket.on(
  'combat_movement_locked',
  data => {

    selfCombat.attackLockedUntil =
      Math.max(

        selfCombat.attackLockedUntil ||
        0,

        data.until ||
        0
      );
  }
);


// =====================================================
// QIAO BOXING
// =====================================================

socket.on(
  'combat_qiao_boxing',
  data => {

    animateQiaoBoxing(

      data.playerId,

      data.phase
    );
  }
);


// =====================================================
// QIAO MOBILITY
// =====================================================

socket.on(
  'combat_qiao_mobility',
  data => {

    const rendered =
      getRenderedPlayer(
        data.playerId
      );


    if (
      rendered
    ) {

      rendered.mobilityUntil =
        data.until;
    }


    if (
      data.playerId ===
      localPlayerId
    ) {

      selfCombat.mobilityUntil =
        data.until;
    }
  }
);


// =====================================================
// QIAO DAMAGE START
// =====================================================

socket.on(
  'combat_qiao_damage_started',
  data => {

    startQiaoDamageVisual(
      data
    );


    if (
      data.playerId ===
      localPlayerId
    ) {

      selfCombat.airborneUntil =
        data.until;


      selfCombat.actionLockedUntil =
        data.until;


      /*
        The SAME Shift-lock camera now
        smoothly transitions downward.

        Mouse X remains usable.

        Mouse Y becomes temporarily locked.
      */

      qiaoUltCameraActive =
        true;
    }
  }
);


// =====================================================
// QIAO DAMAGE IMPACT
// =====================================================

socket.on(
  'combat_qiao_damage_impact',
  data => {

    finishQiaoDamageVisual(
      data
    );


    if (
      data.playerId ===
      localPlayerId
    ) {

      selfCombat.airborneUntil =
        0;


      selfCombat.actionLockedUntil =
        0;


      /*
        Same camera smoothly returns to
        the exact normal Shift-lock view.
      */

      qiaoUltCameraActive =
        false;
    }
  }
);


// =====================================================
// PROJECTILE EVENTS
// =====================================================

socket.on(
  'combat_projectile_spawn',
  data => {

    if (
      data.kind ===
        'cheng_control'
    ) {

      animatePunch(
        data.ownerId
      );
    }


    spawnProjectile(
      data
    );
  }
);


socket.on(
  'combat_projectile_hit',
  data => {

    removeProjectile(
      data.id
    );
  }
);


socket.on(
  'combat_projectile_expired',
  data => {

    removeProjectile(
      data.id
    );
  }
);


// =====================================================
// HEALTH
// =====================================================

socket.on(
  'combat_health_update',
  data => {

    const rendered =
      getRenderedPlayer(
        data.playerId
      );


    if (
      rendered
    ) {

      rendered
        .playerData
        .hp =
          data.hp;


      rendered
        .playerData
        .maxHp =
          data.maxHp;


      if (
        data.shieldHp !==
        undefined
      ) {

        rendered
          .playerData
          .shieldHp =
            data.shieldHp;
      }


      updateNameplate(

        rendered,

        data.hp,

        data.maxHp
      );
    }


    if (
      data.playerId ===
      localPlayerId
    ) {

      selfCombat.hp =
        data.hp;


      selfCombat.maxHp =
        data.maxHp;


      if (
        data.shieldHp !==
        undefined
      ) {

        selfCombat.shieldHp =
          data.shieldHp;
      }
    }
  }
);


// =====================================================
// STUN
// =====================================================

socket.on(
  'combat_stunned',
  data => {

    if (
      data.playerId ===
      localPlayerId
    ) {

      selfCombat.stunnedUntil =
        data.until;
    }
  }
);


// =====================================================
// CHENG SPEED
// =====================================================

socket.on(
  'combat_speed_buff',
  data => {

    if (
      data.playerId ===
      localPlayerId
    ) {

      selfCombat.speedBuffUntil =
        data.until;
    }
  }
);


// =====================================================
// STRENGTHEN
// =====================================================

socket.on(
  'combat_strengthen_started',
  data => {

    const rendered =
      getRenderedPlayer(
        data.playerId
      );


    if (
      rendered
    ) {

      rendered.strengthenUntil =
        data.until;
    }


    if (
      data.playerId ===
      localPlayerId
    ) {

      selfCombat.strengthenUntil =
        data.until;
    }
  }
);


// =====================================================
// LU SHIELD START
// =====================================================

socket.on(
  'combat_shield_started',
  data => {

    const rendered =
      getRenderedPlayer(
        data.playerId
      );


    if (
      rendered
    ) {

      rendered
        .playerData
        .shieldHp =
          data.shieldHp;


      rendered
        .playerData
        .shieldMaxHp =
          data.shieldMaxHp;


      rendered
        .playerData
        .shieldUntil =
          data.until;
    }


    if (
      data.playerId ===
      localPlayerId
    ) {

      selfCombat.shieldHp =
        data.shieldHp;


      selfCombat.shieldMaxHp =
        data.shieldMaxHp;


      selfCombat.shieldUntil =
        data.until;
    }
  }
);


// =====================================================
// LU SHIELD UPDATE
// =====================================================

socket.on(
  'combat_shield_update',
  data => {

    const rendered =
      getRenderedPlayer(
        data.playerId
      );


    if (
      rendered
    ) {

      rendered
        .playerData
        .shieldHp =
          data.shieldHp;


      rendered
        .playerData
        .shieldMaxHp =
          data.shieldMaxHp;


      rendered
        .playerData
        .shieldUntil =
          data.shieldUntil;
    }


    if (
      data.playerId ===
      localPlayerId
    ) {

      selfCombat.shieldHp =
        data.shieldHp;


      selfCombat.shieldMaxHp =
        data.shieldMaxHp;


      selfCombat.shieldUntil =
        data.shieldUntil;
    }
  }
);


// =====================================================
// DEATH
// =====================================================

socket.on(
  'combat_player_died',
  data => {

    const rendered =
      getRenderedPlayer(
        data.playerId
      );


    if (
      rendered
    ) {

      rendered
        .playerData
        .alive =
          false;
    }


    animateDeath(
      data.playerId
    );


    if (
      data.playerId ===
      localPlayerId
    ) {

      selfCombat.alive =
        false;


      /*
        If Qiao somehow dies while the
        camera transition is active,
        return it cleanly.
      */

      qiaoUltCameraActive =
        false;


      isSpectator =
        true;


      if (
        document
          .pointerLockElement
      ) {

        document
          .exitPointerLock();
      }


      document
        .getElementById(
          'spectator-controls'
        )
        .style.display =
          'block';


      setTimeout(
        () => {

          cycleSpectator(
            1
          );

        },
        900
      );
    }
  }
);


// =====================================================
// MATCH END
// =====================================================

socket.on(
  'combat_match_ended',
  data => {

    matchEnded =
      true;


    document
      .getElementById(
        'match-result'
      )
      .innerText =

        data.winnerName ===
        playerName

          ? 'YOU WIN'

          : `${
              data.winnerName
            } WINS`;
  }
);


// =====================================================
// RETURN TO SQUAD
// =====================================================

socket.on(
  'return_to_squad',
  () => {

    document
      .getElementById(
        'ui-layer'
      )
      .style.display =
        'none';


    if (
      document
        .pointerLockElement
    ) {

      document
        .exitPointerLock();
    }


    clearArenaPlayers();


    qiaoUltCameraActive =
      false;


    qiaoUltCameraBlend =
      0;


    /*
      Clear old smoothed camera target.

      Next round creates a fresh one.
    */

    if (
      camera &&
      camera.userData
    ) {

      delete camera
        .userData
        .smoothLookTarget;
    }


    isSpectator =
      false;


    matchEnded =
      false;


    selectedCharacter =
      null;


    characterReady =
      false;


    selfCombat = {

      character:
        null,

      hp:
        850,

      maxHp:
        850,

      alive:
        true,

      stunnedUntil:
        0,

      attackLockedUntil:
        0,

      actionLockedUntil:
        0,

      speedBuffUntil:
        0,

      mobilityUntil:
        0,

      airborneUntil:
        0,

      strengthenUntil:
        0,

      basicReadyAt:
        0,

      controlReadyAt:
        0,

      strengthenReadyAt:
        0,

      shieldHp:
        0,

      shieldMaxHp:
        0,

      shieldUntil:
        0
    };


    showScreen(
      'team-screen'
    );


    socket.emit(
      'request_squad_state'
    );
  }
);


// =====================================================
// PLAYER LEFT
// =====================================================

socket.on(
  'player_left',
  id => {

    if (
      !remotePlayers[
        id
      ] ||
      !scene
    ) {

      return;
    }


    scene.remove(
      remotePlayers[
        id
      ].container
    );


    delete remotePlayers[
      id
    ];


    if (
      isSpectator
    ) {

      cycleSpectator(
        1
      );
    }
  }
);


// =====================================================
// ABORT
// =====================================================

function leaveGame() {

  document
    .getElementById(
      'ui-layer'
    )
    .style.display =
      'none';


  if (
    document
      .pointerLockElement
  ) {

    document
      .exitPointerLock();
  }


  clearArenaPlayers();


  qiaoUltCameraActive =
    false;


  qiaoUltCameraBlend =
    0;


  if (
    camera &&
    camera.userData
  ) {

    delete camera
      .userData
      .smoothLookTarget;
  }


  socket.emit(
    'leave_squad'
  );


  currentSquad =
    null;


  currentMode =
    null;


  selectedCharacter =
    null;


  characterReady =
    false;


  showScreen(
    'lobby-screen'
  );
}