const { promisify } = require('util');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const jwt = require('jsonwebtoken');
const AppError = require('./../utils/appError');
const sendEmail = require('./../utils/email');
const crypto = require('crypto');

const signToken = id => {
  return jwt.sign({ id: id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true //cookie cannot be accessed and  modified by the browser
  };

  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  //Remove the password from o/p
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user: user
    }
  });
};

//SIGNUP
exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create(req.body);
  // {
  //   //to use only required fields for signup from User schema(only this data will be allowed from the client to form a new user)
  //   name: req.body.name,
  //   email: req.body.email,
  //   password: req.body.password,
  //   passwordConfirm: req.body.passwordConfirm,
  //   role: req.body.role,

  // }

  createSendToken(newUser, 201, res);
});

//LOGIN
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  //1) Check if email and psswd exists

  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }

  //2) Check if the user exists && passwd is correct
  const user = await User.findOne({ email }).select('+password'); //as psswd select property is false so we have to explicitly select psswd to include it to find user.
  //user is the current document
  if (!user || !(await user.correctPassword(password, user.password))) {
    //using the instance method in userModel here
    return next(new AppError('Incorrect email or password', 401));
  }
  // 3) if everything is ok, send token to client
  createSendToken(user, 200, res);
});
//for a best signature for jwt use 32 char for high security

//will protect the tours from the user not logged in
exports.protect = catchAsync(async (req, res, next) => {
  //1) getting the token and check if it exists
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  //console.log(token);

  if (!token) {
    return next(
      new AppError('You are not logged in please login to get access', 401)
    );
  }
  //2) Verification token   [validate the token (jwt algo matches the token is valid or not)]
  //to check if someone manipulated the data or the token is expired
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET); //using the promisify inbuilt function to return a promise which can be awaited
  //console.log(decoded);
  // 3) check if the user exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError('The user belongs to this token no longer exists', 401)
    );
  }

  //4)check if user changes password after the jwt token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('user recently changed password! please login again', 401)
    );
  }

  //GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  next();
});

exports.restrictTo = (...roles) => {
  //...roleas = rest parameter
  return (req, res, next) => {
    //roles is an array ['admin', 'lead-guide']. role is now just user role = 'user'
    //the return functin will get access to roles because there is a closure
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      ); //forbidden
    }
    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with email address.', 404));
  }

  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });
  console.log('are we entering here');
  //deactivate all validators in our schema that are required for a post request (to save the expired time and encrypted reset token in schema)

  // 3) Send it to user's email
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`;

  console.log(resetURL, 'resetURL');

  const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}.\nIf you didn't forget your password, please ignore this email!`;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Your password reset token (valid for 10 min)',
      message
    });

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!'
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError('There was an error sending the email. Try again later!'),
      500
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto //comparing this token with the encrypted one in the DB
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save(); //we are using save not update because we want to run the validators and save middleware functions

  // 3) Update changedPasswordAt property for the user
  // 4) Log the user in, send JWT
  createSendToken(user, 200, res);
});
//token header convention - Authorization : Bearer tokenvalue

exports.updatePassword = catchAsync(async (req, res, next) => {
  //ask for current password before updating
  //1) Get user from the collection
  const user = await User.findById(req.user.id).select('+password');

  //2)Check if the posted psswd is correctPassword
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong', 401));
  }

  //3)If so update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save(); //here we want the validation

  //4)Log user in, send JWT
  createSendToken(user, 200, res);
});
