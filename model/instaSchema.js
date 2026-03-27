const mongoose = require('mongoose')

const instaSchema = new mongoose.Schema({
    userName: {
        type: String,
        required: true,
        unique: true,
    },
    userEmail: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now()
    }
})

module.exports = mongoose.model('UserAuth', instaSchema)