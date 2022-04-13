import version from "./config/version.js";
import env from "./config/env.js";
import { ErrorReportingConfig } from "./config/env-loader.js";
import StackdriverErrorReporter from "stackdriver-errors-js";

console.log("Initializing error reporting at " + window.location.hostname);
// Disable on localhost
const enableErrorReporting =
  window.location.hostname === "localhost" ? false : true;
var loadedCustomErrorLogging;
var prevConsoleError;
var errorHandler = new StackdriverErrorReporter();

errorHandler.start({
  key: ErrorReportingConfig.apiKey,
  projectId: ErrorReportingConfig.projectId,
  service: env.build_target,
  version: version.commit,
  reportUncaughtExceptions: true,
  reportUnhandledPromiseRejections: true,
  disabled: !enableErrorReporting,
  //context: {}, // Additional tags to add in every error report
});

// Override console.error function to automatically report errors
if (enableErrorReporting && !loadedCustomErrorLogging) {
  console.log("Registering error reporting hooks");
  loadedCustomErrorLogging = true;
  prevConsoleError = console.error.bind(console);

  console.error = function () {
    var message,
      slicedArgs = Array.prototype.slice.call(arguments);
    var errorObj;
    try {
      message = slicedArgs.join(" ");
      // Fetch first error object found in arguments
      for (const argument of slicedArgs) {
        if (argument instanceof Error) {
          errorObj = argument;
          break;
        }
      }
    } catch (err) {}

    if (errorObj === undefined) {
      errorObj = new Error(message);
    } else {
      errorObj.message = message;
    }
    errorHandler.report(errorObj, { skipLocalFrames: 2 });
    // Call existing function
    prevConsoleError.apply(console, arguments);
  };
}
export default errorHandler;
