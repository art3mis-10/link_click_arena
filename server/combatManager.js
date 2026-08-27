const crypto =
  require('crypto');


const ChengXiaoshi =
  require(
    './characters/chengXiaoshi'
  );


const LuGuang =
  require(
    './characters/luGuang'
  );


const QiaoLing =
  require(
    './characters/qiaoLing'
  );

const LiTianxi =
require(
  './characters/liTianxi'
);

class CombatManager {
  constructor({
    io,
    gameManager,
    onlineUsers,
    getSquadForUser,
    roomForSquad,
    onRoundEnd
  }) {
    this.io =
      io;

    this.gameManager =
      gameManager;

    this.onlineUsers =
      onlineUsers;

    this.getSquadForUser =
      getSquadForUser;

    this.roomForSquad =
      roomForSquad;

    this.onRoundEnd =
      onRoundEnd;

    this.characters = {

      cheng_xiaoshi:
        ChengXiaoshi,
    
      lu_guang:
        LuGuang,
    
      qiao_ling:
        QiaoLing,
    
      li_tianxi:
        LiTianxi
    };

    this.projectiles =
      new Map();

    this.roundEndTimers =
      new Map();

    this.tickHandle =
      setInterval(
        () =>
          this.tick(),
        50
      );
  }


  // =====================================================
  // CHARACTER LOOKUP
  // =====================================================

  getCharacterKit(
    player
  ) {
    if (!player) {
      return null;
    }

    return (
      this.characters[
        player.character
      ] ||
      null
    );
  }


  // =====================================================
  // SOCKETS
  // =====================================================

  registerSocket(
    socket,
    getAuthenticatedUser
  ) {
    socket.on(
      'combat_basic_input',
      () => {
        const username =
          getAuthenticatedUser();

        if (username) {
          this.routeAction(
            socket,
            username,
            'basicAttack'
          );
        }
      }
    );


    socket.on(
      'combat_control_input',
      () => {
        const username =
          getAuthenticatedUser();

        if (username) {
          this.routeAction(
            socket,
            username,
            'ability'
          );
        }
      }
    );


    socket.on(
      'combat_strengthen_input',
      () => {
        const username =
          getAuthenticatedUser();

        if (username) {
          this.routeAction(
            socket,
            username,
            'ult'
          );
        }
      }
    );


    socket.on(
      'combat_request_state',
      () => {
        const username =
          getAuthenticatedUser();

        if (username) {
          this.emitSelfState(
            socket.id
          );
        }
      }
    );
  }


  // =====================================================
  // ROUTE CHARACTER ACTION
  // =====================================================

  routeAction(
    socket,
    username,
    action
  ) {
    const squad =
      this.getSquadForUser(
        username
      );

    if (
      !squad ||
      squad.mode !==
        'pvp' ||
      squad.phase !==
        'arena'
    ) {
      return;
    }

    const state =
      this.getCombat(
        socket.id
      );

    if (!state) {
      return;
    }

    const {
      player,
      combat
    } =
      state;

    const kit =
      this.getCharacterKit(
        player
      );

    if (
      !kit ||
      typeof kit[action] !==
        'function'
    ) {
      return;
    }

    kit[action](
      this,
      socket,
      username,
      squad,
      player,
      combat
    );
  }


  // =====================================================
  // ROUND START
  // =====================================================

  startForSquad(
    squad
  ) {
    const now =
      Date.now();

    for (
      const username
      of squad.members
    ) {
      const socketId =
        this.onlineUsers.get(
          username
        );

      if (!socketId) {
        continue;
      }

      const player =
        this.gameManager
          .getPlayer(
            socketId
          );

      if (!player) {
        continue;
      }

      const kit =
        this.getCharacterKit(
          player
        );

      const maxHp =
        kit
          ? kit.maxHp
          : 600;

      this.gameManager
        .initializeCombat(
          socketId,
          maxHp
        );

      player.combat.lastMoveAt =
        now;

      this.emitSelfState(
        socketId
      );
    }
  }


  // =====================================================
  // PUBLIC PLAYER STATE
  // =====================================================

