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
        0
    };


    return this.players[id];
  }


  getPlayer(id) {

    return this.players[id] ||
      null;
  }


  removePlayer(id) {

    delete this.players[id];
  }


  updatePlayerPosition(
    id,
    data
  ) {

    if (!this.players[id]) {

      return null;
    }


    this.players[id].x =
      Number(data.x) ||
      0;


    this.players[id].z =
      Number(data.z) ||
      0;


    this.players[id].rotation =
      Number(data.rotation) ||
      0;


    return this.players[id];
  }


  setPlayerCharacter(
    id,
    character
  ) {

    if (this.players[id]) {

      this.players[id].character =
        character;
    }
  }


  setPlayerSpawn(
    id,
    x,
    z,
    rotation = 0
  ) {

    if (!this.players[id]) {
      return;
    }


    this.players[id].x =
      x;


    this.players[id].z =
      z;


    this.players[id].rotation =
      rotation;
  }
}


module.exports =
  GameManager;
