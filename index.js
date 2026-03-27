const express = require('express');
const app = express();
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const HOST = '127.0.0.1';

// ------------------ MIDDLEWARE ------------------
app.use(express.static('public/'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session config (Improved)
app.use(session({
    secret: "jagruti@1204",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 30 // 30 minutes
    }
}));

// ------------------ DB CONNECTION ------------------
const connection = require('./config/db');
connection();

// ------------------ MODELS ------------------
const instaSchema = require('./model/instaSchema');
const userSchema = require('./model/userSchema');
const sendGmail = require('./gmail');

// ------------------ AUTH MIDDLEWARE ------------------
const isAuth = (req, res, next) => {
    if (!req.session.loginId) {
        return res.redirect('/');
    }
    next();
};

// ------------------ MULTER CONFIG ------------------
const storage = multer.diskStorage({
    destination: 'public/upload/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + "_" + file.originalname);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "video/mp4"];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type"));
        }
    }
});

// ------------------ ROUTES ------------------

// Login Page
app.get('/', (req, res) => {
    res.render('login.ejs');
});

// LOGIN
app.post('/login', async (req, res) => {
    try {
        const { userName, password } = req.body;

        const user = await instaSchema.findOne({ userName });
        if (!user) return res.send(`<script>alert('User Not Found'); location.href='/'</script>`);

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.send(`<script>alert('Wrong Password'); location.href='/'</script>`);

        req.session.loginId = user._id;

        res.send(`<script>alert('Login Success'); location.href='/dashboard'</script>`);

    } catch (err) {
        console.log(err);
        res.send("Something went wrong");
    }
});

// SIGNUP PAGE
app.get('/signup', (req, res) => {
    res.render('signup.ejs');
});

// SIGNUP + OTP
app.post('/signup', async (req, res) => {
    try {
        const { userName, userEmail, password, phone } = req.body;

        if (!userName || !userEmail || !password || !phone) {
            return res.send(`<script>alert('All fields required'); location.href='/signup'</script>`);
        }

        if (password.length < 6) {
            return res.send(`<script>alert('Password must be 6+ characters'); location.href='/signup'</script>`);
        }

        const existingUser = await instaSchema.findOne({ userEmail });
        if (existingUser) {
            return res.send(`<script>alert('Email already exists'); location.href='/signup'</script>`);
        }

        req.session.userDetails = req.body;

        const otp = Math.floor(1000 + Math.random() * 9000);
        req.session.OTP = otp;
        req.session.otpExpire = Date.now() + 5 * 60 * 1000; // 5 min

        console.log("OTP:", otp);
        sendGmail(userEmail, otp);

        res.redirect('/otppage');

    } catch (err) {
        console.log(err);
        res.send("Error during signup");
    }
});

// OTP PAGE
app.get('/otppage', (req, res) => {
    res.render('otppage.ejs');
});

// VERIFY OTP
app.post('/verifyotp', async (req, res) => {
    try {
        if (!req.session.userDetails) {
            return res.send(`<script>alert('Session expired'); location.href='/signup'</script>`);
        }

        if (Date.now() > req.session.otpExpire) {
            return res.send(`<script>alert('OTP Expired'); location.href='/signup'</script>`);
        }

        const userOtp = req.body.userotp.join('');

        if (userOtp != req.session.OTP) {
            return res.send(`<script>alert('Invalid OTP'); location.href='/otppage'</script>`);
        }

        const data = req.session.userDetails;
        const hash = await bcrypt.hash(data.password, 10);

        await new instaSchema({
            userName: data.userName,
            userEmail: data.userEmail,
            password: hash,
            phone: data.phone
        }).save();

        req.session.userDetails = null;
        req.session.OTP = null;

        res.send(`<script>alert('Registered Successfully'); location.href='/'</script>`);

    } catch (err) {
        console.log(err);
        res.send("OTP verification failed");
    }
});

// DASHBOARD
app.get('/dashboard', isAuth, async (req, res) => {
    try {
        const user = await instaSchema.findById(req.session.loginId);

        let userData = await userSchema.findOne({ userId: req.session.loginId });

        if (!userData) userData = { userPost: [], userReel: [] };

        res.render('dashboard.ejs', { user, userData });

    } catch (err) {
        console.log(err);
    }
});

// PROFILE
app.get('/profile', isAuth, async (req, res) => {
    try {
        const user = await instaSchema.findById(req.session.loginId);

        let profile = await userSchema.findOne({ userId: req.session.loginId });

        if (!profile) profile = { userPost: [], userReel: [] };

        res.render('profile.ejs', { user, profile });

    } catch (err) {
        console.log(err);
    }
});

// UPDATE PROFILE
app.post('/profile', isAuth, upload.single('userProfile'), async (req, res) => {
    try {
        const { username, userBio, gender } = req.body;

        let existing = await userSchema.findOne({ userId: req.session.loginId });

        const userProfile = req.file
            ? req.file.filename
            : existing?.userProfile || "";

        await userSchema.findOneAndUpdate(
            { userId: req.session.loginId },
            {
                userId: req.session.loginId,
                username,
                userBio,
                gender,
                userProfile
            },
            { upsert: true }
        );

        res.send(`<script>alert('Profile Updated'); location.href='/profile'</script>`);

    } catch (err) {
        console.log(err);
    }
});

// CREATE POST
app.post('/create-post', isAuth, upload.array('userPost'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.send("No post uploaded");
        }

        const posts = req.files.map(file => ({
            image: file.filename,
            caption: req.body.caption || ""
        }));

        await userSchema.updateOne(
            { userId: req.session.loginId },
            {
                $push: { userPost: { $each: posts } }
            },
            { upsert: true }
        );

        res.redirect('/profile');

    } catch (err) {
        console.log(err);
    }
});

// DELETE POST
app.get('/delete/post/:id', isAuth, async (req, res) => {
    try {
        const postId = req.params.id;

        let userData = await userSchema.findOne({ userId: req.session.loginId });

        if (!userData) return res.redirect('/profile');

        const post = userData.userPost.find(p => p._id.toString() === postId);

        if (post) {
            const filename = post.image;

            await userSchema.updateOne(
                { userId: req.session.loginId },
                { $pull: { userPost: { _id: postId } } }
            );

            const filePath = path.join(__dirname, "public/upload/", filename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        res.redirect('/profile');

    } catch (err) {
        console.log(err);
    }
});

// LOGOUT
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ------------------ SERVER ------------------
app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
});