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


    /*
      CHARACTER LIBRARY

      Later just add:

      qiao_ling: QiaoLing
      vein: Vein
      etc.
    */

    this.characters = {

      cheng_xiaoshi:
        ChengXiaoshi,

      lu_guang:
        LuGuang
    };


    this.projectiles =
      new Map();


    this.roundEndTimers =
      new Map();


    /*
      20 server combat ticks/sec.
    */

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
  // SOCKET CONTROLS
  // =====================================================

  registerSocket(
    socket,
    getAuthenticatedUser
  ) {

    /*
      SPACE
    */

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


    /*
      Q
    */

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


    /*
      E
    */

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
  // SEND INPUT TO CHARACTER FILE
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
      squad.mode !== 'pvp' ||
      squad.phase !== 'arena'
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
  // START ROUND
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


      player.combat
        .lastMoveAt =
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

      alive:
        player.combat
          ? player.combat.alive
          : true
    };
  }


  // =====================================================
  // COMBAT LOOKUP
  // =====================================================

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
  // CAN PLAYER ACT?
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
        combat.stunnedUntil
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


    const now =
      Date.now();


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
            now,

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

          speedBuffUntil:
            combat.speedBuffUntil,

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
            combat.shieldUntil
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
      squad.phase !== 'arena' ||
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


    if (
      !combat.alive ||
      now <
        combat.stunnedUntil
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
      requestedX -
      player.x;


    let dz =
      requestedZ -
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
      distance > 0
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
            player.x +
            dx
          )
        ),

      z:
        Math.max(
          -24,
          Math.min(
            24,
            player.z +
            dz
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
  // FRONT MELEE TARGET
  // =====================================================

  findMeleeTarget(
    squad,
    attacker,
    range,
    minimumDot
  ) {

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
        distance <= 0 ||
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
    range
  ) {

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


      const distance =
        Math.hypot(

          target.x -
          attacker.x,

          target.z -
          attacker.z
        );


      if (
        distance <= range &&
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
  // SPAWN PROJECTILE
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

          strengthened:
            Boolean(
              projectile.strengthened
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
    sourceId
  ) {

    if (
      !target.combat ||
      !target.combat.alive
    ) {

      return;
    }


    const now =
      Date.now();


    const combat =
      target.combat;


    let remainingDamage =
      amount;


    /*
      SHIELD ABSORPTION
    */

    if (
      combat.shieldHp > 0 &&
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


    /*
      DAMAGE RESETS REGEN TIMER

      Even if shield absorbs the
      entire attack, the player was
      still hit.
    */

    combat.lastDamageAt =
      now;


    combat.nextRegenAt =
      now +
      10000;


    if (
      remainingDamage > 0
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
      combat.hp <= 0
    ) {

      this.killPlayer(

        squad,

        target,

        sourceId
      );
    }
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


    /*
      New stun does not queue
      additively.

      It just ensures stun lasts
      until at least now + duration.
    */

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
  // PROJECTILE HIT ROUTING
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
  }


  // =====================================================
  // PROJECTILE EXPIRATION
  // =====================================================

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
  // WINNER
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


    /*
      Solo arena is for testing.
    */

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
  // TICK
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
  // PROJECTILE TICK
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


      /*
        HOMING PROJECTILE

        Lu Guang Strengthen laser.
      */

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
          distance > 0
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

        projectile
          .direction
          .x *

        projectile.speed *

        dt;


      projectile.z +=

        projectile
          .direction
          .z *

        projectile.speed *

        dt;


      const lifetime =
        now -
        projectile.spawnedAt;


      /*
        Normal straight projectile:
        range limited.

        Homing projectile:
        lifetime limited instead,
        so Strengthen laser keeps
        chasing.
      */

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


        /*
          Homing laser is locked to
          its original target.

          It shouldn't accidentally hit
          someone else.
        */

        if (
          projectile.homing &&
          projectile.targetId &&
          target.id !==
            projectile.targetId
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
  // HEALTH REGEN
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
        combat.shieldHp <= 0 ||
        combat.shieldUntil <= 0
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