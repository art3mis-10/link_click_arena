const mongoose =
  require('mongoose');


// =====================================================
// DIRECT MESSAGE
// =====================================================

const MessageSchema =
  new mongoose.Schema(
    {

      sender: {

        type:
          String,

        required:
          true,

        trim:
          true,

        index:
          true
      },


      recipient: {

        type:
          String,

        required:
          true,

        trim:
          true,

        index:
          true
      },


      text: {

        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          200
      },


      /*
        Null until the RECIPIENT actually
        opens/reads the conversation.
      */

      readAt: {

        type:
          Date,

        default:
          null
      },


      /*
        Null while unread.

        Once read:
        expiresAt = readAt + 24 hours

        MongoDB TTL deletes it automatically.
      */

      expiresAt: {

        type:
          Date,

        default:
          null
      }

    },

    {

      timestamps:
        true
    }
  );


// =====================================================
// TTL INDEX
// =====================================================

MessageSchema.index(

  {
    expiresAt:
      1
  },

  {
    expireAfterSeconds:
      0
  }
);


// =====================================================
// CONVERSATION LOOKUP INDEX
// =====================================================

MessageSchema.index({

  sender:
    1,

  recipient:
    1,

  createdAt:
    -1
});


module.exports =
  mongoose.model(
    'Message',
    MessageSchema
  );