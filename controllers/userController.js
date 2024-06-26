const User = require('../models/userModel')
const productSchema = require('../models/productModel')
const cartSchema = require('../models/cartModel')
const orderSchema = require('../models/orderModel')
const categoryModel = require('../models/categoryModel')
const salesSchema = require('../models/salesReport')
const bcrypt = require('bcryptjs')
const nodemailer = require('nodemailer')
const couponSchema = require('../models/couponModel')
const bannerSchema = require('../models/bannerModel')
const paypal = require('paypal-rest-sdk');

require('dotenv').config();

const regex_password = /^(?=.*?[A-Z])(?=.*[a-z])(?=.*[0-9]){8,16}/gm
const regex_otp = /^(?=.*[0-9])/gm
const regex_mobile = /^\d{10}$/

let message
let msg
let orderStatus = 0
let paymentMethod
let index

paypal.configure({
    mode: 'sandbox',
    client_id: process.env.PAYPALCLIENT_ID,
    client_secret: process.env.PAYPALCLIENT_SCRT
});


//////////SECURE PASSWORD////////////

const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10)
        return passwordHash
    } catch (error) {
        console.log(error.message);
    }
}

///////////SEND EMAIL VERIFICATION////////

const sendVerifyMail = async (username, email, user_id) => {
    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: 'freshorgani@gmail.com',
                pass: process.env.EMAILPASS
            },
        });

        const mailOption = {
            from: 'freshorgani@gmail.com',
            to: email,
            subject: 'Email verification',
            html: `<p>Hii ${username}, Please click <a href="${process.env.SITEURL}/verify?id=${user_id}">here</a> to verify your email.</p>`,
        };

        transporter.sendMail(mailOption, (error, info) => {
            if (error) {
                console.log(error.message);
                console.log('Email could not be sent');
            } else {
                console.log('Email has been sent:', info.response);
            }
        });
    } catch (error) {
        console.log(error);
        console.log('Error occurred while sending email');
    }
};

/////////USER SIGNUP//////////

const userSignup = async (req, res, next) => {
    try {
        res.render('signUp', { message, msg })
        message = null
        msg = null
    } catch (error) {
        console.log(error.message);
        next(error.message)
    }
}


///////INSERT USERDATA//////////

const insertUser = async (req, res, next) => {
    const usd = req.body
    let user
    const checkMail = await User.findOne({ email: usd.email })
    const checkMob = await User.findOne({ phone: usd.phone })

    try {
        if (!usd.email && !usd.phone && !usd.password && !usd.username) {
            res.redirect('/signup')
            msg = 'Fill all the fields'
        } else if (!usd.username || usd.username.trim().length < 3) {
            res.redirect('/signup')
            msg = 'Enter valid name'
        } else if (!usd.email || usd.username.trim().length == 0) {
            res.redirect('/signup')
            msg = 'Enter email'
        } else if (checkMail) {
            res.redirect('/signup')
            msg = 'Email already exist'
        } else if (!usd.phone) {
            res.redirect('/signup')
            msg = 'Enter phone number'
        } else if (regex_mobile.test(usd.phone) == false) {
            res.redirect('/signup')
            msg = 'Enter valid phone number'
        } else if (checkMob) {
            res.redirect('/signup')
            msg = 'Phone number already exist'
        } else if (!usd.password) {
            res.redirect('/signup')
            msg = 'Enter password'
        } else if (regex_password.test(usd.password) == false) {
            res.redirect('/signup')
            msg = 'Password must contain atleast {8-16 characters,A-Z,a-z,0-9,!@#$%^&*()}'
        } else if (usd.password != usd.Rpassword) {
            res.redirect('/signup')
            msg = "Passwords Does not match"
        }
        else {
            const paswwordSec = await securePassword(usd.password)
            user = new User({
                username: usd.username,
                email: usd.email,
                phone: usd.phone,
                password: paswwordSec,
                is_admin: 0
            })
        }

        const userData = await user.save()

        if (userData) {
            sendVerifyMail(usd.username, usd.email, userData._id)
            res.redirect('/login')
            message = 'Registration successfull. Verify Email to Login'
        } else {
            res.redirect('/signup')
            msg = 'Registration failed'
        }

    } catch (error) {
        console.log(error.message);
        next(error.message)
    }
}

////////LOGIN USER///////

const loginUser = async (req, res, next) => {

    try {
        res.render('login', { message, msg })
        message = null
        msg = null
    } catch (error) {
        console.log(error.message);
        next(error.message)
    }
}

//////////LOGIN VERIFICATION///////////

const verifyLogin = async (req, res, next) => {
    try {
        if (req.body.email.trim().length == 0 || req.body.password.trim().length == 0) {
            res.redirect('/login')
            msg = 'Fields should not be Empty'
        } else {
            const email = req.body.email
            const password = req.body.password
            const userData = await User.findOne({ email: email })

            if (userData) {
                const passwordHash = await bcrypt.compare(password, userData.password)
                if (passwordHash) {
                    if (userData.is_verified == 1) {
                        if (userData.is_blocked == 0) {
                            req.session.user_id = userData._id;
                            res.redirect('/')
                        } else {
                            res.redirect('/login')
                            msg = 'Your account has been Blocked'
                        }
                    } else {
                        res.redirect('/login')
                        msg = 'Email not Verified'
                    }
                } else {
                    res.redirect('/login')
                    msg = 'Incorrect Password'
                }
            } else {
                res.redirect('/login')
                msg = 'User Not Found'
            }
        }

    } catch (error) {
        console.log(error.message);
        next(error.message)
    }
}

