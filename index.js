const express = require('express');
const app = express();
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const PORT = 3001;
const HOST = '127.0.0.1';

app.use(express.static('public/'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());


app.use(session({
    resave: false,
    saveUninitialized: false,
    secret: "jagruti@1204"
}));


const connection = require('./config/db');
connection();


const instaSchema = require('./model/instaSchema');
const userSchema = require('./model/userSchema');
const sendGmail = require('./gmail');

const storage = multer.diskStorage({
    destination: 'public/upload/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + "_" + file.originalname);
    }
});
const upload = multer({ storage });


app.get('/', (req, res) => {
    res.render('login.ejs');
});

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
    }
});


app.get('/signup', (req, res) => {
    res.render('signup.ejs');
});

app.post('/signup', (req, res) => {
    const { userName, userEmail, password, phone } = req.body;

    if (!userName || !userEmail || !password || !phone) {
        return res.send(`<script>alert('All fields required'); location.href='/signup'</script>`);
    }

    req.session.userDetails = req.body;

    const otp = Math.floor(1000 + Math.random() * 9000);
    req.session.OTP = otp;

    console.log("OTP:", otp);
    sendGmail(userEmail, otp);

    res.redirect('/otppage');
});


app.get('/otppage', (req, res) => {
    res.render('otppage.ejs');
});

app.post('/verifyotp', async (req, res) => {
    try {

        if (!req.session.userDetails) {
            return res.send(`<script>alert('Session expired'); location.href='/signup'</script>`);
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
    }
});


app.get('/dashboard', async (req, res) => {
    try {

        if (!req.session.loginId) return res.redirect('/');

        const user = await instaSchema.findById(req.session.loginId);

        let userData = await userSchema.findOne({
            userId: req.session.loginId
        });

        if (!userData) {
            userData = { userPost: [], userReel: [] };
        }

        res.render('dashboard.ejs', { user, userData });

    } catch (err) {
        console.log(err);
    }
});


app.get('/profile', async (req, res) => {
    try {

        if (!req.session.loginId) return res.redirect('/');

        const user = await instaSchema.findById(req.session.loginId);

        let profile = await userSchema.findOne({
            userId: req.session.loginId
        });

        if (!profile) {
            profile = { userPost: [], userReel: [] };
        }

        res.render('profile.ejs', { user, profile });

    } catch (err) {
        console.log(err);
    }
});


app.get('/edit-profile', async (req, res) => {

    if (!req.session.loginId) return res.redirect('/');

    let profile = await userSchema.findOne({
        userId: req.session.loginId
    });

    if (!profile) profile = {};

    res.render('edit-profile.ejs', { profile });
});


app.post('/profile', upload.single('userProfile'), async (req, res) => {
    try {

        if (!req.session.loginId) return res.redirect('/');

        const { username, userBio, gender } = req.body;

        let existing = await userSchema.findOne({
            userId: req.session.loginId
        });

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
            { returnDocument: 'after', upsert: true }
        );

        res.send(`<script>alert('Profile Updated'); location.href='/profile'</script>`);

    } catch (err) {
        console.log(err);
    }
});


app.get('/create', (req, res) => {
    if (!req.session.loginId) return res.redirect('/');
    res.render('create.ejs');
});


app.post('/create-post', upload.array('userPost'), async (req, res) => {
    try {

        if (!req.session.loginId) return res.redirect('/');

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
                $set: { userId: req.session.loginId },
                $push: { userPost: { $each: posts } }
            },
            { upsert: true }
        );

        res.redirect('/profile');

    } catch (err) {
        console.log(err);
    }
});


app.post('/create-reel', upload.array('userReel'), async (req, res) => {
    try {

        if (!req.session.loginId) return res.redirect('/');

        if (!req.files || req.files.length === 0) {
            return res.send("No reel uploaded");
        }

        const reels = req.files.map(file => ({
            video: file.filename,
            caption: req.body.caption || ""
        }));

        await userSchema.updateOne(
            { userId: req.session.loginId },
            {
                $set: { userId: req.session.loginId },
                $push: { userReel: { $each: reels } }
            },
            { upsert: true }
        );

        res.redirect('/profile');

    } catch (err) {
        console.log(err);
    }
});


app.get('/delete/post/:id', async (req, res) => {
    try {

        const postId = req.params.id;

        let userData = await userSchema.findOne({
            userId: req.session.loginId
        });

        if (!userData) return res.redirect('/profile');

        const post = userData.userPost.find(p => p._id.toString() === postId);

        if (post) {

            const filename = post.image;

            await userSchema.updateOne(
                { userId: req.session.loginId },
                {
                    $pull: { userPost: { _id: postId } }
                }
            );

            const path = "public/upload/" + filename;
            if (fs.existsSync(path)) {
                fs.unlinkSync(path);
            }
        }

        res.redirect('/profile');

    } catch (err) {
        console.log(err);
    }
});

app.get('/delete/reel/:id', async (req, res) => {
    try {

        const reelId = req.params.id;

        const userData = await userSchema.findOne({
            userId: req.session.loginId
        });

        if (!userData) return res.redirect('/profile');

        const reel = userData.userReel.find(
            r => r._id.toString() === reelId
        );

        if (!reel) {
            console.log("Reel not found");
            return res.redirect('/profile');
        }

        const filename = reel.video;

    
        userData.userReel = userData.userReel.filter(
            r => r._id.toString() !== reelId
        );

        await userData.save();

        const path = "public/upload/" + filename;
        if (fs.existsSync(path)) {
            fs.unlinkSync(path);
        }

        res.redirect('/profile');

    } catch (err) {
        console.log(err);
    }
});


app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});


app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
});