const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const MongoClient = require('mongodb').MongoClient;
require('dotenv').config();


// form method PUT, app.put 가능하게해주는 라이브러리
const methodOverride = require('method-override');

// 회원인증 passport
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
// const MongoStore = require('connect-mongo');



app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended : true}));
app.use(express.static("public"));
app.use(methodOverride('_method'));


// 회원인증관련
app.use(session({
    secret : 'secretCode', 
    resave : true, 
    saveUninitialized : false,
    // store: MongoStore.create({ mongoUrl:"mongodb://localhost:27017/swab" }),
    // cookie : {maxAge:(3.6e+6)*24}
}));
app.use(passport.initialize());
app.use(passport.session());


var db;
MongoClient.connect(process.env.DB_URL, function(err, client){
    if(err) return console.log(err);

    db = client.db('swab');
    app.db = db;

    app.listen(process.env.PORT, function(){
        console.log('listening on 8080');
    });
});



function isLogin(req, res, next){
    if(req.user){
        next()
    } else {
        res.redirect('/login');
    }
}


app.get('/login', function(req, res){
    res.render('login.ejs');
});

app.get('/join', function(req, res){
    res.render('join.ejs');
});


app.get('/cart', function(req, res){
    res.send('cart list');
});


app.get('/', function(req, res){
    res.render('index.ejs');
});


app.get('/write', (req, res)=>{
    res.render('write.ejs')
});


app.use('/book', require('./routes/book.js'));


app.get('/myPage', isLogin, (req, res)=>{
    res.render('myPage.ejs')
})
app.use('/myPage', require('./routes/myPage.js'));



app.get('/fail', (req,res)=>{
    res.send(
        `<script>
            alert('로그인 실패');
            location.href = '/login';
        </script>`
    );
});



app.post('/login', passport.authenticate('local', { 
        failureRedirect : '/fail' 
    }), (req, res)=>{
    res.redirect('/');
});


passport.use(new LocalStrategy({
    usernameField: 'id',
    passwordField: 'pw',
    session: true,
    passReqToCallback: false,
  }, function (inputId, inputPw, done) {
    console.log(inputId, inputPw);
    db.collection('login').findOne({ id: inputId }, function (err, result) {
      if (err) return done(err);
  
      if (!result) return done(null, false, { message: '존재하지 않는 아이디입니다.' })
      if (inputPw == result.pw) {
        return done(null, result)
      } else {
        return done(null, false, { message: '비밀번호가 틀렸습니다.' })
      }
    })
}));

// user.id 라는 이름으로 세션생성(passport new LocalStrategy 객체의 결과가 user로 들어간다.)
passport.serializeUser(function(user, done){
    done(null, user.id)
});

// 로그인한 유저의 개인정보를 db에서 찾아서 result반환.
passport.deserializeUser(function(userId, done){
    db.collection('login').findOne({ id : userId }, function(err, result){
        if(err) console.log(err);
        done(null, result)
    })
})

app.post('/register', (req, res)=>{
    db.collection('login').insertOne({ id : req.body.id, pw: req.body.pw }, (err, result)=>{
        res.redirect('/login');
    });
});

app.post('/add', (req, res)=>{

    var user = req.user._id

    db.collection('counter').findOne({name : '게시물 갯수'}, (err, result)=>{
        var totalQnA = result.totalQnA;

        var insert = { _id : totalQnA + 1, title: req.body.title, content: req.body.content, createUser : user }

        db.collection('qna').insertOne(insert, (err, result)=>{
            db.collection('counter').updateOne({name:'게시물 갯수'}, {$inc : {totalQnA : 1}}, (err, result)=>{
                if(err) console.log(err);
    
                res.send(
                    `<script>
                        alert('등록이 완료되었습니다.');
                        location.href='/qna';
                    </script>`
                )
            })
        })
    })
});

app.get('/edit/:id', isLogin, function(req, res){
    db.collection('qna').findOne({_id : parseInt(req.params.id)}, function(err, result){
        if(result == null) {
            res.sendFile(__dirname + '/views/empty.html');
        } else {
            res.render('edit.ejs', { data : result, user : req.user._id})
        }
    })
});

app.put('/edit/:id', function(req,res){
    db.collection('qna').updateOne({_id : parseInt(req.params.id)}, {$set : {title : req.body.title, content : req.body.title}}, function(err,result){
        res.send(
            `<script>
                alert('수정이 완료되었습니다.');
                location.href='/qna';
            </script>`
        )
    });
});


app.get('/addBook', (req, res)=>{
    res.render('addBook.ejs')
});

app.post('/addBook', (req, res)=>{
    db.collection('counter').findOne({name : '등록된 책'}, (err, result)=>{
        var totalBook = result.totalBook;
        db.collection('qna').insertOne({_id : totalBook + 1, title: req.body.title, content: req.body.content}, (err, result)=>{
            db.collection('counter').updateOne({name:'등록된 책'}, {$inc : {totalBook : 1}}, (err, result)=>{
                if(err) console.log(err);
    
                res.send(
                    `<script>
                        alert('등록이 완료되었습니다.');
                        location.href='/';
                    </script>`
                )
            })
        })
    })
});


app.delete('/delete/:id', isLogin,(req, res)=>{
    var deleteData = { _id : parseInt(req.params.id), createUser : req.user._id }

    db.collection('qna').deleteOne( deleteData, function(err, result){
        res.status(200).send({ message : '삭제했습니다.' });
    }); 
})



app.get('/qna', isLogin ,function(req, res){
    db.collection('qna').find().toArray((err, result)=>{
        res.render('qna.ejs', { qnas : result, user : req.user._id });
    });

});


app.get('/search', function(req, res){
    // query string이 담겨져있슴
    // console.log(req.query)

    
    var keyword = [
        {
            $search: {
                index : 'titleSearch',
                text : {
                    query : req.query.value,
                    path: "title"  // 제목, 컨텐츠 둘다 찾고싶으면 ['title', 'content']
                }
            }
        },
        { $sort : { _id : 1 }},
        // { $limit :  10 },

        // 보여주고싶은 것만 보여주기 1이면 보여줌 0이면 안보여줌
        // { $project : { title : 1, _id : 0, score: { $meta : "searchScore" } } }
    ]


    // aggregate[{}, {}, {}]로도 가넝
    db.collection('qna').aggregate(keyword).toArray((err, result)=>{
        res.render('search.ejs', { searchQnA : result })
    })
});