///////LOAD HOME PAGE////////

const loadHome = async (req, res, next) => {
    try {
        let session = req.session.user_id
        const products = await productSchema.find({ is_show: true }).sort({ _id: -1 })
        const banner = await bannerSchema.findOne()
        res.render('home', { product: products, session, msg, message, banner })
        msg = null
        message = null
    } catch (err) {
        console.log(err);
        next(err.message)
    }
}

//////////////////LOAD PRODUCT DETAILS PAGE//////////////

const productDetails = async (req, res, next) => {
    try {
        const id = req.query.id
        const session = req.session.user_id
        const product = await productSchema.findOne({ _id: new Object(id) })
        res.render('singleProduct', { product: product, session, message, msg })
        message = null
        msg = null
    } catch (error) {
        console.log(error);
        next(error.message)
    }
}

////////////LOAD USER PROFILE PAGE/////////

const userProfile = async (req, res, next) => {
    try {
        const session = req.session.user_id
        if (session) {
            const userData = await User.findOne({ _id: new Object(session) })
            if (orderStatus == 1) {
                const cart = await cartSchema.findOne({ userId: session }).populate('item.product')
                const user = await User.findOne({ _id: session })
                let address
                if (index != undefined) {
                    address = user.address[index]
                } else {
                    address = user.address[0]
                }
                const orderItems = cart.item.map((item) => {
                    return {
                        product: item.product._id,
                        price: item.price,
                        quantity: item.quantity,
                    }
                })
                const generateOrderId = () => {
                    const date = new Date();
                    const year = date.getFullYear().toString().substring(2, 4);
                    const month = ("0" + (date.getMonth() + 1)).slice(-2);
                    const day = ("0" + date.getDate()).slice(-2);
                    const randomStr = Math.random().toString(36).substring(7).toUpperCase();
                    const num = Math.floor(Math.random() * 90 + 10);

                    const orderId = `OrgFr-${year}${month}${day}-${randomStr}${num}`;
                    return orderId;
                }
                const orderId = generateOrderId();
                const generatePaymentId = () => {
                    const randomStr = Math.random().toString(36).substring(7).toUpperCase();
                    const randomStr1 = Math.random().toString(25).substring(2).toUpperCase();
                    const num = Math.floor(Math.random() * 90 + 10);
                    const num1 = Math.floor(Math.random() * 250 + 10);
                    const orderId = `${randomStr1}${num1}-${randomStr}${num}`;
                    return orderId;
                }
                const paymentId = generatePaymentId();
                const latestOrder = await orderSchema.findOne().sort('-orderCount').exec()
                const order = new orderSchema({
                    userId: session,
                    item: orderItems,
                    address: address,
                    totalPrice: req.session.payMoney,
                    orderCount: latestOrder ? latestOrder.orderCount + 1 : 1,
                    start_date: new Date().toLocaleDateString('en-GB'),
                    paymentType: paymentMethod,
                    orderId: orderId,
                    paymentId: paymentId
                })
                await order.save()
                const orderData = await orderSchema.findOne({ userId: session }).sort({ _id: -1 }).populate('item.product')
                orderData.item.forEach(async (item) => {
                    const productid = item.product._id
                    const quantity = item.quantity
                    const pinc = await productSchema.updateOne({ _id: productid }, { $inc: { stocks: -quantity } })
                })
                await cartSchema.deleteMany({ userId: session })
                orderStatus = 0
            }
            const orders = await orderSchema.find({ $and: [{ userId: session }, { user_cancelled: false }, { admin_cancelled: false }, { is_delivered: false }] }).populate('item.product')
            res.render('userProfile', { userData, session, message, orders, msg })
            msg = null
            message = null
        } else {
            msg = 'Login To Access'
            res.redirect('/login')
        }
    } catch (error) {
        console.log(error);
        next(error.message)
    }
}

//////LOAD USER EDIT PROFILE///////////////

const loadEditProfile = async (req, res, next) => {
    try {
        const session = req.session.user_id
        const userData = await User.findOne({ _id: new Object(session) })
        const index2 = req.query.index
        let addressCount = userData.address[index2]
        res.render('editProfile', { userData, session, msg, addressCount, index2, message })
        message = null
        msg = null
    } catch (error) {
        console.log(error);
        next(error.message)
    }
}


/////////EDIT PROFILE/////////

