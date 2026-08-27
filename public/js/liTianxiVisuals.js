const tianxiMarkSources =
  {};

const tianxiMarkMeshes =
  {};

const tianxiBasicCounts =
  {};

const tianxiBasicCountPulses =
  {};

const tianxiWaves =
  [];

const tianxiBackbursts =
  {};

const tianxiUltVisuals =
  {};

const tianxiHitPulses =
  {};


// =====================================================
// CLEANUP
// =====================================================

function disposeTianxiMesh(
  mesh
) {

  if (!mesh) {
    return;
  }


  if (
    mesh.parent
  ) {

    mesh.parent.remove(
      mesh
    );
  }


  if (
    mesh.geometry
  ) {

    mesh.geometry.dispose();
  }


  if (
    mesh.material
  ) {

    if (
      mesh.material.map
    ) {

      mesh.material.map.dispose();
    }


    mesh.material.dispose();
  }
}


// =====================================================
// BASIC COUNT TEXTURE
// =====================================================

function makeTianxiCountTexture(
  count
) {

  const canvas =
    document.createElement(
      'canvas'
    );


  canvas.width =
    256;


  canvas.height =
    96;


  const ctx =
    canvas.getContext(
      '2d'
    );


  ctx.clearRect(
    0,
    0,
    256,
    96
  );


  ctx.fillStyle =
    'rgba(9, 6, 18, 0.86)';


  ctx.fillRect(
    20,
    10,
    216,
    76
  );


  ctx.strokeStyle =
    '#d790ff';


  ctx.lineWidth =
    4;


  ctx.strokeRect(
    20,
    10,
    216,
    76
  );


  ctx.fillStyle =
    '#f3d8ff';


  ctx.font =
    '900 25px Segoe UI';


  ctx.textAlign =
    'left';


  ctx.textBaseline =
    'middle';


  ctx.fillText(
    `FLUFF ${count}`,
    34,
    35
  );


  /*
    Three visual charge circles.

    count 0 = all dark
    count 1 = first lit
    count 2 = first two lit
  */

  for (
    let index = 0;
    index < 3;
    index += 1
  ) {

    const x =
      67 +
      index *
      55;


    const y =
      65;


    ctx.beginPath();


    ctx.arc(
      x,
      y,
      11,
      0,
      Math.PI *
      2
    );


    ctx.fillStyle =
      index <
      count

        ? '#e69aff'

        : '#403449';


    ctx.fill();


    ctx.strokeStyle =
      '#d790ff';


    ctx.lineWidth =
      2;


    ctx.stroke();
  }


  const texture =
    new THREE.CanvasTexture(
      canvas
    );


  texture.needsUpdate =
    true;


  return texture;
}


// =====================================================
// BASIC COUNT SPRITE
// =====================================================

function ensureTianxiCounter(
  playerId
) {

  const rendered =
    getRenderedPlayer(
      playerId
    );


  if (
    !rendered ||
    rendered.playerData.character !==
      'li_tianxi'
  ) {

    return null;
  }


  if (
    rendered.tianxiCountSprite
  ) {

    return rendered.tianxiCountSprite;
  }


  const material =
    new THREE.SpriteMaterial({

      map:
        makeTianxiCountTexture(

          tianxiBasicCounts[
            playerId
          ] ||
          0
        ),

      transparent:
        true,

      depthTest:
        false
    });


  const sprite =
    new THREE.Sprite(
      material
    );


  sprite.position.set(
    0,
    3.18,
    0
  );


  sprite.scale.set(
    1.75,
    0.66,
    1
  );


  sprite.renderOrder =
    1000;


  rendered.container.add(
    sprite
  );


  rendered.tianxiCountSprite =
    sprite;


  return sprite;
}


function setTianxiCounter(
  playerId,
  count
) {

  const normalized =
    Math.max(

      0,

      Math.min(

        2,

        Number(
          count
        ) ||
        0
      )
    );


  tianxiBasicCounts[
    playerId
  ] =
    normalized;


  tianxiBasicCountPulses[
    playerId
  ] =
    performance.now();


  const sprite =
    ensureTianxiCounter(
      playerId
    );


  if (
    !sprite
  ) {

    return;
  }


  const oldMap =
    sprite.material.map;


  sprite.material.map =
    makeTianxiCountTexture(
      normalized
    );


  sprite.material.needsUpdate =
    true;


  if (
    oldMap
  ) {

    oldMap.dispose();
  }
}


