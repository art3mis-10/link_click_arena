const path =
  require('path');


const crypto =
  require('crypto');


require('dotenv').config({

  path:
    path.join(
      __dirname,
      '../.env'
    )
});


const express =
  require('express');


const mongoose =
  require('mongoose');


const jwt =
  require('jsonwebtoken');


const User =
  require('./User');


const GameManager =
  require('./gameRoom');


const CombatManager =
  require('./combatManager');


const app =
  express();


const http =
  require('http')
    .createServer(
      app
    );


const io =
  require('socket.io')(
    http
  );


const gameManager =
  new GameManager();


// =====================================================
// LIVE STATE
// =====================================================

const onlineUsers =
  new Map();


const activeSquads =
  new Map();


const userSquadHosts =
  new Map();


// =====================================================
// EXPRESS
// =====================================================

app.use(

  express.json({
    limit:
      '50mb'
  })
);


app.use(

  express.urlencoded({

    limit:
      '50mb',

    extended:
      true
  })
);


/*
  PUBLIC FILES
*/

app.use(

  express.static(

    path.join(
      __dirname,
      '../public'
    )
  )
);


/*
  ROOT ASSETS FOLDER
*/

app.use(

  '/assets',

  express.static(

    path.join(
      __dirname,
      '../assets'
    )
  )
);


// =====================================================
// DATABASE
// =====================================================

mongoose
  .connect(
    process.env.MONGO_URI
  )
  .then(
    () => {

      console.log(
        'MongoDB Atlas Connected Successfully!'
      );
    }
  )
  .catch(
    error => {

      console.error(
        'Database connection error:',
        error
      );
    }
  );


// =====================================================
// SQUADS
// =====================================================

function makeSoloSquad(
  username,
  mode = 'match'
) {

  const squad = {

    host:
      username,

    mode,

    members: [
      username
    ],

    phase:
      'lobby',

    selections:
      {},

    ready:
      {},

    /*
      Snapshot of who actually
      STARTED this round.
    */
    roundRoster:
      [],

    /*
      Stops accidental double-awards.
    */
    roundStatsRecorded:
      false
  };


  activeSquads.set(
    username,
    squad
  );


  userSquadHosts.set(
    username,
    username
  );


  return squad;
}


function getSquadForUser(
  username
) {

  const hostUsername =
    userSquadHosts.get(
      username
    );


  if (
    !hostUsername
  ) {

    return null;
  }


  return (
    activeSquads.get(
      hostUsername
    ) ||
    null
  );
}


function roomForSquad(
  squad
) {

  return `squad_${squad.host}`;
}


function maxPlayersForMode(
  mode
) {

  return mode ===
    'pvp'

    ? 4

    : 2;
}


function validCharacter(
  character
) {

  return (

    character ===
      'cheng_xiaoshi' ||

    character ===
      'lu_guang' ||

    character ===
      'qiao_ling'
  );
}


function resetRoundState(
  squad
) {

  squad.phase =
    'lobby';


  squad.selections =
    {};


  squad.ready =
    {};


  squad.roundRoster =
    [];


  squad.roundStatsRecorded =
    false;
}


// =====================================================
// PUBLIC USER
// =====================================================

async function userPublicData(
  username
) {

  const user =
    await User
      .findOne({
        username
      })
      .select(
        'username avatar'
      );


  if (
    !user
  ) {

    return null;
  }


  return {

    username:
      user.username,

    avatar:
      user.avatar ||
      ''
  };
}


// =====================================================
// SERIALIZE CHARACTER MAP
// =====================================================

function serializeCharacterStats(
  statsMap
) {

  const output =
    {};


  if (
    !statsMap
  ) {

    return output;
  }


  if (
    statsMap instanceof
      Map
  ) {

    for (
      const [
        character,
        stats
      ]
      of statsMap.entries()
    ) {

      output[
        character
      ] = {

        pvpMatches:
          Number(
            stats.pvpMatches
          ) ||
          0,

        pvpWins:
          Number(
            stats.pvpWins
          ) ||
          0,

        proficiencyPoints:
          Number(
            stats.proficiencyPoints
          ) ||
          0
      };
    }


    return output;
  }


  for (
    const [
      character,
      stats
    ]
    of Object.entries(
      statsMap
    )
  ) {

    output[
      character
    ] = {

      pvpMatches:
        Number(
          stats.pvpMatches
        ) ||
        0,

      pvpWins:
        Number(
          stats.pvpWins
        ) ||
        0,

      proficiencyPoints:
        Number(
          stats.proficiencyPoints
        ) ||
        0
    };
  }


  return output;
}


// =====================================================
// SQUAD PAYLOAD
// =====================================================