  publicPlayer(
    player
  ) {
    return {
      id:
        player.id,

      name:
        player.name,

      character:
        player.character,

      x:
        player.x,

      z:
        player.z,

      rotation:
        player.rotation,

      pitch:
        player.pitch ||
        0,

      hp:
        player.combat
          ? player.combat.hp
          : 0,

      maxHp:
        player.combat
          ? player.combat.maxHp
          : 0,

      shieldHp:
        player.combat
          ? player.combat.shieldHp
          : 0,

      shieldMaxHp:
        player.combat
          ? player.combat.shieldMaxHp
          : 0,

      shieldUntil:
        player.combat
          ? player.combat.shieldUntil
          : 0,

      airborneUntil:
        player.combat
          ? player.combat.airborneUntil
          : 0,

      alive:
        player.combat
          ? player.combat.alive
          : true
    };
  }


  getCombat(
    socketId
  ) {
    const player =
      this.gameManager
        .getPlayer(
          socketId
        );

    if (
      !player ||
      !player.combat
    ) {
      return null;
    }

    return {
      player,

      combat:
        player.combat
    };
  }


  // =====================================================
  // ACTION VALIDATION
  // =====================================================

  canAct(
    player,
    combat,
    now =
      Date.now()
  ) {
    return (
      Boolean(player) &&
      Boolean(combat) &&
      combat.alive &&
      now >=
        combat.stunnedUntil &&
      now >=
        combat.actionLockedUntil
    );
  }


  // =====================================================
  // BASIC MOVEMENT LOCK
  // =====================================================

  lockBasicMovement(
    squad,
    player,
    durationMs
  ) {
    if (
      !player ||
      !player.combat
    ) {
      return;
    }

    const now =
      Date.now();

    player.combat
      .attackLockedUntil =

        Math.max(
          player.combat
            .attackLockedUntil ||
            0,

          now +
          durationMs
        );

    this.io
      .to(
        player.id
      )
      .emit(
        'combat_movement_locked',
        {
          until:
            player.combat
              .attackLockedUntil,

          serverNow:
            now
        }
      );

    this.emitSelfState(
      player.id
    );
  }


  // =====================================================
  // MOVEMENT MULTIPLIER
  // =====================================================

  movementMultiplier(
    player,
    combat,
    now =
      Date.now()
  ) {
    const kit =
      this.getCharacterKit(
        player
      );

    if (
      kit &&
      typeof kit
        .movementMultiplier ===
        'function'
    ) {
      return kit
        .movementMultiplier(
          combat,
          now
        );
    }

    return 1;
  }


  // =====================================================
  // PRIVATE STATE
  // =====================================================

  emitSelfState(
    socketId
  ) {
    const state =
      this.getCombat(
        socketId
      );

    if (!state) {
      return;
    }

    const {
      player,
      combat
    } =
      state;

    this.io
      .to(
        socketId
      )
      .emit(
        'combat_self_state',
        {
          serverNow:
            Date.now(),

          character:
            player.character,

          hp:
            combat.hp,

          maxHp:
            combat.maxHp,

          alive:
            combat.alive,

          stunnedUntil:
            combat.stunnedUntil,

          attackLockedUntil:
            combat.attackLockedUntil,

          actionLockedUntil:
            combat.actionLockedUntil,

          speedBuffUntil:
            combat.speedBuffUntil,

          mobilityUntil:
            combat.mobilityUntil,

          airborneUntil:
            combat.airborneUntil,

          strengthenUntil:
            combat.strengthenUntil,

          basicReadyAt:
            combat.basicReadyAt,

          controlReadyAt:
            combat.controlReadyAt,

          strengthenReadyAt:
            combat.strengthenReadyAt,

          shieldHp:
            combat.shieldHp,

          shieldMaxHp:
            combat.shieldMaxHp,

          shieldUntil:
            combat.shieldUntil,
          
          immobilizedUntil:
            combat.immobilizedUntil ||
            0,
          
          invincibleUntil:
            combat.invincibleUntil ||
            0,
          
          untargetableUntil:
            combat.untargetableUntil ||
            0,
          
          tianxiBackburstUntil:
            combat.tianxiBackburstUntil ||
            0,
          
          tianxiBasicCount:
            combat.tianxiBasicCount ||
            0,
          
          tianxiBasicExpiresAt:
            combat.tianxiBasicExpiresAt ||
            0,
          
            tianxiUltActive:
            Boolean(
              combat.tianxiUltActive
            ),
          
          immobilizedBy:
            combat.immobilizedBy ||
            null,
        }
      );
  }


