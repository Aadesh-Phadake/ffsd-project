const Listing = require('../models/listing');

module.exports.index = async (req, res) => {
    const listings = await Listing.find();
    res.render('listings/index.ejs', {listings: listings});
};

module.exports.new = async(req, res) => {
    res.render('listings/new.ejs');
};

module.exports.show = async (req, res) => { 
    const listing = await Listing.findById(req.params.id).populate({path: 'reviews', populate: {path: 'author'}}).populate('owner');
    if(!listing){
        req.flash('error', 'Hotel not found!');
        return res.redirect('/listings');
    }
    res.render('listings/show.ejs', {listing: listing});
};

module.exports.create  =async (req, res, next) => {
    if(!req.body)throw new expressError(400,'Send valid data.');
    const listing = new Listing(req.body);
    listing.owner = req.user._id;
    await listing.save();
    req.flash('success', 'Hotel listed successfully!');
    res.redirect(`/listings`);
};

module.exports.edit = async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if(!listing){
        req.flash('error', 'Hotel not found!');
        return res.redirect('/listings');
    }
    res.render('listings/edit.ejs', {listing: listing});
};

module.exports.update = async (req, res,next) => { 
    if(!req.body)throw new expressError(400,'Send valid data.');
    await Listing.findByIdAndUpdate(req.params.id, {...req.body});
    res.redirect(`/listings/${req.params.id}`);
};

module.exports.delete = async (req, res) => {
    let deletedListing = await Listing.findByIdAndDelete(req.params.id);
    req.flash('error', 'Hotel deleted successfully!');
    console.log(deletedListing);
    res.redirect(`/listings`);
}