async function buildSquadPayload(
  squad
) {

  if (
    !squad
  ) {

    return null;
  }


  const members =
    (
      await Promise.all(

        squad.members.map(
          username =>
            userPublicData(
              username
            )
        )
      )
    )
      .filter(
        Boolean
      );


  return {

    hostUsername:
      squad.host,

    mode:
      squad.mode,

    phase:
      squad.phase,

    members,

    maxPlayers:
      maxPlayersForMode(
        squad.mode
      ),

    readyCount:
      squad.members.filter(
        username =>
          squad.ready[
            username
          ]
      ).length,

    memberCount:
      squad.members.length
  };
}


async function emitSquadState(
  squad
) {

  const payload =
    await buildSquadPayload(
      squad
    );


  if (
    payload
  ) {

    io
      .to(
        roomForSquad(
          squad
        )
      )
      .emit(
        'squad_updated',
        payload
      );
  }
}


// =====================================================
// RECORD COMPLETED PVP
// =====================================================

async function recordPvpMatch(
  squad,
  winner
) {

  if (
    squad.roundStatsRecorded
  ) {

    return;
  }


  if (
    squad.mode !==
      'pvp'
  ) {

    return;
  }


  const roster =
    Array.isArray(
      squad.roundRoster
    )

      ? squad.roundRoster

      : [];


  /*
    SOLO TESTS ARE NOT COUNTED.
  */

  if (
    roster.length <
      2
  ) {

    return;
  }


  /*
    Mark BEFORE asynchronous writes so
    duplicate finish calls cannot award twice.
  */

  squad.roundStatsRecorded =
    true;


  const matchId =
    crypto.randomUUID();


  const playedAt =
    new Date();


  const winnerUsername =
    winner.name;


  await Promise.all(

    roster.map(
      async participant => {

        const won =
          participant.username ===
          winnerUsername;


        const proficiencyAward =
          won
            ? 2
            : 1;


        const increments = {

          matchesPlayed:
            1,

          [`characterStats.${participant.character}.pvpMatches`]:
            1,

          [`characterStats.${participant.character}.proficiencyPoints`]:
            proficiencyAward
        };


        if (
          won
        ) {

          increments[
            `characterStats.${participant.character}.pvpWins`
          ] =
            1;
        }


        const historyEntry = {

          matchId,

          playedAt,

          character:
            participant.character,

          won,

          proficiencyAward,

          winnerUsername,

          rosterSize:
            roster.length,

          roster:
            roster.map(
              member => ({

                username:
                  member.username,

                character:
                  member.character
              })
            )
        };


        const result =
          await User.updateOne(

            {
              username:
                participant.username
            },

            {
              $inc:
                increments,

              $push: {

                pvpMatchHistory:
                  historyEntry
              }
            }
          );


        console.log(

          '[PVP STATS]',

          participant.username,

          participant.character,

          won
            ? '+2 proficiency WIN'
            : '+1 proficiency',

          'matched:',
          result.matchedCount,

          'modified:',
          result.modifiedCount
        );
      }
    )
  );


  console.log(
    `[PVP STATS] Saved match ${matchId}; winner: ${winnerUsername}; roster: ${roster.length}`
  );
}


// =====================================================
// FINISH ROUND
// =====================================================

async function finishPvpRound(
  squad,
  winner
) {

  const existing =
    activeSquads.get(
      squad.host
    );


  if (
    !existing ||
    existing !==
      squad
  ) {

    return;
  }


  /*
    CRITICAL:
    Save BEFORE clearing selections.
  */

  try {

    await recordPvpMatch(
      squad,
      winner
    );

  } catch (error) {

    console.error(
      '[PVP STATS] Failed to record match:',
      error
    );
  }


  squad.phase =
    'lobby';


  squad.selections =
    {};


  squad.ready =
    {};


  squad.roundRoster =
    [];


  squad.roundStatsRecorded =
    false;


  io
    .to(
      roomForSquad(
        squad
      )
    )
    .emit(
      'return_to_squad',
      {

        winnerName:
          winner.name
      }
    );


  await emitSquadState(
    squad
  );
}


// =====================================================
// COMBAT
// =====================================================

const combatManager =
  new CombatManager({

    io,

    gameManager,

    onlineUsers,

    getSquadForUser,

    roomForSquad,

    onRoundEnd:
      finishPvpRound
  });


// =====================================================
// LEAVE SQUAD
// =====================================================

