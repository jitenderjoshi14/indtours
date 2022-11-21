const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'A user must have a name']
  },

  email: {
    type: String,
    required: [true, 'A user must have a e-mail'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email']
  },

  photo: {
    type: String
  },
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'], //validator to allow certain tyopes of roles
    default: 'user'
  },

  password: {
    type: String,
    required: [true, 'please provide a password'],
    minlength: 8,
    select: false //this.password will not be available (psswd will not be available to any o/p to client);
  },

  passwordConfirm: {
    type: String,
    required: [true, 'please confirm your password'],
    validate: {
      //this only works on Create and SAVE!!! - to update a user we have to use save as well and not findOne or update
      validator: function(el) {
        //this callback will be called when new doc is created
        return el === this.password;
      },
      message: 'Passwords are not the same'
    }
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false
  }
});

//Encrypting password before saving it to DB while signUp.
//mongoose middleware- document
userSchema.pre('save', async function(next) {
  //only run this func if passw was actually modified
  if (!this.isModified('password')) return next(); //this refer to the current user

  //hash the psswd with the cost of 12
  this.password = await bcrypt.hash(this.password, 12); //encryption

  //delete the passwordConfirm field
  this.passwordConfirm = undefined;
  next();
});

//what to do if password is reset
userSchema.pre('save', function(next) {
  if (!this.isModified('password') || this.isNew) return next();
  //isNew - if the document is new
  this.passwordChangedAt = Date.now() - 1000;
  //sometimes saving to db is slower than issuing the JSON web token
  //-1000 is done to make sure the token is not created before the password is changed it is generated after the password is changed
  next();
});

userSchema.pre(/^find/, function(next) {
  //this points to the current query
  this.find({ active: { $ne: false } });
  next();
});

//instance method - a method that is gona be available on all documents of a certain collection
userSchema.methods.correctPassword = async function(
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    //this always points to the current document in an instance method
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    // console.log(changedTimstamp, JWTTimestamp);
    return JWTTimestamp < changedTimestamp;
  }

  // False means NOT changed
  return false;
};

userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex'); //creating token
  //encrypting the token
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

 // console.log({ resetToken }, this.passwordResetToken);

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;

//Authentication :- never store plain psswds in a database (encrypt it always)

//JWT - stateless sol for authentication, no need to store any session state on the server. (RESTfull APIs should always be stateless[no session state]).
