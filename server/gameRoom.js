class GameManager {

  constructor() {

    this.players = {};
  }


  addPlayer(
    id,
    name,
    avatar = ''
  ) {

    this.players[id] = {

      id,

      name:
        name ||
        'Agent',

      avatar:
        avatar ||
        '',

      character:
        null,

      x:
        0,

      z:
        0,

      rotation:
        0,

      pitch:
        0,

      combat:
        null
    };


    return this.players[id];
  }


  getPlayer(id) {

    return (
      this.players[id] ||
      null
    );
  }


  removePlayer(id) {

    delete this.players[id];
  }


  updatePlayerPosition(
    id,
    data
  ) {

    const player =
      this.players[id];


    if (!player) {

      return null;
    }


    if (
      Number.isFinite(
        Number(data.x)
      )
    ) {

      player.x =
        Number(data.x);
    }


    if (
      Number.isFinite(
        Number(data.z)
      )
    ) {

      player.z =
        Number(data.z);
    }


    if (
      Number.isFinite(
        Number(
          data.rotation
        )
      )
    ) {

      player.rotation =
        Number(
          data.rotation
        );
    }


    if (
      Number.isFinite(
        Number(
          data.pitch
        )
      )
    ) {

      player.pitch =
        Number(
          data.pitch
        );
    }


    return player;
  }


  setPlayerCharacter(
    id,
    character
  ) {

    if (
      this.players[id]
    ) {

      this.players[id]
        .character =
          character;
    }
  }


  setPlayerSpawn(
    id,
    x,
    z,
    rotation = 0
  ) {

    if (
      !this.players[id]
    ) {

      return;
    }


    this.players[id].x =
      x;


    this.players[id].z =
      z;


    this.players[id]
      .rotation =
        rotation;


    this.players[id]
      .pitch =
        0;
  }


  initializeCombat(id) {

    const player =
      this.players[id];


    if (!player) {

      return null;
    }


    const now =
      Date.now();


    /*
      Cheng is 850 HP.

      Other unfinished characters also get
      a temporary 850-HP hittable shell so
      PvP testing does not break.
    */
    const maxHp =
      850;


    player.combat = {

      maxHp,

      hp:
        maxHp,

      alive:
        true,

      lastDamageAt:
        0,

      nextRegenAt:
        now +
        10000,

      stunnedUntil:
        0,

      speedBuffUntil:
        0,

      strengthenUntil:
        0,

      basicReadyAt:
        0,

      controlReadyAt:
        0,

      strengthenReadyAt:
        0,

      lastMoveAt:
        now,

      lastMoveX:
        player.x,

      lastMoveZ:
        player.z
    };


    return player.combat;
  }
}


module.exports =
  GameManager;