const editProfile = async (req, res, next) => {
    try {
        const data = req.body;
        const id = req.session.user_id
        const index2 = req.query.index
        const key = `address.${index2}`
        if (req.file) {
            await User.updateOne({ _id: new Object(id) }, { $set: { image: req.file.filename } })
        }

        if (!data.username && !data.address && !data.city && !data.district && !data.state && !data.country) {
            res.redirect('/editProfile')
            msg = 'Fill all the fields'
        } else if (!data.username || data.username.trim().length < 3) {
            res.redirect('/editProfile')
            msg = 'Enter valid name'
        } else if (!data.address || data.address.trim().length < 3) {
            res.redirect('/editProfile')
            msg = 'Enter Valid Address'
        } else if (!data.city || data.city.trim().length < 3) {
            res.redirect('/editProfile')
            msg = 'Enter Valid City'
        } else if (!data.district || data.district.trim().length < 3) {
            res.redirect('/editProfile')
            msg = 'Enter Valid District'
        } else if (!data.state || data.state.trim().length < 3) {
            res.redirect('/editProfile')
            msg = 'Enter Valid State'
        } else if (!data.country || data.country.trim().length < 3) {
            res.redirect('/editProfile')
            msg = 'Enter Valid Country'
        } else if (regex_mobile.test(data.phone) == false) {
            res.redirect('/editProfile')
            msg = 'Enter valid phone number'
        }
        else {

            if (index2) {
                const editaddress = {
                    address: data.address,
                    city: data.city,
                    district: data.district,
                    state: data.state,
                    country: data.country
                }
                if (data.address && data.city && data.district && data.state && data.country) {
                    await User.updateOne({ _id: new Object(id) }, { $set: { [key]: editaddress } })
                    await User.updateOne({ _id: new Object(id) }, { $set: { username: data.username, email: data.email, phone: data.phone } })
                    res.redirect('/userProfile')
                    message = 'Profile Updated'
                } else {
                    res.redirect('/editProfile')
                    msg = 'Fields Should Not Empty'
                }
            } else {
                if (data.address && data.city && data.district && data.state && data.country) {
                    await User.updateOne({ _id: new Object(id) }, {
                        $set: {
                            'address.0': {
                                address: data.address,
                                city: data.city,
                                district: data.district,
                                state: data.state,
                                country: data.country
                            }
                        }
                    })
                    await User.updateOne({ _id: new Object(id) }, { $set: { username: data.username, email: data.email, phone: data.phone } })
                    res.redirect('/userProfile')
                    message = 'Profile Updated'
                } else {
                    res.redirect('/editProfile')
                    msg = 'Fill all the fields'
                }
            }

        }
    } catch (error) {
        console.log(error);
        next(error.message)
    }
}


/////////////LOAD CHANGE PASSWORD///////////

const loadChangePassword = async (req, res, next) => {
    try {
        res.render('changePassword', { msg })
        msg = null
    } catch (error) {
        console.log(error);
        next(error.message)
    }
}


/////////////CHANGE PASSWORD////////////

const changePassword = async (req, res, next) => {
    try {
        const newPassword = req.body.newPassword
        const rePassword = req.body.Repassword
        const id = req.session.user_id
        const password = await User.findOne({ _id: new Object(id) })
        const passwordHash = await bcrypt.compare(req.body.oldPassword, password.password)
        if (passwordHash) {
            if (regex_password.test(newPassword) == false) {
                msg = 'Password must contain atleast {8-16 characters,A-Z,a-z,0-9,!@#$%^&*()}'
                res.redirect('/changePassword')
            } else {
                if (newPassword == rePassword) {
                    const paswwordSec = await securePassword(newPassword)
                    await User.updateOne({ _id: new Object(id) }, { password: paswwordSec })
                    res.redirect('/userProfile')
                    message = 'Password Changed successfully'
                } else {
                    res.redirect('/changePassword')
                    msg = 'Password does not match!'
                }
            }
        } else {
            msg = 'Current password is Incorrect!'
            res.redirect('/changePassword')
        }
    } catch (error) {
        console.log(error);
        next(error.message)
    }
}


///////////LOGOUT///////////////

const logOut = async (req, res) => {
    req.session.user_id = null
    res.redirect('/login')
}

///////////ADMIN BLOCKED/////////////

const logOutIn = async (req, res) => {
    req.session.user_id = null
    res.redirect('/admin/userData')
}

/////////EMAIL VERIFICATION////////////

const verifyMail = async (req, res, next) => {
    try {
        await User.updateOne({ _id: req.query.id }, { $set: { is_verified: 1 } })
        res.render('emailVerified')
    } catch (error) {
        console.log(error.message);
        next(error.message)
    }
}


////////OTP LOGIN///////

const otpLogin = async (req, res, next) => {
    try {
        res.render('otpLogin', { message, msg })
        message = null
        msg = null
    } catch (error) {
        console.log(error.message);
        next(error.message)
    }
}

////////OTP PAGE///////

const otppage = async (req, res, next) => {
    try {
        res.render('otpPage', { message, msg })
        message = null
        msg = null
    } catch (error) {
        console.log(error.message);
        next(error.message)
    }
}

//////////OTP GENERATION///////////

function otpgen() {
    OTP = Math.random() * 1000000
    OTP = Math.floor(OTP)
    return OTP
}
let otp

//////////OTP EMAIL ///////////

let otpChechMail
const verifyotpMail = async (req, res, next) => {
    try {
        if (req.body.email.trim().length == 0) {
            res.redirect('/otpLogin')
            msg = 'Please fill the form'
        } else {
            otpChechMail = req.body.email
            const userData = await User.findOne({ email: otpChechMail })
            if (userData) {
                if (otpChechMail) {
                    if (userData.is_verified == 1) {
                        if (userData.is_blocked == 0) {
                            res.redirect('/otpPage')
                            const mailtransport = nodemailer.createTransport({
                                host: 'smtp.gmail.com',
                                port: 465,
                                secure: true,
                                auth: {
                                    user: 'freshorgani@gmail.com',
                                    pass: process.env.EMAILPASS
                                },
                            });

                            otp = otpgen()
                            let details = {
                                from: "freshorgani@gmail.com",
                                to: otpChechMail,
                                subject: "Login OTP",
                                text: otp + " is your Organi Fresh verification code. Do not share OTP with anyone "
                            }
                            mailtransport.sendMail(details, (err) => {
                                if (err) {
                                    console.log(err);
                                } else {
                                    console.log("success");
                                }
                            })

                        } else {
                            res.redirect('/otpLogin')
                            msg = 'Your account has been blocked'
                        }
                    } else {
                        res.redirect('/otpLogin')
                        msg = 'Email not Verified'
                    }
                }
            } else {
                res.redirect('/otpLogin')
                msg = 'User not Found'
            }
        }

    } catch (error) {
        console.log(error.message);
        next(error.message)
    }
}