async function leaveCurrentSquad(
  username,
  {
    disconnecting = false
  } = {}
) {

  const squad =
    getSquadForUser(
      username
    );


  if (
    !squad
  ) {

    return;
  }


  const socketId =
    onlineUsers.get(
      username
    );


  const oldRoom =
    roomForSquad(
      squad
    );


  if (
    squad.host ===
      username
  ) {

    const remainingMembers =
      squad.members.filter(
        member =>
          member !==
          username
      );


    activeSquads.delete(
      squad.host
    );


    userSquadHosts.delete(
      username
    );


    for (
      const member
      of remainingMembers
    ) {

      makeSoloSquad(
        member,
        squad.mode
      );


      const memberSocketId =
        onlineUsers.get(
          member
        );


      if (
        memberSocketId
      ) {

        const memberSocket =
          io
            .sockets
            .sockets
            .get(
              memberSocketId
            );


        if (
          memberSocket
        ) {

          memberSocket.leave(
            oldRoom
          );


          memberSocket.join(
            `squad_${member}`
          );


          memberSocket.emit(
            'squad_disbanded',
            {

              message:
                'The squad host returned to the lobby.'
            }
          );
        }
      }
    }


    return;
  }


  squad.members =
    squad.members.filter(
      member =>
        member !==
        username
    );


  delete squad.selections[
    username
  ];


  delete squad.ready[
    username
  ];


  userSquadHosts.delete(
    username
  );


  if (
    !disconnecting
  ) {

    makeSoloSquad(
      username,
      squad.mode
    );
  }


  if (
    socketId
  ) {

    const userSocket =
      io
        .sockets
        .sockets
        .get(
          socketId
        );


    if (
      userSocket
    ) {

      userSocket.leave(
        oldRoom
      );


      if (
        !disconnecting
      ) {

        userSocket.join(
          `squad_${username}`
        );
      }
    }
  }


  await emitSquadState(
    squad
  );


  if (
    squad.phase ===
      'character'
  ) {

    if (
      squad.mode ===
        'pvp'
    ) {

      io
        .to(
          roomForSquad(
            squad
          )
        )
        .emit(
          'pvp_ready_state',
          {

            readyCount:
              squad.members.filter(
                member =>
                  squad.ready[
                    member
                  ]
              ).length,

            memberCount:
              squad.members.length
          }
        );


      const everyoneReady =

        squad.members.length >
          0 &&

        squad.members.every(
          member =>

            squad.ready[
              member
            ] &&

            squad.selections[
              member
            ]
        );


      if (
        everyoneReady
      ) {

        startArenaForSquad(
          squad
        );
      }

    } else {

      io
        .to(
          roomForSquad(
            squad
          )
        )
        .emit(
          'match_character_state',
          {

            selections: {
              ...squad.selections
            },

            ready: {
              ...squad.ready
            }
          }
        );
    }
  }
}


// =====================================================
// SPAWNS
// =====================================================

function getSpawnLayout(
  count
) {

  const edge =
    20;


  if (
    count <=
      1
  ) {

    return [
      {
        x:
          0,

        z:
          -edge,

        rotation:
          0
      }
    ];
  }


  if (
    count ===
      2
  ) {

    return [

      {
        x:
          0,

        z:
          -edge,

        rotation:
          0
      },

      {
        x:
          0,

        z:
          edge,

        rotation:
          Math.PI
      }
    ];
  }


  if (
    count ===
      3
  ) {

    return [

      {
        x:
          0,

        z:
          -edge,

        rotation:
          0
      },

      {
        x:
          edge,

        z:
          0,

        rotation:
          -Math.PI /
          2
      },

      {
        x:
          0,

        z:
          edge,

        rotation:
          Math.PI
      }
    ];
  }


  return [

    {
      x:
        0,

      z:
        -edge,

      rotation:
        0
    },

    {
      x:
        edge,

      z:
        0,

      rotation:
        -Math.PI /
        2
    },

    {
      x:
        0,

      z:
        edge,

      rotation:
        Math.PI
    },

    {
      x:
        -edge,

      z:
        0,

      rotation:
        Math.PI /
        2
    }
  ];
}


// =====================================================
// START ARENA
// =====================================================

function startArenaForSquad(
  squad
) {

  const participants =
    squad.members
      .map(
        username => ({

          username,

          socketId:
            onlineUsers.get(
              username
            )
        })
      )
      .filter(
        participant =>
          Boolean(
            participant.socketId
          )
      );


  const spawns =
    getSpawnLayout(
      participants.length
    );


  participants.forEach(
    (
      participant,
      index
    ) => {

      const character =
        squad.selections[
          participant.username
        ] ||
        'cheng_xiaoshi';


      gameManager
        .setPlayerCharacter(

          participant.socketId,

          character
        );


      const spawn =
        spawns[
          index
        ];


      gameManager
        .setPlayerSpawn(

          participant.socketId,

          spawn.x,

          spawn.z,

          spawn.rotation
        );
    }
  );


  /*
    CRITICAL PROFICIENCY SNAPSHOT.

    We save this BEFORE selections are
    ever reset and use only players who
    actually made it into the arena.
  */

  if (
    squad.mode ===
      'pvp'
  ) {

    squad.roundRoster =
      participants.map(
        participant => ({

          username:
            participant.username,

          character:
            squad.selections[
              participant.username
            ] ||
            'cheng_xiaoshi'
        })
      );


    squad.roundStatsRecorded =
      false;

  } else {

    squad.roundRoster =
      [];


    squad.roundStatsRecorded =
      false;
  }


  /*
    Set phase BEFORE combat initialization.

    This avoids any code observing a
    half-started character-selection state.
  */

  squad.phase =
    'arena';


  combatManager
    .startForSquad(
      squad
    );


  const players =
    participants
      .map(
        participant => {

          const player =
            gameManager
              .getPlayer(
                participant.socketId
              );


          return player

            ? combatManager
                .publicPlayer(
                  player
                )

            : null;
        }
      )
      .filter(
        Boolean
      );


  io
    .to(
      roomForSquad(
        squad
      )
    )
    .emit(
      'arena_started',
      {

        mode:
          squad.mode,

        players
      }
    );
}


