const joi=require('joi');

module.exports.listingSchema=joi.object({
    title:joi.string().required(),
    description:joi.string().required(),
    images:joi.array().items(joi.string().allow("",null)).max(20),
    price:joi.number().required().min(0),
    location:joi.string().required(),
    country:joi.string().required()
}).required();

module.exports.reviewSchema=joi.object({
    comment:joi.string().required(),
    rating:joi.number().required().min(1).max(5)
}).required();