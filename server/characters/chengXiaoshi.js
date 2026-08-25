const ChengXiaoshi = {
  id: 'cheng_xiaoshi',
  maxHp: 850,

  // =====================================================
  // SPACE — PUNCH
  // =====================================================

  basicAttack(
    manager,
    socket,
    username,
    squad,
    player,
    combat
  ) {
    const now = Date.now();

    if (!manager.canAct(player, combat, now)) {
      return;
    }

    if (now < combat.basicReadyAt) {
      return;
    }

    const strengthened =
      now < combat.strengthenUntil;

    const damage =
      strengthened
        ? 100
        : 80;

    const cooldown =
      strengthened
        ? 500
        : 1000;

    combat.basicReadyAt =
      now + cooldown;

    /*
      Universal basic attack movement stop.
    */
    manager.lockBasicMovement(
      squad,
      player,
      180
    );

    manager.io
      .to(
        manager.roomForSquad(squad)
      )
      .emit(
        'combat_basic_attack',
        {
          character: 'cheng_xiaoshi',
          attackerId: player.id,
          damage,
          serverNow: now
        }
      );

    const target =
      manager.findMeleeTarget(
        squad,
        player,
        4,
        0
      );

    if (target) {
      manager.applyDamage(
        squad,
        target,
        damage,
        player.id,
        {
          tracking: false
        }
      );
    }

    manager.emitSelfState(
      socket.id
    );
  },


  // =====================================================
  // Q — CONTROL
  // =====================================================

  ability(
    manager,
    socket,
    username,
    squad,
    player,
    combat
  ) {
    const now =
      Date.now();

    if (!manager.canAct(player, combat, now)) {
      return;
    }

    if (now < combat.controlReadyAt) {
      return;
    }

    combat.controlReadyAt =
      now + 10000;

    /*
      Always resets basic on cast.
    */
    combat.basicReadyAt =
      0;

    socket.emit(
      'combat_basic_reset',
      {
        serverNow: now
      }
    );

    const direction = {
      x:
        -Math.sin(
          player.rotation || 0
        ),

      z:
        -Math.cos(
          player.rotation || 0
        )
    };

    manager.spawnProjectile({
      kind:
        'cheng_control',

      squad,

      ownerId:
        player.id,

      ownerName:
        player.name,

      x:
        player.x +
        direction.x,

      z:
        player.z +
        direction.z,

      direction,

      speed:
        22,

      maxRange:
        12,

      radius:
        0.75,

      damage:
        50,

      homing:
        false,

      tracking:
        false
    });

    manager.emitSelfState(
      socket.id
    );
  },


  // =====================================================
  // E — STRENGTHEN
  // =====================================================

  ult(
    manager,
    socket,
    username,
    squad,
    player,
    combat
  ) {
    const now =
      Date.now();

    if (!manager.canAct(player, combat, now)) {
      return;
    }

    if (now < combat.strengthenReadyAt) {
      return;
    }

    combat.strengthenReadyAt =
      now + 40000;

    combat.strengthenUntil =
      now + 5000;

    manager.io
      .to(
        manager.roomForSquad(squad)
      )
      .emit(
        'combat_strengthen_started',
        {
          character:
            'cheng_xiaoshi',

          playerId:
            player.id,

          until:
            combat.strengthenUntil,

          serverNow:
            now
        }
      );

    manager.emitSelfState(
      socket.id
    );
  },


  // =====================================================
  // CONTROL HIT
  // =====================================================

  projectileHit(
    manager,
    projectile,
    target
  ) {
    const now =
      Date.now();

    const owner =
      manager.gameManager
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

    const hit =
      manager.applyDamage(
        projectile.squad,
        target,
        50,
        owner.id,
        {
          tracking:
            false
        }
      );

    /*
      If Qiao Ling is airborne,
      Control passes through and does
      NOT stun or give Cheng speed.
    */
    if (!hit) {
      return;
    }

    if (
      target.combat &&
      target.combat.alive
    ) {
      manager.applyStun(
        projectile.squad,
        target,
        3000
      );
    }

    owner.combat.speedBuffUntil =
      now + 3000;

    manager.io
      .to(
        manager.roomForSquad(
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

    manager.emitSelfState(
      owner.id
    );
  },


  // =====================================================
  // MOVEMENT
  // =====================================================

  movementMultiplier(
    combat,
    now
  ) {
    let multiplier =
      1;

    if (
      now <
      combat.speedBuffUntil
    ) {
      multiplier +=
        0.50;
    }

    if (
      now <
      combat.strengthenUntil
    ) {
      multiplier +=
        0.15;
    }

    return multiplier;
  }
};


module.exports =
  ChengXiaoshi;