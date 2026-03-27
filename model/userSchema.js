const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserAuth',
        required: true,
        unique:true
    },

    username: String,
    userBio: String,

    userProfile: String,

    gender: String,

    userPost: [
        {
            image: String,
            caption: String
        }
    ],

    userReel: [
        {
            video: String,
            caption: String
        }
    ],

    createdAt: {
        type: Date,
        default: Date.now()

    }
})

module.exports = mongoose.model('UserProfile', userSchema)