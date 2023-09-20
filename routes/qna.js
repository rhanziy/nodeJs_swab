var router = require('express').Router();


const methodOverride = require('method-override');
router.use(methodOverride('_method'));

function isLogin(req, res, next){
    if(req.session){
        next()
    } else {
        res.redirect('/login');
    }
}

router.use( isLogin );

router.get('/new', (req, res)=>{
    res.render('qna/writeQnA.ejs', { user : req.session });
})


router.post('/upload', isLogin, (req, res)=>{

    res.app.db.collection('counter').findOne({name : '게시물 갯수'}, (err, result)=>{
        var totalQnA = result.totalQnA;

        var insert = { _id : totalQnA + 1, title: req.body.title, content: req.body.content, createUser : req.session.passport.user }

        res.app.db.collection('qna').insertOne(insert, (err, result)=>{
            res.app.db.collection('counter').updateOne({name:'게시물 갯수'}, {$inc : {totalQnA : 1}}, (err, result)=>{
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


router.get('/:id/edit', isLogin, function(req, res){
    res.app.db.collection('qna').findOne({_id : parseInt(req.params.id)}, function(err, result){
        if(result == null) {
            res.sendFile(__dirname + '/views/empty.html');
        } else {
            res.render('qna/editQnA.ejs', { data : result, user : req.session.passport.user })
        }
    })
});

router.put('/edit/:id', function(req,res){
    res.app.db.collection('qna').updateOne({_id : parseInt(req.params.id)}, {$set : {title : req.body.title, content : req.body.content}}, function(){
        res.send(
            `<script>
                alert('수정이 완료되었습니다.');
                location.href='/myPage/myQnA';
            </script>`
        )
    });
});


router.delete('/:id/delete', isLogin,(req, res)=>{
    
    var deleteData = { _id : parseInt(req.params.id), createUser : req.session.passport.user }

    res.app.db.collection('qna').deleteOne( deleteData, function(err, result){
        res.status(200).send({ message : '삭제했습니다.' });
    }); 
})


router.get('/search', function(req, res){
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
    res.app.db.collection('qna').aggregate(keyword).toArray((err, result)=>{
        res.render('qna/searchQnA.ejs', { qna : result, user: req.session })
    })
});


module.exports = router;