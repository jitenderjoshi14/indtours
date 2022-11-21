const mongoose = require('mongoose');
const slugify = require('slugify');
const validator = require('validator');
//const User = require('./userModel');
const tourSchema = new mongoose.Schema(
  {
    //Schema
    name: {
      type: String, //schema type options
      required: [true, 'A tour must have a Name'], //validator
      unique: true,
      trim: true,
      maxlength: [40, 'A tour name must have less or equal then 40 chars'], //validator
      minlength: [10, 'A tour name must have more or equal then 10 chars'] //validator
      // validate: [validator.isAlpha, 'Tour name must only contain chars'] //cant use as it dont  take spaces (can be used to validate emails)
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have a Duration']
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a Group Size']
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a Difficulty'], //validator
      enum: {
        //validator
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either easy, medium or difficult'
      }
    },

    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'], //validator
      max: [5, 'Rating must be below 5.0'], //validator
      set: val => Math.round(val * 10) / 10
      //will run each time a new val is set for this field(ratingsAverage)
    },
    ratingsQuantity: {
      type: Number,
      default: 0
    },

    price: {
      type: Number,
      required: [true, 'A tour must have a Price']
    },
    priceDiscount: {
      type: Number, //custom validator
      validate: {
        // this only points to current doc on New document creation
        validator: function(val) {
          return val < this.price;
        },
        message: 'Discount price ({VALUE}) should be below the regular price'
      }
    },

    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a Summary']
    },
    description: {
      type: String,
      trim: true
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image']
    },

    images: [String],
    createdAt: {
      type: Date,
      default: Date.now()
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false
    },
    startLocation: {
      //GeoJSON - to specify geospatial data
      //embeded object
      type: {
        type: String,
        default: 'Point',
        enum: ['Point']
      },
      coordinates: [Number], //(longi, lati)
      address: String,
      description: String
    },
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point']
        },
        coordinates: [Number], //(longi, lati)
        address: String,
        description: String,
        day: Number
      }
    ],

    // guides: Array //array of user ids that are guides (while embedding was used)

    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      }
    ]
  },
  //option object
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

//indexing (simple or single field index)
// tourSchema.index({ price: 1 }); // 1: ascending  -1: descending

//compound index
tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: '2dsphere' }); //2d sphere index for geo spatial data

tourSchema.virtual('durationWeeks').get(
  //virtual properties cannot be used in a query
  function() {
    return this.duration / 7;
  }
);

//virtual populate
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id'
});

//mongoose middleware - pre and post hooks (can be used b/w events or before or after)
//types - 1) document 2) query 3) aggregate 4) model

//document middleware: runs before .save() and .create()
tourSchema.pre('save', function(next) {
  //pre-save hook or middlevare
  this.slug = slugify(this.name, { lower: true }); //this will be the document obj
  next();
});

// tourSchema.post('save', function(doc, next) {
//   //post will run afte all pre middleware func have completed - post save hook or middleware
//   console.log(doc);

//   next();
// });

//For embedding guides into tours (how embedding works)
// tourSchema.pre('save', async function(next) {
//   const guidesPromises = this.guides.map(async id => await User.findById(id)); //array of promises returned by map
//   this.guides = await Promise.all(guidesPromises); //array of resolved promise (user data)
//   next();
// });

//QUERY MIDDLEWARE
tourSchema.pre(/^find/, function(next) {
  this.find({
    secretTour: { $ne: true }
  });
  this.start = Date.now(); //this will be query object
  next();
});

//Populating docs
tourSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt'
  });

  next();
});

tourSchema.post(/^find/, function(docs, next) {
  // console.log(docs);
  // console.log(`Qurey took ${Dtae.now() - this.start} millisecond`);
  next();
});

//Aggregation MIDDLEWARE (commenting to make geoNear operator work)
// tourSchema.pre('aggregate', function(next) {
//   this.pipeline().unshift({ $match: { secretTour: { $ne: true } } }); // this will be arrgegation object
//   next();
// });

const Tour = mongoose.model('Tour', tourSchema); //mongoose Model

module.exports = Tour;

//this model will be use to crete data, get data, edit data and delete data using controllers (tourCpntroller).