// =====================================================
// REGISTER
// =====================================================

app.post(
  '/api/register',
  async (
    req,
    res
  ) => {

    const {
      username,
      password
    } =
      req.body;


    try {

      if (
        !username ||
        !password
      ) {

        return res
          .status(
            400
          )
          .json({

            message:
              'Username and password required'
          });
      }


      if (
        username.length <
          3
      ) {

        return res
          .status(
            400
          )
          .json({

            message:
              'Username must be at least 3 characters'
          });
      }


      if (
        password.length <
          6
      ) {

        return res
          .status(
            400
          )
          .json({

            message:
              'Password must be at least 6 characters'
          });
      }


      const userExists =
        await User.findOne({
          username
        });


      if (
        userExists
      ) {

        return res
          .status(
            400
          )
          .json({

            message:
              'Username already taken'
          });
      }


      const user =
        new User({

          username,

          password
        });


      await user.save();


      const token =
        jwt.sign(

          {

            id:
              user._id,

            username:
              user.username
          },

          process.env.JWT_SECRET ||
          'fallback_secret'
        );


      return res.json({

        token,

        username:
          user.username,

        avatar:
          user.avatar ||
          ''
      });

    } catch (error) {

      return res
        .status(
          500
        )
        .json({

          message:
            error.message ||
            'Server error during registration'
        });
    }
  }
);


// =====================================================
// LOGIN
// =====================================================

app.post(
  '/api/login',
  async (
    req,
    res
  ) => {

    const {
      username,
      password
    } =
      req.body;


    try {

      if (
        !username ||
        !password
      ) {

        return res
          .status(
            400
          )
          .json({

            message:
              'Username and password required'
          });
      }


      const user =
        await User.findOne({
          username
        });


      if (
        !user ||
        !(
          await user.matchPassword(
            password
          )
        )
      ) {

        return res
          .status(
            400
          )
          .json({

            message:
              'Invalid credentials'
          });
      }


      const token =
        jwt.sign(

          {

            id:
              user._id,

            username:
              user.username
          },

          process.env.JWT_SECRET ||
          'fallback_secret'
        );


      return res.json({

        token,

        username:
          user.username,

        avatar:
          user.avatar ||
          ''
      });

    } catch (error) {

      return res
        .status(
          500
        )
        .json({

          message:
            'Server error during login'
        });
    }
  }
);


// =====================================================
// SOCKET.IO
// =====================================================

