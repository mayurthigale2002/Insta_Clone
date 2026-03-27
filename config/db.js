const mongoose = require('mongoose')

const connection = async () => {
    try {

        await mongoose.connect('mongodb://localhost:27017/')
        console.log("DB Connection Successfully");

    } catch (err) {

        console.log("DB Connection Failed!" + err);
        
    }
}

connection()

module.exports = connection