const path =
  require('path');


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
    .createServer(app);


const io =
  require('socket.io')(
    http
  );


const gameManager =
  new GameManager();


// ============================================
// LIVE STATE
// ============================================

const onlineUsers =
  new Map();


/*
  host username
  ->
  squad object
*/
const activeSquads =
  new Map();


/*
  username
  ->
  host username
*/
const userSquadHosts =
  new Map();


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


// ============================================
// STATIC FILES
// ============================================

/*
  Serve the public folder.

  __dirname is the server folder,
  so ../public points to:

  project/public/
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
  Serve the separate assets folder.

  This makes:

  project/assets/lobby_background.jpg

  available in the browser as:

  /assets/lobby_background.jpg
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


// ============================================
// MONGODB
// ============================================

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


// ============================================
// SQUAD HELPERS
// ============================================

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
      {}
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


  if (!hostUsername) {

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

  return mode === 'pvp'
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
      'lu_guang'
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
}


// ============================================
// USER PUBLIC DATA
// ============================================

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


  if (!user) {

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


// ============================================
// BUILD SQUAD PAYLOAD
// ============================================

async function buildSquadPayload(
  squad
) {

  if (!squad) {

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
      .filter(Boolean);


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


// ============================================
// BROADCAST SQUAD STATE
// ============================================

async function emitSquadState(
  squad
) {

  const payload =
    await buildSquadPayload(
      squad
    );


  if (payload) {

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

async function finishPvpRound(
  squad,
  winner
) {

  /*
    Make sure this squad still exists.
  */
  const existing =
    activeSquads.get(
      squad.host
    );


  if (
    !existing ||
    existing !== squad
  ) {

    return;
  }


  squad.phase =
    'lobby';


  squad.selections =
    {};


  squad.ready =
    {};


  /*
    Force all surviving/dead/spectating
    players back into squad lobby.
  */
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


// ============================================
// LEAVE SQUAD
// ============================================

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


  if (!squad) {

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


  /*
    HOST LEAVES:
    disband entire squad.
  */
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

      userSquadHosts.set(
        member,
        member
      );


      makeSoloSquad(
        member,
        squad.mode
      );


      const memberSocketId =
        onlineUsers.get(
          member
        );


      if (memberSocketId) {

        const memberSocket =
          io.sockets.sockets.get(
            memberSocketId
          );


        if (memberSocket) {

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


  /*
    NON-HOST LEAVES:
    remove only that player.
  */

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


  if (!disconnecting) {

    makeSoloSquad(
      username,
      squad.mode
    );
  }


  if (socketId) {

    const userSocket =
      io.sockets.sockets.get(
        socketId
      );


    if (userSocket) {

      userSocket.leave(
        oldRoom
      );


      if (!disconnecting) {

        userSocket.join(
          `squad_${username}`
        );
      }
    }
  }


  await emitSquadState(
    squad
  );


  /*
    If somebody leaves while
    players are choosing characters,
    update the remaining players.
  */

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
        squad.members.length > 0 &&

        squad.members.every(
          member =>

            squad.ready[
              member
            ] &&

            squad.selections[
              member
            ]
        );


      if (everyoneReady) {

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


// ============================================
// SPAWN POSITIONS
// ============================================

function getSpawnLayout(
  count
) {

  const edge =
    20;


  /*
    1 PLAYER:
    north edge
  */
  if (count <= 1) {

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


  /*
    2 PLAYERS:
    opposite edges
  */
  if (count === 2) {

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


  /*
    3 PLAYERS:
    three separate edges
  */
  if (count === 3) {

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
          -Math.PI / 2
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


  /*
    4 PLAYERS:
    all four edges
  */
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
        -Math.PI / 2
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
        Math.PI / 2
    }
  ];
}


// ============================================
// START ARENA
// ============================================

function startArenaForSquad(
  squad
) {

  const socketIds =
    squad.members
      .map(
        username =>
          onlineUsers.get(
            username
          )
      )
      .filter(Boolean);


  const spawns =
    getSpawnLayout(
      socketIds.length
    );


  socketIds.forEach(
    (
      socketId,
      index
    ) => {

      const username =
        squad.members[
          index
        ];


      const character =
        squad.selections[
          username
        ] ||
        'cheng_xiaoshi';


      gameManager
        .setPlayerCharacter(
          socketId,
          character
        );


      const spawn =
        spawns[
          index
        ];


      gameManager
        .setPlayerSpawn(

          socketId,

          spawn.x,

          spawn.z,

          spawn.rotation
        );
    }
  );


  /*
    Initialize HP, cooldowns,
    stun states, buffs, regen, etc.
  */
  combatManager
    .startForSquad(
      squad
    );


  const players =
    socketIds
      .map(
        id => {

          const player =
            gameManager
              .getPlayer(id);


          return player
            ? combatManager
                .publicPlayer(
                  player
                )
            : null;
        }
      )
      .filter(Boolean);


  squad.phase =
    'arena';


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


// ============================================
// REGISTER
// ============================================

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
          .status(400)
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
          .status(400)
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
          .status(400)
          .json({
            message:
              'Password must be at least 6 characters'
          });
      }


      const userExists =
        await User.findOne({
          username
        });


      if (userExists) {

        return res
          .status(400)
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
        .status(500)
        .json({
          message:
            error.message ||
            'Server error during registration'
        });
    }
  }
);


// ============================================
// LOGIN
// ============================================

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
          .status(400)
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
          .status(400)
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
        .status(500)
        .json({
          message:
            'Server error during login'
        });
    }
  }
);