  // =====================================================
  // MOVEMENT VALIDATION
  // =====================================================

  validateMovement(
    socket,
    username,
    data
  ) {
    const squad =
      this.getSquadForUser(
        username
      );

    const state =
      this.getCombat(
        socket.id
      );

    if (
      !squad ||
      squad.phase !==
        'arena' ||
      !state
    ) {
      return null;
    }

    const {
      player,
      combat
    } =
      state;

    const now =
      Date.now();

    /*
      Stun and basic attack both
      temporarily prohibit movement.
    */
    if (
      !combat.alive ||
      now <
        combat.stunnedUntil ||
      now <
        combat.attackLockedUntil
    ) {
      socket.emit(
        'player_position_correction',
        {
          x:
            player.x,

          z:
            player.z,

          rotation:
            player.rotation,

          pitch:
            player.pitch ||
            0
        }
      );

      return null;
    }

    const requestedX =
      Number(
        data.x
      );

    const requestedZ =
      Number(
        data.z
      );
    
    const immobilized =
      now <
      (
        combat.immobilizedUntil ||
        0
      );

    if (
      !Number.isFinite(
        requestedX
      ) ||
      !Number.isFinite(
        requestedZ
      )
    ) {
      return null;
    }

    const lastAt =
      combat.lastMoveAt ||
      now;

    const dt =
      Math.max(
        0.001,
        Math.min(
          0.25,
          (
            now -
            lastAt
          ) /
          1000
        )
      );

    const maxDistance =
      9 *
      this.movementMultiplier(
        player,
        combat,
        now
      ) *
      dt +
      0.45;

    let dx =
      immobilized
        ? 0
        : requestedX -
          player.x;
    
    let dz =
      immobilized
        ? 0
        : requestedZ -
          player.z;

    const distance =
      Math.hypot(
        dx,
        dz
      );

    let corrected =
      false;

    if (
      distance >
        maxDistance &&
      distance >
        0
    ) {
      const scale =
        maxDistance /
        distance;

      dx *=
        scale;

      dz *=
        scale;

      corrected =
        true;
    }

    const accepted = {
      x:
        Math.max(
          -24,
          Math.min(
            24,
            player.x + dx
          )
        ),

      z:
        Math.max(
          -24,
          Math.min(
            24,
            player.z + dz
          )
        ),

      rotation:
        Number.isFinite(
          Number(
            data.rotation
          )
        )
          ? Number(
              data.rotation
            )
          : player.rotation,

      pitch:
        Number.isFinite(
          Number(
            data.pitch
          )
        )
          ? Number(
              data.pitch
            )
          : player.pitch ||
            0
    };

    const updated =
      this.gameManager
        .updatePlayerPosition(
          socket.id,
          accepted
        );

    combat.lastMoveAt =
      now;

    if (corrected) {
      socket.emit(
        'player_position_correction',
        accepted
      );
    }

    return updated;
  }


  // =====================================================
  // NON-TRACKING INVULNERABILITY
  // =====================================================

  isNonTrackingInvulnerable(
    player,
    now =
      Date.now()
  ) {
    return (
      Boolean(
        player &&
        player.combat &&
        player.combat.alive
      ) &&
      now <
        (
          player.combat
            .airborneUntil ||
          0
        )
    );
  }

  // =====================================================
  // FULL INVULNERABILITY
  // =====================================================

  isFullyInvulnerable(
    player,
    now =
      Date.now()
  ) {

    return (

      Boolean(
        player &&
        player.combat &&
        player.combat.alive
      ) &&

      now <
        (
          player.combat
            .invincibleUntil ||
          0
        )
    );
  }


