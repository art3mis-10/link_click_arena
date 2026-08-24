const crypto = require('crypto');

class CombatManager {

  constructor({
    io,
    gameManager,
    onlineUsers,
    getSquadForUser,
    roomForSquad,
    onRoundEnd
  }) {

    this.io = io;
    this.gameManager = gameManager;
    this.onlineUsers = onlineUsers;
    this.getSquadForUser = getSquadForUser;
    this.roomForSquad = roomForSquad;
    this.onRoundEnd = onRoundEnd;

    this.projectiles = new Map();

    this.roundEndTimers = new Map();

    // 20 server combat ticks per second.
    this.tickHandle = setInterval(
      () => this.tick(),
      50
    );
  }


  // =====================================================
  // SOCKET INPUTS
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
          this.basicAttack(
            socket,
            username
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
          this.useControl(
            socket,
            username
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
          this.useStrengthen(
            socket,
            username
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
  // BEGIN COMBAT
  // =====================================================

  startForSquad(squad) {

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


      this.gameManager
        .initializeCombat(
          socketId
        );


      player.combat.lastMoveAt =
        now;


      player.combat.lastMoveX =
        player.x;


      player.combat.lastMoveZ =
        player.z;


      this.emitSelfState(
        socketId
      );
    }
  }


  // =====================================================
  // PUBLIC PLAYER DATA
  // =====================================================

  publicPlayer(player) {

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
        player.pitch || 0,

      hp:
        player.combat
          ? player.combat.hp
          : 850,

      maxHp:
        player.combat
          ? player.combat.maxHp
          : 850,

      alive:
        player.combat
          ? player.combat.alive
          : true
    };
  }


  // =====================================================
  // HELPERS
  // =====================================================

  getCombat(socketId) {

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


  canUseChengAction(
    player,
    combat,
    now = Date.now()
  ) {

    return (

      player.character ===
        'cheng_xiaoshi' &&

      combat.alive &&

      now >=
        combat.stunnedUntil
    );
  }


  movementMultiplier(
    combat,
    now = Date.now()
  ) {

    let multiplier =
      1;


    // Control hit buff
    if (
      now <
      combat.speedBuffUntil
    ) {

      multiplier +=
        0.50;
    }


    // Strengthen buff
    if (
      now <
      combat.strengthenUntil
    ) {

      multiplier +=
        0.15;
    }


    return multiplier;
  }


  // =====================================================
  // SEND PRIVATE PLAYER STATE
  // =====================================================

  emitSelfState(socketId) {

    const data =
      this.getCombat(
        socketId
      );


    if (!data) {
      return;
    }


    const now =
      Date.now();


    const {
      player,
      combat
    } = data;


    this.io
      .to(socketId)
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
            combat.strengthenReadyAt
        }
      );
  }


