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
  
  
      /*
        4 attacks/sec
  
        1000 / 4 = 250ms
      */
  
      if (
        now <
        combat.basicReadyAt
      ) {
  
        return;
      }
  
  
      /*
        Automatically find nearest
        living opponent inside 10 units.
      */
  
      const target =
        manager.findNearestTarget(
  
          squad,
  
          player,
  
          10
        );
  
  
      /*
        Cannot attack if nobody
        is currently within range.
      */
  
      if (!target) {
  
        return;
      }
  
  
      combat.basicReadyAt =
        now +
        250;
  
  
      const strengthened =
        now <
        combat.strengthenUntil;
  
  
      /*
        Normal = 25
        Strengthen = 30
      */
  
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
        distance <= 0
      ) {
  
        return;
      }
  
  
      const direction = {
  
        x:
          dx /
          distance,
  
        z:
          dz /
          distance
      };
  
  
      /*
        Normal laser:
  
        travels straight toward
        the opponent's CURRENT location.
  
        Therefore technically dodgeable.
  
        Strengthen laser:
  
        tracks the target after firing.
      */
  
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
          70,
  
        maxRange:
          10,
  
        radius:
          0.4,
  
        damage,
  
        homing:
          strengthened,
  
        strengthened,
  
        /*
          Homing lasers get enough lifetime
          to follow the opponent around
          the whole small arena.
        */
  
        maxLifetime:
          strengthened
            ? 2500
            : 800
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
  
  
      /*
        12 second cooldown.
      */
  
      combat.controlReadyAt =
        now +
        12000;
  
  
      /*
        80 HP shield.
        Lasts 3 seconds.
      */
  
      combat.shieldHp =
        80;
  
  
      combat.shieldMaxHp =
        80;
  
  
      combat.shieldUntil =
        now +
        3000;
  
  
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
  
  
      /*
        35 second cooldown.
      */
  
      combat.strengthenReadyAt =
        now +
        35000;
  
  
      /*
        5 seconds.
      */
  
      combat.strengthenUntil =
        now +
        5000;
  
  
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
  
      manager.applyDamage(
  
        projectile.squad,
  
        target,
  
        projectile.damage,
  
        projectile.ownerId
      );
  
  
      /*
        During Strengthen:
  
        each laser has 33% chance
        to stun for 0.5 seconds.
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
  
  
      /*
        Strengthen:
        +20% movement.
      */
  
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