///////OTP PAGE VERIFY////////

const otpVerify = async (req, res, next) => {
    try {
        if (req.body.otp.trim().length == 0) {
            res.redirect('/otpPage')
            msg = 'Enter OTP'
        } else {
            const OTP = req.body.otp
            if (regex_otp.test(OTP) == false) {
                res.redirect('/otpPage')
                msg = 'Invalid OTP'
            } else if (otp == OTP) {
                const userData = await User.findOne({ email: otpChechMail })
                req.session.user_id = userData._id;
                res.redirect('/')
            } else {
                res.redirect('/otpPage')
                msg = 'Incorrect OTP'
            }
        }
    } catch (error) {
        next(error.message)
        console.log(error.message);
    }
}

//////LOAD CART PAGE///////

const loadCart = async (req, res, next) => {
    try {
        const session = req.session.user_id
        const cartProducts = await cartSchema.findOne({ userId: session }).populate('item.product')
        let totalPrice = 0
        if (cartProducts && cartProducts.item != null) {
            cartProducts.item.forEach(value => {
                totalPrice += value.price * value.quantity
            });
        }
        await cartSchema.updateOne({ userId: session }, { $set: { totalPrice: totalPrice } })
        res.render('cart', { session, cartProducts, totalPrice, msg, message })
        msg = null
        message = null
    } catch (error) {
        console.log(error);
        next(error.message)
    }
}

///////////ADD TO CART///////////

const addToCart = async (req, res, next) => {
    try {
        const product_Id = req.query.id
        const user_Id = req.session.user_id

        const product = await productSchema.findOne({ _id: new Object(product_Id) })
        const userCart = await cartSchema.findOne({ userId: user_Id });
        const cartCount = await cartSchema.findOne({ userId: user_Id, "item.product": product_Id })
        const wishList = await User.findOne({ _id: user_Id })

        if (userCart) {
            const itemIndex = userCart.item.findIndex(item => item.product._id.toString() === product_Id);
            if (itemIndex >= 0) {
                if (cartCount) {
                    const item = cartCount.item.find(item => item.product.toString() === product_Id)
                    if (item) {
                        if (item.quantity >= product.stocks) {
                            const referer = req.headers.referer || "/";
                            res.redirect(referer);
                            msg = 'Product out of stock'
                        } else {
                            await cartSchema.updateOne({ userId: user_Id, "item.product": product_Id }, { $inc: { "item.$.quantity": 1 } });
                        }
                    }
                }
            } else {
                if (product.stocks < 1) {
                    const referer = req.headers.referer || "/";
                    res.redirect(referer);
                    msg = 'Product out of stock'
                } else {

                    await cartSchema.updateOne(
                        { userId: user_Id },
                        { $push: { item: { product: product_Id, price: product.price, quantity: 1 } } }
                    );
                    if (wishList.wishlist.includes(product_Id)) {
                        wishList.wishlist.pull(product_Id);
                        await wishList.save();
                    }
                }
            }
        } else {
            if (product.stocks < 1) {
                const referer = req.headers.referer || "/";
                res.redirect(referer);
                msg = 'Product out of stock'
            } else {
                await cartSchema.insertMany({ userId: user_Id, item: [{ product: product_Id, price: product.price, quantity: 1 }] });
                if (wishList.wishlist.includes(product_Id)) {
                    await User.updateOne({ _id: user_Id }, { $unset: { wishlist: product_Id } })
                }
            }
        }

        const referer = req.headers.referer || "/";
        res.redirect(referer);
        message = 'Added To Cart'

    } catch (error) {
        console.log(error);
        next(error.message)
    }
}


///////////INCREMENT CART//////////

const incrementCart = async (req, res, next) => {
    try {
        const userId = req.session.user_id;
        const itemid = req.query.id;
        const cartCount = await cartSchema.findOne({ 'item._id': itemid })
        const item = cartCount.item.find(item => item._id.toString() === itemid)
        const product = await productSchema.findOne({ _id: item.product })
        if (item) {
            if (item.quantity >= product.stocks) {
                msg = 'Item out of stock'
                res.redirect('/cart');
            } else {
                await cartSchema.updateOne({ userId: userId, "item._id": itemid }, { $inc: { "item.$.quantity": 1 } });
                let total = 0
                const cart = await cartSchema.findOne({ userId: userId, "item._id": itemid })

                cart.item.forEach(value => {
                    total += value.price * value.quantity
                })
                await cartSchema.updateOne({ userId: userId }, { $set: { totalPrice: total } })

                const carts = await cartSchema.findOne({ userId: userId, "item._id": itemid })

                const q = carts.item.filter((value) => {
                    return value._id == itemid
                })
                const quantity = q[0].quantity
                const price = quantity * q[0].price
                const totalPrice = carts.totalPrice
                res.json({ quantity: quantity, price: price, totalPrice: totalPrice })
            }
        }

    } catch (error) {
        console.log(error);
        next(error.message)
    }
};

