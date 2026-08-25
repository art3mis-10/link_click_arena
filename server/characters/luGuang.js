const LuGuang = {
  id: 'lu_guang',
  maxHp: 600,

  // =====================================================
  // SPACE — LASER
  // =====================================================

  basicAttack(
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

    if (now < combat.basicReadyAt) {
      return;
    }

    const target =
      manager.findNearestTarget(
        squad,
        player,
        15
      );

    if (!target) {
      return;
    }

    combat.basicReadyAt =
      now + 250;

    manager.lockBasicMovement(
      squad,
      player,
      90
    );

    const strengthened =
      now <
      combat.strengthenUntil;

    const damage =
      strengthened
        ? 30
        : 25;

    const dx =
      target.x -
      player.x;

    const dz =
      target.z -
      player.z;

    const distance =
      Math.hypot(
        dx,
        dz
      );

    if (
      distance <=
      0
    ) {
      return;
    }

    const direction = {
      x:
        dx / distance,

      z:
        dz / distance
    };

    manager.spawnProjectile({
      kind:
        'lu_laser',

      squad,

      ownerId:
        player.id,

      ownerName:
        player.name,

      targetId:
        target.id,

      x:
        player.x +
        direction.x * 0.8,

      z:
        player.z +
        direction.z * 0.8,

      direction,

      speed:
        80,

      maxRange:
        15,

      radius:
        0.4,

      damage,

      homing:
        strengthened,

      tracking:
        strengthened,

      strengthened,

      /*
        Normal Lasers still expire normally.

        Strengthened homing Lasers stay alive
        effectively indefinitely until they
        hit, their target dies, their owner
        dies, or the round ends.
      */
      maxLifetime:
        strengthened
          ? Number.MAX_SAFE_INTEGER
          : 1000
    });

    manager.emitSelfState(
      socket.id
    );
  },


  // =====================================================
  // Q — SHIELD
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
      now + 12000;

    combat.shieldHp =
      80;

    combat.shieldMaxHp =
      80;

    combat.shieldUntil =
      now + 3000;

    manager.io
      .to(
        manager.roomForSquad(
          squad
        )
      )
      .emit(
        'combat_shield_started',
        {
          playerId:
            player.id,

          shieldHp:
            80,

          shieldMaxHp:
            80,

          until:
            combat.shieldUntil,

          serverNow:
            now
        }
      );

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
      now + 35000;

    combat.strengthenUntil =
      now + 5000;

    manager.io
      .to(
        manager.roomForSquad(
          squad
        )
      )
      .emit(
        'combat_strengthen_started',
        {
          character:
            'lu_guang',

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
  // LASER HIT
  // =====================================================

  projectileHit(
    manager,
    projectile,
    target
  ) {
    const hit =
      manager.applyDamage(
        projectile.squad,
        target,
        projectile.damage,
        projectile.ownerId,
        {
          tracking:
            Boolean(
              projectile.tracking
            )
        }
      );

    if (!hit) {
      return;
    }

    if (
      projectile.strengthened &&
      target.combat &&
      target.combat.alive &&
      Math.random() < 0.33
    ) {
      manager.applyStun(
        projectile.squad,
        target,
        500
      );
    }
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
      combat.strengthenUntil
    ) {
      multiplier +=
        0.20;
    }

    return multiplier;
  }
};


module.exports =
  LuGuang;