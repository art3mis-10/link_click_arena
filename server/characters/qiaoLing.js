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
      One combo each second.

      One click:
      30 fist
      then
      50 sweep.
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
      Qiao stands still for the
      short two-hit animation.
    */

    manager.lockBasicMovement(
      squad,
      player,
      260
    );


    // =================================================
    // HIT 1 — FIST
    // =================================================

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


    // =================================================
    // HIT 2 — SWEEP
    // =================================================

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
          Re-check independently.

          This preserves the design where the
          second hit can be dodged separately.
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
      Exactly 0.25 seconds.
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
      Tianxi E interaction.

      Qiao may still CAST DAMAGE while
      immobilized, but she cannot rise or
      move during the one-second windup.
    */

    const forcedGround =

      now <
      (
        combat.immobilizedUntil ||
        0
      );


    /*
      Normal:
        airborne for 1 sec.

      Tianxi immobilized:
        airborneUntil = 0.
    */

    combat.airborneUntil =

      forcedGround

        ? 0

        : now + 1000;


    /*
      Either version still lasts
      exactly 1 second before impact.
    */

    const damageEndsAt =
      now + 1000;


    combat.actionLockedUntil =
      damageEndsAt;


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

          /*
            This is the ACTION end time,
            not airborneUntil.

            Ground Qiao still needs a
            1-second animation.
          */

          until:
            damageEndsAt,

          airborne:
            !forcedGround,

          height:

            forcedGround
              ? 0
              : 5.5,

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
          Qiao's CURRENT X/Z is the
          center of the impact.

          Normal Qiao may move while airborne.

          Immobilized Qiao stays fixed because
          movement validation blocks X/Z.
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
                5,

              serverNow:
                Date.now()
            }
          );


        /*
          350 damage.

          Radius exactly 5.

          Survivors:
          1 second stun.
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
      Base movement:
      9 units/sec.

      Mobility:
      exactly 70 units/sec.

      9 × 70/9 = 70.
    */

    if (
      now <
      combat.mobilityUntil
    ) {

      return 70 / 9;
    }


    return 1;
  }
};


module.exports =
  QiaoLing;