//////DECREMENT CART////////

const decrementCart = async (req, res, next) => {
    try {
        const userId = req.session.user_id;
        const itemid = req.query.id;
        const cart = await cartSchema.findOne({ userId: userId, "item._id": itemid });
        const currentItem = cart.item.find(item => item._id.toString() === itemid);
        if (currentItem.quantity <= 1) {
            res.redirect('/cart');
            return;
        } else {
            await cartSchema.updateOne({ userId: userId, "item._id": itemid, }, { $inc: { "item.$.quantity": -1 } });
            let total = 0
            const cart = await cartSchema.findOne({ userId: userId, "item._id": itemid })

            cart.item.forEach(value => {
                total += value.price * value.quantity
            })
            await cartSchema.updateOne({ userId: userId }, { $set: { totalPrice: total } })

            const carts = await cartSchema.findOne({ userId: userId, "item._id": itemid })

            const q = carts.item.filter((value) => {
                return value._id == itemid
            })
            const quantity = q[0].quantity
            const price = quantity * q[0].price
            const totalPrice = carts.totalPrice
            res.json({ quantity: quantity, price: price, totalPrice: totalPrice })
        }
    } catch (error) {
        console.log(error);
        next(error.message)
    }
}
//////REMOVE FROM CART////////

const removeCart = async (req, res, next) => {
    try {
        const id = req.query.id
        const userId = req.session.user_id
        await cartSchema.updateOne({ userId: new Object(userId) }, { $pull: { item: { _id: new Object(id) } } })
        msg = 'Removed From Cart'
        res.redirect('/cart')
    } catch (error) {
        console.log(error);
        next(error.message)
    }
}

///////LOAD ADD NEW ADDRESS/////////////

const addAddress = async (req, res, next) => {
    try {
        const session = req.session.user_id
        res.render('newAddress', { session, message, msg })
        msg = null
        message = null
    } catch (error) {
        console.log(error.message);
        next(error.message)
    }
}


/////// ADD NEW ADDRESS////////

const addNewAddress = async (req, res, next) => {
    try {
        const id = req.session.user_id
        const data = req.body
        if (data.address.trim().length > 3 && data.city.trim().length > 3 && data.district.trim().length > 3 && data.state.trim().length > 3 && data.country.trim().length > 3) {
            const userData = await User.findOne({ _id: new Object(id) })
            userData.address.push(data)
            await userData.save()

            res.redirect('/addAddress')
            message = 'Address Added '
        } else {
            res.redirect('/addAddress')
            msg = 'Fields Should Not Be Empty or Enter valid data'
        }
    } catch (error) {
        console.log(error.message);
        next(error.message)
    }
}

//////LOAD CHECK OUT PAGE///////////

const loadChekOut = async (req, res, next) => {
    try {

        index = req.query.index
        const id = req.session.user_id
        const session = req.session.user_id
        const cart = await cartSchema.findOne({ userId: session }).populate('item.product')
        const user = await User.findOne({ _id: session })
        const coupons = await couponSchema.find()
        const addressCount = user.address[index]
        if (cart != null) {
            if (cart.item != 0) {
                res.render('checkOut', { session, cart, user, addressCount, coupons })
            } else {
                res.redirect('/cart')
                msg = "Your cart is empty"
            }
        } else {
            res.redirect('/cart')
            msg = "Your cart is empty"
        }
    } catch (error) {
        console.log(error);
        next(error.message)
    }

}


////////LOAD PLACE ORDER PAGE///////////

const loadPlaceOrder = async (req, res, next) => {
    try {
        const session = req.session.user_id
        let Total
        const pro = await cartSchema.findOne({ userId: session }, { _id: 0 })
        const user = await User.findOne({ _id: session })
        const wallet = user.wallet
        let walletPay = false
        if (pro.couponDiscount) {
            Total = parseInt(pro.totalPrice) - pro.couponDiscount
            if (user.wallet) {
                if (user.wallet >= Total) {
                    walletPay = true
                    Total = 0
                } else {
                    Total = Total - user.wallet
                }
            }

        } else {
            Total = parseInt(pro.totalPrice)
            if (user.wallet) {
                if (user.wallet >= Total) {
                    walletPay = true
                    Total = 0
                } else {
                    Total = Total - user.wallet
                }
            }

        }
        res.render('placeOrder', { Total, session, msg, message, pro, wallet, walletPay })
        msg = null
        message = null
    } catch (error) {
        console.log(error.mesage);
        next(error.message)
    }
}

////////ORDER CONFIRM PAGE//////

