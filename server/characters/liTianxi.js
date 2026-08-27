const BASIC_INTERVAL_MS =
  667;

const BASIC_MEMORY_MS =
  3000;

const MARK_DURATION_MS =
  5000;


const Q_COOLDOWN_MS =
  10000;

const Q_WAVE_DURATION_MS =
  1000;

const Q_WAVE_SPEED =
  30;

const Q_WAVE_WIDTH =
  12;

const Q_WAVE_DEPTH =
  2.4;

const Q_BACKBURST_DURATION_MS =
  500;

const Q_BACKBURST_SPEED =
  40;


const ULT_RANGE =
  20;

/*
  User specification says:
  "very great speed"

  No exact number was supplied,
  so this is the one implementation
  constant to tune later if needed.
*/
const ULT_FLIGHT_SPEED =
  120;

const ULT_DURATION_MS =
  1500;

const ULT_HITS =
  8;

const ULT_DAMAGE =
  12;


// =====================================================
// BASIC COUNT EVENT
// =====================================================

function emitBasicCount(
  manager,
  squad,
  player,
  combat
) {

  manager.io
    .to(
      manager.roomForSquad(
        squad
      )
    )
    .emit(
      'combat_tianxi_basic_count',
      {

        playerId:
          player.id,

        count:
          combat.tianxiBasicCount ||
          0,

        expiresAt:
          combat.tianxiBasicExpiresAt ||
          0,

        serverNow:
          Date.now()
      }
    );
}


// =====================================================
// RESET BASIC COUNTER AFTER 3 SEC
// =====================================================

function resetBasicLater(
  manager,
  squad,
  player,
  expectedExpiry
) {

  setTimeout(
    () => {

      if (
        !player.combat ||
        !player.combat.alive ||
        player.combat.tianxiBasicExpiresAt !==
          expectedExpiry ||
        Date.now() <
          expectedExpiry
      ) {

        return;
      }


      player.combat.tianxiBasicCount =
        0;


      player.combat.tianxiBasicExpiresAt =
        0;


      emitBasicCount(
        manager,
        squad,
        player,
        player.combat
      );


      manager.emitSelfState(
        player.id
      );

    },
    BASIC_MEMORY_MS +
    40
  );
}


// =====================================================
// RELEASE E
// =====================================================

function releaseUlt(
  manager,
  squad,
  player,
  target
) {

  if (
    player.combat
  ) {

    player.combat.tianxiUltActive =
      false;


    player.combat.actionLockedUntil =
      0;


    player.combat.immobilizedUntil =
      0;


    player.combat.immobilizedBy =
      null;
  }


  /*
    Only release the target if THIS
    Tianxi is the one immobilizing them.
  */

  if (
    target &&
    target.combat &&
    target.combat.immobilizedBy ===
      player.id
  ) {

    target.combat.immobilizedUntil =
      0;


    target.combat.immobilizedBy =
      null;


    manager.io
      .to(
        manager.roomForSquad(
          squad
        )
      )
      .emit(
        'combat_immobilized',
        {

          playerId:
            target.id,

          sourceId:
            player.id,

          until:
            0,

          serverNow:
            Date.now()
        }
      );


    manager.emitSelfState(
      target.id
    );
  }


  manager.io
    .to(
      manager.roomForSquad(
        squad
      )
    )
    .emit(
      'combat_tianxi_ult_end',
      {

        playerId:
          player.id,

        targetId:
          target
            ? target.id
            : null,

        serverNow:
          Date.now()
      }
    );


  manager.emitSelfState(
    player.id
  );
}


// =====================================================
// LI TIANXI
// =====================================================

