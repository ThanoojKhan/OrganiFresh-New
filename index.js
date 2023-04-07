const mongoose = require('mongoose')
const morgan = require('morgan')
const userRoute = require('./router/userRoute')
const adminRoute = require('./router/adminRoute')
const bodyParser = require('body-parser')
const session = require('express-session')
const nocache = require('nocache')
const path = require('path')
require('dotenv').config();

const config = require('./config/config')
config.mongooseConnection()


const express = require('express')
const app = express()
app.use(morgan("dev"));
app.use(nocache())


app.use(session({ secret:process.env.SECRET_KEY, cookie: { maxAge: 60000 * 100 }, saveUninitialized: true, resave: true }))
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.use('/admin', adminRoute)
app.use('/', userRoute)

app.set('view engine','ejs')
app.set('views','./views/users')
app.use((error,req,res,next)=>{
    res.status(error.status||500)
    res.render('error')
})

app.listen(process.env.PORT, () => {
    console.log('server running');
})
