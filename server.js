// 작업폴더 오픈 후 npm init. entry point ? server.js
// 서버 자동 실행 npm install -g nodemon, => nodemon server.js

// npm install express
const express = require('express');
const app = express();

// npm install mongodb@3.6.4
const MongoClient = require('mongodb').MongoClient;

// npm install dotenv로 환경변수 사용
// .env파일 생성가능 / process.env.변수명으로 사용
require('dotenv').config();


// npm install ejs
// ejs파일에 서버데이터 박아넣기
app.set('view engine', 'ejs');

//form 데이터를 body로 받아오는 body-parser
app.use(express.urlencoded({extended : true}));


// public을 절대경로로 지정
app.use(express.static("public"));


// npm install bcrypt 비밀번호 암호화
const bcrypt = require("bcrypt");


// npm install method-override
// form method PUT, app.put 가능하게해주는 라이브러리
const methodOverride = require('method-override');
app.use(methodOverride('_method'));


// npm install socket.io
// 양방향 통신
const http = require('http').createServer(app);
const {Server} = require('socket.io');
const io = new Server(http);


var db;
MongoClient.connect(process.env.DB_URL, { useUnifiedTopology: true },function(err, client){
    if(err) return console.log(err);

    db = client.db('swab');
    app.db = db;
    
    // 쌩 nodejs-express로 서버띄울때는 app.listen
    http.listen(process.env.PORT, function(){
        console.log('listening on 8080');
    });
});


app.get('/socket', function(req, res){
    res.render('socket.ejs')
});

io.on('connection', function(socket){
    console.log('유저접속됨')

    
    socket.on('enter-room', function(data){
        // 채팅방 만들기
        socket.join('room1');
    });


    socket.on('user-send', function(data){
        // 모든 유저에게 메세지 보내줌
        // io.emit('broadcast', data);

        // socket.id에 해당하는 사람에게만 전송
        // io.on 파라미터 socket에 접속유저의 정보가 들어있슴.
        io.to(socket.id).emit('broadcast', data);
    });
    

    socket.on('room1-send', function(data){
        io.to('room1').emit('broadcast', data);
    })

});




// 회원인증 관련 passport
// npm install passport passport-local express-session
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const { json } = require('body-parser');
const { ObjectId } = require('mongodb');
const MongoDBStore = require('connect-mongodb-session')(session);

const store = new MongoDBStore({
    uri : process.env.DB_URL,
    databaseName : 'swab',
    collection : 'sessions',
    expiresAfterSeconds: 60 * 60 * 24 * 14 
});

app.use(session({
    secret : 'secretCode', 
    resave : false, 
    saveUninitialized : false,
    store: store,
}));
app.use(passport.initialize());



function isLogin(req, res, next){
    if(req.session){
        next()
    } else {
        res.redirect('/login');
    }
}


app.get('/', function(req, res){
    db.collection('bookInfo').find({ status : '1' }, {"fileName.0": 1}).sort({"date" : -1}).toArray((err, result)=>{
        res.render('index.ejs', { book : result, user : req.session });
    })
});


app.get('/login', function(req, res){
    res.render('members/login.ejs', { user : req.session });
});

app.get('/join', function(req, res){
    res.render('members/join.ejs', { user : req.session });
});



app.get('/fail', (req,res)=>{
    res.send(
        `<script>
            alert('로그인 실패');
            location.href = '/login';
        </script>`
    );
});


app.post('/memberIdChk', (req, res)=>{
    db.collection('login').findOne({ id : req.body.memberId }, (err, result)=>{
        if(result == null){
            res.send("ok");
        } else {
            res.send("fail");
        }
    })

})

const salt = 12;

app.post('/register', async (req, res)=>{

    const encryptedPw = await bcrypt.hash(req.body.pw, salt);
    
    db.collection('login').insertOne({ id : req.body.id, pw: encryptedPw }, ()=>{
        res.redirect('/login');
    });

});


app.post('/login', passport.authenticate('local', { 
        failureRedirect : '/fail' 
    }), async (req, res)=>{    
    res.redirect('/');
});


passport.use(new LocalStrategy({
    usernameField: 'id',
    passwordField: 'pw',
    session: true,
    passReqToCallback: false,
  }, function (inputId, inputPw, done) {
    try {
        db.collection('login').findOne({ id: inputId }, async function (err, result) {
            console.log(result);
            if (result) {
                const isEqualPw = await bcrypt.compare(inputPw, result.pw);

                if(isEqualPw){
                    return done(null, result);
                } else {
                    return done(null, false, { message: '비밀번호가 일치하지않습니다.' });
                }
                
            } else {
                return done(null, false, { message: '존재하지 않는 아이디입니다.' })
            }

        });
    } catch(e) {
        console.log(e);
    }
}));

// user.id 라는 이름으로 세션생성(passport new LocalStrategy 객체의 결과가 user로 들어간다.)
passport.serializeUser(function(user, done){
    done(null, user.id)
});


// 로그인한 유저의 개인정보를 db에서 찾아서 result반환.
passport.deserializeUser(function(userId, done){
    db.collection('login').findOne({ id : userId }, function(err, result){
        if(err) console.log(err);
        done(null, result);
    })
})

