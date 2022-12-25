//  In-built modules
const express = require('express');
const passport = require('passport');
const googleStrategy = require('passport-google-oauth2').Strategy;
const session = require('express-session');
require('dotenv').config();

//  Local modules
let docs = require('./db/docs');
let users = require('./db/users');

const app = express();
const port = process.env.PORT || 3000;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

app.set('view engine', 'ejs');
app.use(express.static('./views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: 'auto' }
}))

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    let user = users.find((user) => {return id == user.id});
    if(user)
        done(null, user);
    else
        done(null, false);
})

passport.use(new googleStrategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: REDIRECT_URI,
    passReqToCallback: true
}, (req, accessToken, refreshToken, profile, done) => {
    
    let user = users.find((user) => {return profile.id == user.id});
    if(user)
        return done(null, user);
    else
    {
        //  the below line(users.push) is important for proper serialization, idk why
        profile.saved = [1, 3, 4, 8, 13];
        users.push(profile);
        return done(null, profile);
    }
}));

//-------------------------------------HELPER-Functions--------------------------------------
app.use((req, res, next) => {
    res.locals.user = req.user;
    next();
})

//-------------------------------------ROUTES---------------------------------------

app.get('/', (req, res) => {
    //  current user
    console.log(req.user?.id);

    // console.log('q:', req.query);
    if(Object.keys(req.query).length > 0)
    {
        res.redirect(`/search/:${req.query.tags}`);
    }

    res.render('index.ejs', {
        cards: docs
    });
})

app.get('/search', (req, res) => {
    
    let qs = req.query.qs.toLowerCase();  //  qs = query string
    let curDocs = docs.filter((card) => {
        let result = false;
        card.tags.forEach((tag) => {
            if(tag.toLowerCase() == qs)
                result = true;    
        });
        if(card.description.toLowerCase().includes(qs))
            result = true;
        return result;
    });

    res.render('index.ejs', {
        cards: curDocs
    });
})

app.get('/toggle/:id', (req, res) => {

    if(!req.isAuthenticated())
    {
        res.redirect('/');
        return;
    }

    let cid = parseInt(req.params.id, 10);
    let curUser = req.user;

    console.log(cid, 'happening', curUser.saved.length);
    let idx = curUser.saved.indexOf(cid);
    console.log(curUser.saved);

    if(idx != -1)
        curUser.saved.splice(idx, 1);
    else
        curUser.saved.push(cid);

    console.log(curUser.saved);
    // console.log(curUser?.saved.length);
});

app.get('/personal', (req, res) => {
    if(req.isAuthenticated())
    {
        let curDocs = docs.filter((card) => {
            return req.user.saved.includes(card.id);
        });
        res.render('index.ejs', {
            cards: curDocs
        });
    }
    else
        res.redirect('/');
})

app.get('/login', (req, res) => {
    res.redirect('/auth/callback');
})

app.get('/auth/callback',
    passport.authenticate('google', {
        scope:
            ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile', 'openid'],
        successRedirect: '/auth/success',
        failureRedirect: '/auth/failure',
        passReqToCallback: true
    })
);

app.get('/auth/success', (req, res) => {
    //  current user
    // console.log(req.user?.id);
    // users.forEach(user => {
    //     console.log(user.id);
    // });
    res.redirect('/');
})
app.get('/auth/failure', (req, res) => {
    res.send('failure');
})

app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err)
            console.log(err);
        else
        {
            // console.log(req.isAuthenticated());
            res.redirect('/');
        }
    })
})

app.post('/add', (req, res) => {
    if(!req.isAuthenticated())
    {
        res.redirect('/');
        return;
    }

    console.log(req.isAuthenticated());
    let curUser = users.find((user) => {
        return user.id == req.user.id
    })
    
    let tags = req.body.tags.split(',');
    let item = {
        ...req.body,
        id: docs.length + 1,
        tags: tags,
        author: curUser.id
    };
    curUser.saved.push(item.id);
    docs.push(item);
    res.redirect('back');
})

//----------------------------------SERVER-LISTENING------------------------------------
app.listen(port, () => {
    console.log(`Server listening at port: ${port}`);
})