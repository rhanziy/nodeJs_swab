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
    // res.app.db.collection('chatRoom').find({ "member.1" : { $eq : req.session.passport.user }}).toArray((err, result)=>{
    //     res.render('./myPage/myChat.ejs', {  chatInfo : result, user : req.session });    
    // })

    res.app.db.collection('chatRoom').aggregate([
        {
            $match : { "member.1" : req.session.passport.user }
        },
        {
            $lookup:{
                from:'bookInfo',
                localField : "itemId",
                foreignField : '_id',
                as : 'bookInfo'
            }
        },
        {
            $addFields : {
                fileName : { $arrayElemAt : ["$bookInfo.fileName", 0] }
            }
        },
        {
            $set :{
                bookInfo : { $arrayElemAt : ["$bookInfo.bookTitle", 0] },
            }
        },
        {
            $project : { date : 0, itemId : 0}
        }
    ]).toArray((err, result)=>{
        console.log(result)
        res.render('./myPage/myChat.ejs', { chatInfo : result, user : req.session });
    })
})


router.get('/myQnA', (req, res)=>{
    res.app.db.collection('qna').find({ createUser : req.session.passport.user }).toArray((err, result)=>{
        res.render('./myPage/myQnA.ejs', { qnas : result, user : req.session });
    })
})


module.exports = router;