const multer = require('multer')
const path = require('path')

function createMulter(){
    const storage = multer.diskStorage({
        destination:(req,file,callback)=>{
        callback(null,path.join(__dirname,'../public/proImage/temp'))
        },
        filename:(req,file,callback)=>{
            const name = Date.now()+'-'+file.originalname;
            callback(null,name)
        }
    });
    
    const upload = multer({storage:storage})
    return upload
}

function createMultera(){
    const storage1 = multer.diskStorage({
        destination:(req,file,callback)=>{
        callback(null,path.join(__dirname,'../public/banner'))
        },
        filename:(req,file,callback)=>{
            const name = Date.now()+'-'+file.originalname;
            callback(null,name)
        }
    });
    
    const upload1 = multer({storage:storage1})
    return upload1
}

module.exports = {
    createMulter,
    createMultera
}