  // =====================================================
  // FOLLOW-UNTIL-HIT TARGETABILITY
  // =====================================================

  isTargetableForTracking(
    player,
    now =
      Date.now()
  ) {

    return (

      Boolean(
        player &&
        player.combat &&
        player.combat.alive
      ) &&

      now >=
        (
          player.combat
            .untargetableUntil ||
          0
        )
    );
  }


  // =====================================================
  // MELEE TARGET
  // =====================================================

  findMeleeTarget(
    squad,
    attacker,
    range,
    minimumDot
  ) {
    const now =
      Date.now();

    const forwardX =
      -Math.sin(
        attacker.rotation ||
        0
      );

    const forwardZ =
      -Math.cos(
        attacker.rotation ||
        0
      );

    let bestTarget =
      null;

    let bestDistance =
      Infinity;

    for (
      const username
      of squad.members
    ) {
      const socketId =
        this.onlineUsers.get(
          username
        );

      if (
        !socketId ||
        socketId ===
          attacker.id
      ) {
        continue;
      }

      const target =
        this.gameManager
          .getPlayer(
            socketId
          );

      if (
        !target ||
        !target.combat ||
        !target.combat.alive
      ) {
        continue;
      }

      /*
        Melee is non-tracking.
      */
      if (
        this.isNonTrackingInvulnerable(
          target,
          now
        )
      ) {
        continue;
      }

      const dx =
        target.x -
        attacker.x;

      const dz =
        target.z -
        attacker.z;

      const distance =
        Math.hypot(
          dx,
          dz
        );

      if (
        distance <=
          0 ||
        distance >
          range
      ) {
        continue;
      }

      const dot =
        (
          dx /
          distance
        ) *
        forwardX +
        (
          dz /
          distance
        ) *
        forwardZ;

      if (
        dot <
        minimumDot
      ) {
        continue;
      }

      if (
        distance <
        bestDistance
      ) {
        bestTarget =
          target;

        bestDistance =
          distance;
      }
    }

    return bestTarget;
  }


  // =====================================================
  // NEAREST TARGET
  // =====================================================

  findNearestTarget(
    squad,
    attacker,
    range,
    {
      requireTargetable =
        false
    } = {}
  ) {
  
    const now =
      Date.now();
  
  
    let closest =
      null;
  
  
    let closestDistance =
      Infinity;
  
  
    for (
      const username
      of squad.members
    ) {
  
      const socketId =
        this.onlineUsers.get(
          username
        );
  
  
      if (
        !socketId ||
        socketId ===
          attacker.id
      ) {
  
        continue;
      }
  
  
      const target =
        this.gameManager
          .getPlayer(
            socketId
          );
  
  
      if (
        !target ||
        !target.combat ||
        !target.combat.alive
      ) {
  
        continue;
      }
  
  
      if (
        requireTargetable &&
        !this.isTargetableForTracking(
          target,
          now
        )
      ) {
  
        continue;
      }
  
  
      const distance =
        Math.hypot(
  
          target.x -
            attacker.x,
  
          target.z -
            attacker.z
        );
  
  
      if (
        distance <=
          range &&
        distance <
          closestDistance
      ) {
  
        closest =
          target;
  
  
        closestDistance =
          distance;
      }
    }
  
  
    return closest;
  }


  // =====================================================
  // PROJECTILE
  // =====================================================

  spawnProjectile(
    options
  ) {
    const now =
      Date.now();

    const projectile = {
      id:
        crypto.randomUUID(),

      spawnedAt:
        now,

      lastTickAt:
        now,

      startX:
        options.x,

      startZ:
        options.z,

      maxLifetime:
        options.maxLifetime ||
        2000,

      ...options
    };

    this.projectiles.set(
      projectile.id,
      projectile
    );

    this.io
      .to(
        this.roomForSquad(
          projectile.squad
        )
      )
      .emit(
        'combat_projectile_spawn',
        {
          id:
            projectile.id,

          kind:
            projectile.kind,

          ownerId:
            projectile.ownerId,

          targetId:
            projectile.targetId ||
            null,

          x:
            projectile.x,

          z:
            projectile.z,

          direction:
            projectile.direction,

          speed:
            projectile.speed,

          maxRange:
            projectile.maxRange,

          homing:
            Boolean(
              projectile.homing
            ),

          tracking:
            Boolean(
              projectile.tracking
            ),

          strengthened:
            Boolean(
              projectile.strengthened
            ),
          appliesMark:
            Boolean(
              projectile.appliesMark
            ),

          spawnedAt:
            projectile.spawnedAt
        }
      );

    return projectile;
  }