const orderConfirm = async (req, res, next) => {

    try {
        const session = req.session.user_id
        const payment = req.body
        paymentMethod = payment.flexRadioDefault
        const cart = await cartSchema.findOne({ userId: session })
        const user = await User.findOne({ _id: session })
        let payMoney = cart.couponDiscount ? parseInt(cart.totalPrice) - cart.couponDiscount : parseInt(cart.totalPrice)

        req.session.payMoney = payMoney
        if (payment.flexRadioDefault == 'Cash On Delivery') {
            if (user.wallet) {
                if (user.wallet >= payMoney) {
                    await User.findByIdAndUpdate({ _id: session }, { $inc: { wallet: -payMoney } })
                } else {
                    await User.findByIdAndUpdate({ _id: session }, { $set: { wallet: 0 } })
                }
            }
            orderStatus = 1
            res.redirect('/userProfile')
            message = 'Order Placed'
        } else if (payment.flexRadioDefault == 'Wallet') {
            if (user.wallet) {
                if (user.wallet >= payMoney) {
                    await User.findByIdAndUpdate({ _id: session }, { $inc: { wallet: -payMoney } })
                } else {
                    await User.findByIdAndUpdate({ _id: session }, { $set: { wallet: 0 } })
                }
            }
            orderStatus = 1
            res.redirect('/userProfile')
            message = 'Order Placed'
        } else if (payment.flexRadioDefault == 'Online') {
            if (user.wallet) {
                payMoney = payMoney - user.wallet
            }
            const currencyMap = {
                840: "USD",
                978: "EUR",
                826: "GBP",
            };
            const currencyCode = currencyMap["840"];

            const amount = {
                currency: currencyCode,
                total: payMoney,
            };


            const create_payment_json = {
                intent: "sale",
                payer: {
                    payment_method: "paypal",
                },
                redirect_urls: {
                    return_url: process.env.SITEURL + "/success",
                    cancel_url: process.env.SITEURL + "/checkout",
                },
                transactions: [
                    {
                        amount,
                        description: "Washing Bar soap",
                    },
                ],
            };

            paypal.payment.create(create_payment_json, function (error, payment) {
                if (error) {
                    throw error;
                } else {
                    for (let i = 0; i < payment.links.length; i++) {
                        if (payment.links[i].rel === "approval_url") {
                            res.redirect(payment.links[i].href);
                        }
                    }
                }
            });

        } else {
            res.redirect('/placeOrder')
            msg = 'Please select any payment option'
        }
    } catch (error) {
        console.log(error);
        next(error.message)
    }

}


///////////////CONFIRM PAYMENT////////////////

const confirmPayment = async (req, res, next) => {
    const payerId = req.query.PayerID;
    const paymentId = req.query.paymentId;
    const session = req.session.user_id
    const cart = await cartSchema.findOne({ userId: session })
    const user = await User.findOne({ _id: session })
    if (user.wallet) {
        if (user.wallet >= req.session.payMoney) {
            await User.findByIdAndUpdate({ _id: session }, { $inc: { wallet: req.session.payMoney } })
        } else {
            await User.findByIdAndUpdate({ _id: session }, { $set: { wallet: 0 } })
        }
    }
    const execute_payment_json = {
        payer_id: payerId,
        transactions: [
            {
                amount: {
                    currency: "USD",
                    total: req.session.payMoney,
                },
            },
        ],
    };

    paypal.payment.execute(
        paymentId,
        execute_payment_json,
        function (error, payment) {
            if (error) {
                console.log(error.response);
                throw error;
            } else {
                orderStatus = 1;
                res.redirect("/userProfile");
                message = 'Order Placed'
            }
        }
    );
};



//////SHOW ORDERS///////////

const showOrders = async (req, res, next) => {
    try {
        const session = req.session.user_id
        const orderId = req.query.orderid
        const order = await orderSchema.findOne({ _id: orderId }).populate('userId').populate('item.product')
        res.render('orders', { session, order })
    } catch (error) {
        console.log(error.message);
        next(error.message)
    }
}


///////////SHOW ORDER HISTORY////////////

const loadOrderHistory = async (req, res, next) => {
    try {

        const session = req.session.user_id
        const orders = await orderSchema.find({ userId: session }).populate('userId').populate('item.product')
        let proCount
        orders.forEach((order) => {
            proCount = 0
            if (order.is_delivered == true) {
                order.status = 'Delivered'
            } else if (order.user_cancelled == true) {
                order.status = 'Cancelled'
            } else if (order.admin_cancelled == true) {
                order.status = 'Admin Cancelled'
            } else {
                order.status = 'On the way'
            }

            order.item.forEach((item) => {
                proCount += item.quantity
            })
            order.proCount = proCount

        })
        if (orders) {
            res.render('orderHistory', { session, orders, proCount, message })
            message = null
        } else {
            res.redirect('/userProfile')
            msg = 'No Orders found'
        }

    } catch (error) {
        console.log(error.message);
        next(error.message)
    }
}


//////CANCEL ORDERS/////////

const cancelOrder = async (req, res, next) => {
    try {
        const orderId = req.query.orderid
        const session = req.session.user_id
        const orders = await orderSchema.findOne({ _id: orderId }).populate('item.product')
        const user = await User.findOne({ _id: session })
        await orderSchema.updateOne({ _id: orderId }, { $set: { user_cancelled: true } })
        if (orders.paymentType == 'Online' || orders.paymentType == 'Wallet') {
            if (user.wallet) {
                await User.findByIdAndUpdate({ _id: session }, { $inc: { wallet: orders.totalPrice } })
            } else {
                await User.findByIdAndUpdate({ _id: session }, { $set: { wallet: orders.totalPrice } })
            }
        }
        orders.item.forEach(async (item) => {
            const productId = item.product._id
            const quantity = item.quantity
            await productSchema.updateOne({ _id: productId }, { $inc: { stocks: quantity } })
        });
        res.redirect('/userProfile')
        message = 'Order Cancelled'
    } catch (error) {
        console.log(error.message);
        next(error.message)
    }
}


///////////RETURN ORDER//////////////

