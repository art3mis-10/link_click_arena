let scene;

let camera;

let renderer;

let localPlayerContainer;

let localPlayerId = null;

let arenaInitialized = false;

let animationStarted = false;

let pointerLocked = false;

let yaw = 0;

let pitch = 0;


const remotePlayers = {};

const keys = {};


// ============================================
// ARENA START
// ============================================

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
    }


    document
      .querySelectorAll(
        '.screen'
      )
      .forEach(screen => {

        screen.style.display =
          'none';
      });


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
  }
);


// ============================================
// CREATE PROFILE PICTURE SPRITE
// ============================================

function createAvatarSprite(
  avatarUrl,
  username
) {

  if (avatarUrl) {

    const texture =
      new THREE.TextureLoader()
        .load(
          avatarUrl
        );


    const material =
      new THREE.SpriteMaterial({
        map:
          texture,

        transparent:
          true
      });


    const sprite =
      new THREE.Sprite(
        material
      );


    sprite.scale.set(
      1.2,
      1.2,
      1
    );


    sprite.position.set(
      0,
      2.4,
      0
    );


    return sprite;
  }


  const canvas =
    document.createElement(
      'canvas'
    );


  canvas.width =
    128;


  canvas.height =
    128;


  const context =
    canvas.getContext(
      '2d'
    );


  context.fillStyle =
    '#00ffff';


  context.beginPath();


  context.arc(
    64,
    64,
    60,
    0,
    Math.PI * 2
  );


  context.fill();


  context.fillStyle =
    '#071015';


  context.font =
    'bold 64px Segoe UI';


  context.textAlign =
    'center';


  context.textBaseline =
    'middle';


  context.fillText(
    (
      username ||
      '?'
    )
      .charAt(0)
      .toUpperCase(),

    64,
    68
  );


  const texture =
    new THREE.CanvasTexture(
      canvas
    );


  const material =
    new THREE.SpriteMaterial({
      map:
        texture,

      transparent:
        true
    });


  const sprite =
    new THREE.Sprite(
      material
    );


  sprite.scale.set(
    1.2,
    1.2,
    1
  );


  sprite.position.set(
    0,
    2.4,
    0
  );


  return sprite;
}


// ============================================
// CREATE PLAYER OBJECT
// ============================================

function createPlayerObject(
  player
) {

  const container =
    new THREE.Group();


  const color =
    player.character ===
    'cheng_xiaoshi'

      ? 0x3388ff
      : 0xcccccc;


  const body =
    new THREE.Mesh(

      new THREE.BoxGeometry(
        0.8,
        1.8,
        0.4
      ),

      new THREE.MeshStandardMaterial({
        color
      })
    );


  body.position.y =
    0.9;


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
    -Math.PI / 2;


  pointer.position.set(
    0,
    0.9,
    -0.4
  );


  const avatar =
    createAvatarSprite(

      player.avatar || '',

      player.name ||
      'Agent'
    );


  container.add(
    body
  );


  container.add(
    pointer
  );


  container.add(
    avatar
  );


  return {
    container
  };
}


// ============================================
// INITIALIZE ARENA
// ============================================

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
    -Math.PI / 2;


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


  // ==========================================
  // KEYBOARD
  // ==========================================

  window.addEventListener(
    'keydown',
    event => {

      keys[
        event.key
          .toLowerCase()
      ] =
        true;


      if (
        event.key ===
        'Shift'
      ) {

        if (!pointerLocked) {

          canvas
            .requestPointerLock();

        } else {

          document
            .exitPointerLock();
        }
      }
    }
  );


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


  // ==========================================
  // POINTER LOCK
  // ==========================================

  document.addEventListener(
    'pointerlockchange',
    () => {

      pointerLocked =
        document
          .pointerLockElement ===
        canvas;
    }
  );


  document.addEventListener(
    'mousemove',
    event => {

      if (
        !pointerLocked ||
        !localPlayerContainer
      ) {

        return;
      }


      yaw -=
        event.movementX *
        0.003;


      pitch =
        Math.max(

          -Math.PI / 4,

          Math.min(

            Math.PI / 6,

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


  // ==========================================
  // WINDOW RESIZE
  // ==========================================

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


  if (!animationStarted) {

    animationStarted =
      true;


    animateArena();
  }
}


// ============================================
// CLEAR PLAYERS
// ============================================

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


  localPlayerId =
    null;


  Object
    .keys(remotePlayers)
    .forEach(id => {

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
    });
}


// ============================================
// SYNC INITIAL PLAYER POSITIONS
// ============================================

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

          player.x || 0,

          0,

          player.z || 0
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


        yaw =
          player.rotation ||
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


// ============================================
// ARENA LOOP
// ============================================

function animateArena() {

  requestAnimationFrame(
    animateArena
  );


  if (
    !renderer ||
    !scene ||
    !camera ||
    !localPlayerContainer
  ) {

    return;
  }


  let moved =
    false;


  const moveVector =
    new THREE.Vector3();


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


  if (moved) {

    moveVector
      .normalize()
      .multiplyScalar(
        0.15
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


    /*
      Keep player on platform.
    */

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
          yaw
      }
    );
  }


  const cameraOffset =
    new THREE.Vector3(

      0,

      2.5 +
      pitch * 3,

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


// ============================================
// OTHER PLAYERS MOVE
// ============================================

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


    remotePlayers[
      data.id
    ]
      .container
      .position
      .set(

        data.x,

        0,

        data.z
      );


    remotePlayers[
      data.id
    ]
      .container
      .rotation
      .y =
        data.rotation;
  }
);


// ============================================
// PLAYER LEAVES ARENA
// ============================================

socket.on(
  'player_left',
  id => {

    if (
      !remotePlayers[id] ||
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
  }
);


// ============================================
// LEAVE GAME
// ============================================

function leaveGame() {

  document
    .getElementById(
      'ui-layer'
    )
    .style.display =
      'none';


  if (
    document.pointerLockElement
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


  showScreen(
    'lobby-screen'
  );
}