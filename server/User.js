const mongoose =
  require('mongoose');


const bcrypt =
  require('bcryptjs');


// =====================================================
// PER-CHARACTER STATS
// =====================================================

const CharacterStatsSchema =
  new mongoose.Schema(
    {

      /*
        Actual counted PvP rounds played
        with this character.

        A win is STILL only one actual
        match here.
      */
      pvpMatches: {
        type: Number,
        default: 0
      },


      /*
        Actual wins with this character.
      */
      pvpWins: {
        type: Number,
        default: 0
      },


      /*
        Used for proficiency rank.

        Loss = +1
        Win  = +2
      */
      proficiencyPoints: {
        type: Number,
        default: 0
      }

    },
    {
      _id: false
    }
  );


// =====================================================
// PVP HISTORY ROSTER MEMBER
// =====================================================

const PvPRosterMemberSchema =
  new mongoose.Schema(
    {

      username: {
        type: String,
        required: true
      },


      character: {
        type: String,
        required: true
      }

    },
    {
      _id: false
    }
  );


// =====================================================
// ONE SAVED PVP MATCH
// =====================================================

const PvPMatchHistorySchema =
  new mongoose.Schema(
    {

      matchId: {
        type: String,
        required: true
      },


      playedAt: {
        type: Date,
        default: Date.now
      },


      /*
        Character THIS USER played.
      */
      character: {
        type: String,
        required: true
      },


      won: {
        type: Boolean,
        default: false
      },


      /*
        1 for loss
        2 for win
      */
      proficiencyAward: {
        type: Number,
        required: true
      },


      winnerUsername: {
        type: String,
        required: true
      },


      rosterSize: {
        type: Number,
        required: true
      },


      /*
        Snapshot of everyone in this round
        and the character each person used.
      */
      roster: {
        type: [
          PvPRosterMemberSchema
        ],
        default: []
      }

    },
    {
      _id: false
    }
  );


// =====================================================
// USER
// =====================================================

const UserSchema =
  new mongoose.Schema({

    username: {

      type: String,

      required: true,

      unique: true,

      trim: true,

      minlength: 3
    },


    password: {

      type: String,

      required: true,

      minlength: 6
    },


    avatar: {

      type: String,

      default: ''
    },


    friends: [

      {

        type:
          mongoose
            .Schema
            .Types
            .ObjectId,

        ref:
          'User'
      }
    ],


    friendRequests: [

      {

        type:
          mongoose
            .Schema
            .Types
            .ObjectId,

        ref:
          'User'
      }
    ],

    showcasedCharacters: {
      type: [String],
    
      default: [],
    
      validate: {
        validator(value) {
          return (
            Array.isArray(value) &&
            value.length <= 3
          );
        },
    
        message:
          'You can showcase at most 3 characters.'
      }
    },


    // ===================================================
    // OVERALL MATCH COUNT
    // ===================================================

    /*
      Counts real multiplayer PvP matches.

      Solo arena testing does NOT increment this.
    */
    matchesPlayed: {

      type: Number,

      default: 0
    },


    // ===================================================
    // CHARACTER PROFICIENCY
    // ===================================================

    /*
      Map lets you add future characters without
      having to redesign the database schema.

      Example:

      characterStats.get('cheng_xiaoshi')

      characterStats.get('lu_guang')

      Later:
      characterStats.get('qiao_ling')
    */

    characterStats: {

      type: Map,

      of:
        CharacterStatsSchema,

      default:
        {}
    },


    // ===================================================
    // PVP MATCH HISTORY
    // ===================================================

    pvpMatchHistory: {

      type: [
        PvPMatchHistorySchema
      ],

      default:
        []
    }
  });


// =====================================================
// HASH PASSWORD
// =====================================================

UserSchema.pre(
  'save',
  async function () {

    if (
      !this.isModified(
        'password'
      )
    ) {

      return;
    }


    const salt =
      await bcrypt.genSalt(
        10
      );


    this.password =
      await bcrypt.hash(

        this.password,

        salt
      );
  }
);


// =====================================================
// CHECK PASSWORD
// =====================================================

UserSchema.methods
  .matchPassword =
  async function (
    enteredPassword
  ) {

    return await bcrypt.compare(

      enteredPassword,

      this.password
    );
  };


module.exports =
  mongoose.model(
    'User',
    UserSchema
  );