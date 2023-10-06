var router = require('express').Router();

const methodOverride = require('method-override');
router.use(methodOverride('_method'));


function isLogin(req, res, next){
    if(req.session.passport){
        next()
    } else {
        res.redirect('/login');
    }
}

router.use( isLogin );


router.get('/new', (req, res)=>{
    res.render('books/addBook.ejs', { user : req.session })
})


// // npm install multer 
// 이미지 업로드 라이브러리.
const multer = require('multer');
const fs = require("fs");


let ff;
var storage = multer.diskStorage({
    destination : function(req, file, cb){
        var dir = "./public/images";

        if(!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive : true });
        }
        cb(null, dir);

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


// upload.single 파라미터 안에는 input name속성
// upload.array('input name', 10) 2번째인자는 받을 갯수
router.post('/upload', upload.array('file', 3), (req, res)=>{

    let fileName = [];
    req.files.map((e)=> {
        fileName.push(e.filename);
    })

    res.app.db.collection('counter').findOne({name : '등록된 책'}, (err, result)=>{
        var totalBook = result.totalBook;
        res.app.db.collection('bookInfo').insertOne({_id : totalBook + 1, fileName : fileName, bookTitle: req.body.title, author: req.body.author, cate : req.body.cate, createUser : req.session.passport.user, status: '1', date : new Date() }, ()=>{
            res.app.db.collection('counter').updateOne({name:'등록된 책'}, {$inc : {totalBook : 1}}, (err)=>{
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


router.get('/:bookId/edit', (req,res)=>{

    res.app.db.collection('bookInfo').findOne({ _id : parseInt(req.params.bookId) }, (err, result)=>{
        res.render('books/editBook.ejs', { bookInfo : result, user : req.session })
    })
})


router.put('/edit/:bookId', upload.array('file', 3), function(req,res){
    
    var exFile = req.body.exFile;

    let fileName = [];
    if(req.files){
        req.files.map((e)=> {
            fileName.push(e.filename);
        })
    }

    if(exFile){
        exFile.length < 4 ? fileName.push(...exFile) : fileName.push(exFile)
    }
    
    res.app.db.collection('bookInfo').updateOne({_id : parseInt(req.params.bookId)}, 
        {$set : { fileName : fileName, bookTitle: req.body.title, author: req.body.author, cate : req.body.cate, status : req.body.status }}, (err)=>{
        if(err) console.log(err)
        res.send(
            `<script>
                alert('수정이 완료되었습니다.');
                location.href='/books/${req.params.bookId}';
            </script>`
        )
    });
});


router.get('/search', function(req, res){

    var keyword = [
        {
            $search: {
                index : 'bookSearch',
                text : {
                    query : req.query.value ,
                    path: ["bookTitle", "author"]
                }
            }
        },
        { $sort : { date : -1 }},
    ]

    res.app.db.collection('bookInfo').aggregate(keyword).toArray((err, result)=>{
        res.render('books/searchBook.ejs', { searchBook : result, user : req.session })
    })
});



router.get('/:createUser/:bookId/change', isLogin, (req, res)=>{
    req.params.bookId = parseInt(req.params.bookId);

    res.app.db.collection('bookInfo').findOne({_id : req.params.bookId},{ bookTitle:1, author: 1 }, (err, info)=>{
        res.app.db.collection('bookInfo').find({ createUser : req.session.passport.user, status : '1' }, {_id:0, cate:0, date:0}).toArray((err, result)=>{
            res.render('books/changeBook.ejs', { info: info, books : result , user : req.session })
        });
    });
});




router.put('/change/:bookId', (req, res)=>{
    
    res.app.db.collection('bookInfo').updateOne({_id : parseInt(req.params.bookId)}, {$set : { status: "2" }}, (err)=>{
        if(err) console.log(err);
        res.send('ok');
    })
});






router.delete('/:bookId', isLogin,(req, res)=>{

    res.app.db.collection('bookInfo').deleteOne({_id : parseInt(req.params.bookId)}, function(err, result){
        if(!result) { 
            res.send(
                `<script>
                    alert('게시물이 없습니다.');
                    history.back();
                </script>`
            );
        }
        res.status(200).send('ok');
    }); 
});


router.post('/like/:bookId', isLogin, function(req, res){
    let bookId = parseInt(req.params.bookId)

    res.app.db.collection('likeItem').findOne({ user : req.session.passport.user }, (err, result)=>{

        if(result){
            res.app.db.collection('likeItem').updateOne(
                { user : req.session.passport.user }, { $push : { itemId : bookId }}, 
                (err)=>{
                    if(err) console.log(err);
                    res.send('ok');
            })
        } else {
            res.app.db.collection('likeItem').insertOne(
                { user : req.session.passport.user, itemId : [ bookId ] }, 
                (err)=>{
                    if(err) console.log(err);
                    res.send('ok');
            })
        }
    })
})

router.post('/likeClear/:bookId', isLogin, function(req,res){

    res.app.db.collection('likeItem').update(
        { user : req.session.passport.user },
        { $pull : { itemId : parseInt(req.params.bookId) } },
        (err, result)=>{
            res.send('ok')
    })
})


module.exports = router;