app.get('/logout', async(req, res)=>{
    try {
        if(req.session){
            req.session.destroy();
        }
        res.redirect("/");
    } catch(e) {
       console.log(e);
    }
})





app.use('/books', require('./routes/books.js'));

app.get('/books/:id', (req, res)=>{

    req.params.id = parseInt(req.params.id)
    
    db.collection('bookInfo').findOne({ _id : parseInt(req.params.id)}, (err, bookInfo)=>{
        if(!req.session.passport){
            return res.render('books/books.ejs', { book : bookInfo, like : '0', user: req.session});
        } else {
            db.collection('likeItem').findOne({ user : req.session.passport.user , itemId : { $in : [req.params.id] }}, (err, result1)=>{
                if(result1){
                    return res.render('books/books.ejs', { book : bookInfo, like : '1', user: req.session});
                } else {
                    res.render('books/books.ejs', { book : bookInfo, like : '0', user: req.session});
                }
            })
        }

    });
});


app.get('/images/:img', function(req, res){
    res.sendFile(__dirname + '/public/images' + req.params.img)
})



app.use('/qna', require('./routes/qna.js'));


app.get('/qna', isLogin ,function(req, res){
    db.collection('qna').find().toArray((err, result)=>{
        res.render('qna.ejs', { qnas : result, user : req.session });
    });

});




app.use('/mypage', require('./routes/myPage.js'));

app.get('/mypage', isLogin , (req, res)=>{
    db.collection('likeItem').findOne({ user : req.session.passport.user }, (err, result)=> {
        if(result.itemId.length == 0){
            return res.render('mypage/myPage.ejs', { likeItem : '0', user : req.session })
        }
        db.collection('bookInfo').find({ _id : { $in : result.itemId }}).toArray((err, likeItem)=>{
            res.render('mypage/myPage.ejs', { likeItem : likeItem, user : req.session })
        });
    });
})






app.post('/chat', isLogin, function(req, res){

    const newChat = {
        member : [ req.body.createUser, req.session.passport.user ],
        date : new Date(),
        title : req.body.createUser + "님의 상점",
        itemId : parseInt(req.body.bookId)
    }

    db.collection('chatRoom').findOne({ member : newChat.member, itemId : newChat.itemId }, (err, result)=>{
        if(result == null){
            db.collection('chatRoom').insertOne( newChat );
        } 
        res.status(200).send('ok');
    });
});


app.get('/chat/:user/:id', isLogin, function(req, res){

    var bookId = parseInt(req.params.id);

    db.collection('bookInfo').findOne({ _id : bookId },{ bookTitle : 1 }, (err, bookInfo)=>{
        db.collection('chatRoom').findOne({ member : [ req.params.user, req.session.passport.user ], itemId: bookId } , (err, result)=>{
            if(result) { 
                res.render('chat.ejs', { bookInfo : bookInfo, chatInfo : result, user : req.session });
            } else {
                res.send(`
                <script>
                    alert('채팅방이 없습니다.');
                    history.back();
                </script>
                `)
                return;
            }
        })
    })
})



app.get('/message/:id', (req, res)=>{

   // 일반 get, post요청은 1:1 요청/응답인데 header변경을 통해 여러번 응답 가능
   // server -> user 일방적 통신 가능
    res.writeHead(200, {
        "Connection" : "keep-alive",
        "Content-Type" : "text/event-stream",
        "Cache-Control" : "no-cache",
    });

    db.collection('message').find({ parent : req.params.id }).toArray((err, result)=>{
        // 데이터 전송
        // console.log(JSON.stringify(result))
        res.write('event: test\n');
        res.write('data: ' + JSON.stringify(result) + '\n\n');
    });


    // 컬렉션 안의 원하는 document만 감시하고 싶으면 match 안에 find 조건. fullDocument 붙임
    // 조건안의 document가 추가/수정/삭제 되면~
    const pipeLine = [
        { $match : { 'fullDocument.parent' : req.params.id }}
    ]

    // db변동사항을 감지하는 change stream
    const collection = db.collection('message');
    const changeStream = collection.watch(pipeLine);
    changeStream.on('change', (result)=>{
        // console.log(result.fullDocument)
        res.write('event: test\n');
        res.write('data: ' + JSON.stringify([result.fullDocument]) + '\n\n');
    });
})

app.post('/message', (req, res)=>{
    db.collection('login').findOne({ id : req.session.passport.user }, (err, result)=>{
        db.collection('message').insertOne({ userId : result._id , parent : req.body.parent, content : req.body.content, date : new Date() }, (err)=>{
            if(err) return;
            res.status(200);
        })
    })

})


app.delete('/out/:chatId', isLogin, (req,res)=>{
    
    db.collection('message').deleteMany({ parent : req.params.chatId}, (err)=>{
        if(err) console.log(err)
        db.collection('chatRoom').deleteOne({ _id : ObjectId(req.params.chatId) }, (err)=>{
            if(err) console.log(err)
            res.status(200);
        })
    })
})


