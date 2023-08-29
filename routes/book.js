var router = require('express').Router();




router.get('/dom', (req, res)=>{
    res.send('국내서적');
});

router.get('/nat', (req, res)=>{
    res.send('국외서적');
});


module.exports = router;