// =====================================================
// FILLED MARK CIRCLE
// =====================================================

function ensureTianxiMarkMesh(
  targetId
) {

  if (
    tianxiMarkMeshes[
      targetId
    ]
  ) {

    return tianxiMarkMeshes[
      targetId
    ];
  }


  if (
    !scene
  ) {

    return null;
  }


  const mesh =
    new THREE.Mesh(

      new THREE.CircleGeometry(
        0.9,
        48
      ),

      new THREE.MeshBasicMaterial({

        color:
          0xd34dff,

        transparent:
          true,

        opacity:
          0.72,

        side:
          THREE.DoubleSide,

        depthWrite:
          false
      })
    );


  /*
    Filled circle FLAT under marked
    player's feet.
  */

  mesh.rotation.x =
    -Math.PI /
    2;


  mesh.position.y =
    0.035;


  mesh.renderOrder =
    18;


  scene.add(
    mesh
  );


  tianxiMarkMeshes[
    targetId
  ] =
    mesh;


  return mesh;
}


// =====================================================
// UPDATE MARKS
// =====================================================

function updateTianxiMarks(
  now
) {

  const nowMs =
    Date.now();


  for (
    const [
      targetId,
      sources
    ]
    of Object.entries(
      tianxiMarkSources
    )
  ) {

    /*
      Client also cleans on timestamp,
      so visual doesn't linger if a packet
      is delayed.
    */

    for (
      const [
        sourceId,
        expiresAt
      ]
      of Object.entries(
        sources
      )
    ) {

      if (
        nowMs >=
        Number(
          expiresAt
        )
      ) {

        delete sources[
          sourceId
        ];
      }
    }


    if (
      !Object.keys(
        sources
      ).length
    ) {

      delete tianxiMarkSources[
        targetId
      ];


      disposeTianxiMesh(
        tianxiMarkMeshes[
          targetId
        ]
      );


      delete tianxiMarkMeshes[
        targetId
      ];


      continue;
    }


    const rendered =
      getRenderedPlayer(
        targetId
      );


    const mesh =
      ensureTianxiMarkMesh(
        targetId
      );


    if (
      !rendered ||
      !mesh
    ) {

      continue;
    }


    mesh.position.x =
      rendered.container.position.x;


    mesh.position.z =
      rendered.container.position.z;


    mesh.position.y =
      0.035;


    /*
      Very obvious pulsing filled mark.
    */

    const pulse =

      1 +

      Math.sin(
        now *
        0.009
      ) *

      0.08;


    mesh.scale.set(
      pulse,
      pulse,
      pulse
    );


    mesh.material.opacity =

      0.62 +

      Math.sin(
        now *
        0.012
      ) *

      0.12;
  }
}


// =====================================================
// Q WAVE
// =====================================================

function createTianxiWave(
  data
) {

  if (
    !scene
  ) {

    return;
  }


  const mesh =
    new THREE.Mesh(

      new THREE.BoxGeometry(

        data.width ||
        12,

        0.07,

        2.4
      ),

      new THREE.MeshBasicMaterial({

        color:
          0xc75cff,

        transparent:
          true,

        opacity:
          0.46,

        depthWrite:
          false
      })
    );


  mesh.position.set(

    data.x,

    0.055,

    data.z
  );


  mesh.rotation.y =
    Math.atan2(

      data.direction.x,

      data.direction.z
    );


  mesh.renderOrder =
    17;


  scene.add(
    mesh
  );


  tianxiWaves.push({

    mesh,

    startX:
      data.x,

    startZ:
      data.z,

    direction:
      data.direction,

    speed:
      data.speed ||
      30,

    duration:
      data.duration ||
      1000,

    startedAt:
      performance.now()
  });
}


function updateTianxiWaves(
  now
) {

  for (
    let index =
      tianxiWaves.length -
      1;

    index >=
      0;

    index -=
      1
  ) {

    const wave =
      tianxiWaves[
        index
      ];


    const elapsed =
      now -
      wave.startedAt;


    const t =
      Math.min(

        1,

        elapsed /
        wave.duration
      );


    const distance =

      wave.speed *

      (
        elapsed /
        1000
      );


    wave.mesh.position.x =

      wave.startX +

      wave.direction.x *
      distance;


    wave.mesh.position.z =

      wave.startZ +

      wave.direction.z *
      distance;


    wave.mesh.material.opacity =

      0.46 *

      (
        1 -
        t *
        0.35
      );


    if (
      t >=
      1
    ) {

      disposeTianxiMesh(
        wave.mesh
      );


      tianxiWaves.splice(
        index,
        1
      );
    }
  }
}