io.on(
  'connection',
  socket => {

    let authenticatedUser =
      null;


    combatManager.registerSocket(

      socket,

      () =>
        authenticatedUser
    );


    // =================================================
    // PLAYER LOGIN
    // =================================================

    socket.on(
      'player_login',
      async data => {

        if (
          !data ||
          !data.name
        ) {

          return;
        }


        authenticatedUser =
          data.name;


        onlineUsers.set(
          authenticatedUser,
          socket.id
        );


        let squad =
          getSquadForUser(
            authenticatedUser
          );


        if (
          !squad
        ) {

          squad =
            makeSoloSquad(
              authenticatedUser,
              'match'
            );
        }


        socket.join(
          roomForSquad(
            squad
          )
        );


        const user =
          await User
            .findOne({

              username:
                authenticatedUser
            })
            .select(
              'avatar'
            );


        gameManager
          .addPlayer(

            socket.id,

            authenticatedUser,

            user
              ? user.avatar
              : ''
          );
      }
    );


    // =================================================
    // ENTER MODE
    // =================================================

    socket.on(
      'enter_mode',
      async ({
        mode
      }) => {

        if (
          !authenticatedUser ||
          ![
            'match',
            'pvp'
          ].includes(
            mode
          )
        ) {

          return;
        }


        const currentSquad =
          getSquadForUser(
            authenticatedUser
          );


        if (
          currentSquad &&
          currentSquad.host !==
            authenticatedUser
        ) {

          socket.emit(
            'squad_error',
            {

              message:
                'Leave your current squad before opening another mode.'
            }
          );


          return;
        }


        if (
          currentSquad &&
          currentSquad.members.length >
            1
        ) {

          await leaveCurrentSquad(
            authenticatedUser
          );
        }


        let squad =
          getSquadForUser(
            authenticatedUser
          );


        if (
          !squad
        ) {

          squad =
            makeSoloSquad(
              authenticatedUser,
              mode
            );
        }


        squad.mode =
          mode;


        squad.members = [
          authenticatedUser
        ];


        resetRoundState(
          squad
        );


        socket.join(
          roomForSquad(
            squad
          )
        );


        await emitSquadState(
          squad
        );
      }
    );


    // =================================================
    // REQUEST SQUAD
    // =================================================

    socket.on(
      'request_squad_state',
      async () => {

        if (
          !authenticatedUser
        ) {

          return;
        }


        const squad =
          getSquadForUser(
            authenticatedUser
          );


        const payload =
          await buildSquadPayload(
            squad
          );


        if (
          payload
        ) {

          socket.emit(
            'squad_updated',
            payload
          );
        }
      }
    );


    // =================================================
    // INVITE
    // =================================================

    socket.on(
      'send_squad_invite',
      async ({
        targetUsername
      }) => {

        if (
          !authenticatedUser
        ) {

          return;
        }


        const squad =
          getSquadForUser(
            authenticatedUser
          );


        if (
          !squad ||
          squad.phase !==
            'lobby'
        ) {

          return;
        }


        if (
          squad.members.length >=
          maxPlayersForMode(
            squad.mode
          )
        ) {

          socket.emit(
            'squad_error',
            {

              message:
                'Your squad is full.'
            }
          );


          return;
        }


        if (
          squad.members.includes(
            targetUsername
          )
        ) {

          return;
        }


        const recipientSocketId =
          onlineUsers.get(
            targetUsername
          );


        if (
          !recipientSocketId
        ) {

          socket.emit(
            'squad_error',
            {

              message:
                'That friend is offline.'
            }
          );


          return;
        }


        const sender =
          await userPublicData(
            authenticatedUser
          );


        io
          .to(
            recipientSocketId
          )
          .emit(
            'squad_invite_received',
            {

              hostUsername:
                squad.host,

              inviterUsername:
                authenticatedUser,

              inviterAvatar:
                sender
                  ? sender.avatar
                  : '',

              mode:
                squad.mode
            }
          );
      }
    );


    // =================================================
    // ACCEPT INVITE
    // =================================================

    socket.on(
      'accept_squad_invite',
      async ({
        hostUsername
      }) => {

        if (
          !authenticatedUser ||
          authenticatedUser ===
            hostUsername
        ) {

          return;
        }


        const targetSquad =
          activeSquads.get(
            hostUsername
          );


        if (
          !targetSquad ||
          targetSquad.phase !==
            'lobby'
        ) {

          socket.emit(
            'squad_error',
            {

              message:
                'That squad is no longer available.'
            }
          );


          return;
        }


        if (
          targetSquad.members.length >=
          maxPlayersForMode(
            targetSquad.mode
          )
        ) {

          socket.emit(
            'squad_error',
            {

              message:
                'That squad is already full.'
            }
          );


          return;
        }


        const currentSquad =
          getSquadForUser(
            authenticatedUser
          );


        if (
          currentSquad &&
          currentSquad.host ===
            authenticatedUser &&
          currentSquad.members.length >
            1
        ) {

          socket.emit(
            'squad_error',
            {

              message:
                'Leave or disband your current squad first.'
            }
          );


          return;
        }


        if (
          currentSquad
        ) {

          socket.leave(
            roomForSquad(
              currentSquad
            )
          );


          if (
            currentSquad.host ===
              authenticatedUser &&
            currentSquad.members.length ===
              1
          ) {

            activeSquads.delete(
              authenticatedUser
            );

          } else {

            currentSquad.members =
              currentSquad.members.filter(
                member =>
                  member !==
                  authenticatedUser
              );


            delete currentSquad
              .selections[
                authenticatedUser
              ];


            delete currentSquad
              .ready[
                authenticatedUser
              ];


            await emitSquadState(
              currentSquad
            );
          }
        }


        targetSquad.members.push(
          authenticatedUser
        );


        userSquadHosts.set(
          authenticatedUser,
          targetSquad.host
        );


        socket.join(
          roomForSquad(
            targetSquad
          )
        );


        await emitSquadState(
          targetSquad
        );


        socket.emit(
          'joined_squad',
          {

            mode:
              targetSquad.mode
          }
        );
      }
    );


    // =================================================
    // LEAVE
    // =================================================

    socket.on(
      'leave_squad',
      async () => {

        if (
          !authenticatedUser
        ) {

          return;
        }


        await leaveCurrentSquad(
          authenticatedUser
        );


        socket.emit(
          'left_squad'
        );
      }
    );


    // =================================================
    // CHARACTER SELECT
    // =================================================

    socket.on(
      'start_character_select',
      () => {

        if (
          !authenticatedUser
        ) {

          return;
        }


        const squad =
          getSquadForUser(
            authenticatedUser
          );


        if (
          !squad ||
          squad.host !==
            authenticatedUser ||
          squad.phase !==
            'lobby'
        ) {

          return;
        }


        if (
          squad.mode ===
            'match' &&
          squad.members.length !==
            2
        ) {

          socket.emit(
            'squad_error',
            {

              message:
                'MATCH requires exactly 2 players.'
            }
          );


          return;
        }


        squad.phase =
          'character';


        squad.selections =
          {};


        squad.ready =
          {};


        io
          .to(
            roomForSquad(
              squad
            )
          )
          .emit(
            'character_select_started',
            {

              mode:
                squad.mode,

              memberCount:
                squad.members.length
            }
          );
      }
    );


    // =================================================
    // CHOOSE CHARACTER
    // =================================================

    socket.on(
      'select_character',
      character => {

        if (
          !authenticatedUser ||
          !validCharacter(
            character
          )
        ) {

          return;
        }


        const squad =
          getSquadForUser(
            authenticatedUser
          );


        if (
          !squad ||
          squad.phase !==
            'character' ||
          squad.ready[
            authenticatedUser
          ]
        ) {

          return;
        }


        if (
          squad.mode ===
            'match'
        ) {

          const teammate =
            squad.members.find(
              member =>
                member !==
                authenticatedUser
            );


          if (
            teammate &&
            squad.ready[
              teammate
            ] &&
            squad.selections[
              teammate
            ] ===
              character
          ) {

            socket.emit(
              'character_error',
              {

                message:
                  'Your teammate already locked that character.'
              }
            );


            return;
          }
        }


        squad.selections[
          authenticatedUser
        ] =
          character;


        gameManager
          .setPlayerCharacter(
            socket.id,
            character
          );


        if (
          squad.mode ===
            'match'
        ) {

          const publicSelections =
            {};


          for (
            const member
            of squad.members
          ) {

            publicSelections[
              member
            ] =
              squad.selections[
                member
              ] ||
              null;
          }


          io
            .to(
              roomForSquad(
                squad
              )
            )
            .emit(
              'match_character_state',
              {

                selections:
                  publicSelections,

                ready: {
                  ...squad.ready
                }
              }
            );

        } else {

          socket.emit(
            'pvp_own_selection',
            {

              character
            }
          );
        }
      }
    );


    // =================================================
    // LOCK / READY
    // =================================================

    socket.on(
      'ready_character',
      () => {

        if (
          !authenticatedUser
        ) {

          return;
        }


        const squad =
          getSquadForUser(
            authenticatedUser
          );


        if (
          !squad ||
          squad.phase !==
            'character'
        ) {

          return;
        }


        const chosen =
          squad.selections[
            authenticatedUser
          ];


        if (
          !chosen
        ) {

          socket.emit(
            'character_error',
            {

              message:
                'Choose a character first.'
            }
          );


          return;
        }


        if (
          squad.mode ===
            'match'
        ) {

          const teammate =
            squad.members.find(
              member =>
                member !==
                authenticatedUser
            );


          if (
            teammate &&
            squad.ready[
              teammate
            ] &&
            squad.selections[
              teammate
            ] ===
              chosen
          ) {

            socket.emit(
              'character_error',
              {

                message:
                  'Your teammate already locked that character.'
              }
            );


            return;
          }
        }


        squad.ready[
          authenticatedUser
        ] =
          true;


        if (
          squad.mode ===
            'match'
        ) {

          io
            .to(
              roomForSquad(
                squad
              )
            )
            .emit(
              'match_character_state',
              {

                selections: {
                  ...squad.selections
                },

                ready: {
                  ...squad.ready
                }
              }
            );

        } else {

          io
            .to(
              roomForSquad(
                squad
              )
            )
            .emit(
              'pvp_ready_state',
              {

                readyCount:
                  squad.members.filter(
                    member =>
                      squad.ready[
                        member
                      ]
                  ).length,

                memberCount:
                  squad.members.length
              }
            );
        }


        const everyoneReady =
          squad.members.every(
            member =>

              squad.ready[
                member
              ] &&

              squad.selections[
                member
              ]
          );


        if (
          everyoneReady
        ) {

          startArenaForSquad(
            squad
          );
        }
      }
    );


    // =================================================
    // MOVEMENT
    // =================================================

    socket.on(
      'player_move',
      data => {

        if (
          !authenticatedUser
        ) {

          return;
        }


        const squad =
          getSquadForUser(
            authenticatedUser
          );


        if (
          !squad ||
          squad.phase !==
            'arena'
        ) {

          return;
        }


        const updatedPlayer =
          combatManager
            .validateMovement(

              socket,

              authenticatedUser,

              data
            );


        if (
          updatedPlayer
        ) {

          socket
            .to(
              roomForSquad(
                squad
              )
            )
            .emit(
              'player_moved',

              combatManager
                .publicPlayer(
                  updatedPlayer
                )
            );
        }
      }
    );


    // =================================================
    // DISCONNECT
    // =================================================

    socket.on(
      'disconnect',
      async () => {

        if (
          !authenticatedUser
        ) {

          gameManager.removePlayer(
            socket.id
          );


          return;
        }


        const squad =
          getSquadForUser(
            authenticatedUser
          );


        const room =
          squad
            ? roomForSquad(
                squad
              )
            : null;


        onlineUsers.delete(
          authenticatedUser
        );


        await leaveCurrentSquad(

          authenticatedUser,

          {
            disconnecting:
              true
          }
        );


        userSquadHosts.delete(
          authenticatedUser
        );


        gameManager.removePlayer(
          socket.id
        );


        if (
          room
        ) {

          socket
            .to(
              room
            )
            .emit(
              'player_left',
              socket.id
            );
        }
      }
    );


    socket.on(
      'send_friend_request',
      data => {

        const targetSocketId =
          onlineUsers.get(
            data.to
          );


        if (
          targetSocketId
        ) {

          io
            .to(
              targetSocketId
            )
            .emit(
              'friend_request_received',
              {

                from:
                  data.from
              }
            );
        }
      }
    );
  }
);