const returnOrder = async (req, res, next) => {
    try {
        const orderId = req.query.id
        const userId = req.session.user_id
        const order = await orderSchema.findOne({ _id: orderId })
        const sale = await salesSchema.find({ orders: orderId })
        const user = await User.findOne({ _id: userId })
        const Price = order.totalPrice
        if (user.wallet) {
            await User.findByIdAndUpdate({ _id: userId }, { $inc: { wallet: Price } })
        } else {
            await User.findByIdAndUpdate({ _id: userId }, { $set: { wallet: Price } })
        }
        await salesSchema.deleteOne({ orders: orderId })
        await orderSchema.findByIdAndDelete({ _id: orderId })

        res.redirect("/orderHistory")
        message = 'Order Returned'

    } catch (error) {
        console.log(error.message);
        next(error.message)
    }
}


////////LOAD SELECT ADDRESS PAGE////////////

const loadSelectAddress = async (req, res, next) => {
    try {
        const session = req.session.user_id
        const user = await User.findOne({ _id: session })
        res.render('selectAddress', { session, user, msg, message })
        message = null
        msg = null
    } catch (error) {
        console.log(error.message);
        next(error.message)
    }
}

/////////LOAD MORE ADDRESS PAGE////////

const loadMoreAddress = async (req, res, next) => {
    try {
        const session = req.session.user_id
        const user = await User.findOne({ _id: session })
        res.render('moreAddress', { session, user, message, msg })
        message = null
        msg = null
    } catch (error) {
        console.log(error.message);
        next(error.message)
    }
}

///////////LOAD WISHLIST//////////////

const loadWishList = async (req, res, next) => {
    try {
        const session = req.session.user_id
        const wishlist = await User.findOne({ _id: session }).populate('wishlist')
        res.render('wishList', { session, wishlist, message, msg })
        message = null
        msg = null
    } catch (error) {
        console.log(error.message);
        next(error.message)
    }
}

//////////ADD TO WISHLIST////////////

const addToWishlist = async (req, res, next) => {
    try {
        const session = req.session.user_id
        const productId = req.query.id
        const user = await User.findOne({ _id: session })
        const cart = await cartSchema.findOne({ userId: session, "item.product": productId })
        if (cart) {
            msg = 'Product already in cart'
            const referer = req.headers.referer || "/";
            res.redirect(referer);
        } else {
            if (!user.wishlist.includes(productId)) {
                user.wishlist.push(productId)
                await user.save()
                const referer = req.headers.referer || "/";
                res.redirect(referer);
                message = 'Added To Wishlist'
            } else {
                const referer = req.headers.referer || "/";
                res.redirect(referer);
                msg = 'Product already in Wishlist'
            }
        }
    } catch (error) {
        console.log(error.message);
        next(error.message)
    }
}


/////////////REMOVE FROM WISHLIST//////

const removeWishlist = async (req, res, next) => {
    try {
        const session = req.session.user_id
        const product = req.query.id
        const del = await User.findOne({ _id: session })
        del.wishlist.pull(product);
        await del.save();
        res.redirect('/wishlist')
    } catch (error) {
        console.log(error.message);
        next(error.message)
    }
}

////////////LOAD SHOP PAGE/////////////

const loadShopPage = async (req, res, next) => {
    try {
        let page = 1
        if (req.query.page) {
            page = req.query.page
        }
        const session = req.session.user_id
        const count = await productSchema.find({ is_show: true }).countDocuments()
        const product = await productSchema.find({ is_show: true }).limit(20).skip((page - 1) * 20).exec()
        const category = await categoryModel.find()
        res.render('shopPage', { session, product, category, message, msg, totalPages: Math.ceil(count / 20) })
        message = null
        msg = null
    } catch (error) {
        console.log(error.message);
        next(error.message)
    }
}

///////////LOAD SHIPPING POLICY//////////

const loadShipping = async (req, res, next) => {
    try {
        const session = req.session.user_id
        res.render('shippingPolicy', { session })
    } catch (error) {
        console.log(error.message);
        next(error)
    }
}


///////////LOAD TERMS AND CONDITIONS//////////

const loadReturns = async (req, res, next) => {
    try {
        const session = req.session.user_id
        res.render('termsConditions', { session })
    } catch (error) {
        console.log(error.message);
        next(error)
    }
}


///////////LOAD PRIVACY POLICY//////////

const loadPrivacy = async (req, res, next) => {
    try {
        const session = req.session.user_id
        res.render('privacyPolicy', { session })
    } catch (error) {
        console.log(error.message);
        next(error)
    }
}

///////////COUPON USING//////////

const addCoupon = async (req, res, next) => {
    try {
        let amount
        const code = req.body.coupon
        const session = req.session.user_id
        const cart = await cartSchema.findOne({ userId: session }, { totalPrice: 1 })
        const coupon = await couponSchema.findOne({ couponCode: code })

        if (coupon) {
            if (cart.totalPrice > coupon.minPurchase) {
                const today = new Date()

                if (coupon.endDate > today) {
                    const userFind = await couponSchema.findOne({ couponCode: code, userId: session })
                    if (!userFind) {
                        const discount = 10

                        const discountPrice = Math.min(coupon.maxDiscount, (parseInt(cart.totalPrice) * discount) / 100)
                        amount = parseInt(cart.totalPrice) - discountPrice
                        await cartSchema.updateOne({ userId: session }, { $set: { couponDiscount: discountPrice } })
                        await couponSchema.updateOne({ couponCode: code }, { $push: { userId: session } })
                        res.json({ status: true, discountPrice, amount })
                    } else {
                        res.json({ used: true })
                    }
                } else {
                    res.json({ expired: true })
                }
            } else {

                res.json({ lessPrice: true })
            }
        } else {
            res.json({ noMatch: true })
        }


    } catch (error) {
        console.log(error.message);
        next(error.message)
    }
}