// =====================================================
// Q BACKBURST
// =====================================================

function startTianxiBackburst(
  data
) {

  const rendered =
    getRenderedPlayer(
      data.playerId
    );


  if (
    !rendered
  ) {

    return;
  }


  if (
    !rendered.tianxiBackburstAura
  ) {

    const aura =
      new THREE.Mesh(

        new THREE.TorusGeometry(
          0.9,
          0.07,
          8,
          32
        ),

        new THREE.MeshBasicMaterial({

          color:
            0xe89cff,

          transparent:
            true,

          opacity:
            0,

          depthWrite:
            false
        })
      );


    aura.rotation.x =
      Math.PI /
      2;


    aura.position.y =
      0.08;


    rendered.container.add(
      aura
    );


    rendered.tianxiBackburstAura =
      aura;
  }


  rendered.tianxiBackburstAura
    .material
    .opacity =
      0.85;


  tianxiBackbursts[
    data.playerId
  ] = {

    until:
      data.until,

    rendered
  };
}


function updateTianxiBackbursts() {

  const now =
    Date.now();


  for (
    const [
      playerId,
      state
    ]
    of Object.entries(
      tianxiBackbursts
    )
  ) {

    if (
      !state.rendered ||
      now >=
        state.until
    ) {

      if (
        state.rendered
          ?.tianxiBackburstAura
      ) {

        state.rendered
          .tianxiBackburstAura
          .material
          .opacity =
            0;


        state.rendered
          .body
          .rotation
          .x =
            0;
      }


      delete tianxiBackbursts[
        playerId
      ];


      continue;
    }


    state.rendered
      .tianxiBackburstAura
      .rotation
      .z +=
        0.22;


    state.rendered
      .body
      .rotation
      .x =
        0.18;
  }
}


// =====================================================
// E VISUAL
// =====================================================

function startTianxiUltVisual(
  data
) {

  const rendered =
    getRenderedPlayer(
      data.playerId
    );


  if (
    !rendered
  ) {

    return;
  }


  if (
    !rendered.tianxiUltAura
  ) {

    const aura =
      new THREE.Mesh(

        new THREE.TorusGeometry(
          0.72,
          0.08,
          8,
          28
        ),

        new THREE.MeshBasicMaterial({

          color:
            0xff8df4,

          transparent:
            true,

          opacity:
            0,

          depthWrite:
            false
        })
      );


    aura.rotation.x =
      Math.PI /
      2;


    aura.position.y =
      0.65;


    rendered.container.add(
      aura
    );


    rendered.tianxiUltAura =
      aura;
  }


  rendered.tianxiUltAura
    .material
    .opacity =
      0.9;


  tianxiUltVisuals[
    data.playerId
  ] = {

    rendered,

    targetId:
      data.targetId,

    attached:
      false
  };
}


function attachTianxiUltVisual(
  data
) {

  const state =

    tianxiUltVisuals[
      data.playerId
    ] ||

    {

      rendered:
        getRenderedPlayer(
          data.playerId
        ),

      targetId:
        data.targetId
    };


  state.targetId =
    data.targetId;


  state.attached =
    true;


  tianxiUltVisuals[
    data.playerId
  ] =
    state;


  const target =
    getRenderedPlayer(
      data.targetId
    );


  if (
    !target
  ) {

    return;
  }


  if (
    !target.tianxiUltTargetRing
  ) {

    const ring =
      new THREE.Mesh(

        new THREE.TorusGeometry(
          1,
          0.06,
          8,
          34
        ),

        new THREE.MeshBasicMaterial({

          color:
            0xff66dd,

          transparent:
            true,

          opacity:
            0.72,

          depthWrite:
            false
        })
      );


    ring.rotation.x =
      Math.PI /
      2;


    ring.position.y =
      0.12;


    target.container.add(
      ring
    );


    target.tianxiUltTargetRing =
      ring;
  }


  target
    .tianxiUltTargetRing
    .material
    .opacity =
      0.78;
}


