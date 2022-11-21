class AppError extends Error {
  constructor(message, statusCode) {
    //called every time a obj is created out of this class
    super(message); //parent call (Error) - message is set to the Error as a messsage property

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor); // the constructor call when a obj is created will not be the part of the stack trace
  }
}

module.exports = AppError;