  // =====================================================
  // DAMAGE
  // =====================================================

  applyDamage(
    squad,
    target,
    amount,
    sourceId,
    {
      tracking = false
    } = {}
  ) {
    if (
      !target.combat ||
      !target.combat.alive
    ) {
      return false;
    }

    const now =
      Date.now();

    if (
      this.isFullyInvulnerable(
        target,
        now
      )
    ) {
    
      return false;
    }
    /*
      Qiao Ling DAMAGE:
      airborne avoids every
      non-tracking attack.
    */
    if (
      !tracking &&
      this.isNonTrackingInvulnerable(
        target,
        now
      )
    ) {
      return false;
    }

    const combat =
      target.combat;

    let remainingDamage =
      amount;

    if (
      combat.shieldHp >
        0 &&
      now <
        combat.shieldUntil
    ) {
      const absorbed =
        Math.min(
          combat.shieldHp,
          remainingDamage
        );

      combat.shieldHp -=
        absorbed;

      remainingDamage -=
        absorbed;

      this.io
        .to(
          this.roomForSquad(
            squad
          )
        )
        .emit(
          'combat_shield_update',
          {
            playerId:
              target.id,

            shieldHp:
              combat.shieldHp,

            shieldMaxHp:
              combat.shieldMaxHp,

            shieldUntil:
              combat.shieldUntil,

            serverNow:
              now
          }
        );
    }

    combat.lastDamageAt =
      now;

    combat.nextRegenAt =
      now + 10000;

    if (
      remainingDamage >
      0
    ) {
      combat.hp =
        Math.max(
          0,
          combat.hp -
            remainingDamage
        );
    }

    this.io
      .to(
        this.roomForSquad(
          squad
        )
      )
      .emit(
        'combat_health_update',
        {
          playerId:
            target.id,

          hp:
            combat.hp,

          maxHp:
            combat.maxHp,

          delta:
            -remainingDamage,

          sourceId,

          shieldHp:
            combat.shieldHp,

          serverNow:
            now
        }
      );

    this.emitSelfState(
      target.id
    );

    if (
      combat.hp <=
      0
    ) {
      this.killPlayer(
        squad,
        target,
        sourceId
      );
    }

    return true;
  }


  // =====================================================
  // STUN
  // =====================================================

  applyStun(
    squad,
    target,
    durationMs
  ) {
    if (
      !target.combat ||
      !target.combat.alive
    ) {
      return;
    }

    const now =
      Date.now();

    if (
      this.isFullyInvulnerable(
        target,
        now
      )
    ) {
    
      return;
    }
    target.combat
      .stunnedUntil =
        Math.max(
          target.combat
            .stunnedUntil,

          now +
          durationMs
        );

    this.io
      .to(
        this.roomForSquad(
          squad
        )
      )
      .emit(
        'combat_stunned',
        {
          playerId:
            target.id,

          until:
            target.combat
              .stunnedUntil,

          serverNow:
            now
        }
      );

    this.emitSelfState(
      target.id
    );
  }

  // =====================================================
  // LI TIANXI MARK
  // =====================================================