function endTianxiUltVisual(
  data
) {

  const state =
    tianxiUltVisuals[
      data.playerId
    ];


  if (
    state
      ?.rendered
      ?.tianxiUltAura
  ) {

    state.rendered
      .tianxiUltAura
      .material
      .opacity =
        0;


    state.rendered
      .body
      .rotation
      .x =
        0;
  }


  const target =

    data.targetId

      ? getRenderedPlayer(
          data.targetId
        )

      : null;


  if (
    target
      ?.tianxiUltTargetRing
  ) {

    target.tianxiUltTargetRing
      .material
      .opacity =
        0;
  }


  delete tianxiUltVisuals[
    data.playerId
  ];
}


function updateTianxiUltVisuals(
  now
) {

  for (
    const state
    of Object.values(
      tianxiUltVisuals
    )
  ) {

    if (
      !state.rendered
    ) {

      continue;
    }


    if (
      state.rendered
        .tianxiUltAura
    ) {

      state.rendered
        .tianxiUltAura
        .rotation
        .z +=

          state.attached
            ? 0.18
            : 0.32;
    }


    state.rendered
      .body
      .rotation
      .x =

        state.attached
          ? -0.08
          : -0.38;


    const target =
      getRenderedPlayer(
        state.targetId
      );


    if (
      target
        ?.tianxiUltTargetRing &&
      state.attached
    ) {

      target
        .tianxiUltTargetRing
        .rotation
        .z +=
          0.12;


      const pulse =

        1 +

        Math.sin(
          now *
          0.025
        ) *

        0.08;


      target
        .tianxiUltTargetRing
        .scale
        .set(
          pulse,
          pulse,
          pulse
        );
    }
  }
}


// =====================================================
// E HIT PULSE
// =====================================================

function triggerTianxiHitPulse(
  targetId
) {

  tianxiHitPulses[
    targetId
  ] =
    performance.now();
}


function updateTianxiHitPulses(
  now
) {

  for (
    const [
      targetId,
      startedAt
    ]
    of Object.entries(
      tianxiHitPulses
    )
  ) {

    const rendered =
      getRenderedPlayer(
        targetId
      );


    if (
      !rendered
    ) {

      delete tianxiHitPulses[
        targetId
      ];


      continue;
    }


    const t =
      Math.min(

        1,

        (
          now -
          startedAt
        ) /
        135
      );


    const pulse =
      Math.sin(
        t *
        Math.PI
      );


    rendered.body.scale.set(

      1 +
      pulse *
      0.20,

      1 -
      pulse *
      0.08,

      1 +
      pulse *
      0.20
    );


    if (
      t >=
      1
    ) {

      rendered.body.scale.set(
        1,
        1,
        1
      );


      delete tianxiHitPulses[
        targetId
      ];
    }
  }
}


// =====================================================
// FLUFF PROJECTILE VISUAL
// =====================================================

function restyleTianxiFluff(
  data
) {

  if (
    data.kind !==
    'tianxi_fluff'
  ) {

    return;
  }


  /*
    arena.js receives the same projectile
    event first because this file loads AFTER
    arena.js.

    Replace its generic sphere appearance.
  */

  requestAnimationFrame(
    () => {

      const projectile =
        projectiles[
          data.id
        ];


      if (
        !projectile ||
        !projectile.mesh
      ) {

        return;
      }


      projectile.mesh
        .geometry
        .dispose();


      projectile.mesh
        .material
        .dispose();


      projectile.mesh.geometry =
        new THREE.SphereGeometry(
          0.28,
          16,
          12
        );


      projectile.mesh.material =
        new THREE.MeshBasicMaterial({

          color:
            data.appliesMark
              ? 0xff8df2
              : 0xe8c8ff,

          transparent:
            true,

          opacity:
            0.96
        });


      projectile.mesh.scale.set(
        1.2,
        0.9,
        1.2
      );


      projectile.isTianxiFluff =
        true;
    }
  );
}


function updateTianxiFluffs(
  now
) {

  for (
    const projectile
    of Object.values(
      projectiles
    )
  ) {

    if (
      !projectile.isTianxiFluff ||
      !projectile.mesh
    ) {

      continue;
    }


    projectile.mesh.rotation.x +=
      0.11;


    projectile.mesh.rotation.y +=
      0.16;


    projectile.mesh.position.y =

      1.05 +

      Math.sin(
        now *
        0.02
      ) *

      0.08;
  }
}


// =====================================================
// COUNTER ANIMATION
// =====================================================