////LOAD CONTACT PAGE////////////

const loadContactPage = async (req, res) => {
    try {
        const session = req.session.user_id
        res.render('contactPage', { session, message, msg })
        message = null
        msg = null
    } catch (error) {
        console.log(error.message);
    }
}


//////SEND MESSAGE//////////

const sendMessage = async (req, res) => {
    try {
        let messageBody = req.body
        if (req.body.name.trim().length == 0 || req.body.email.trim().length == 0 || req.body.subject.trim().length == 0 || req.body.subject.trim().length == 0) {
            res.redirect('/contactPage')
            msg = 'Please fill the fields'
        } else {
            if (messageBody) {

                const mailtransport = nodemailer.createTransport({
                    host: 'smtp.gmail.com',
                    port: 465,
                    secure: true,
                    auth: {
                        user: 'freshorgani@gmail.com',
                        pass: process.env.EMAILPASS
                    },
                });
                let details = {
                    from: messageBody.email,
                    to: "freshorgani@gmail.com",
                    subject: "Organi Fresh Messages",
                    text: `
Name: ${messageBody.name}
Email: ${messageBody.email}
Subject: ${messageBody.subject}
Message: ${messageBody.message}`
                }
                mailtransport.sendMail(details, (err) => {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log("success");
                    }
                })
            }
            res.redirect('/contactPage')
            message = 'Message Sent'
        }

    } catch (error) {
        console.log(error.message);
    }
}


//////PRODUCT FILTER///////////

const productFilter = async (req, res, next) => {
    try {

        let product
        let products = []
        let Categorys
        let Data = []

        const { categorys, search, filterprice } = req.body


        if (!search) {
            if (filterprice != 0) {
                if (filterprice.length == 2) {
                    product = await productSchema.find({
                        is_show: true,
                        $and: [
                            { price: { $lte: Number(filterprice[1]) } },
                            { price: { $gte: Number(filterprice[0]) } }
                        ]

                    }).populate('category')
                } else {
                    product = await productSchema.find({
                        is_show: true,
                        $and: [
                            { price: { $gte: Number(filterprice[0]) } }
                        ]

                    }).populate('category')
                }
            } else {
                product = await productSchema.find({ is_show: true }).populate('category')
            }

        } else {

            if (filterprice != 0) {
                if (filterprice.length == 2) {
                    product = await productSchema.find({
                        is_show: true,
                        $and: [
                            { price: { $lte: Number(filterprice[1]) } },
                            { price: { $gte: Number(filterprice[0]) } },
                            {
                                $or: [
                                    { brand: { $regex: '.*' + search + '.*', $options: 'i' } },
                                    { title: { $regex: '.*' + search + '.*', $options: 'i' } }
                                ]
                            }
                        ]

                    }).populate('category')
                } else {
                    product = await productSchema.find({
                        is_show: true,
                        $and: [
                            { price: { $gte: Number(filterprice[0]) } },
                            {
                                $or: [
                                    { brand: { $regex: '.*' + search + '.*', $options: 'i' } },
                                    { title: { $regex: '.*' + search + '.*', $options: 'i' } }
                                ]
                            }
                        ]

                    }).populate('category')
                }
            } else {
                product = await productSchema.find({
                    is_show: true,
                    $or: [
                        { brand: { $regex: '.*' + search + '.*', $options: 'i' } },
                        { title: { $regex: '.*' + search + '.*', $options: 'i' } }
                    ]
                }).populate('category')
            }


        }

        Categorys = categorys.filter((value) => {
            return value !== null
        })
        if (Categorys[0]) {

            Categorys.forEach((element, i) => {
                products[i] = product.filter((value) => {
                    return value.category.category == element
                })
            });
            products.forEach((value, i) => {
                Data[i] = value.filter((v) => {
                    return v
                })
            })
        } else {
            Data[0] = product
        }
        res.json({ Data })
    } catch (error) {
        console.log(error.message);
        next(error.message)
    }
}

module.exports = {
    userSignup,
    insertUser,
    verifyMail,
    loginUser,
    verifyLogin,
    loadHome,
    logOut,
    logOutIn,
    otpLogin,
    verifyotpMail,
    otppage,
    otpVerify,
    productDetails,
    userProfile,
    loadEditProfile,
    editProfile,
    loadChangePassword,
    changePassword,
    loadCart,
    addToCart,
    incrementCart,
    decrementCart,
    removeCart,
    loadChekOut,
    addAddress,
    addNewAddress,
    loadPlaceOrder,
    orderConfirm,
    showOrders,
    cancelOrder,
    loadSelectAddress,
    loadMoreAddress,
    loadShopPage,
    loadWishList,
    addToWishlist,
    productFilter,
    removeWishlist,
    loadContactPage,
    sendMessage,
    addCoupon,
    confirmPayment,
    loadShipping,
    loadReturns,
    loadPrivacy,
    loadOrderHistory,
    returnOrder
}