const { Session, Profile } = require("./models");

const getToken = (req) => {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return req.headers["x-session-token"] || "";
};

const requireAuth = async (req, res, next) => {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: "Authentication required" });

    const session = await Session.findOne({ token, expiresAt: { $gt: new Date() } });
    if (!session) return res.status(401).json({ error: "Session expired or invalid" });

    const profile = await Profile.findById(session.profileId);
    if (!profile) {
      await Session.deleteOne({ _id: session._id });
      return res.status(401).json({ error: "Profile not found for session" });
    }

    req.session = session;
    req.profile = profile;
    next();
  } catch (error) {
    res.status(500).json({ error: "Authentication failed", details: error.message });
  }
};

module.exports = { requireAuth };
