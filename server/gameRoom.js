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


  initializeCombat(
    id,
    maxHp
  ) {
  
    const player =
      this.players[id];
  
  
    if (!player) {
  
      return null;
    }
  
  
    const now =
      Date.now();
  
  
    player.combat = {
  
      maxHp,
  
      hp:
        maxHp,
  
      alive:
        true,
  
  
      // -----------------------------
      // DAMAGE / REGEN
      // -----------------------------
  
      lastDamageAt:
        0,
  
      nextRegenAt:
        now +
        10000,
  
  
      // -----------------------------
      // STATUS
      // -----------------------------
  
      stunnedUntil:
        0,
  
  
      // -----------------------------
      // CHENG SPEED BUFF
      // -----------------------------
  
      speedBuffUntil:
        0,
  
  
      // -----------------------------
      // ULT
      // -----------------------------
  
      strengthenUntil:
        0,
  
  
      // -----------------------------
      // COOLDOWNS
      // -----------------------------
  
      basicReadyAt:
        0,
  
      controlReadyAt:
        0,
  
      strengthenReadyAt:
        0,
  
  
      // -----------------------------
      // LU GUANG SHIELD
      // -----------------------------
  
      shieldHp:
        0,
  
      shieldMaxHp:
        0,
  
      shieldUntil:
        0,
  
  
      // -----------------------------
      // MOVEMENT VALIDATION
      // -----------------------------
  
      lastMoveAt:
        now
    };
  
  
    return player.combat;
  }
}


module.exports =
  GameManager;
