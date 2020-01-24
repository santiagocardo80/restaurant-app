const Review = require('../models/Review')
const uuid = require('uuid')

exports.addReview = async (req, res) => {
  req.body.author = req.user._id
  req.body.store = req.params.id
  const newReview = await Review.create(req.body)
  req.flash('success', 'Review Saved!')
  res.redirect('back')
}