  // =====================================================
  // SERVER-AUTHORITATIVE MOVEMENT LIMIT
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
    } = state;


    const now =
      Date.now();


    // Dead/stunned players cannot move.
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
            player.pitch || 0
        }
      );


      return null;
    }


    const requestedX =
      Number(data.x);


    const requestedZ =
      Number(data.z);


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
          (now - lastAt) /
            1000
        )
      );


    // Normal movement = 9 world units/sec.
    const maxDistance =
      9 *
      this.movementMultiplier(
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
          : player.pitch || 0
    };


    const updated =
      this.gameManager
        .updatePlayerPosition(
          socket.id,
          accepted
        );


    combat.lastMoveAt =
      now;


    combat.lastMoveX =
      updated.x;


    combat.lastMoveZ =
      updated.z;


    if (corrected) {

      socket.emit(
        'player_position_correction',
        accepted
      );
    }


    return updated;
  }


  // =====================================================
  // SPACE — PUNCH
  // =====================================================

  basicAttack(
    socket,
    username
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
      squad.mode !== 'pvp' ||
      squad.phase !== 'arena' ||
      !state
    ) {

      return;
    }


    const now =
      Date.now();


    const {
      player,
      combat
    } = state;


    if (
      !this.canUseChengAction(
        player,
        combat,
        now
      )
    ) {

      return;
    }


    if (
      now <
      combat.basicReadyAt
    ) {

      return;
    }


    const strengthened =
      now <
      combat.strengthenUntil;


    // Normal = 80.
    // Strengthen = 100.
    const damage =
      strengthened
        ? 100
        : 80;


    // Normal = 1/sec.
    // Strengthen = 2/sec.
    const cooldownMs =
      strengthened
        ? 500
        : 1000;


    combat.basicReadyAt =
      now +
      cooldownMs;


    // Everyone sees the punch animation.
    this.io
      .to(
        this.roomForSquad(
          squad
        )
      )
      .emit(
        'combat_basic_attack',
        {

          attackerId:
            player.id,

          serverNow:
            now,

          damage
        }
      );


    /*
      Punch range:
      2.4 world units.

      Arena is 50 x 50,
      so 2.4 is deliberately close melee.
    */
    const target =
      this.findMeleeTarget(
    
      squad,
    
      player,
    
      4,
    
      0
    );

    if (target) {

      this.applyDamage(

        squad,

        target,

        damage,

        player.id
      );
    }


    this.emitSelfState(
      socket.id
    );
  }


  // =====================================================
  // MELEE HIT DETECTION
  // =====================================================

  findMeleeTarget(
    squad,
    attacker,
    range,
    minimumDot
  ) {

    // Three.js forward direction is local -Z.
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
        distance > range
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
  // Q — CONTROL
  // =====================================================

  useControl(
    socket,
    username
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
      squad.mode !== 'pvp' ||
      squad.phase !== 'arena' ||
      !state
    ) {

      return;
    }


    const now =
      Date.now();


    const {
      player,
      combat
    } = state;


    if (
      !this.canUseChengAction(
        player,
        combat,
        now
      )
    ) {

      return;
    }


    if (
      now <
      combat.controlReadyAt
    ) {

      return;
    }


    // Cooldown begins IMMEDIATELY upon throw.
    combat.controlReadyAt =
      now +
      10000;
    /*
        Control always resets Cheng's basic attack cooldown as soon
        as the projectile is thrown, whether or not it hits.
    */
    combat.basicReadyAt =
        0;

    socket.emit(
        'combat_basic_reset',
        {
            serverNow:
            now
        }
    );

    const direction = {

      x:
        -Math.sin(
          player.rotation ||
          0
        ),

      z:
        -Math.cos(
          player.rotation ||
          0
        )
    };


    const projectile = {

      id:
        crypto.randomUUID(),

      squad,

      ownerId:
        player.id,

      ownerName:
        player.name,

      x:
        player.x +
        direction.x *
        1.0,

      z:
        player.z +
        direction.z *
        1.0,

      startX:
        player.x +
        direction.x *
        1.0,

      startZ:
        player.z +
        direction.z *
        1.0,

      direction,

      // 16 units/sec.
      speed:
        60,

      // Mid-range.
      maxRange:
        20,

      radius:
        0.75,

      damage:
        50,

      spawnedAt:
        now,

      lastTickAt:
        now
    };


    this.projectiles.set(
      projectile.id,
      projectile
    );


    /*
      Every client draws the projectile.

      Server remains responsible
      for real collision.
    */
    this.io
      .to(
        this.roomForSquad(
          squad
        )
      )
      .emit(
        'combat_projectile_spawn',
        {

          id:
            projectile.id,

          ownerId:
            projectile.ownerId,

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

          spawnedAt:
            projectile.spawnedAt
        }
      );


    this.emitSelfState(
      socket.id
    );
  }


  // =====================================================
  // E — STRENGTHEN
  // =====================================================

  useStrengthen(
    socket,
    username
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
      squad.mode !== 'pvp' ||
      squad.phase !== 'arena' ||
      !state
    ) {

      return;
    }


    const now =
      Date.now();


    const {
      player,
      combat
    } = state;


    if (
      !this.canUseChengAction(
        player,
        combat,
        now
      )
    ) {

      return;
    }


    if (
      now <
      combat.strengthenReadyAt
    ) {

      return;
    }


    // 40 sec cooldown.
    combat.strengthenReadyAt =
      now +
      40000;


    // 5 sec duration.
    combat.strengthenUntil =
      now +
      5000;


    this.io
      .to(
        this.roomForSquad(
          squad
        )
      )
      .emit(
        'combat_strengthen_started',
        {

          playerId:
            player.id,

          until:
            combat.strengthenUntil,

          serverNow:
            now
        }
      );


    this.emitSelfState(
      socket.id
    );
  }


  // =====================================================
  // APPLY DAMAGE
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


    combat.hp =
      Math.max(
        0,
        combat.hp -
        amount
      );


    combat.lastDamageAt =
      now;


    /*
      Receiving damage resets
      regeneration timer to 10 sec.
    */
    combat.nextRegenAt =
      now +
      10000;


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
            -amount,

          sourceId,

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
  // CONTROL HIT
  // =====================================================

  controlHit(
    projectile,
    target
  ) {

    const now =
      Date.now();


    const owner =
      this.gameManager
        .getPlayer(
          projectile.ownerId
        );


    if (
      !owner ||
      !owner.combat ||
      !owner.combat.alive
    ) {

      return;
    }


    /*
      First deal the 50 damage.
    */
    this.applyDamage(

      projectile.squad,

      target,

      projectile.damage,

      owner.id
    );


    /*
      If target survived:
      freeze them for 3 sec.
    */
    if (
      target.combat &&
      target.combat.alive
    ) {

      target.combat
        .stunnedUntil =

        Math.max(

          target.combat
            .stunnedUntil,

          now +
          2000
        );


      this.io
        .to(
          this.roomForSquad(
            projectile.squad
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


    /*
      Successful Control hit:

      +50% movement for 3 seconds
      AND reset basic punch.
    */
    owner.combat
      .speedBuffUntil =
        now +
        3000;


    this.io
      .to(
        this.roomForSquad(
          projectile.squad
        )
      )
      .emit(
        'combat_speed_buff',
        {

          playerId:
            owner.id,

          until:
            owner.combat
              .speedBuffUntil,

          serverNow:
            now
        }
      );


    this.emitSelfState(
      owner.id
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
  // LAST PLAYER STANDING
  // =====================================================

  checkWinner(squad) {

    if (
      !squad ||
      squad.phase !== 'arena' ||
      squad.mode !== 'pvp'
    ) {

      return;
    }


    /*
      Solo mode is allowed for testing.
      We do NOT instantly declare a solo
      player winner when they spawn.
    */
    if (
      squad.members.length <
      2
    ) {

      return;
    }


    const alive = [];


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
      alive.length !== 1
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

          this.roundEndTimers.delete(
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
  // SERVER COMBAT TICK
  // =====================================================

  tick() {

    const now =
      Date.now();


    // ---------------------------------------------------
    // CONTROL PROJECTILES
    // ---------------------------------------------------

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


      let hitTarget =
        null;


      for (
        const username
        of projectile.squad.members
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


      if (hitTarget) {

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


        this.controlHit(

          projectile,

          hitTarget
        );
      }
    }


    // ---------------------------------------------------
    // HEALTH REGENERATION
    // ---------------------------------------------------

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


      // +20 HP per second.
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
  // PROJECTILE EXPIRED
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
}


module.exports =
  CombatManager;