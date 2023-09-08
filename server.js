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


// // npm install multer 
// 이미지 업로드 라이브러리.
let multer = require('multer');


// npm install socket.io
// 양방향 통신
const http = require('http').createServer(app);
const {Server} = require('socket.io');
const io = new Server(http);



var db;
MongoClient.connect(process.env.DB_URL, function(err, client){
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


app.get('/login', function(req, res){
    res.render('./member/login.ejs', { user : req.session });
});

app.get('/join', function(req, res){
    res.render('./member/join.ejs', { user : req.session });
});


app.get('/cart', function(req, res){
    res.send('cart list');
});


app.get('/', function(req, res){
    db.collection('bookInfo').find({}, {_id:0, cate:0, createUser:0, "fileName.1":0}).toArray((err, result)=>{

        res.render('index.ejs', { book : result, user : req.session });
    })
});


app.get('/write', isLogin, (req, res)=>{
    res.render('write.ejs', { user : req.session })
});


app.use('/book', require('./routes/book.js'));


app.get('/myPage', isLogin, (req, res)=>{
    res.render('./myPage/myPage.ejs', { user : req.session })
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


app.post('/add', isLogin, (req, res)=>{

    db.collection('counter').findOne({name : '게시물 갯수'}, (err, result)=>{
        var totalQnA = result.totalQnA;

        var insert = { _id : totalQnA + 1, title: req.body.title, content: req.body.content, createUser : req.session.passport.user }

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
            res.render('edit.ejs', { data : result, user : req.session.passport.user })
        }
    })
});

app.put('/edit/:id', function(req,res){
    db.collection('qna').updateOne({_id : parseInt(req.params.id)}, {$set : {title : req.body.title, content : req.body.title}}, function(){
        res.send(
            `<script>
                alert('수정이 완료되었습니다.');
                location.href='/qna';
            </script>`
        )
    });
});



let ff;
var storage = multer.diskStorage({
    destination : function(req, file, cb){
        cb(null, './public/images');
    },
    filename : function(req, file, cb){
        // 한글깨짐현상 방지
        ff = file
        ff.originalname = Buffer.from(file.originalname, "latin1").toString("utf8");
        cb(null,  Date.now() +"_"+ ff.originalname);
    },
    // filefilter : function(req, file, cb){
    //     var ext = path.extname(file.originalname);
    //     if(ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg'){
    //         return callback(new Error('PNG, JPG 확장자만 업로드 가능합니다.'));
    //     }
    //     callback(null, true)
    // },
    limits : {
        fileSize : 1024 * 1024
    }
});

var upload = multer({storage : storage});


//램에 저장하는법
// var storage = multer.memoryStorage();
// var upload = multer({ storage : storage });


app.get('/addBook', isLogin, (req, res)=>{
    res.render('addBook.ejs', { user : req.session })
});

app.get('/editBook/:createUser/:bookId', isLogin, (req,res)=>{

    db.collection('bookInfo').findOne({ createUser : req.params.createUser, _id : parseInt(req.params.bookId) }, (err, result)=>{
        res.render('editBook.ejs', { bookInfo : result, user : req.session })
    })
})

app.put('/editBook/:id', upload.array('file', 3), function(req,res){

    let fileName = [];
    if(req.files){
        req.files.map((e)=> {
            fileName.push(e.filename);
        })
    }

    db.collection('bookInfo').updateOne({_id : parseInt(req.params.id)}, 
        {$set : { fileName : fileName, bookTitle: req.body.title, author: req.body.author, cate : req.body.cate }}, (err)=>{
        if(err) console.log(err)
        res.send(
            `<script>
                alert('수정이 완료되었습니다.');
                location.href='/bookInfo/${req.params.id}';
            </script>`
        )
    });
});

app.get('/bookInfo/:id', (req, res)=>{
    db.collection('bookInfo').findOne({ _id : parseInt(req.params.id)}, (err, result)=>{
        if(err) console.log(err)
        res.render('bookInfo.ejs', { book : result, user : req.session });
    });
});

// upload.single 파라미터 안에는 input name속성
// upload.array('input name', 10) 2번째인자는 받을 갯수
app.post('/upload', isLogin, upload.array('file', 3), (req, res)=>{
    let fileName = [];
    req.files.map((e)=> {
        fileName.push(e.filename);
    })

    db.collection('counter').findOne({name : '등록된 책'}, (err, result)=>{
        var totalBook = result.totalBook;
        db.collection('bookInfo').insertOne({_id : totalBook + 1, fileName : fileName ,bookTitle: req.body.title, author: req.body.author, cate : req.body.cate, createUser : req.session.passport.user}, ()=>{
            db.collection('counter').updateOne({name:'등록된 책'}, {$inc : {totalBook : 1}}, (err)=>{
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


app.get('/images/:img', function(req, res){
    res.sendFile(__dirname + '/public/images' + req.params.img)
})




app.post('/chat', isLogin, function(req, res){

    const newChat = {
        member : [ req.body.createUser, req.session.passport.user ],
        date : new Date(),
        title : req.body.createUser + "님의 상점",
    }

    db.collection('chatRoom').findOne({ member : newChat.member }, (err, result)=>{
        if(result == null){
            db.collection('chatRoom').insertOne( newChat );
        } 
        res.status(200).send('ok');
    });
});


app.get('/chat/:user/:id', isLogin, function(req, res){

    db.collection('bookInfo').findOne({ _id : parseInt(req.params.id) },{ bookTitle : 1 }, (err, bookInfo)=>{
        db.collection('chatRoom').findOne({ member : [ req.params.user, req.session.passport.user ]} , (err, result)=>{
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



app.delete('/delete/:id', isLogin,(req, res)=>{
    var deleteData = { _id : parseInt(req.params.id), createUser : req.session.passport.user }

    db.collection('qna').deleteOne( deleteData, function(err, result){
        res.status(200).send({ message : '삭제했습니다.' });
    }); 
})

app.delete('/delete/:createUser/:bookId', isLogin,(req, res)=>{
    var deleteData = { _id : parseInt(req.params.id), createUser : req.session.passport.user }

    db.collection('bookInfo').deleteOne( deleteData, function(err, result){
        res.status(200).send({ message : '삭제했습니다.' });
    }); 
})




app.get('/qna', isLogin ,function(req, res){
    db.collection('qna').find().toArray((err, result)=>{
        res.render('qna.ejs', { qnas : result, user : req.session });
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