const LiTianxi = {

  id:
    'li_tianxi',

  maxHp:
    650,


  // ===================================================
  // SPACE — FLUFF BALLS
  // ===================================================

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
  
  
    // ===================================================
    // RESET OLD 3-SECOND ATTACK CHAIN
    // ===================================================
  
    if (
      combat.tianxiBasicCount >
        0 &&
      now >=
        (
          combat.tianxiBasicExpiresAt ||
          0
        )
    ) {
  
      combat.tianxiBasicCount =
        0;
  
  
      combat.tianxiBasicExpiresAt =
        0;
  
  
      emitBasicCount(
        manager,
        squad,
        player,
        combat
      );
    }
  
  
    // ===================================================
    // FIND TARGET IF ONE EXISTS
    // ===================================================
  
    const target =
      manager.findNearestTarget(
  
        squad,
  
        player,
  
        12,
  
        {
          requireTargetable:
            true
        }
      );
  
  
    /*
      IMPORTANT:
  
      NO TARGET DOES NOT CANCEL THE ATTACK.
  
      Tianxi is allowed to fire into empty space.
    */
  
  
    // ===================================================
    // COOLDOWN + MOVEMENT LOCK
    // ===================================================
  
    combat.basicReadyAt =
      now +
      BASIC_INTERVAL_MS;
  
  
    manager.lockBasicMovement(
      squad,
      player,
      90
    );
  
  
    // ===================================================
    // BASIC COUNT
    //
    // 0 → 1
    // 1 → 2
    // 2 → third shot → 0
    // ===================================================
  
    const nextCount =
  
      (
        combat.tianxiBasicCount ||
        0
      ) +
      1;
  
  
    const appliesMark =
      nextCount >=
      3;
  
  
    if (
      appliesMark
    ) {
  
      combat.tianxiBasicCount =
        0;
  
  
      combat.tianxiBasicExpiresAt =
        0;
  
    } else {
  
      combat.tianxiBasicCount =
        nextCount;
  
  
      combat.tianxiBasicExpiresAt =
        now +
        BASIC_MEMORY_MS;
  
  
      resetBasicLater(
  
        manager,
  
        squad,
  
        player,
  
        combat.tianxiBasicExpiresAt
      );
    }
  
  
    emitBasicCount(
      manager,
      squad,
      player,
      combat
    );
  
  
    // ===================================================
    // DIRECTION
    // ===================================================
  
    let direction;
  
  
    if (
      target
    ) {
  
      /*
        TARGET EXISTS:
  
        Fire toward that target and then
        follow that original target.
      */
  
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
        distance >
        0
      ) {
  
        direction = {
  
          x:
            dx /
            distance,
  
          z:
            dz /
            distance
        };
  
      } else {
  
        /*
          Extremely rare overlap fallback:
          fire in Tianxi's facing direction.
        */
  
        direction = {
  
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
      }
  
    } else {
  
      /*
        NO TARGET:
  
        Lock the shot to the direction Tianxi
        was facing at the moment SPACE was pressed.
      */
  
      direction = {
  
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
    }
  
  
    // ===================================================
    // SPAWN FLUFF BALL
    // ===================================================
  
    manager.spawnProjectile({
  
      kind:
        'tianxi_fluff',
  
      squad,
  
      ownerId:
        player.id,
  
      ownerName:
        player.name,
  
      /*
        Target only exists for the homing version.
      */
  
      targetId:
        target
          ? target.id
          : null,
  
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
        40,
  
      /*
        Straight empty-space shot travels
        exactly up to 12 world units.
  
        Homing shot still uses this as its
        initial acquisition range.
      */
  
      maxRange:
        12,
  
      radius:
        0.42,
  
      damage:
        7,
  
      /*
        HAS TARGET:
        follows original opponent.
  
        NO TARGET:
        straight projectile.
      */
  
      homing:
        Boolean(
          target
        ),
  
      /*
        A homing Tianxi shot is tracking.
  
        An empty-space shot is NOT tracking
        because it is just travelling straight.
      */
  
      tracking:
        Boolean(
          target
        ),
  
      /*
        Third attack carries the mark property
        whether or not somebody was in range
        when it was fired.
  
        Therefore, if a straight third shot
        later collides with somebody, it can
        mark them.
      */
  
      appliesMark,
  
      /*
        Homing:
        stays alive until hit/target death/etc.
  
        Straight shot:
        12 units at 40 u/s = 0.3 seconds.
        Give it a tiny tolerance above 300 ms.
      */
  
      maxLifetime:
  
        target
  
          ? Number.MAX_SAFE_INTEGER
  
          : 350
    });
  
  
    manager.emitSelfState(
      socket.id
    );
  },


  // ===================================================
  // Q — MARK
  // ===================================================

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
      now +
      Q_COOLDOWN_MS;


    const forward = {

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


    const backward = {

      x:
        -forward.x,

      z:
        -forward.z
    };


    // ---------------------------------------------------
    // 0.5 SECOND INVINCIBILITY
    // ---------------------------------------------------

    combat.invincibleUntil =
      now +
      Q_BACKBURST_DURATION_MS;


    /*
      New follow-until-hit attacks cannot
      choose Tianxi during this time.

      EXISTING tracking attacks are still
      valid and keep following.
    */

    combat.untargetableUntil =
      now +
      Q_BACKBURST_DURATION_MS;


    combat.tianxiBackburstUntil =
      now +
      Q_BACKBURST_DURATION_MS;


    // ---------------------------------------------------
    // WAVE VISUAL
    // ---------------------------------------------------

    manager.io
      .to(
        manager.roomForSquad(
          squad
        )
      )
      .emit(
        'combat_tianxi_wave_started',
        {

          playerId:
            player.id,

          x:
            player.x,

          z:
            player.z,

          direction:
            forward,

          width:
            Q_WAVE_WIDTH,

          speed:
            Q_WAVE_SPEED,

          duration:
            Q_WAVE_DURATION_MS,

          serverNow:
            now
        }
      );


    // ---------------------------------------------------
    // BACKWARD BURST VISUAL
    // ---------------------------------------------------

    manager.io
      .to(
        manager.roomForSquad(
          squad
        )
      )
      .emit(
        'combat_tianxi_backburst',
        {

          playerId:
            player.id,

          direction:
            backward,

          speed:
            Q_BACKBURST_SPEED,

          until:
            combat.tianxiBackburstUntil,

          invincibleUntil:
            combat.invincibleUntil,

          serverNow:
            now
        }
      );


    /*
      Save wave origin BEFORE Tianxi
      starts moving backwards.
    */

    const waveOriginX =
      player.x;


    const waveOriginZ =
      player.z;


    // ---------------------------------------------------
    // AUTOMATIC BACKWARD BURST
    // ---------------------------------------------------

    let lastBurstTick =
      now;


    const burstTimer =
      setInterval(
        () => {

          const tickNow =
            Date.now();


          if (
            !player.combat ||
            !player.combat.alive ||
            squad.phase !==
              'arena' ||
            tickNow >=
              combat.tianxiBackburstUntil
          ) {

            clearInterval(
              burstTimer
            );


            combat.tianxiBackburstUntil =
              0;


            manager.emitSelfState(
              player.id
            );


            return;
          }


          const dt =
            Math.min(

              0.06,

              (
                tickNow -
                lastBurstTick
              ) /
              1000
            );


          lastBurstTick =
            tickNow;


          player.x =
            Math.max(

              -24,

              Math.min(

                24,

                player.x +

                backward.x *
                Q_BACKBURST_SPEED *
                dt
              )
            );


          player.z =
            Math.max(

              -24,

              Math.min(

                24,

                player.z +

                backward.z *
                Q_BACKBURST_SPEED *
                dt
              )
            );


          manager.emitForcedPosition(
            squad,
            player
          );

        },
        40
      );


    // ---------------------------------------------------
    // RECTANGULAR WAVE
    // ---------------------------------------------------

    const hitTargets =
      new Set();


    const waveStart =
      now;


    const waveTimer =
      setInterval(
        () => {

          const tickNow =
            Date.now();


          const elapsed =
            tickNow -
            waveStart;


          if (
            !player.combat ||
            !player.combat.alive ||
            squad.phase !==
              'arena' ||
            elapsed >=
              Q_WAVE_DURATION_MS
          ) {

            clearInterval(
              waveTimer
            );


            manager.io
              .to(
                manager.roomForSquad(
                  squad
                )
              )
              .emit(
                'combat_tianxi_wave_end',
                {

                  playerId:
                    player.id,

                  serverNow:
                    tickNow
                }
              );


            return;
          }


          /*
            30 u/s for one second.
          */

          const progress =

            Q_WAVE_SPEED *

            (
              elapsed /
              1000
            );


          const waveX =

            waveOriginX +

            forward.x *
            progress;


          const waveZ =

            waveOriginZ +

            forward.z *
            progress;


          /*
            Perpendicular vector.
          */

          const sideX =
            -forward.z;


          const sideZ =
            forward.x;


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
                player.id ||
              hitTargets.has(
                socketId
              )
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


            const rx =
              target.x -
              waveX;


            const rz =
              target.z -
              waveZ;


            const lateral =
              Math.abs(

                rx *
                sideX +

                rz *
                sideZ
              );


            const longitudinal =
              Math.abs(

                rx *
                forward.x +

                rz *
                forward.z
              );


            /*
              Width = exactly 12.

              Depth is just the visual/hit
              thickness of the travelling wave.
            */

            if (
              lateral >
                Q_WAVE_WIDTH /
                2 ||

              longitudinal >
                Q_WAVE_DEPTH /
                2
            ) {

              continue;
            }


            /*
              One Q can affect each target
              only once.
            */

            hitTargets.add(
              socketId
            );


            const alreadyMarked =
              manager.hasTianxiMark(

                player,

                target,

                tickNow
              );


            /*
              Q is non-tracking, so airborne
              Qiao can avoid it.

              Tianxi's invincibility also
              blocks it.
            */

            const hit =
              manager.applyDamage(

                squad,

                target,

                60,

                player.id,

                {
                  tracking:
                    false
                }
              );


            if (
              !hit
            ) {

              continue;
            }


            /*
              Already marked:
              stun 1.5 sec.

              Mark remains afterward.
            */

            if (
              alreadyMarked &&
              target.combat.alive
            ) {

              manager.applyStun(

                squad,

                target,

                1500
              );
            }


            /*
              Applying Q refreshes the mark
              to another maximum 5 seconds.
            */

            if (
              target.combat.alive
            ) {

              manager.addTianxiMark(

                squad,

                player,

                target,

                MARK_DURATION_MS
              );
            }
          }

        },
        40
      );


    manager.emitSelfState(
      socket.id
    );
  },


  // ===================================================
  // E — DAMAGE
  // ===================================================

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


    /*
      NO cooldown.

      Find all opponents:
      - alive
      - marked by THIS Tianxi
      - within 20
      - currently targetable
    */

    const forwardX =
      -Math.sin(
        player.rotation ||
        0
      );


    const forwardZ =
      -Math.cos(
        player.rotation ||
        0
      );


    let target =
      null;


    let bestAngle =
      Infinity;


    let bestDistance =
      Infinity;


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


      const candidate =
        manager.gameManager
          .getPlayer(
            socketId
          );


      if (
        !candidate ||
        !candidate.combat ||
        !candidate.combat.alive ||
        !manager.hasTianxiMark(

          player,

          candidate,

          now
        ) ||
        !manager.isTargetableForTracking(

          candidate,

          now
        )
      ) {

        continue;
      }


      const dx =
        candidate.x -
        player.x;


      const dz =
        candidate.z -
        player.z;


      const distance =
        Math.hypot(
          dx,
          dz
        );


      if (
        distance >
        ULT_RANGE
      ) {

        continue;
      }


      /*
        Find smallest horizontal camera/facing
        angle.

        A player behind Tianxi can still win
        if they're the only marked target.
      */

      const dot =
        distance >
          0

          ? Math.max(

              -1,

              Math.min(

                1,

                (
                  dx /
                  distance
                ) *
                forwardX +

                (
                  dz /
                  distance
                ) *
                forwardZ
              )
            )

          : 1;


      const angle =
        Math.acos(
          dot
        );


      if (
        angle <
          bestAngle -
          0.0001 ||

        (
          Math.abs(
            angle -
            bestAngle
          ) <
            0.0001 &&

          distance <
            bestDistance
        )
      ) {

        target =
          candidate;


        bestAngle =
          angle;


        bestDistance =
          distance;
      }
    }


    if (
      !target
    ) {

      socket.emit(
        'combat_tianxi_ult_unavailable',
        {

          message:
            'No marked opponent is within 20 units.',

          serverNow:
            now
        }
      );


      return;
    }


    /*
      Tianxi cannot manually move or cast
      other actions while flying/attacking.
    */

    combat.tianxiUltActive =
      true;


    combat.actionLockedUntil =
      now +
      10000;


    combat.immobilizedUntil =
      now +
      10000;


    combat.immobilizedBy =
      player.id;


    manager.io
      .to(
        manager.roomForSquad(
          squad
        )
      )
      .emit(
        'combat_tianxi_ult_started',
        {

          playerId:
            player.id,

          targetId:
            target.id,

          flightSpeed:
            ULT_FLIGHT_SPEED,

          serverNow:
            now
        }
      );


    // ---------------------------------------------------
    // FOLLOW TARGET UNTIL REACHED
    // ---------------------------------------------------

    let lastFlightTick =
      now;


    const flightTimer =
      setInterval(
        () => {

          const tickNow =
            Date.now();


          if (
            !player.combat ||
            !player.combat.alive ||
            !target.combat ||
            !target.combat.alive ||
            squad.phase !==
              'arena'
          ) {

            clearInterval(
              flightTimer
            );


            releaseUlt(
              manager,
              squad,
              player,
              target
            );


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


          const dt =
            Math.min(

              0.06,

              (
                tickNow -
                lastFlightTick
              ) /
              1000
            );


          lastFlightTick =
            tickNow;


          const step =
            ULT_FLIGHT_SPEED *
            dt;


          /*
            Once E is cast, target moving
            beyond 20 does NOT cancel it.
          */

          if (
            distance <=
              0.75 ||
            step >=
              distance
          ) {

            clearInterval(
              flightTimer
            );


            const dirX =
              distance >
                0

                ? dx /
                  distance

                : 0;


            const dirZ =
              distance >
                0

                ? dz /
                  distance

                : -1;


            /*
              Keep Tianxi just beside the target
              so the models don't occupy exactly
              the same space visually.
            */

            const offsetX =
              -dirX *
              0.75;


            const offsetZ =
              -dirZ *
              0.75;


            player.x =
              target.x +
              offsetX;


            player.z =
              target.z +
              offsetZ;


            manager.emitForcedPosition(
              squad,
              player
            );


            const attachedAt =
              Date.now();


            const endsAt =
              attachedAt +
              ULT_DURATION_MS;


            combat.actionLockedUntil =
              endsAt;


            combat.immobilizedUntil =
              endsAt;


            /*
              TARGET:
              movement disabled,
              attacks/abilities remain usable.
            */

            target.combat.immobilizedUntil =
              Math.max(

                target.combat.immobilizedUntil ||
                0,

                endsAt
              );


            target.combat.immobilizedBy =
              player.id;


            manager.io
              .to(
                manager.roomForSquad(
                  squad
                )
              )
              .emit(
                'combat_immobilized',
                {

                  playerId:
                    target.id,

                  sourceId:
                    player.id,

                  until:
                    endsAt,

                  serverNow:
                    attachedAt
                }
              );


            manager.io
              .to(
                manager.roomForSquad(
                  squad
                )
              )
              .emit(
                'combat_tianxi_ult_attached',
                {

                  playerId:
                    player.id,

                  targetId:
                    target.id,

                  until:
                    endsAt,

                  serverNow:
                    attachedAt
                }
              );


            manager.emitSelfState(
              player.id
            );


            manager.emitSelfState(
              target.id
            );


            // -------------------------------------------
            // 8 HITS OVER 1.5 SEC
            // -------------------------------------------

            let hitIndex =
              0;


            const attackTimer =
              setInterval(
                () => {

                  if (
                    !player.combat ||
                    !player.combat.alive ||
                    !target.combat ||
                    !target.combat.alive ||
                    squad.phase !==
                      'arena'
                  ) {

                    clearInterval(
                      attackTimer
                    );


                    releaseUlt(
                      manager,
                      squad,
                      player,
                      target
                    );


                    return;
                  }


                  /*
                    Stick to target's CURRENT
                    location.
                  */

                  player.x =
                    target.x +
                    offsetX;


                  player.z =
                    target.z +
                    offsetZ;


                  manager.emitForcedPosition(
                    squad,
                    player
                  );


                  hitIndex +=
                    1;


                  manager.applyDamage(

                    squad,

                    target,

                    ULT_DAMAGE,

                    player.id,

                    {
                      tracking:
                        true
                    }
                  );


                  manager.io
                    .to(
                      manager.roomForSquad(
                        squad
                      )
                    )
                    .emit(
                      'combat_tianxi_ult_hit',
                      {

                        playerId:
                          player.id,

                        targetId:
                          target.id,

                        hitIndex,

                        totalHits:
                          ULT_HITS,

                        damage:
                          ULT_DAMAGE,

                        serverNow:
                          Date.now()
                      }
                    );


                  if (
                    hitIndex >=
                      ULT_HITS ||
                    !target.combat.alive
                  ) {

                    clearInterval(
                      attackTimer
                    );


                    /*
                      Mark is removed only when
                      E finishes.
                    */

                    manager.clearTianxiMark(

                      squad,

                      player,

                      target
                    );


                    releaseUlt(

                      manager,

                      squad,

                      player,

                      target
                    );
                  }

                },
                ULT_DURATION_MS /
                ULT_HITS
              );


            return;
          }


          /*
            Very-fast tracking sprint.
          */

          if (
            distance >
            0
          ) {

            player.x =
              Math.max(

                -24,

                Math.min(

                  24,

                  player.x +

                  (
                    dx /
                    distance
                  ) *

                  step
                )
              );


            player.z =
              Math.max(

                -24,

                Math.min(

                  24,

                  player.z +

                  (
                    dz /
                    distance
                  ) *

                  step
                )
              );


            manager.emitForcedPosition(
              squad,
              player
            );
          }

        },
        40
      );


    manager.emitSelfState(
      socket.id
    );
  },


  // ===================================================
  // FLUFF BALL HIT
  // ===================================================

  projectileHit(
    manager,
    projectile,
    target
  ) {

    const hit =
      manager.applyDamage(

        projectile.squad,

        target,

        7,

        projectile.ownerId,

        {
          tracking:
            true
        }
      );


    if (
      !hit ||
      !projectile.appliesMark ||
      !target.combat.alive
    ) {

      return;
    }


    const owner =
      manager.gameManager
        .getPlayer(
          projectile.ownerId
        );


    if (
      owner &&
      owner.combat &&
      owner.combat.alive
    ) {

      manager.addTianxiMark(

        projectile.squad,

        owner,

        target,

        MARK_DURATION_MS
      );
    }
  },


  movementMultiplier() {

    return 1;
  }
};


module.exports =
  LiTianxi;