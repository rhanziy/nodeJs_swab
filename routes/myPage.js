var router = require('express').Router();

function isLogin(req, res, next){
    if(req.user){
        next()
    } else {
        res.redirect('/login');
    }
}

router.use( isLogin );

router.get('/community', (req, res)=>{
    res.send('커뮤니티게시판');
})


router.get('/myQnA', (req, res)=>{
    res.app.db.collection('qna').find().toArray((err, result)=>{
        res.render('myQnA.ejs', { qnas : result, user : req.user._id });
    })
})


module.exports = router;