function updateTianxiCounters(
  now
) {

  const players = [

    localRenderedPlayer,

    ...Object.values(
      remotePlayers
    )

  ].filter(
    Boolean
  );


  for (
    const rendered
    of players
  ) {

    if (
      rendered.playerData.character !==
      'li_tianxi'
    ) {

      continue;
    }


    const playerId =
      rendered.playerData.id;


    const sprite =
      ensureTianxiCounter(
        playerId
      );


    if (
      !sprite
    ) {

      continue;
    }


    const pulseStarted =
      tianxiBasicCountPulses[
        playerId
      ] ||
      0;


    const t =
      Math.min(

        1,

        (
          now -
          pulseStarted
        ) /
        180
      );


    const scalePulse =

      pulseStarted

        ? Math.sin(
            t *
            Math.PI
          ) *
          0.13

        : 0;


    sprite.scale.set(

      1.75 *
      (
        1 +
        scalePulse
      ),

      0.66 *
      (
        1 +
        scalePulse
      ),

      1
    );
  }
}

function clearAllTianxiVisuals() {

    // ===================================================
    // MARKS
    // ===================================================
  
    for (
      const targetId
      of Object.keys(
        tianxiMarkMeshes
      )
    ) {
  
      disposeTianxiMesh(
        tianxiMarkMeshes[
          targetId
        ]
      );
  
  
      delete tianxiMarkMeshes[
        targetId
      ];
    }
  
  
    for (
      const targetId
      of Object.keys(
        tianxiMarkSources
      )
    ) {
  
      delete tianxiMarkSources[
        targetId
      ];
    }
  
  
    // ===================================================
    // COUNTERS
    // ===================================================
  
    for (
      const playerId
      of Object.keys(
        tianxiBasicCounts
      )
    ) {
  
      delete tianxiBasicCounts[
        playerId
      ];
    }
  
  
    for (
      const playerId
      of Object.keys(
        tianxiBasicCountPulses
      )
    ) {
  
      delete tianxiBasicCountPulses[
        playerId
      ];
    }
  
  
    // ===================================================
    // WAVES
    // ===================================================
  
    while (
      tianxiWaves.length
    ) {
  
      const wave =
        tianxiWaves.pop();
  
  
      if (
        wave?.mesh
      ) {
  
        disposeTianxiMesh(
          wave.mesh
        );
      }
    }
  
  
    // ===================================================
    // BACKBURST
    // ===================================================
  
    for (
      const [
        playerId,
        state
      ]
      of Object.entries(
        tianxiBackbursts
      )
    ) {
  
      if (
        state
          ?.rendered
          ?.tianxiBackburstAura
      ) {
  
        state.rendered
          .tianxiBackburstAura
          .material
          .opacity =
            0;
      }
  
  
      delete tianxiBackbursts[
        playerId
      ];
    }
  
  
    // ===================================================
    // ULT
    // ===================================================
  
    for (
      const [
        playerId,
        state
      ]
      of Object.entries(
        tianxiUltVisuals
      )
    ) {
  
      if (
        state
          ?.rendered
          ?.tianxiUltAura
      ) {
  
        state.rendered
          .tianxiUltAura
          .material
          .opacity =
            0;
      }
  
  
      const target =
        state?.targetId
  
          ? getRenderedPlayer(
              state.targetId
            )
  
          : null;
  
  
      if (
        target
          ?.tianxiUltTargetRing
      ) {
  
        target.tianxiUltTargetRing
          .material
          .opacity =
            0;
      }
  
  
      delete tianxiUltVisuals[
        playerId
      ];
    }
  
  
    // ===================================================
    // HIT PULSES
    // ===================================================
  
    for (
      const targetId
      of Object.keys(
        tianxiHitPulses
      )
    ) {
  
      const rendered =
        getRenderedPlayer(
          targetId
        );
  
  
      if (
        rendered?.body
      ) {
  
        rendered.body.scale.set(
          1,
          1,
          1
        );
      }
  
  
      delete tianxiHitPulses[
        targetId
      ];
    }
  }


// =====================================================
// SOCKET EVENTS
// =====================================================

socket.on(
    'arena_started',
    () => {

        clearAllTianxiVisuals();
    }
    );


    socket.on(
    'return_to_squad',
    () => {

        clearAllTianxiVisuals();
    }
);