// ============================================
// SOCKET.IO
// ============================================

io.on(
  'connection',
  socket => {

    let authenticatedUser = null;
    
    combatManager.registerSocket(
      socket,
      () => authenticatedUser
    );

    // ========================================
    // PLAYER LOGIN
    // ========================================

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


        if (!squad) {

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


    // ========================================
    // ENTER MODE
    // ========================================

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
          ].includes(mode)
        ) {

          return;
        }


        const currentSquad =
          getSquadForUser(
            authenticatedUser
          );


        /*
          Guests cannot silently
          change somebody else's squad mode.
        */
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


        /*
          If host currently owns a real squad,
          opening a different mode disbands it.
        */
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


        if (!squad) {

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


    // ========================================
    // REQUEST SQUAD STATE
    // ========================================

    socket.on(
      'request_squad_state',
      async () => {

        if (!authenticatedUser) {

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


        if (payload) {

          socket.emit(
            'squad_updated',
            payload
          );
        }
      }
    );


    // ========================================
    // SEND SQUAD INVITE
    // ========================================

    socket.on(
      'send_squad_invite',
      async ({
        targetUsername
      }) => {

        if (!authenticatedUser) {

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


        if (!recipientSocketId) {

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


    // ========================================
    // ACCEPT INVITE
    // ========================================

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


        /*
          Don't let a host abandon
          their own populated squad
          by accepting another invite.
        */
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


        if (currentSquad) {

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


    // ========================================
    // LEAVE SQUAD
    // ========================================

    socket.on(
      'leave_squad',
      async () => {

        if (!authenticatedUser) {

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


    // ========================================
    // START CHARACTER SELECT
    // ========================================

    socket.on(
      'start_character_select',
      async () => {

        if (!authenticatedUser) {

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


        /*
          MATCH specifically requires
          exactly 2 players.
        */
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


        /*
          PVP has NO minimum beyond host.
          1, 2, 3, or 4 all work.
        */

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


    // ========================================
    // SELECT CHARACTER
    // ========================================

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


        /*
          MATCH:
          locked character cannot
          be taken by teammate.
        */
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


        /*
          PVP:
          duplicates ARE allowed.
        */

        squad.selections[
          authenticatedUser
        ] =
          character;


        gameManager
          .setPlayerCharacter(
            socket.id,
            character
          );


        /*
          MATCH reveals selection
          because exclusivity requires it.
        */
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

          /*
            PVP selection goes ONLY
            back to the player who chose it.
          */

          socket.emit(
            'pvp_own_selection',
            {
              character
            }
          );
        }
      }
    );


    // ========================================
    // READY CHARACTER
    // ========================================

    socket.on(
      'ready_character',
      () => {

        if (!authenticatedUser) {

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


        if (!chosen) {

          socket.emit(
            'character_error',
            {
              message:
                'Choose a character first.'
            }
          );


          return;
        }


        /*
          MATCH race-condition check:
          prevents two players
          locking same character.
        */
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


        /*
          MATCH STATE
        */
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

          /*
            PVP only exposes ready count.
            Character choices stay private.
          */

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


        /*
          Start automatically when
          EVERY CURRENT MEMBER is ready.
        */

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


        if (everyoneReady) {

          startArenaForSquad(
            squad
          );
        }
      }
    );


    // ========================================
    // PLAYER MOVEMENT
    // ========================================

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
    
    
        /*
          Server verifies:
    
          - alive
          - not stunned
          - legitimate movement speed
          - speed buffs
          - arena boundaries
        */
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


    // ========================================
    // DISCONNECT
    // ========================================

    socket.on(
      'disconnect',
      async () => {

        if (!authenticatedUser) {

          gameManager
            .removePlayer(
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


        gameManager
          .removePlayer(
            socket.id
          );


        if (room) {

          socket
            .to(room)
            .emit(
              'player_left',
              socket.id
            );
        }
      }
    );


    // ========================================
    // REAL-TIME FRIEND REQUEST
    // ========================================

    socket.on(
      'send_friend_request',
      data => {

        const targetSocketId =
          onlineUsers.get(
            data.to
          );


        if (targetSocketId) {

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


// ============================================
// PROFILE ENDPOINT
// ============================================

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


      if (!user) {

        return res
          .status(404)
          .json({
            message:
              'User not found'
          });
      }


      res.json({

        username:
          user.username,

        avatar:
          user.avatar ||
          '',

        matchesPlayed:
          user.matchesPlayed ||
          0,

        friendsCount:
          user.friends
            ? user.friends.length
            : 0,

        isOnline:
          onlineUsers.has(
            user.username
          )
      });

    } catch (error) {

      res
        .status(500)
        .json({
          message:
            'Server error fetching profile'
        });
    }
  }
);


// ============================================
// AVATAR ENDPOINT
// ============================================

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


      if (!user) {

        return res
          .status(404)
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
        .status(500)
        .json({
          message:
            'Failed to update avatar'
        });
    }
  }
);


// ============================================
// FRIEND LIST
// ============================================

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


      if (!user) {

        return res.json([]);
      }


      const list =
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
          );


      res.json(
        list
      );

    } catch (error) {

      res
        .status(500)
        .json({
          message:
            'Failed to load friends list'
        });
    }
  }
);


// ============================================
// EXACT FRIEND SEARCH
// ============================================

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
      query.trim() === ''
    ) {

      return res.json([]);
    }


    try {

      const searchedUsername =
        query.trim();


      const user =
        await User
          .findOne({
            username:
              searchedUsername
          })
          .select(
            'username avatar'
          );


      if (
        !user ||
        user.username ===
          username
      ) {

        return res.json([]);
      }


      res.json([
        {

          username:
            user.username,

          avatar:
            user.avatar ||
            ''
        }
      ]);

    } catch (error) {

      res
        .status(500)
        .json({
          message:
            'Failed to search users'
        });
    }
  }
);


// ============================================
// FRIEND REQUEST
// ============================================

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
          .status(404)
          .json({
            message:
              'User not found'
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
        .status(500)
        .json({
          message:
            'Error sending friend request'
        });
    }
  }
);


// ============================================
// FRIEND REQUEST LIST
// ============================================

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


      if (!user) {

        return res.json([]);
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
        .status(500)
        .json({
          message:
            'Failed to load requests'
        });
    }
  }
);


// ============================================
// FRIEND REQUEST RESPONSE
// ============================================

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
          .status(404)
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
        .status(500)
        .json({
          message:
            'Error responding to friend request'
        });
    }
  }
);


// ============================================
// SERVER START
// ============================================

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