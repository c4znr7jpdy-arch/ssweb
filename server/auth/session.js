function establishSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate(error => {
      if (error) return reject(error);
      req.session.userId = userId;
      req.session.save(saveError => (saveError ? reject(saveError) : resolve()));
    });
  });
}

module.exports = { establishSession };
