var router = require('express').Router();

function isLogin(req, res, next){
    if(req.user){
        next()
    } else {
        res.redirect('/login');
    }
}

router.use( isLogin );

router.get('/myPost', (req, res)=>{
    // res.render('./myPage/myPost.ejs');
})

router.get('/myChat', (req,res)=>{

    res.app.db.collection('chatRoom').find({ "member.1" : { $eq : req.user.id } }).toArray((err, result)=>{
            res.render('./myPage/myChat.ejs', { chatInfo : result, user : req.user._id });
    })  
})

router.get('/myQnA', (req, res)=>{
    res.app.db.collection('qna').find().toArray((err, result)=>{
        res.render('./myPage/myQnA.ejs', { qnas : result, user : req.user._id });
    })
})


module.exports = router;