// =====================================================
// PROFILE
// =====================================================

app.get(
  '/api/profile/:username',
  async (
    req,
    res
  ) => {

    try {

      const user =
        await User
          .findOne({

            username:
              req.params.username
          })
          .select(
            '-password'
          );


      if (
        !user
      ) {

        return res
          .status(
            404
          )
          .json({

            message:
              'User not found'
          });
      }


      const viewerUsername =
        req.query.viewer ||
        null;


      let isFriend =
        false;


      if (
        viewerUsername &&
        viewerUsername !==
          user.username
      ) {

        const viewer =
          await User
            .findOne({

              username:
                viewerUsername
            })
            .select(
              'friends'
            );


        if (
          viewer
        ) {

          isFriend =
            viewer.friends.some(
              friendId =>

                friendId.toString() ===
                user._id.toString()
            );
        }
      }


      res.json({

        username:
          user.username,

        avatar:
          user.avatar ||
          '',

        matchesPlayed:
          Number(
            user.matchesPlayed
          ) ||
          0,

        friendsCount:
          user.friends
            ? user.friends.length
            : 0,

        isOnline:
          onlineUsers.has(
            user.username
          ),

        isFriend,

        showcasedCharacters:
          user.showcasedCharacters ||
          [],

        /*
          THIS WAS MISSING FROM THE
          SERVER YOU UPLOADED.
        */
        characterStats:
          serializeCharacterStats(
            user.characterStats
          )
      });

    } catch (error) {

      console.error(
        'Profile error:',
        error
      );


      res
        .status(
          500
        )
        .json({

          message:
            'Server error fetching profile'
        });
    }
  }
);


