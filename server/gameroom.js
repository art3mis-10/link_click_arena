class GameManager {
    constructor() {
      this.players = {};
    }
  
    addPlayer(id, name) {
      this.players[id] = {
        id,
        name: name || 'Agent',
        character: 'cheng_xiaoshi',
        x: (Math.random() - 0.5) * 10,
        z: (Math.random() - 0.5) * 10,
        rotation: 0
      };
      return this.players[id];
    }
  
    removePlayer(id) {
      delete this.players[id];
    }
  
    updatePlayerPosition(id, data) {
      if (this.players[id]) {
        this.players[id].x = data.x;
        this.players[id].z = data.z;
        this.players[id].rotation = data.rotation;
        return this.players[id];
      }
      return null;
    }
  
    setPlayerCharacter(id, character) {
      if (this.players[id]) {
        this.players[id].character = character;
      }
    }
  }
  
  module.exports = GameManager;