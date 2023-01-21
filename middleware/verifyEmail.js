module.exports = async (req, res, next) => {
  if (req.decoded.user.email !== req.query.email) {
    return res.status(403).json({ message: "Unauthorized Access" });
  }
  next();
};