// =====================================================
// AVATAR
// =====================================================

app.post(
  '/api/profile/avatar',
  async (
    req,
    res
  ) => {

    const {
      username,
      avatar
    } =
      req.body;


    try {

      const user =
        await User
          .findOneAndUpdate(

            {
              username
            },

            {
              avatar
            },

            {
              new:
                true
            }
          )
          .select(
            '-password'
          );


      if (
        !user
      ) {

        return res
          .status(
            404
          )
          .json({

            message:
              'User not found'
          });
      }


      res.json({

        success:
          true,

        avatar:
          user.avatar
      });

    } catch (error) {

      res
        .status(
          500
        )
        .json({

          message:
            'Failed to update avatar'
        });
    }
  }
);


// =====================================================
// CHARACTER SHOWCASE
// =====================================================

app.post(
  '/api/profile/showcase',
  async (
    req,
    res
  ) => {

    try {

      const {
        username,
        characters
      } =
        req.body;


      if (
        !username ||
        !Array.isArray(
          characters
        )
      ) {

        return res
          .status(
            400
          )
          .json({

            message:
              'Invalid showcase data'
          });
      }


      const unique =
        [
          ...new Set(
            characters
          )
        ];


      if (
        unique.length >
          3
      ) {

        return res
          .status(
            400
          )
          .json({

            message:
              'You can showcase at most 3 characters.'
          });
      }


      if (
        unique.some(
          character =>
            !validCharacter(
              character
            )
        )
      ) {

        return res
          .status(
            400
          )
          .json({

            message:
              'Invalid character'
          });
      }


      const user =
        await User
          .findOneAndUpdate(

            {
              username
            },

            {
              showcasedCharacters:
                unique
            },

            {
              new:
                true,

              runValidators:
                true
            }
          );


      if (
        !user
      ) {

        return res
          .status(
            404
          )
          .json({

            message:
              'User not found'
          });
      }


      res.json({

        success:
          true,

        showcasedCharacters:
          user.showcasedCharacters
      });

    } catch (error) {

      console.error(
        'Showcase error:',
        error
      );


      res
        .status(
          500
        )
        .json({

          message:
            'Failed to update showcase'
        });
    }
  }
);


// =====================================================
// FRIEND LIST
// =====================================================

