// come into effect when the user set production to true in .env file
exports.upload_files = async (req, res, next) => {
    try {
      res.status(200).json({"progress": 0});
    } catch (error) {
      next(error);
    }
  }