  addTianxiMark(
    squad,
    sourcePlayer,
    target,
    durationMs =
      5000
  ) {

    if (
      !sourcePlayer ||
      !target ||
      !target.combat ||
      !target.combat.alive
    ) {

      return;
    }


    if (
      !target.combat.tianxiMarks
    ) {

      target.combat.tianxiMarks =
        {};
    }


    const now =
      Date.now();


    const expiresAt =
      now +
      durationMs;


    target.combat.tianxiMarks[
      sourcePlayer.id
    ] =
      expiresAt;


    this.io
      .to(
        this.roomForSquad(
          squad
        )
      )
      .emit(
        'combat_tianxi_mark',
        {

          sourceId:
            sourcePlayer.id,

          targetId:
            target.id,

          expiresAt,

          serverNow:
            now
        }
      );


    /*
      Clear exactly this application
      after 5 seconds unless it was
      refreshed in the meantime.
    */

    setTimeout(
      () => {

        if (
          !target.combat ||
          !target.combat.tianxiMarks
        ) {

          return;
        }


        if (
          target.combat.tianxiMarks[
            sourcePlayer.id
          ] !==
            expiresAt
        ) {

          return;
        }


        delete target.combat.tianxiMarks[
          sourcePlayer.id
        ];


        this.io
          .to(
            this.roomForSquad(
              squad
            )
          )
          .emit(
            'combat_tianxi_mark_cleared',
            {

              sourceId:
                sourcePlayer.id,

              targetId:
                target.id,

              serverNow:
                Date.now()
            }
          );

      },
      durationMs +
      25
    );
  }


  hasTianxiMark(
    sourcePlayer,
    target,
    now =
      Date.now()
  ) {

    if (
      !sourcePlayer ||
      !target ||
      !target.combat ||
      !target.combat.tianxiMarks
    ) {

      return false;
    }


    return (

      Number(

        target.combat.tianxiMarks[
          sourcePlayer.id
        ]

      ) ||
      0

    ) >
      now;
  }


  clearTianxiMark(
    squad,
    sourcePlayer,
    target
  ) {

    if (
      !sourcePlayer ||
      !target ||
      !target.combat ||
      !target.combat.tianxiMarks
    ) {

      return;
    }


    if (
      !target.combat.tianxiMarks[
        sourcePlayer.id
      ]
    ) {

      return;
    }


    delete target.combat.tianxiMarks[
      sourcePlayer.id
    ];


    this.io
      .to(
        this.roomForSquad(
          squad
        )
      )
      .emit(
        'combat_tianxi_mark_cleared',
        {

          sourceId:
            sourcePlayer.id,

          targetId:
            target.id,

          serverNow:
            Date.now()
        }
      );
  }


  // =====================================================
  // FORCED SERVER MOVEMENT
  // =====================================================

  emitForcedPosition(
    squad,
    player
  ) {

    this.io
      .to(
        this.roomForSquad(
          squad
        )
      )
      .emit(
        'combat_forced_position',
        {

          playerId:
            player.id,

          x:
            player.x,

          z:
            player.z,

          rotation:
            player.rotation ||
            0,

          serverNow:
            Date.now()
        }
      );
  }

  // =====================================================
  // PROJECTILE HIT
  // =====================================================

  handleProjectileHit(
    projectile,
    target
  ) {
    if (
      projectile.kind ===
      'cheng_control'
    ) {
      ChengXiaoshi
        .projectileHit(
          this,
          projectile,
          target
        );

      return;
    }

    if (
      projectile.kind ===
      'lu_laser'
    ) {
      LuGuang
        .projectileHit(
          this,
          projectile,
          target
        );
    }

    if (
      projectile.kind ===
        'tianxi_fluff'
    ) {
    
      LiTianxi.projectileHit(
        this,
        projectile,
        target
      );
    }
  }


  expireProjectile(
    projectile
  ) {
    if (
      !this.projectiles.has(
        projectile.id
      )
    ) {
      return;
    }

    this.projectiles.delete(
      projectile.id
    );

    this.io
      .to(
        this.roomForSquad(
          projectile.squad
        )
      )
      .emit(
        'combat_projectile_expired',
        {
          id:
            projectile.id,

          serverNow:
            Date.now()
        }
      );
  }


  // =====================================================
  // DEATH
  // =====================================================