socket.on(
  'combat_tianxi_basic_count',
  data => {

    setTianxiCounter(
      data.playerId,
      data.count
    );


    if (
      data.playerId ===
      localPlayerId
    ) {

      selfCombat.tianxiBasicCount =
        data.count;


      selfCombat.tianxiBasicExpiresAt =
        data.expiresAt ||
        0;
    }
  }
);


socket.on(
  'combat_tianxi_mark',
  data => {

    if (
      !tianxiMarkSources[
        data.targetId
      ]
    ) {

      tianxiMarkSources[
        data.targetId
      ] =
        {};
    }


    tianxiMarkSources[
      data.targetId
    ][
      data.sourceId
    ] =
      data.expiresAt;


    ensureTianxiMarkMesh(
      data.targetId
    );
  }
);


socket.on(
  'combat_tianxi_mark_cleared',
  data => {

    const sources =
      tianxiMarkSources[
        data.targetId
      ];


    if (
      !sources
    ) {

      return;
    }


    delete sources[
      data.sourceId
    ];


    if (
      !Object.keys(
        sources
      ).length
    ) {

      delete tianxiMarkSources[
        data.targetId
      ];


      disposeTianxiMesh(
        tianxiMarkMeshes[
          data.targetId
        ]
      );


      delete tianxiMarkMeshes[
        data.targetId
      ];
    }
  }
);


socket.on(
  'combat_tianxi_wave_started',
  createTianxiWave
);


socket.on(
  'combat_tianxi_backburst',
  startTianxiBackburst
);


socket.on(
  'combat_tianxi_ult_started',
  startTianxiUltVisual
);


socket.on(
  'combat_tianxi_ult_attached',
  attachTianxiUltVisual
);


socket.on(
  'combat_tianxi_ult_end',
  endTianxiUltVisual
);


socket.on(
  'combat_tianxi_ult_hit',
  data => {

    triggerTianxiHitPulse(
      data.targetId
    );
  }
);


socket.on(
  'combat_tianxi_ult_unavailable',
  data => {

    const status =
      document.getElementById(
        'stun-status'
      );


    if (
      !status
    ) {

      return;
    }


    const text =

      data.message ||

      'NO MARKED TARGET IN RANGE';


    status.innerText =
      text;


    setTimeout(
      () => {

        if (
          status.innerText ===
          text
        ) {

          status.innerText =
            '';
        }

      },
      1200
    );
  }
);


socket.on(
  'combat_immobilized',
  data => {

    if (
      data.playerId ===
      localPlayerId
    ) {

      selfCombat.immobilizedUntil =
        data.until ||
        0;
    }
  }
);


socket.on(
  'combat_forced_position',
  data => {

    const rendered =
      getRenderedPlayer(
        data.playerId
      );


    if (
      !rendered
    ) {

      return;
    }


    if (
      data.playerId ===
      localPlayerId
    ) {

      rendered.container.position.x =
        data.x;


      rendered.container.position.z =
        data.z;

    } else {

      rendered.targetPosition.x =
        data.x;


      rendered.targetPosition.z =
        data.z;
    }
  }
);


socket.on(
  'combat_projectile_spawn',
  restyleTianxiFluff
);


socket.on(
  'combat_player_died',
  data => {

    if (
      tianxiMarkSources[
        data.playerId
      ]
    ) {

      delete tianxiMarkSources[
        data.playerId
      ];


      disposeTianxiMesh(
        tianxiMarkMeshes[
          data.playerId
        ]
      );


      delete tianxiMarkMeshes[
        data.playerId
      ];
    }


    for (
      const [
        playerId,
        state
      ]
      of Object.entries(
        tianxiUltVisuals
      )
    ) {

      if (
        playerId ===
          data.playerId ||
        state.targetId ===
          data.playerId
      ) {

        endTianxiUltVisual({

          playerId,

          targetId:
            state.targetId
        });
      }
    }
  }
);


// =====================================================
// ANIMATION LOOP
// =====================================================

function animateLiTianxiVisuals(
  now =
    performance.now()
) {

  requestAnimationFrame(
    animateLiTianxiVisuals
  );


  if (
    !scene
  ) {

    return;
  }


  updateTianxiMarks(
    now
  );


  updateTianxiWaves(
    now
  );


  updateTianxiBackbursts();


  updateTianxiUltVisuals(
    now
  );


  updateTianxiHitPulses(
    now
  );


  updateTianxiFluffs(
    now
  );


  updateTianxiCounters(
    now
  );
}


requestAnimationFrame(
  animateLiTianxiVisuals
);