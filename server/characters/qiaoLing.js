const QiaoLing = {
    id:
      'qiao_ling',
  
    maxHp:
      550,
  
  
    // =====================================================
    // SPACE — BOXING
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
        One BOXING combo each second.
        Each combo contains TWO hits.
      */
      if (
        now <
        combat.basicReadyAt
      ) {
        return;
      }
  
      combat.basicReadyAt =
        now + 1000;
  
      /*
        Qiao stays still through both
        parts of the combo.
      */
      manager.lockBasicMovement(
        squad,
        player,
        260
      );
  
      // -------------------------------------------------
      // FIRST HIT — FIST
      // -------------------------------------------------
  
      manager.io
        .to(
          manager.roomForSquad(
            squad
          )
        )
        .emit(
          'combat_qiao_boxing',
          {
            playerId:
              player.id,
  
            phase:
              'fist',
  
            serverNow:
              now
          }
        );
  
      const fistTarget =
        manager.findMeleeTarget(
          squad,
          player,
          4,
          0
        );
  
      if (
        fistTarget
      ) {
        manager.applyDamage(
          squad,
          fistTarget,
          30,
          player.id,
          {
            tracking:
              false
          }
        );
      }
  
  
      // -------------------------------------------------
      // SECOND HIT — LEG SWEEP
      // -------------------------------------------------
  
      setTimeout(
        () => {
          /*
            Qiao could have died or become
            stunned between the two strikes.
  
            The sweep still belongs to the
            already-started combo if she is
            alive, but it does not execute if
            she died.
          */
          if (
            !player.combat ||
            !player.combat.alive ||
            squad.phase !==
              'arena'
          ) {
            return;
          }
  
          manager.io
            .to(
              manager.roomForSquad(
                squad
              )
            )
            .emit(
              'combat_qiao_boxing',
              {
                playerId:
                  player.id,
  
                phase:
                  'sweep',
  
                serverNow:
                  Date.now()
              }
            );
  
          /*
            Re-evaluate the target NOW.
  
            This is what lets a fast or
            invulnerable opponent avoid the
            sweep even if the fist connected.
          */
          const sweepTarget =
            manager.findMeleeTarget(
              squad,
              player,
              4,
              0
            );
  
          if (
            sweepTarget
          ) {
            manager.applyDamage(
              squad,
              sweepTarget,
              50,
              player.id,
              {
                tracking:
                  false
              }
            );
          }
  
        },
        140
      );
  
      manager.emitSelfState(
        socket.id
      );
    },
  
  
    // =====================================================
    // Q — MOBILITY
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
        now + 5000;
  
      /*
        0.25 sec burst.
      */
        combat.mobilityUntil =
        now + 250;
  
      manager.io
        .to(
          manager.roomForSquad(
            squad
          )
        )
        .emit(
          'combat_qiao_mobility',
          {
            playerId:
              player.id,
  
            until:
              combat.mobilityUntil,
  
            serverNow:
              now
          }
        );
  
      manager.emitSelfState(
        socket.id
      );
    },
  
  
    // =====================================================
    // E — DAMAGE
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
        now + 25000;
  
      /*
        Airborne for exactly 1 sec.
  
        During this time:
        - may move normally
        - cannot use another action
        - ignores non-tracking attacks
      */
        combat.airborneUntil =
        now + 1000;
      
      combat.actionLockedUntil =
        now + 1000;
  
      manager.io
        .to(
          manager.roomForSquad(
            squad
          )
        )
        .emit(
          'combat_qiao_damage_started',
          {
            playerId:
              player.id,
  
            until:
              combat.airborneUntil,
  
            height:
              5.5,
  
            radius:
              5,
  
            serverNow:
              now
          }
        );
  
      manager.emitSelfState(
        socket.id
      );
  
  
      setTimeout(
        () => {
          if (
            !player.combat ||
            !player.combat.alive ||
            squad.phase !==
              'arena'
          ) {
            return;
          }
  
          /*
            The AOE center is Qiao's CURRENT
            location, so moving while airborne
            also moves the final impact area.
          */
          const impactX =
            player.x;
  
          const impactZ =
            player.z;
  
          player.combat.airborneUntil =
            0;
  
          player.combat.actionLockedUntil =
            0;
  
          manager.io
            .to(
              manager.roomForSquad(
                squad
              )
            )
            .emit(
              'combat_qiao_damage_impact',
              {
                playerId:
                  player.id,
  
                x:
                  impactX,
  
                z:
                  impactZ,
  
                radius:
                  7,
  
                serverNow:
                  Date.now()
              }
            );
  
          /*
            350 AOE damage + 1 sec AOE stun.
          */
          for (
            const member
            of squad.members
          ) {
            const socketId =
              manager.onlineUsers.get(
                member
              );
  
            if (
              !socketId ||
              socketId ===
                player.id
            ) {
              continue;
            }
  
            const target =
              manager.gameManager
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
                  impactX,
  
                target.z -
                  impactZ
              );
  
            if (
              distance >
              5
            ) {
              continue;
            }
  
            const hit =
              manager.applyDamage(
                squad,
                target,
                350,
                player.id,
                {
                  tracking:
                    false
                }
              );
  
            if (
              hit &&
              target.combat.alive
            ) {
              manager.applyStun(
                squad,
                target,
                1000
              );
            }
          }
  
          manager.emitSelfState(
            player.id
          );
  
        },
        1000
      );
    },
  
  
    // =====================================================
    // MOVEMENT
    // =====================================================
  
    movementMultiplier(
      combat,
      now
    ) {
      /*
        Normal player speed is 9.
  
        Qiao's Mobility is explicitly
        60 world units / sec.
  
        70 / 9 = 6.666...
      */
        if (
            now <
            combat.mobilityUntil
          ) {
            return (
              70 / 9
            );
          }
  
      return 1;
    }
  };
  
  
  module.exports =
    QiaoLing;