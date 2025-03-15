const User = require('../models/user');

module.exports.renderSignup = (req, res) => {
    res.render('users/signup');
};

module.exports.signup = async (req, res) => {
    try{
    let {username, email, password} = req.body;
    let user = new User({username, email});
    let registeredUser = await User.register(user, password);
    req.login(registeredUser, err => {
        if(err) return next(err);
        req.flash('success', 'Welcome to TravelNest!');
        res.redirect('/listings');
    });
    
    } catch(e){
        req.flash('error', e.message);
        res.redirect('/signup');
    }
};

module.exports.renderLogin = (req, res) => {
    res.render('users/login');
};

module.exports.login = async (req, res) => {
    req.flash('success', 'Welcome back to TravelNest!');
    res.redirect(res.locals.redirectUrl || '/listings');
};

module.exports.logout = (req, res,next) => {
    req.logout((err)=>{
        if(err) return next(err);
    });
    req.flash('success', 'Logged out successfully!');
    res.redirect('/listings');
};