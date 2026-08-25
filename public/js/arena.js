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


/*
  This object stores the LOCAL
  player's combat information.

  It now supports BOTH Cheng
  and Lu Guang.
*/

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

  speedBuffUntil:
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


    const me =
      players.find(
        player =>
          player.name ===
          playerName
      );


    if (me) {

      localPlayerId =
        me.id;


      selectedCharacter =
        me.character;


      selfCombat.character =
        me.character;


      /*
        Character HP comes from server.

        Cheng = 850
        Lu Guang = 600
      */

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
          mode === 'pvp'
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


    if (!arenaInitialized) {

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


  /*
    Future character fallback.
  */

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
// NAME + HEALTH BAR TEXTURE
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


  // -----------------------------------------------------
  // NAME
  // -----------------------------------------------------

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


  // -----------------------------------------------------
  // HEALTH BAR
  // -----------------------------------------------------

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
    ratio > 0.5
  ) {

    ctx.fillStyle =
      '#39e66d';

  } else if (
    ratio > 0.25
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


  // -----------------------------------------------------
  // HP NUMBERS
  // -----------------------------------------------------

  ctx.font =
    'bold 22px Segoe UI';


  ctx.fillStyle =
    '#ffffff';


  ctx.strokeStyle =
    'rgba(0,0,0,0.9)';


  ctx.lineWidth =
    5;


  const hpText =
    `${Math.ceil(hp)} / ${Math.ceil(maxHp)}`;


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


  if (oldMap) {

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


  /*
    Temporary colors:

    Cheng = blue
    Lu = pale white
  */

  const color =

    player.character ===
      'cheng_xiaoshi'

      ? 0x3388ff

      : player.character ===
          'lu_guang'

        ? 0xe6e6e6

        : 0xcccccc;


  // -----------------------------------------------------
  // BODY
  // -----------------------------------------------------

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


  // -----------------------------------------------------
  // FACING POINTER
  // -----------------------------------------------------

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


  // -----------------------------------------------------
  // CHENG PUNCH ARM
  // -----------------------------------------------------

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


  // -----------------------------------------------------
  // NAME + HP
  // -----------------------------------------------------

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


  // -----------------------------------------------------
  // STRENGTHEN AURA
  // -----------------------------------------------------

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


  // -----------------------------------------------------
  // LU GUANG SHIELD
  // -----------------------------------------------------

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


  // -----------------------------------------------------
  // ADD EVERYTHING
  // -----------------------------------------------------

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

    nameplate,

    aura,

    shield,

    strengthenUntil:
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


  // -----------------------------------------------------
  // FLOOR
  // -----------------------------------------------------

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


  // -----------------------------------------------------
  // KEY DOWN
  // -----------------------------------------------------

  window.addEventListener(
    'keydown',
    event => {

      const key =
        event.key
          .toLowerCase();


      keys[key] =
        true;


      // -----------------------------------------------
      // SPECTATOR
      // -----------------------------------------------

      if (isSpectator) {

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


      // -----------------------------------------------
      // SPACE — BASIC
      // -----------------------------------------------

      if (
        event.code ===
        'Space'
      ) {

        event.preventDefault();


        tryBasicAttack();
      }


      // -----------------------------------------------
      // Q — ABILITY
      // -----------------------------------------------

      if (
        key ===
        'q'
      ) {

        tryAbility();
      }


      // -----------------------------------------------
      // E — ULT
      // -----------------------------------------------

      if (
        key ===
        'e'
      ) {

        tryUlt();
      }


      // -----------------------------------------------
      // SHIFT — POINTER LOCK
      // -----------------------------------------------

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


  // -----------------------------------------------------
  // KEY UP
  // -----------------------------------------------------

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


  // -----------------------------------------------------
  // POINTER LOCK
  // -----------------------------------------------------

  document.addEventListener(
    'pointerlockchange',
    () => {

      pointerLocked =
        document
          .pointerLockElement ===
        canvas;
    }
  );


  // -----------------------------------------------------
  // MOUSE CAMERA
  // -----------------------------------------------------

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


      yaw -=
        event.movementX *
        0.003;


      pitch =
        Math.max(

          -Math.PI /
          4,

          Math.min(

            Math.PI /
            6,

            pitch -
            event.movementY *
            0.003
          )
        );


      localPlayerContainer
        .rotation
        .y =
          yaw;
    }
  );


  // -----------------------------------------------------
  // RESIZE
  // -----------------------------------------------------

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


  // -----------------------------------------------------
  // ANIMATION LOOP
  // -----------------------------------------------------

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
// REMOVE ARENA PLAYERS
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

        if (scene) {

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
}


// =====================================================
// INITIAL PLAYER SYNC
// =====================================================

function syncArenaPlayers(
  players
) {

  if (!scene) {

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
// FIND RENDERED PLAYER
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
    remotePlayers[id] ||
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


// =====================================================
// Q
// =====================================================

function tryAbility() {

  if (
    !canLocalAct()
  ) {

    return;
  }


  /*
    The event name is still
    combat_control_input because
    the server already uses that
    as the generic Q input.

    Cheng:
      Q = Control

    Lu:
      Q = Shield
  */

  socket.emit(
    'combat_control_input'
  );
}


// =====================================================
// E
// =====================================================

function tryUlt() {

  if (
    !canLocalAct()
  ) {

    return;
  }


  /*
    Existing server event is
    kept unchanged.

    Both current characters use
    Strengthen as E anyway.
  */

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


  /*
    IMPORTANT:

    We DO NOT check for Cheng here anymore.

    Any selected/implemented character
    may send Space/Q/E.

    The server determines what those
    inputs mean.
  */

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


  if (
    Date.now() <
    selfCombat.stunnedUntil
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


  // -----------------------------------------------------
  // CHENG
  // -----------------------------------------------------

  if (
    selectedCharacter ===
      'cheng_xiaoshi'
  ) {

    let multiplier =
      1;


    /*
      Successful Control hit:
      +50%
    */

    if (
      now <
      selfCombat.speedBuffUntil
    ) {

      multiplier +=
        0.50;
    }


    /*
      Strengthen:
      +15%
    */

    if (
      now <
      selfCombat.strengthenUntil
    ) {

      multiplier +=
        0.15;
    }


    return multiplier;
  }


  // -----------------------------------------------------
  // LU GUANG
  // -----------------------------------------------------

  if (
    selectedCharacter ===
      'lu_guang'
  ) {

    let multiplier =
      1;


    /*
      Strengthen:
      +20%
    */

    if (
      now <
      selfCombat.strengthenUntil
    ) {

      multiplier +=
        0.20;
    }


    return multiplier;
  }


  return 1;
}


// =====================================================
// CHENG PUNCH ANIMATION
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


// =====================================================
// UPDATE PUNCH
// =====================================================

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


        if (!rendered) {

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
// PROJECTILE VISUAL
// =====================================================

function spawnProjectile(
  data
) {

  let geometry;

  let material;


  // -----------------------------------------------------
  // LU GUANG LASER
  // -----------------------------------------------------

  if (
    data.kind ===
      'lu_laser'
  ) {

    /*
      Long narrow beam.
      Box points along its Z axis.
    */

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

    // ---------------------------------------------------
    // CHENG CONTROL
    // ---------------------------------------------------

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


  /*
    Make Lu's beam visually point
    in the direction it is flying.
  */

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


  if (!projectile) {

    return;
  }


  if (scene) {

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

        // ------------------------------------------------
        // HOMING LU GUANG STRENGTHEN LASER
        // ------------------------------------------------

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


          if (!target) {

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


            /*
              Don't visually overshoot.
            */

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


        // ------------------------------------------------
        // NORMAL STRAIGHT PROJECTILE
        // ------------------------------------------------

        /*
          spawnedAt comes from server.

          If packet arrives a little late,
          immediately render farther along
          its path.
        */

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

          /*
            Cheng Control orb spin.
          */

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

  ].filter(Boolean);


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


      if (active) {

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

  ].filter(Boolean);


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


      if (active) {

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
// DEATH ANIMATION
// =====================================================

function animateDeath(
  playerId
) {

  const rendered =
    getRenderedPlayer(
      playerId
    );


  if (!rendered) {

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


// =====================================================
// UPDATE DEATH
// =====================================================

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


        // ------------------------------------------------
        // TIP OVER
        // ------------------------------------------------

        animation
          .rendered
          .container
          .rotation
          .z =

            -t *
            Math.PI /
            2;


        // ------------------------------------------------
        // SHRINK
        // ------------------------------------------------

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

          if (scene) {

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


  // -----------------------------------------------------
  // STUN HAS PRIORITY
  // -----------------------------------------------------

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


  // -----------------------------------------------------
  // CHENG
  // -----------------------------------------------------

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


  // -----------------------------------------------------
  // LU GUANG
  // -----------------------------------------------------

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
    ).toFixed(1)
  }s`;
}


// =====================================================
// SMOOTH REMOTE MOVEMENT
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

        rendered
          .container
          .position
          .lerp(

            rendered
              .targetPosition,

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


  updatePunchAnimations(
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


  updateCooldownHud();


  updateRemoteInterpolation(
    dt
  );


  // -----------------------------------------------------
  // SPECTATOR
  // -----------------------------------------------------

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


  const stunned =
    Date.now() <
    selfCombat.stunnedUntil;


  let moved =
    false;


  const moveVector =
    new THREE.Vector3();


  if (
    !stunned &&
    !matchEnded
  ) {

    if (keys.w) {

      moveVector.z -=
        1;


      moved =
        true;
    }


    if (keys.s) {

      moveVector.z +=
        1;


      moved =
        true;
    }


    if (keys.a) {

      moveVector.x -=
        1;


      moved =
        true;
    }


    if (keys.d) {

      moveVector.x +=
        1;


      moved =
        true;
    }
  }


  // -----------------------------------------------------
  // LOCAL MOVEMENT
  // -----------------------------------------------------

  if (moved) {

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


    localPlayerContainer
      .position
      .add(
        moveVector
      );


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


  // -----------------------------------------------------
  // ~30HZ NETWORK UPDATE
  // -----------------------------------------------------

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


  // -----------------------------------------------------
  // CAMERA
  // -----------------------------------------------------

  const cameraOffset =
    new THREE.Vector3(

      0,

      2.5 +
      pitch *
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

      yaw
    );


  camera
    .position
    .copy(
      localPlayerContainer
        .position
    )
    .add(
      cameraOffset
    );


  camera.lookAt(

    localPlayerContainer
      .position
      .clone()
      .add(

        new THREE.Vector3(
          0,
          1.2,
          0
        )
      )
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


// =====================================================
// CYCLE SPECTATOR
// =====================================================

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


// =====================================================
// SHOW SPECTATOR TARGET
// =====================================================

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


// =====================================================
// SPECTATOR CAMERA
// =====================================================

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


  camera
    .position
    .copy(
      target
        .container
        .position
    )
    .add(
      cameraOffset
    );


  camera.lookAt(

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
      )
  );
}


// =====================================================
// OTHER PLAYER MOVEMENT
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


    /*
      Also preserve combat data included
      in publicPlayer().
    */

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
// MOVEMENT CORRECTION
// =====================================================

socket.on(
  'player_position_correction',
  data => {

    if (
      !localPlayerContainer
    ) {

      return;
    }


    localPlayerContainer
      .position
      .set(

        data.x,

        0,

        data.z
      );


    yaw =
      data.rotation ??
      yaw;


    pitch =
      data.pitch ??
      pitch;
  }
);


// =====================================================
// PRIVATE COMBAT STATE
// =====================================================

socket.on(
  'combat_self_state',
  data => {

    selfCombat = {

      ...selfCombat,

      ...data
    };


    /*
      Server is authoritative for
      the actual selected character.
    */

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
// CHENG BASIC RESET
// =====================================================

socket.on(
  'combat_basic_reset',
  () => {

    selfCombat.basicReadyAt =
      0;
  }
);


// =====================================================
// BASIC ATTACK ANIMATION
// =====================================================

socket.on(
  'combat_basic_attack',
  data => {

    /*
      Currently this event is Cheng's
      physical punch.

      Lu's basic is represented by
      lu_laser projectile spawns.
    */

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
// PROJECTILE SPAWN
// =====================================================

socket.on(
  'combat_projectile_spawn',
  data => {

    /*
      Cheng throws Control with a
      forward punching motion.

      Lu does NOT punch when firing.
    */

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


// =====================================================
// PROJECTILE HIT
// =====================================================

socket.on(
  'combat_projectile_hit',
  data => {

    removeProjectile(
      data.id
    );
  }
);


// =====================================================
// PROJECTILE EXPIRED
// =====================================================

socket.on(
  'combat_projectile_expired',
  data => {

    removeProjectile(
      data.id
    );
  }
);


// =====================================================
// HEALTH CHANGE
// =====================================================

socket.on(
  'combat_health_update',
  data => {

    const rendered =
      getRenderedPlayer(
        data.playerId
      );


    if (rendered) {

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
// CHENG SPEED BUFF
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


    if (rendered) {

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
// LU GUANG SHIELD START
// =====================================================

socket.on(
  'combat_shield_started',
  data => {

    const rendered =
      getRenderedPlayer(
        data.playerId
      );


    if (rendered) {

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
// LU GUANG SHIELD UPDATE / BREAK / EXPIRE
// =====================================================

socket.on(
  'combat_shield_update',
  data => {

    const rendered =
      getRenderedPlayer(
        data.playerId
      );


    if (rendered) {

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


    if (rendered) {

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
// WINNER
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
// FORCE RETURN TO SQUAD
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

      speedBuffUntil:
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
// PLAYER DISCONNECT
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