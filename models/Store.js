const mongoose = require('mongoose')
mongoose.Promise = global.Promise
const slug = require('slugs')

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    required: 'Please enter a store name'
  },
  slug: String,
  description: {
    type: String,
    trim: true
  },
  tags: [String],
  created: {
    type: Date,
    default: Date.now
  },
  location: {
    type: {
      type: String,
      default: 'Point'
    },
    coordinates: [{
      type: Number,
      required: 'You must supply coordinates!'
    }],
    address: {
      type: String,
      required: 'You must supply an address!'
    }
  },
  photo: String,
  author: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: 'You must supply an author'
  }
},
{
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Define our indexes
storeSchema.index({
  name: 'text',
  description: 'text',
})

storeSchema.index({ location: '2dsphere' })

storeSchema.pre('save', async function (next) {
  if (!this.isModified('name')) {
    next() // skip it
    return // stop this function from running
  }

  this.slug = slug(this.name)

  const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i')
  const storesWithSlug = await this.constructor.find({ slug: slugRegEx })

  if (storesWithSlug.length) {
    this.slug = `${this.slug}-${storesWithSlug.length + 1}`
  }

  next() 
  // TODO make more resilient so slugs are unique
})

storeSchema.statics.getTagsList = function () {
  return this.aggregate([
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ])
}

storeSchema.statics.getTopStores = function () {
  return this.aggregate([
    // Lookup Stores and populate their reviews
    {
      $lookup: {
        from: 'reviews', // what model to link?
        localField: '_id', // which field on the store?
        foreignField: 'store', // which field on the review?
        as: 'reviews' // add a new field name
      }
    },
    // filter for only items that have 2 or more reviews
    {
      $match: {
        'reviews.1': { $exists: true } // verify if exists a second review in the new Store's review field
      }
    },
    // Add the average reviews field
    {
      $project: { // add a field to the actual one
        photo: '$$ROOT.photo', // $$ROOT means: the original document which is 'Store'
        name: '$$ROOT.name', // $$ROOT means: the original document which is 'Store'
        reviews: '$$ROOT.reviews', // $$ROOT means: the original document which is 'Store'
        slug: '$$ROOT.slug', // $$ROOT means: the original document which is 'Store'
        averageRating: { $avg: '$reviews.rating' } // set the average to the new field 'averageRating'
      }
    },
    // sort it by our new field, highest reviews first
    {
      $sort: { averageRating: -1 }
    },
    // limit to at most 10
    {
      $limit: 10
    }
  ])
}

// find reviews where the stores _id property === reviews store property
storeSchema.virtual('reviews', {
  ref: 'Review', // what model to link?
  localField: '_id', // which field on the store?
  foreignField: 'store' // which field on the review?
})

function autopopulate (next) {
  this.populate('reviews')
  next()
}

storeSchema.pre('find', autopopulate)
storeSchema.pre('findOne', autopopulate)

module.exports = mongoose.model('Store', storeSchema)
