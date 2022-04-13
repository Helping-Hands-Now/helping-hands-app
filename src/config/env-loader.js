var env = require("./env.js");
var version = require("./version.js");

console.log(env.build_target);

if (env.build_target === "helping-hands-community") {
  module.exports = require("./prod");
} else if (env.build_target === "helping-hands-development") {
  console.log("Welcome to Helping Hands Development! Have a nice day :)");
  module.exports = require("./dev");
} else {
  throw new Error("No build_target detected!");
}
