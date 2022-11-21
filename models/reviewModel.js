const Tour = require('./tourModel');
// review / rating / createdAt / ref to tour / ref to user
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review can not be empty!']
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour.']
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user']
    }
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

//one user cannot write multiple reviews for the same tour
reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

//dont want to populate tour on every review
// reviewSchema.pre(/^find/, function(next) {
//   this.populate({
//     path: 'tour',
//     select: 'name'
//   });

//   this.populate({
//     path: 'user',
//     select: 'name photo'
//   });

//   next();
// });

reviewSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'user',
    select: 'name photo'
  });

  next();
});

//implementing calculation of ratings average according to the ratings every tour holds (for overview page)
//static method
reviewSchema.statics.calcAverageRatings = async function(tourId) {
  //this points to current model
  //console.log(tourId);
  const stats = await this.aggregate([
    {
      $match: { tour: tourId }
    },
    {
      $group: {
        _id: '$tour',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' }
      }
    }
  ]);
  // console.log(stats, 'stats');
  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5
    });
  }
};

//post middleware dosent get access to next()
reviewSchema.post('save', function() {
  //this points to current review (document) and constructor is the Model (Review) that created the document.
  this.constructor.calcAverageRatings(this.tour);
});

//findByIdAndUpdate
//findByIdAndDelete
reviewSchema.pre(/^findOneAnd/, async function(next) {
  //this is the current query but we need document so we run the query and can access current document(using id) using r (review object)
  //we dont use post because we will not have access to current query (r)
  this.r = await this.findOne(); //this.r is used to pass r to the post middleware
  // console.log(this.r, 'rrr');

  next();
});

reviewSchema.post(/^findOneAnd/, async function() {
  //above query is executed and review is being updated at this point
  //await this.findOne() does not work here, query has already executed
  await this.r.constructor.calcAverageRatings(this.r.tour);
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
