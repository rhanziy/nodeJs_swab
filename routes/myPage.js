var router = require('express').Router();

function isLogin(req, res, next){
    if(req.session){
        next()
    } else {
        res.redirect('/login');
    }
}

router.use( isLogin );

router.get('/myPost', (req, res)=>{
    res.app.db.collection('bookInfo').find({ createUser : req.session.passport.user }).toArray((err, result)=>{
        res.render('./myPage/myPost.ejs', { bookInfo : result, user : req.session });
    })
})

router.get('/myChat', (req,res)=>{

    res.app.db.collection('chatRoom').find({ "member.1" : { $eq : req.session.passport.user }}).toArray((err, result)=>{
        res.render('./myPage/myChat.ejs', {  chatInfo : result, user : req.session });    
    })

})


router.get('/myQnA', (req, res)=>{
    res.app.db.collection('qna').find({ createUser : req.session.passport.user }).toArray((err, result)=>{
        res.render('./myPage/myQnA.ejs', { qnas : result, user : req.session });
    })
})


module.exports = router;