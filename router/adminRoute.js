const express = require("express")
const multer = require('../config/multer')
const adminController = require('../controllers/adminController')
const auth = require('../middleware/authAdmin')

const upload = multer.createMulter()
const upload1 = multer.createMultera()
const admin_route = express()

admin_route.set('view engine', 'ejs')
admin_route.set('views', './views/admin')


admin_route.get('/', auth.adminLogin, adminController.loginLoad)

admin_route.post('/',auth.adminLogin, adminController.adminLogin)

admin_route.get('/home', auth.logOutSession, adminController.loadAdminHome)

admin_route.get('/logout', auth.logOutSession, adminController.adminLogOut)

admin_route.get('/userData', auth.logOutSession, adminController.loadUserData)

admin_route.get('/blockUser', auth.logOutSession, adminController.blockUser)

admin_route.get('/unblockUser', auth.logOutSession, adminController.unblockUser)

admin_route.get('/addProduct', auth.logOutSession, adminController.newProduct)

admin_route.post('/addProduct',auth.logOutSession,upload.array('image',3),adminController.addProduct)

admin_route.post('/addCategory',auth.logOutSession,adminController.addCategory)

admin_route.post('/editCategory',auth.logOutSession,adminController.editCategory)

admin_route.get('/deleteCategory',auth.logOutSession,adminController.categoryDelete)

admin_route.get('/products',auth.logOutSession,adminController.loadProducts)

admin_route.get('/deleteProduct',auth.logOutSession,adminController.deleteProduct)

admin_route.get('/listProduct',auth.logOutSession,adminController.listProduct)

admin_route.get('/editProduct',auth.logOutSession,adminController.loadEditPage)

admin_route.post('/editProduct',auth.logOutSession,upload.array('image',3),adminController.editProduct)

admin_route.get('/category',auth.logOutSession,adminController.categoryManage)

admin_route.get('/cancelOrder',auth.logOutSession,adminController.cancelOrder)

admin_route.get('/orderStatus',auth.logOutSession,adminController.orderStatus)

admin_route.get('/coupon',auth.logOutSession,adminController.loadCoupons)

admin_route.get('/addCoupon',auth.logOutSession,adminController.loadAddCoupon)

admin_route.post('/addCoupon',auth.logOutSession,adminController.addCoupon)

admin_route.get('/editCoupon',auth.logOutSession,adminController.loadEditCoupon)

admin_route.post('/editCoupon',auth.logOutSession,adminController.editCoupon)

admin_route.get('/deleteCoupon',auth.logOutSession,adminController.deleteCoupon)

admin_route.get('/salesReport',auth.logOutSession,adminController.loadSalesPage)

admin_route.get('/banner',auth.logOutSession,adminController.bannersPage)

admin_route.get('/addBanner',auth.logOutSession,adminController.loadAddBanner)

admin_route.post('/addBanner',auth.logOutSession,upload1.array('image',2),adminController.addBanner)

admin_route.get('/deleteBanner',auth.logOutSession,adminController.deleteBanner)

module.exports = admin_route