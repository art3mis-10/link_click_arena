const mongoose =
  require('mongoose');


const bcrypt =
  require('bcryptjs');


// =====================================================
// CHARACTER STATS
// =====================================================

const CharacterStatsSchema =
  new mongoose.Schema(
    {

      /*
        Actual counted multiplayer PVP rounds.
      */
      pvpMatches: {
        type:
          Number,

        default:
          0
      },


      pvpWins: {
        type:
          Number,

        default:
          0
      },


      /*
        Proficiency scoring:

        loss / normal completed match = +1
        win = +2
      */
      proficiencyPoints: {
        type:
          Number,

        default:
          0
      }

    },
    {
      _id:
        false
    }
  );


// =====================================================
// MATCH ROSTER MEMBER
// =====================================================

const PvPRosterMemberSchema =
  new mongoose.Schema(
    {

      username: {
        type:
          String,

        required:
          true
      },


      character: {
        type:
          String,

        required:
          true
      }

    },
    {
      _id:
        false
    }
  );


// =====================================================
// PVP HISTORY
// =====================================================

const PvPMatchHistorySchema =
  new mongoose.Schema(
    {

      matchId: {
        type:
          String,

        required:
          true
      },


      playedAt: {
        type:
          Date,

        default:
          Date.now
      },


      character: {
        type:
          String,

        required:
          true
      },


      won: {
        type:
          Boolean,

        default:
          false
      },


      proficiencyAward: {
        type:
          Number,

        required:
          true
      },


      winnerUsername: {
        type:
          String,

        required:
          true
      },


      rosterSize: {
        type:
          Number,

        required:
          true
      },


      roster: {
        type: [
          PvPRosterMemberSchema
        ],

        default:
          []
      }

    },
    {
      _id:
        false
    }
  );


// =====================================================
// USER
// =====================================================

const UserSchema =
  new mongoose.Schema({

    username: {

      type:
        String,

      required:
        true,

      unique:
        true,

      trim:
        true,

      minlength:
        3
    },


    password: {

      type:
        String,

      required:
        true,

      minlength:
        6
    },


    avatar: {

      type:
        String,

      default:
        ''
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


    // ===================================================
    // PROFILE MATCH COUNT
    // ===================================================

    matchesPlayed: {

      type:
        Number,

      default:
        0
    },


    // ===================================================
    // 3-CHARACTER PROFILE SHOWCASE
    // ===================================================

    showcasedCharacters: {

      type: [
        String
      ],

      default:
        [],

      validate: {

        validator(
          value
        ) {

          return (

            Array.isArray(
              value
            ) &&

            value.length <=
              3
          );
        },

        message:
          'You can showcase at most 3 characters.'
      }
    },


    // ===================================================
    // CHARACTER STATS
    // ===================================================

    characterStats: {

      type:
        Map,

      of:
        CharacterStatsSchema,

      default:
        {}
    },


    // ===================================================
    // MATCH HISTORY
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
// PASSWORD HASH
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
// PASSWORD CHECK
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