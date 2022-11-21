const path = require('path');
const express = require('express');
const morgan = require('morgan'); //to get info about our request ex:- GET /api/v1/tours 200 2.964 ms - 8744 (logger)
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanatize = require('express-mongo-sanitize');
const XSS = require('xss-clean');
const hpp = require('hpp');
const compression = require('compression');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');

const app = express();

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

//1) Global Middlewares

//serving static files
//app.use(express.static(`${__dirname}/public`)); //serving static files
app.use(express.static(path.join(__dirname, 'public')));

//security HTTP headers
app.use(helmet());

//Development logging
//console.log(process.env.NODE_ENV);
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev')); //param middleware
}

//LIMIT REQ FROM SAME API
//100 REQ FROM SAME IP IN 1 HR
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many request from this ip, please try again in an hour'
});

app.use('/api', limiter);

//Body parser, reading data from the body into req.body
app.use(express.json({ limit: '10kb' }));

//Data Sanitization against nosql query injection
app.use(mongoSanatize());

//Data Sanitization against cross side scripting attacks (XSS)
app.use(XSS());

//prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price'
    ] //fields for which duplication is allowed or parameter pollution is allowed
  })
);

app.use(compression()); //only works for text

// app.use((req, res, next) => {
//   // console.log('hello from middleware');
//   next(); //should be included to complete the req res cycle
// });

//test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  //console.log(req.headers);
  next();
});

//3) Routes

app.use('/api/v1/tours', tourRouter); //sub application or mini app (mounting a router - mounting a new router on a route)
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);

app.all('*', (req, res, next) => {
  //a url that dosent exist is entered
  // const err = new Error(`can't fint ${req.originalUrl} on this server`);
  // err.status = 'fail';
  // err.statusCode = 404;
  next(new AppError(`can't find ${req.originalUrl} on this server`, 404)); //if we pass anything in next it will assume it as error an skip other middlewares and send the err to global err middleware
});

app.use(globalErrorHandler);

module.exports = app;

