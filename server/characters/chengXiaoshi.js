const ChengXiaoshi = {

    id:
      'cheng_xiaoshi',
  
  
    maxHp:
      850,
  
  
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
  
  
      const strengthened =
        now <
        combat.strengthenUntil;
  
  
      /*
        NORMAL:
        80 damage
        1/sec
  
        STRENGTHEN:
        100 damage
        2/sec
      */
  
      const damage =
        strengthened
          ? 100
          : 80;
  
  
      const cooldown =
        strengthened
          ? 500
          : 1000;
  
  
      combat.basicReadyAt =
        now +
        cooldown;
  
  
      /*
        Tell everybody to display
        Cheng's punch animation.
      */
  
      manager.io
        .to(
          manager.roomForSquad(
            squad
          )
        )
        .emit(
          'combat_basic_attack',
          {
  
            character:
              'cheng_xiaoshi',
  
            attackerId:
              player.id,
  
            damage,
  
            serverNow:
              now
          }
        );
  
  
      /*
        PUNCH:
  
        4 world units
        entire front 180 degrees
      */
  
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
  
          player.id
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
        10 second cooldown begins
        as soon as Q is thrown.
      */
  
      combat.controlReadyAt =
        now +
        10000;
  
  
      /*
        IMPORTANT:
  
        Control ALWAYS resets Punch.
  
        It does NOT need to hit.
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
        40 second cooldown
      */
  
      combat.strengthenReadyAt =
        now +
        40000;
  
  
      /*
        5 second duration
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
  
  
      /*
        50 damage
      */
  
      manager.applyDamage(
  
        projectile.squad,
  
        target,
  
        50,
  
        owner.id
      );
  
  
      /*
        If target survives:
        3-second full stun.
      */
  
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
  
  
      /*
        Speed boost happens ONLY
        if Control actually hits.
  
        +50% for 3 seconds.
      */
  
      owner.combat
        .speedBuffUntil =
          now +
          3000;
  
  
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
  
  
      /*
        Control hit speed buff.
      */
  
      if (
        now <
        combat.speedBuffUntil
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