  killPlayer(
    squad,
    player,
    sourceId
  ) {
    if (
      !player.combat ||
      !player.combat.alive
    ) {
      return;
    }

    player.combat.alive =
      false;

    player.combat.hp =
      0;

    player.combat.stunnedUntil =
      0;

    player.combat.airborneUntil =
      0;

    player.combat.mobilityUntil =
      0;

    player.combat.attackLockedUntil =
      0;

    player.combat.actionLockedUntil =
      0;

    this.io
      .to(
        this.roomForSquad(
          squad
        )
      )
      .emit(
        'combat_player_died',
        {
          playerId:
            player.id,

          playerName:
            player.name,

          sourceId,

          serverNow:
            Date.now()
        }
      );

    this.emitSelfState(
      player.id
    );

    this.checkWinner(
      squad
    );
  }


  // =====================================================
  // WIN
  // =====================================================

  checkWinner(
    squad
  ) {
    if (
      !squad ||
      squad.phase !==
        'arena' ||
      squad.mode !==
        'pvp'
    ) {
      return;
    }

    if (
      squad.members.length <
      2
    ) {
      return;
    }

    const alive =
      [];

    for (
      const username
      of squad.members
    ) {
      const socketId =
        this.onlineUsers.get(
          username
        );

      const player =
        socketId
          ? this.gameManager
              .getPlayer(
                socketId
              )
          : null;

      if (
        player &&
        player.combat &&
        player.combat.alive
      ) {
        alive.push(
          player
        );
      }
    }

    if (
      alive.length !==
      1
    ) {
      return;
    }

    if (
      this.roundEndTimers.has(
        squad.host
      )
    ) {
      return;
    }

    const winner =
      alive[0];

    this.io
      .to(
        this.roomForSquad(
          squad
        )
      )
      .emit(
        'combat_match_ended',
        {
          winnerId:
            winner.id,

          winnerName:
            winner.name,

          serverNow:
            Date.now()
        }
      );

    const timer =
      setTimeout(
        () => {
          this.roundEndTimers
            .delete(
              squad.host
            );

          this.onRoundEnd(
            squad,
            winner
          );

        },
        3000
      );

    this.roundEndTimers.set(
      squad.host,
      timer
    );
  }


  // =====================================================
  // MAIN TICK
  // =====================================================

  tick() {
    const now =
      Date.now();

    this.updateProjectiles(
      now
    );

    this.updateHealthRegen(
      now
    );

    this.updateExpiredShields(
      now
    );
  }


  // =====================================================
  // PROJECTILE UPDATE
  // =====================================================