app.get(
  '/api/friends/list',
  async (
    req,
    res
  ) => {

    const {
      username
    } =
      req.query;


    try {

      const user =
        await User
          .findOne({
            username
          })
          .populate(
            'friends',
            'username avatar'
          );


      if (
        !user
      ) {

        return res.json(
          []
        );
      }


      res.json(

        (
          user.friends ||
          []
        )
          .map(
            friend => ({

              username:
                friend.username,

              avatar:
                friend.avatar ||
                '',

              isOnline:
                onlineUsers.has(
                  friend.username
                )
            })
          )
      );

    } catch (error) {

      res
        .status(
          500
        )
        .json({

          message:
            'Failed to load friends list'
        });
    }
  }
);


// =====================================================
// EXACT FRIEND SEARCH
// =====================================================

app.get(
  '/api/friends/search',
  async (
    req,
    res
  ) => {

    const {
      query,
      username
    } =
      req.query;


    if (
      !query ||
      query.trim() ===
        ''
    ) {

      return res.json(
        []
      );
    }


    try {

      const searchedUsername =
        query.trim();


      const [
        searchingUser,
        targetUser
      ] =
        await Promise.all([

          User
            .findOne({
              username
            })
            .select(
              'friends'
            ),

          User
            .findOne({

              username:
                searchedUsername
            })
            .select(
              'username avatar'
            )
        ]);


      if (
        !targetUser ||
        targetUser.username ===
          username
      ) {

        return res.json(
          []
        );
      }


      if (
        searchingUser
      ) {

        const alreadyFriend =
          searchingUser
            .friends
            .some(
              friendId =>

                friendId.toString() ===
                targetUser._id.toString()
            );


        if (
          alreadyFriend
        ) {

          return res.json(
            []
          );
        }
      }


      res.json([

        {

          username:
            targetUser.username,

          avatar:
            targetUser.avatar ||
            ''
        }
      ]);

    } catch (error) {

      res
        .status(
          500
        )
        .json({

          message:
            'Failed to search users'
        });
    }
  }
);


// =====================================================
// FRIEND REQUEST
// =====================================================

app.post(
  '/api/friends/request',
  async (
    req,
    res
  ) => {

    const {
      from,
      to
    } =
      req.body;


    try {

      const targetUser =
        await User.findOne({

          username:
            to
        });


      const senderUser =
        await User.findOne({

          username:
            from
        });


      if (
        !targetUser ||
        !senderUser
      ) {

        return res
          .status(
            404
          )
          .json({

            message:
              'User not found'
          });
      }


      const alreadyFriends =
        senderUser.friends.some(
          id =>
            id.toString() ===
            targetUser._id.toString()
        );


      if (
        alreadyFriends
      ) {

        return res
          .status(
            400
          )
          .json({

            message:
              'You are already friends.'
          });
      }


      await User.updateOne(

        {
          username:
            to
        },

        {
          $addToSet: {

            friendRequests:
              senderUser._id
          }
        }
      );


      res.json({

        message:
          'Friend request sent!'
      });

    } catch (error) {

      res
        .status(
          500
        )
        .json({

          message:
            'Error sending friend request'
        });
    }
  }
);


// =====================================================
// REQUEST LIST
// =====================================================

app.get(
  '/api/friends/requests',
  async (
    req,
    res
  ) => {

    const {
      username
    } =
      req.query;


    try {

      const user =
        await User
          .findOne({
            username
          })
          .populate(
            'friendRequests',
            'username avatar'
          );


      if (
        !user
      ) {

        return res.json(
          []
        );
      }


      res.json(

        (
          user.friendRequests ||
          []
        )
          .map(
            request => ({

              username:
                request.username,

              avatar:
                request.avatar ||
                ''
            })
          )
      );

    } catch (error) {

      res
        .status(
          500
        )
        .json({

          message:
            'Failed to load requests'
        });
    }
  }
);


// =====================================================
// REQUEST RESPONSE
// =====================================================

app.post(
  '/api/friends/respond',
  async (
    req,
    res
  ) => {

    const {
      username,
      target,
      action
    } =
      req.body;


    try {

      const user =
        await User.findOne({
          username
        });


      const targetUser =
        await User.findOne({

          username:
            target
        });


      if (
        !user ||
        !targetUser
      ) {

        return res
          .status(
            404
          )
          .json({

            message:
              'User not found'
          });
      }


      await User.updateOne(

        {
          username
        },

        {
          $pull: {

            friendRequests:
              targetUser._id
          }
        }
      );


      if (
        action ===
          'accept'
      ) {

        await User.updateOne(

          {
            username
          },

          {
            $addToSet: {

              friends:
                targetUser._id
            }
          }
        );


        await User.updateOne(

          {
            username:
              target
          },

          {
            $addToSet: {

              friends:
                user._id
            }
          }
        );
      }


      res.json({

        success:
          true
      });

    } catch (error) {

      res
        .status(
          500
        )
        .json({

          message:
            'Error responding to friend request'
        });
    }
  }
);


// =====================================================
// SERVER
// =====================================================

const PORT =
  process.env.PORT ||
  3000;


http.listen(
  PORT,
  () => {

    console.log(
      `Server live at http://localhost:${PORT}`
    );
  }
);