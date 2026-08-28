const LuGuang = {
  id:
    'lu_guang',

  maxHp:
    600,


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


    if (
      !manager.canAct(
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


    /*
      Calculate strengthened BEFORE finding a target.

      Strengthened lasers use tracking/homing behavior.
    */

    const strengthened =
      now <
      combat.strengthenUntil;


    const target =
      manager.findNearestTarget(
        squad,
        player,
        15,
        {
          requireTargetable:
            strengthened
        }
      );


    /*
      No target:
      no projectile,
      no cooldown,
      no movement lock.
    */

    if (
      !target
    ) {

      return;
    }


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


    /*
      Only consume the attack once we have
      a valid target and direction.
    */

    combat.basicReadyAt =
      now + 250;


    manager.lockBasicMovement(
      squad,
      player,
      90
    );


    const damage =
      strengthened
        ? 30
        : 25;


    const direction = {

      x:
        dx /
        distance,

      z:
        dz /
        distance
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
        direction.x *
        0.8,

      z:
        player.z +
        direction.z *
        0.8,

      direction,

      speed:
        80,

      maxRange:
        15,

      radius:
        0.4,

      damage,


      /*
        Normal Laser:
        straight projectile.

        Strengthened Laser:
        tracks the original target.
      */

      homing:
        strengthened,

      tracking:
        strengthened,

      strengthened,


      /*
        Normal lasers only need about
        1 second at this speed/range.

        Strengthened lasers get slightly
        more time, but no longer live
        effectively forever if something
        goes wrong.
      */

      maxLifetime:
        strengthened
          ? 1500
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


    if (
      !manager.canAct(
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


    if (
      !manager.canAct(
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


    if (
      !hit
    ) {

      return;
    }


    /*
      Strengthened Laser:
      independent 33% chance to stun
      for 0.5 seconds.
    */

    if (
      projectile.strengthened &&
      target.combat &&
      target.combat.alive &&
      Math.random() <
        0.33
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