  updateProjectiles(
    now
  ) {
    for (
      const [
        id,
        projectile
      ]
      of this.projectiles
    ) {
      const owner =
        this.gameManager
          .getPlayer(
            projectile.ownerId
          );

      if (
        !owner ||
        !owner.combat ||
        !owner.combat.alive ||
        projectile.squad.phase !==
          'arena'
      ) {
        this.expireProjectile(
          projectile
        );

        continue;
      }

      if (
        projectile.homing &&
        projectile.targetId
      ) {
        const target =
          this.gameManager
            .getPlayer(
              projectile.targetId
            );

        if (
          !target ||
          !target.combat ||
          !target.combat.alive
        ) {
          this.expireProjectile(
            projectile
          );

          continue;
        }

        const dx =
          target.x -
          projectile.x;

        const dz =
          target.z -
          projectile.z;

        const distance =
          Math.hypot(
            dx,
            dz
          );

        if (
          distance >
          0
        ) {
          projectile.direction = {
            x:
              dx /
              distance,

            z:
              dz /
              distance
          };
        }
      }

      const dt =
        Math.max(
          0,
          Math.min(
            0.1,
            (
              now -
              projectile.lastTickAt
            ) /
            1000
          )
        );

      projectile.lastTickAt =
        now;

      projectile.x +=
        projectile.direction.x *
        projectile.speed *
        dt;

      projectile.z +=
        projectile.direction.z *
        projectile.speed *
        dt;

      const lifetime =
        now -
        projectile.spawnedAt;

      if (
        !projectile.homing
      ) {
        const traveled =
          Math.hypot(
            projectile.x -
              projectile.startX,

            projectile.z -
              projectile.startZ
          );

        if (
          traveled >=
          projectile.maxRange
        ) {
          this.expireProjectile(
            projectile
          );

          continue;
        }
      }

      if (
        lifetime >=
        projectile.maxLifetime
      ) {
        this.expireProjectile(
          projectile
        );

        continue;
      }

      let hitTarget =
        null;

      for (
        const username
        of projectile.squad
          .members
      ) {
        const socketId =
          this.onlineUsers.get(
            username
          );

        if (
          !socketId ||
          socketId ===
            projectile.ownerId
        ) {
          continue;
        }

        const target =
          this.gameManager
            .getPlayer(
              socketId
            );

        if (
          !target ||
          !target.combat ||
          !target.combat.alive
        ) {
          continue;
        }

        if (
          projectile.homing &&
          projectile.targetId &&
          target.id !==
            projectile.targetId
        ) {
          continue;
        }

        /*
          Non-tracking projectiles simply
          pass underneath airborne Qiao.
        */
        if (
          !projectile.tracking &&
          this.isNonTrackingInvulnerable(
            target,
            now
          )
        ) {
          continue;
        }

        const distance =
          Math.hypot(
            target.x -
              projectile.x,

            target.z -
              projectile.z
          );

        if (
          distance <=
          projectile.radius +
          0.5
        ) {
          hitTarget =
            target;

          break;
        }
      }

      if (!hitTarget) {
        continue;
      }

      this.io
        .to(
          this.roomForSquad(
            projectile.squad
          )
        )
        .emit(
          'combat_projectile_hit',
          {
            id:
              projectile.id,

            kind:
              projectile.kind,

            targetId:
              hitTarget.id,

            x:
              projectile.x,

            z:
              projectile.z,

            serverNow:
              now
          }
        );

      this.projectiles.delete(
        id
      );

      this.handleProjectileHit(
        projectile,
        hitTarget
      );
    }
  }


  // =====================================================
  // REGEN
  // =====================================================

  updateHealthRegen(
    now
  ) {
    for (
      const player
      of Object.values(
        this.gameManager.players
      )
    ) {
      const combat =
        player.combat;

      if (
        !combat ||
        !combat.alive ||
        combat.hp >=
          combat.maxHp
      ) {
        continue;
      }

      if (
        now <
        combat.nextRegenAt
      ) {
        continue;
      }

      const squad =
        this.getSquadForUser(
          player.name
        );

      if (
        !squad ||
        squad.phase !==
          'arena'
      ) {
        continue;
      }

      combat.hp =
        Math.min(
          combat.maxHp,
          combat.hp +
          20
        );

      combat.nextRegenAt +=
        1000;

      this.io
        .to(
          this.roomForSquad(
            squad
          )
        )
        .emit(
          'combat_health_update',
          {
            playerId:
              player.id,

            hp:
              combat.hp,

            maxHp:
              combat.maxHp,

            delta:
              20,

            sourceId:
              null,

            shieldHp:
              combat.shieldHp,

            serverNow:
              now
          }
        );

      this.emitSelfState(
        player.id
      );
    }
  }


  // =====================================================
  // SHIELD EXPIRATION
  // =====================================================

  updateExpiredShields(
    now
  ) {
    for (
      const player
      of Object.values(
        this.gameManager.players
      )
    ) {
      const combat =
        player.combat;

      if (
        !combat ||
        combat.shieldHp <=
          0 ||
        combat.shieldUntil <=
          0
      ) {
        continue;
      }

      if (
        now <
        combat.shieldUntil
      ) {
        continue;
      }

      combat.shieldHp =
        0;

      combat.shieldUntil =
        0;

      const squad =
        this.getSquadForUser(
          player.name
        );

      if (squad) {
        this.io
          .to(
            this.roomForSquad(
              squad
            )
          )
          .emit(
            'combat_shield_update',
            {
              playerId:
                player.id,

              shieldHp:
                0,

              shieldMaxHp:
                combat.shieldMaxHp,

              shieldUntil:
                0,

              serverNow:
                now
            }
          );
      }

      this.emitSelfState(
        player.id
      );
    }
  }
}


module.exports =
  CombatManager;