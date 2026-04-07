const logAdminAudit = ({ action, req, statusCode, target = null, details = null }) => {
  const adminId = String((req.user && req.user._id) || "unknown");
  const detailSuffix = details ? ` details=${JSON.stringify(details)}` : "";
  const targetSuffix = target ? ` target=${target}` : "";

  console.info(
    `[AUDIT] action=${action} adminId=${adminId} method=${req.method || "unknown"} path=${req.originalUrl || req.url || "unknown"} status=${statusCode}${targetSuffix}${detailSuffix}`
  );
};

const auditAdminAction = (action, options = {}) => (req, res, next) => {
  res.on("finish", () => {
    if (!req.user || !req.user.isAdmin) {
      return;
    }

    const target = options.getTarget ? options.getTarget(req, res) : null;
    const details = options.getDetails ? options.getDetails(req, res) : null;
    logAdminAudit({
      action,
      req,
      statusCode: res.statusCode,
      target,
      details,
    });
  });

  return next();
};

module.exports = {
  auditAdminAction,
  logAdminAudit,
};
