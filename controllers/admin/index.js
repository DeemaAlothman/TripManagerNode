module.exports = {
  // users
  ...require("./users"),
  // bus types & seats
  ...require("./busTypes"),
  // trips (read-only for admin per متطلباتك)
  ...require("./trips"),
  // security logs
  ...require("./securityLogs"),
//profile
  ...require("./self"),
};
